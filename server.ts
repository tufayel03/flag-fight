import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer } from "ws";
import http from "http";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import path from "path";

const ffmpegPath = ffmpegStatic as string;

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  // Create HTTP server
  const server = http.createServer(app);

  // Create WebSocket server attached to the HTTP server
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    console.log("Client connected to WebSocket");
    let ffmpegProc: ChildProcessWithoutNullStreams | null = null;

    ws.on("message", (message, isBinary) => {
      if (!isBinary) {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === "start" && data.rtmpUrl) {
            console.log("Starting FFmpeg stream to:", data.rtmpUrl);

            const args = [
              "-f", "webm",
              "-i", "pipe:0",
              "-acodec", "aac",
              "-b:a", "128k",
              "-ac", "2",
              "-vcodec", "libx264",
              "-preset", "veryfast",
              "-maxrate", "2500k",
              "-bufsize", "5000k",
              "-pix_fmt", "yuv420p",
              "-g", "60",
              "-f", "flv",
              data.rtmpUrl,
            ];

            ffmpegProc = spawn(ffmpegPath, args);

            // ✅ CRITICAL: Add error handler so stdin write errors don't crash Node
            ffmpegProc.stdin.on("error", (err) => {
              console.error("FFmpeg stdin error (stream likely ended):", err.message);
            });

            // Log FFmpeg output so you can debug issues
            ffmpegProc.stderr.on("data", (chunk) => {
              process.stderr.write("[ffmpeg] " + chunk.toString());
            });

            ffmpegProc.on("close", (code) => {
              console.log(`FFmpeg process exited with code ${code}`);
              ffmpegProc = null;
            });

            ffmpegProc.on("error", (err) => {
              console.error("FFmpeg process error:", err.message);
              ffmpegProc = null;
            });

            console.log("FFmpeg started with args:", args.join(" "));
          }
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      } else {
        // Binary data (video chunks) — write to FFmpeg stdin
        if (ffmpegProc && ffmpegProc.stdin && !ffmpegProc.stdin.destroyed) {
          try {
            ffmpegProc.stdin.write(message as Buffer);
          } catch (err: any) {
            console.error("Error writing to FFmpeg stdin:", err.message);
          }
        }
      }
    });

    ws.on("close", () => {
      console.log("Client disconnected");
      if (ffmpegProc) {
        console.log("Killing FFmpeg process");
        try {
          ffmpegProc.stdin.end();
          ffmpegProc.kill("SIGKILL");
        } catch (_) {}
        ffmpegProc = null;
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
