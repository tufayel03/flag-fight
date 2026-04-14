import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import path from "path";
import { GameEngine, COUNTRIES } from "./game-engine.js";

const ffmpegPath = ffmpegStatic as string;

// ─── Singleton game engine ────────────────────────────────────────────────────
const gameEngine = new GameEngine();
console.log("Game engine started.");

// ─── Streaming state ──────────────────────────────────────────────────────────
let ffmpegProc: ChildProcessWithoutNullStreams | null = null;
let isStreaming = false;
let storedRtmpUrl = "";

// ─── YouTube chat polling state ───────────────────────────────────────────────
let ytApiKey = "";
let ytVideoId = "";
let ytChatId = "";
let ytNextPageToken = "";
let ytPollTimeout: ReturnType<typeof setTimeout> | null = null;

function startYouTubePolling() {
  if (!ytApiKey || !ytVideoId) return;

  const fetchChatId = async () => {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${ytVideoId}&key=${ytApiKey}`
      );
      const data = await res.json();
      if (data.items?.[0]?.liveStreamingDetails?.activeLiveChatId) {
        ytChatId = data.items[0].liveStreamingDetails.activeLiveChatId;
        console.log("YouTube live chat ID found:", ytChatId);
        pollChat();
      } else {
        console.error("No active YouTube live chat found for video:", ytVideoId);
      }
    } catch (e) {
      console.error("Error fetching YouTube chat ID:", e);
    }
  };

  const pollChat = async () => {
    if (!ytChatId || !ytApiKey) return;
    try {
      let url = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${ytChatId}&part=snippet,authorDetails&key=${ytApiKey}`;
      if (ytNextPageToken) url += `&pageToken=${ytNextPageToken}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.items?.length > 0) {
        const sortedCountries = Object.keys(COUNTRIES).sort((a, b) => b.length - a.length);
        data.items.forEach((item: any) => {
          const msg = item.snippet.displayMessage.toLowerCase();
          const author = item.authorDetails.displayName;
          const match = sortedCountries.find((c) => msg.includes(c));
          if (match) {
            gameEngine.addChatMessage(author, match);
            gameEngine.spawnFlag(match);
          }
        });
      }
      ytNextPageToken = data.nextPageToken || "";
      const interval = data.pollingIntervalMillis || 5000;
      ytPollTimeout = setTimeout(pollChat, interval);
    } catch (e) {
      console.error("YouTube poll error:", e);
      ytPollTimeout = setTimeout(pollChat, 5000);
    }
  };

  fetchChatId();
}

function stopYouTubePolling() {
  if (ytPollTimeout) { clearTimeout(ytPollTimeout); ytPollTimeout = null; }
  ytChatId = "";
  ytNextPageToken = "";
}

// ─── FFmpeg stream management ──────────────────────────────────────────────────
function startStream(rtmpUrl: string) {
  if (ffmpegProc) { stopStream(); }

  storedRtmpUrl = rtmpUrl;

  const args = [
    "-f", "image2pipe",
    "-framerate", "30",
    "-i", "pipe:0",
    // Generate silent audio
    "-f", "lavfi",
    "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-vcodec", "libx264",
    "-preset", "veryfast",
    "-pix_fmt", "yuv420p",
    "-maxrate", "2500k",
    "-bufsize", "5000k",
    "-g", "60",
    "-acodec", "aac",
    "-b:a", "128k",
    "-ac", "2",
    "-map", "0:v",
    "-map", "1:a",
    "-f", "flv",
    rtmpUrl,
  ];

  ffmpegProc = spawn(ffmpegPath, args);

  ffmpegProc.stdin.on("error", (err) => {
    console.error("FFmpeg stdin error:", err.message);
  });

  ffmpegProc.stderr.on("data", (chunk) => {
    process.stderr.write("[ffmpeg] " + chunk.toString());
  });

  ffmpegProc.on("close", (code) => {
    console.log(`FFmpeg exited with code ${code}`);
    ffmpegProc = null;
    if (isStreaming) {
      isStreaming = false;
      broadcastToAll({ type: "streamStatus", isStreaming: false, error: `FFmpeg exited (code ${code})` });
    }
  });

  ffmpegProc.on("error", (err) => {
    console.error("FFmpeg process error:", err.message);
    ffmpegProc = null;
    isStreaming = false;
    broadcastToAll({ type: "streamStatus", isStreaming: false, error: err.message });
  });

  isStreaming = true;
  console.log(`FFmpeg stream started → ${rtmpUrl}`);

  // Feed JPEG frames to FFmpeg stdin
  const onFrame = (jpeg: Buffer) => {
    if (ffmpegProc && ffmpegProc.stdin && !ffmpegProc.stdin.destroyed) {
      try { ffmpegProc.stdin.write(jpeg); } catch (_) {}
    }
  };
  gameEngine.on("frame", onFrame);

  // Store cleanup reference
  (ffmpegProc as any)._onFrame = onFrame;
}

function stopStream() {
  if (ffmpegProc) {
    const onFrame = (ffmpegProc as any)._onFrame;
    if (onFrame) gameEngine.off("frame", onFrame);
    try { ffmpegProc.stdin.end(); ffmpegProc.kill("SIGKILL"); } catch (_) {}
    ffmpegProc = null;
  }
  isStreaming = false;
  stopYouTubePolling();
  broadcastToAll({ type: "streamStatus", isStreaming: false });
  console.log("Stream stopped.");
}

// ─── WebSocket broadcast ───────────────────────────────────────────────────────
const adminClients = new Set<WebSocket>();
function broadcastToAll(data: object) {
  const msg = JSON.stringify(data);
  adminClients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

// Forward game state updates to all connected admins
gameEngine.on("stateUpdate", (state) => {
  broadcastToAll({ type: "state", ...state, isStreaming });
});

// ─── HTTP server start ─────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  // ── MJPEG live preview endpoint (watch the game in browser) ──
  app.get("/preview", (req, res) => {
    res.setHeader("Content-Type", "multipart/x-mixed-replace; boundary=--frame");
    res.setHeader("Cache-Control", "no-cache");

    // Send latest frame immediately
    const latest = gameEngine.getLastJpeg();
    if (latest) {
      res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${latest.length}\r\n\r\n`);
      res.write(latest);
      res.write("\r\n");
    }

    const onFrame = (jpeg: Buffer) => {
      if (res.destroyed) return;
      try {
        res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpeg.length}\r\n\r\n`);
        res.write(jpeg);
        res.write("\r\n");
      } catch (_) {}
    };
    gameEngine.on("frame", onFrame);
    req.on("close", () => gameEngine.off("frame", onFrame));
  });

  // ── WebSocket admin protocol ──
  wss.on("connection", (ws) => {
    console.log("Admin client connected");
    adminClients.add(ws);

    // Send current state immediately
    ws.send(JSON.stringify({ type: "state", ...gameEngine.getState(), isStreaming }));

    ws.on("message", (raw, isBinary) => {
      if (isBinary) return;
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
          case "login": {
            const ok = msg.email === "admin@admin.com" && msg.password === "admin123";
            ws.send(JSON.stringify({ type: "loginResult", success: ok }));
            break;
          }

          case "setCredentials": {
            ytApiKey = msg.youtubeApiKey || "";
            ytVideoId = msg.youtubeVideoId || "";
            console.log("Credentials stored. YT API key set:", !!ytApiKey);
            ws.send(JSON.stringify({ type: "credentialsOk" }));
            break;
          }

          case "startStream": {
            if (!msg.rtmpUrl) {
              ws.send(JSON.stringify({ type: "error", message: "No RTMP URL provided" }));
              break;
            }
            startStream(msg.rtmpUrl);
            startYouTubePolling();
            broadcastToAll({ type: "streamStatus", isStreaming: true });
            break;
          }

          case "stopStream": {
            stopStream();
            break;
          }

          case "spawnFlag": {
            const country = (msg.country || "").trim().toLowerCase();
            const spawned = gameEngine.spawnFlag(country);
            if (spawned) gameEngine.addChatMessage(msg.user || "Admin", country);
            break;
          }
        }
      } catch (e) {
        console.error("WS message error:", e);
      }
    });

    ws.on("close", () => {
      adminClients.delete(ws);
      console.log("Admin client disconnected");
    });
  });

  // ── Vite dev or static production serve ──
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (!req.path.startsWith("/preview")) {
        res.sendFile(path.join(distPath, "index.html"));
      }
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
