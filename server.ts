import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer } from "ws";
import http from "http";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import path from "path";

// Set the path to the ffmpeg binary
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Create HTTP server
  const server = http.createServer(app);

  // Create WebSocket server attached to the HTTP server
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    console.log("Client connected to WebSocket");
    let ffmpegCommand: ffmpeg.FfmpegCommand | null = null;

    ws.on("message", (message, isBinary) => {
      if (!isBinary) {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === "start" && data.rtmpUrl) {
            console.log("Starting FFmpeg stream to:", data.rtmpUrl);

            // Initialize FFmpeg
            ffmpegCommand = ffmpeg()
              .input("pipe:0") // Read from stdin
              .inputFormat("webm") // Expect webm from MediaRecorder
              // Video settings
              .videoCodec("libx264")
              .outputOptions([
                "-preset veryfast",
                "-maxrate 2500k",
                "-bufsize 5000k",
                "-pix_fmt yuv420p",
                "-g 60", // Keyframe interval (2 seconds at 30fps)
              ])
              // Audio settings
              .audioCodec("aac")
              .audioBitrate("128k")
              .audioChannels(2)
              // Output format for RTMP
              .format("flv")
              .output(data.rtmpUrl)
              .on("start", (cmd) => {
                console.log("FFmpeg started:", cmd);
              })
              .on("error", (err) => {
                console.error("FFmpeg error:", err.message);
              })
              .on("end", () => {
                console.log("FFmpeg stream ended");
              });

            // Start processing
            ffmpegCommand.run();
          }
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      } else {
        // Binary data (video chunks)
        if (ffmpegCommand) {
          // Write the chunk to FFmpeg's stdin
          // @ts-ignore - fluent-ffmpeg types don't explicitly expose the stdin stream, but it's there
          if (ffmpegCommand.ffmpegProc && ffmpegCommand.ffmpegProc.stdin) {
            // @ts-ignore
            ffmpegCommand.ffmpegProc.stdin.write(message);
          }
        }
      }
    });

    ws.on("close", () => {
      console.log("Client disconnected");
      if (ffmpegCommand) {
        console.log("Killing FFmpeg process");
        ffmpegCommand.kill("SIGKILL");
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
