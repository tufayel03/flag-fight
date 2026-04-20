import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { spawn, ChildProcess } from "child_process";
import { Writable } from "stream";
import ffmpegStatic from "ffmpeg-static";
import path from "path";
import { GameEngine } from "./game-engine.js";

const ffmpegPath = ffmpegStatic as string;

// ─── Server-side audio: PCM beep on bounce ────────────────────────────────────
const SAMPLE_RATE = 44100;
const AUDIO_CHANNELS = 2;
const BYTES_PER_SAMPLE = 2; // s16le
const AUDIO_FPS = 30;  // send one chunk per video frame
const FRAMES_PER_CHUNK = Math.floor(SAMPLE_RATE / AUDIO_FPS); // 1470 frames
const CHUNK_BYTES = FRAMES_PER_CHUNK * AUDIO_CHANNELS * BYTES_PER_SAMPLE; // 5880 bytes
const SILENCE_CHUNK = Buffer.alloc(CHUNK_BYTES, 0);

function generateBeep(freq = 440, durationMs = 90, amplitude = 0.38): Buffer {
  const numFrames = Math.floor(SAMPLE_RATE * durationMs / 1000);
  const buf = Buffer.alloc(numFrames * AUDIO_CHANNELS * BYTES_PER_SAMPLE);
  const attackF = Math.floor(SAMPLE_RATE * 0.005);   // 5ms attack
  const releaseF = Math.floor(SAMPLE_RATE * 0.025);  // 25ms release
  for (let i = 0; i < numFrames; i++) {
    const env = i < attackF ? i / attackF
              : i > numFrames - releaseF ? (numFrames - i) / releaseF
              : 1.0;
    const s = Math.max(-32768, Math.min(32767, Math.floor(amplitude * env * 32767 * Math.sin(2 * Math.PI * freq * i / SAMPLE_RATE))));
    const pos = i * AUDIO_CHANNELS * BYTES_PER_SAMPLE;
    buf.writeInt16LE(s, pos);      // left
    buf.writeInt16LE(s, pos + 2);  // right
  }
  return buf;
}

const BEEP_BUF = generateBeep(440, 90);

// Pending audio buffers to mix into the next chunks
let pendingBeeps: Buffer[] = [];
let pendingBeepOffset = 0;
let audioLoopTimer: ReturnType<typeof setInterval> | null = null;

function mixNextChunk(): Buffer {
  if (pendingBeeps.length === 0) return SILENCE_CHUNK;
  const out = Buffer.from(SILENCE_CHUNK); // copy of silence
  let written = 0;
  while (written < CHUNK_BYTES && pendingBeeps.length > 0) {
    const src = pendingBeeps[0];
    const toWrite = Math.min(src.length - pendingBeepOffset, CHUNK_BYTES - written);
    for (let i = 0; i < toWrite; i += 2) {
      const existing = out.readInt16LE(written + i);
      const incoming = src.readInt16LE(pendingBeepOffset + i);
      out.writeInt16LE(Math.max(-32768, Math.min(32767, existing + incoming)), written + i);
    }
    written += toWrite;
    pendingBeepOffset += toWrite;
    if (pendingBeepOffset >= src.length) { pendingBeeps.shift(); pendingBeepOffset = 0; }
  }
  return out;
}

// ─── Singleton game engine ────────────────────────────────────────────────────
const gameEngine = new GameEngine();
console.log("Game engine ready.");

// ─── Streaming state ──────────────────────────────────────────────────────────
type StreamQuality = "480p" | "720p" | "1080p";
const QUALITY_PRESETS: Record<StreamQuality, { resolution: string, bitrate: string, bufsize: string }> = {
  "480p": { resolution: "480x854", bitrate: "1000k", bufsize: "2000k" },
  "720p": { resolution: "720x1280", bitrate: "3000k", bufsize: "6000k" },
  "1080p": { resolution: "1080x1920", bitrate: "6000k", bufsize: "12000k" },
};

let currentQuality: StreamQuality = "720p";
let ffmpegProc: ChildProcess | null = null;
let isStreaming = false;
let storedRtmpUrl = "";
let streamStartToken = 0;

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
        data.items.forEach((item: any) => {
          const snippet = item.snippet || {};
          const authorDetails = item.authorDetails || {};
          const author = (authorDetails.displayName || "Viewer").trim();
          const avatarUrl = authorDetails.profileImageUrl || null;
          const channelId = authorDetails.channelId || snippet.authorChannelId || author;
          const spawned = gameEngine.spawnPlayer({
            id: String(channelId),
            name: author,
            avatarUrl,
          });
          if (spawned) gameEngine.addChatMessage(author, snippet.displayMessage || "joined");
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
import { lookup } from "dns";
import { promisify } from "util";
const dnsLookup = promisify(lookup);

async function resolveRtmpUrl(rtmpUrl: string): Promise<string> {
  try {
    const url = new URL(rtmpUrl);
    const { address } = await dnsLookup(url.hostname, 4);
    console.log(`Resolved ${url.hostname} → ${address}`);
    url.hostname = address;
    return url.toString();
  } catch (e) {
    console.warn("DNS pre-resolve failed, using original URL:", e);
    return rtmpUrl;
  }
}

function cleanupFfmpegProcess(proc: ChildProcess) {
  const onFrame = (proc as any)._onFrame;
  if (onFrame) {
    gameEngine.off("frame", onFrame);
    (proc as any)._onFrame = null;
  }

  const onBounce = (proc as any)._onBounce;
  if (onBounce) {
    gameEngine.off("bounce", onBounce);
    (proc as any)._onBounce = null;
  }

  if (ffmpegProc === proc) {
    if (audioLoopTimer) {
      clearInterval(audioLoopTimer);
      audioLoopTimer = null;
    }
    pendingBeeps = [];
    pendingBeepOffset = 0;
  }
}

function stopFfmpegProcess() {
  const proc = ffmpegProc;
  if (!proc) return;

  (proc as any)._intentionalStop = true;
  cleanupFfmpegProcess(proc);

  try {
    const videoIn = proc.stdio[0] as Writable;
    if (!videoIn.destroyed) videoIn.end();
    const audioIn = proc.stdio[3] as Writable;
    if (audioIn && !audioIn.destroyed) audioIn.end();
    proc.kill("SIGKILL");
  } catch (_) {}

  if (ffmpegProc === proc) ffmpegProc = null;
}

function endLiveSession(error?: string) {
  isStreaming = false;
  stopYouTubePolling();
  gameEngine.stopAndReset();
  broadcastToAll({ type: "streamStatus", isStreaming: false, ...(error ? { error } : {}) });
}

function handleFfmpegExit(proc: ChildProcess, error?: string) {
  if ((proc as any)._handledExit) return;
  (proc as any)._handledExit = true;

  cleanupFfmpegProcess(proc);
  if (ffmpegProc === proc) ffmpegProc = null;

  if ((proc as any)._intentionalStop) return;
  if (isStreaming) endLiveSession(error);
}

async function startStream(rtmpUrl: string) {
  const startToken = ++streamStartToken;
  if (ffmpegProc) stopFfmpegProcess();

  storedRtmpUrl = rtmpUrl;

  // Pre-resolve hostname so ffmpeg-static (static musl binary) doesn't hit
  // systemd-resolved DNS stub (127.0.0.53) which static binaries can't use
  const resolvedUrl = await resolveRtmpUrl(rtmpUrl);
  if (startToken !== streamStartToken) {
    console.log("Stream start cancelled before FFmpeg launch.");
    return;
  }
  console.log("Streaming to:", resolvedUrl);

  const args = [
    "-f", "image2pipe",
    "-framerate", "30",
    "-i", "pipe:0",
    // Real-time PCM audio from Node.js (pipe:3 = fd 3)
    "-f", "s16le", "-ar", String(SAMPLE_RATE), "-ac", String(AUDIO_CHANNELS),
    "-i", "pipe:3",
    "-vcodec", "libx264",
    "-preset", "veryfast",
    "-vf", `scale=${QUALITY_PRESETS[currentQuality].resolution}`,
    "-pix_fmt", "yuv420p",
    "-b:v", QUALITY_PRESETS[currentQuality].bitrate,
    "-maxrate", QUALITY_PRESETS[currentQuality].bitrate,
    "-bufsize", QUALITY_PRESETS[currentQuality].bufsize,
    "-g", "60",
    "-acodec", "aac",
    "-b:a", "128k",
    "-ac", "2",
    "-map", "0:v",
    "-map", "1:a",
    "-f", "flv",
    resolvedUrl,
  ];

  // stdio: [pipe:0 video, ignore stdout, pipe:2 stderr, pipe:3 audio]
  ffmpegProc = spawn(ffmpegPath, args, {
    stdio: ["pipe", "ignore", "pipe", "pipe"],
  });
  const proc = ffmpegProc;

  const videoIn = proc.stdio[0] as Writable;
  const audioIn = proc.stdio[3] as Writable;

  videoIn.on("error", (err) => {
    console.error("FFmpeg video stdin error:", err.message);
  });

  (proc.stdio[2] as NodeJS.ReadableStream).on("data", (chunk: Buffer) => {
    process.stderr.write("[ffmpeg] " + chunk.toString());
  });

  proc.on("close", (code) => {
    console.log(`FFmpeg exited with code ${code}`);
    handleFfmpegExit(proc, `FFmpeg exited (code ${code})`);
  });

  proc.on("error", (err) => {
    console.error("FFmpeg process error:", err.message);
    handleFfmpegExit(proc, err.message);
  });

  isStreaming = true;
  console.log(`FFmpeg stream started → ${rtmpUrl}`);

  // ── Video feed: pipe JPEG frames from game engine → FFmpeg stdin (pipe:0) ──
  const onFrame = (jpeg: Buffer) => {
    if (ffmpegProc === proc && !videoIn.destroyed) {
      try { videoIn.write(jpeg); } catch (_) {}
    }
  };
  gameEngine.on("frame", onFrame);
  (proc as any)._onFrame = onFrame;

  // ── Audio feed: send 30fps chunks of PCM (silence + beeps) → pipe:3 ──
  pendingBeeps = [];
  pendingBeepOffset = 0;
  audioLoopTimer = setInterval(() => {
    if (!audioIn.destroyed) {
      try { audioIn.write(mixNextChunk()); } catch (_) {}
    }
  }, 1000 / AUDIO_FPS);

  // ── On bounce, queue a beep ──
  const onBounce = () => { pendingBeeps.push(Buffer.from(BEEP_BUF)); };
  gameEngine.on("bounce", onBounce);
  (proc as any)._onBounce = onBounce;

  gameEngine.start();
}

function stopStream() {
  streamStartToken++;
  stopFfmpegProcess();
  endLiveSession();
  console.log("Stream and game stopped.");
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

// Forward bounce events to browser clients so they can play a sound
gameEngine.on("bounce", () => {
  broadcastToAll({ type: "bounce" });
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
    ws.send(JSON.stringify({ type: "state", ...gameEngine.getState(), isStreaming, currentQuality }));

    ws.on("message", (raw, isBinary) => {
      if (isBinary) return;
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
          case "login": {
            const ok = msg.email === "admin@bidnsteal.com" && msg.password === "Tufayel54321";
            ws.send(JSON.stringify({ type: "loginResult", success: ok }));
            break;
          }

          case "setCredentials": {
            ytApiKey = (msg.youtubeApiKey || "").trim();
            ytVideoId = (msg.youtubeVideoId || "").trim();
            console.log("Credentials stored. YT API key set:", !!ytApiKey, "| VideoId:", ytVideoId || "(none)");
            ws.send(JSON.stringify({ type: "credentialsOk" }));
            // If stream is already running, kick off YouTube polling now
            if (isStreaming && ytApiKey && ytVideoId && !ytChatId) {
              console.log("Stream is live — starting YouTube polling with new credentials");
              startYouTubePolling();
            }
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

          case "changeQuality": {
            currentQuality = msg.quality;
            console.log("Stream quality updated to:", currentQuality);
            if (isStreaming && storedRtmpUrl) {
              console.log("Restarting stream to apply new quality settings...");
              startStream(storedRtmpUrl);
            }
            break;
          }

          case "stopStream": {
            stopStream();
            break;
          }

          case "spawnPlayer":
          case "spawnFlag": {
            const name = (msg.name || msg.country || "").trim();
            const spawned = gameEngine.spawnPlayer({
              id: `admin:${name.toLowerCase()}`,
              name,
            });
            if (spawned) gameEngine.addChatMessage(name || msg.user || "Admin", "joined");
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
