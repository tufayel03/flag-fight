import { createCanvas, loadImage } from "@napi-rs/canvas";
import type { Canvas, SKRSContext2D, Image } from "@napi-rs/canvas";
import Matter from "matter-js";
import { EventEmitter } from "events";

// ─── Canvas / layout constants ────────────────────────────────────────────────
export const STREAM_W = 1280;
export const STREAM_H = 720;
const GAME_SIZE = 700;
const GAME_X = Math.floor((STREAM_W - GAME_SIZE) / 2); // 290
const GAME_Y = Math.floor((STREAM_H - GAME_SIZE) / 2); // 10
const CENTER_X = GAME_X + GAME_SIZE / 2; // 640
const CENTER_Y = GAME_Y + GAME_SIZE / 2; // 360
const RADIUS = 280;
const TOTAL_SEGMENTS = 60;
const GAP_SEGMENTS = 8;
const FLAG_SPEED = 11;
const FLAG_FORCE = 0.0024;
const FLAG_MAX_SPEED = 11;
const FPS = 30;

// ─── Country map ──────────────────────────────────────────────────────────────
export const COUNTRIES: Record<string, { code: string; emoji: string }> = {
  "afghanistan": { code: "af", emoji: "🇦🇫" }, "albania": { code: "al", emoji: "🇦🇱" }, "algeria": { code: "dz", emoji: "🇩🇿" },
  "andorra": { code: "ad", emoji: "🇦🇩" }, "angola": { code: "ao", emoji: "🇦🇴" }, "argentina": { code: "ar", emoji: "🇦🇷" },
  "armenia": { code: "am", emoji: "🇦🇲" }, "australia": { code: "au", emoji: "🇦🇺" }, "austria": { code: "at", emoji: "🇦🇹" },
  "azerbaijan": { code: "az", emoji: "🇦🇿" }, "bahamas": { code: "bs", emoji: "🇧🇸" }, "bahrain": { code: "bh", emoji: "🇧🇭" },
  "bangladesh": { code: "bd", emoji: "🇧🇩" }, "barbados": { code: "bb", emoji: "🇧🇧" }, "belarus": { code: "by", emoji: "🇧🇾" },
  "belgium": { code: "be", emoji: "🇧🇪" }, "belize": { code: "bz", emoji: "🇧🇿" }, "benin": { code: "bj", emoji: "🇧🇯" },
  "bhutan": { code: "bt", emoji: "🇧🇹" }, "bolivia": { code: "bo", emoji: "🇧🇴" }, "bosnia": { code: "ba", emoji: "🇧🇦" },
  "botswana": { code: "bw", emoji: "🇧🇼" }, "brazil": { code: "br", emoji: "🇧🇷" }, "brunei": { code: "bn", emoji: "🇧🇳" },
  "bulgaria": { code: "bg", emoji: "🇧🇬" }, "burkina faso": { code: "bf", emoji: "🇧🇫" }, "burundi": { code: "bi", emoji: "🇧🇮" },
  "cambodia": { code: "kh", emoji: "🇰🇭" }, "cameroon": { code: "cm", emoji: "🇨🇲" }, "canada": { code: "ca", emoji: "🇨🇦" },
  "cape verde": { code: "cv", emoji: "🇨🇻" }, "chad": { code: "td", emoji: "🇹🇩" }, "chile": { code: "cl", emoji: "🇨🇱" },
  "china": { code: "cn", emoji: "🇨🇳" }, "colombia": { code: "co", emoji: "🇨🇴" }, "comoros": { code: "km", emoji: "🇰🇲" },
  "congo": { code: "cg", emoji: "🇨🇬" }, "costa rica": { code: "cr", emoji: "🇨🇷" }, "croatia": { code: "hr", emoji: "🇭🇷" },
  "cuba": { code: "cu", emoji: "🇨🇺" }, "cyprus": { code: "cy", emoji: "🇨🇾" }, "czech republic": { code: "cz", emoji: "🇨🇿" },
  "denmark": { code: "dk", emoji: "🇩🇰" }, "djibouti": { code: "dj", emoji: "🇩🇯" }, "dominica": { code: "dm", emoji: "🇩🇲" },
  "dominican republic": { code: "do", emoji: "🇩🇴" }, "ecuador": { code: "ec", emoji: "🇪🇨" }, "egypt": { code: "eg", emoji: "🇪🇬" },
  "el salvador": { code: "sv", emoji: "🇸🇻" }, "eritrea": { code: "er", emoji: "🇪🇷" }, "estonia": { code: "ee", emoji: "🇪🇪" },
  "ethiopia": { code: "et", emoji: "🇪🇹" }, "fiji": { code: "fj", emoji: "🇫🇯" }, "finland": { code: "fi", emoji: "🇫🇮" },
  "france": { code: "fr", emoji: "🇫🇷" }, "gabon": { code: "ga", emoji: "🇬🇦" }, "gambia": { code: "gm", emoji: "🇬🇲" },
  "georgia": { code: "ge", emoji: "🇬🇪" }, "germany": { code: "de", emoji: "🇩🇪" }, "ghana": { code: "gh", emoji: "🇬🇭" },
  "greece": { code: "gr", emoji: "🇬🇷" }, "grenada": { code: "gd", emoji: "🇬🇩" }, "guatemala": { code: "gt", emoji: "🇬🇹" },
  "guinea": { code: "gn", emoji: "🇬🇳" }, "guyana": { code: "gy", emoji: "🇬🇾" }, "haiti": { code: "ht", emoji: "🇭🇹" },
  "honduras": { code: "hn", emoji: "🇭🇳" }, "hungary": { code: "hu", emoji: "🇭🇺" }, "iceland": { code: "is", emoji: "🇮🇸" },
  "india": { code: "in", emoji: "🇮🇳" }, "indonesia": { code: "id", emoji: "🇮🇩" }, "iran": { code: "ir", emoji: "🇮🇷" },
  "iraq": { code: "iq", emoji: "🇮🇶" }, "ireland": { code: "ie", emoji: "🇮🇪" }, "italy": { code: "it", emoji: "🇮🇹" },
  "jamaica": { code: "jm", emoji: "🇯🇲" }, "japan": { code: "jp", emoji: "🇯🇵" }, "jordan": { code: "jo", emoji: "🇯🇴" },
  "kazakhstan": { code: "kz", emoji: "🇰🇿" }, "kenya": { code: "ke", emoji: "🇰🇪" }, "kuwait": { code: "kw", emoji: "🇰🇼" },
  "kyrgyzstan": { code: "kg", emoji: "🇰🇬" }, "laos": { code: "la", emoji: "🇱🇦" }, "latvia": { code: "lv", emoji: "🇱🇻" },
  "lebanon": { code: "lb", emoji: "🇱🇧" }, "liberia": { code: "lr", emoji: "🇱🇷" }, "libya": { code: "ly", emoji: "🇱🇾" },
  "liechtenstein": { code: "li", emoji: "🇱🇮" }, "lithuania": { code: "lt", emoji: "🇱🇹" }, "luxembourg": { code: "lu", emoji: "🇱🇺" },
  "madagascar": { code: "mg", emoji: "🇲🇬" }, "malawi": { code: "mw", emoji: "🇲🇼" }, "malaysia": { code: "my", emoji: "🇲🇾" },
  "maldives": { code: "mv", emoji: "🇲🇻" }, "mali": { code: "ml", emoji: "🇲🇱" }, "malta": { code: "mt", emoji: "🇲🇹" },
  "mauritania": { code: "mr", emoji: "🇲🇷" }, "mauritius": { code: "mu", emoji: "🇲🇺" }, "mexico": { code: "mx", emoji: "🇲🇽" },
  "moldova": { code: "md", emoji: "🇲🇩" }, "monaco": { code: "mc", emoji: "🇲🇨" }, "mongolia": { code: "mn", emoji: "🇲🇳" },
  "montenegro": { code: "me", emoji: "🇲🇪" }, "morocco": { code: "ma", emoji: "🇲🇦" }, "mozambique": { code: "mz", emoji: "🇲🇿" },
  "myanmar": { code: "mm", emoji: "🇲🇲" }, "namibia": { code: "na", emoji: "🇳🇦" }, "nepal": { code: "np", emoji: "🇳🇵" },
  "netherlands": { code: "nl", emoji: "🇳🇱" }, "new zealand": { code: "nz", emoji: "🇳🇿" }, "nicaragua": { code: "ni", emoji: "🇳🇮" },
  "niger": { code: "ne", emoji: "🇳🇪" }, "nigeria": { code: "ng", emoji: "🇳🇬" }, "north korea": { code: "kp", emoji: "🇰🇵" },
  "north macedonia": { code: "mk", emoji: "🇲🇰" }, "norway": { code: "no", emoji: "🇳🇴" }, "oman": { code: "om", emoji: "🇴🇲" },
  "pakistan": { code: "pk", emoji: "🇵🇰" }, "palau": { code: "pw", emoji: "🇵🇼" }, "palestine": { code: "ps", emoji: "🇵🇸" },
  "panama": { code: "pa", emoji: "🇵🇦" }, "paraguay": { code: "py", emoji: "🇵🇾" }, "peru": { code: "pe", emoji: "🇵🇪" },
  "philippines": { code: "ph", emoji: "🇵🇭" }, "poland": { code: "pl", emoji: "🇵🇱" }, "portugal": { code: "pt", emoji: "🇵🇹" },
  "qatar": { code: "qa", emoji: "🇶🇦" }, "romania": { code: "ro", emoji: "🇷🇴" }, "russia": { code: "ru", emoji: "🇷🇺" },
  "rwanda": { code: "rw", emoji: "🇷🇼" }, "saudi arabia": { code: "sa", emoji: "🇸🇦" }, "senegal": { code: "sn", emoji: "🇸🇳" },
  "serbia": { code: "rs", emoji: "🇷🇸" }, "sierra leone": { code: "sl", emoji: "🇸🇱" }, "singapore": { code: "sg", emoji: "🇸🇬" },
  "slovakia": { code: "sk", emoji: "🇸🇰" }, "slovenia": { code: "si", emoji: "🇸🇮" }, "somalia": { code: "so", emoji: "🇸🇴" },
  "south africa": { code: "za", emoji: "🇿🇦" }, "south korea": { code: "kr", emoji: "🇰🇷" }, "south sudan": { code: "ss", emoji: "🇸🇸" },
  "spain": { code: "es", emoji: "🇪🇸" }, "sri lanka": { code: "lk", emoji: "🇱🇰" }, "sudan": { code: "sd", emoji: "🇸🇩" },
  "suriname": { code: "sr", emoji: "🇸🇷" }, "sweden": { code: "se", emoji: "🇸🇪" }, "switzerland": { code: "ch", emoji: "🇨🇭" },
  "syria": { code: "sy", emoji: "🇸🇾" }, "taiwan": { code: "tw", emoji: "🇹🇼" }, "tajikistan": { code: "tj", emoji: "🇹🇯" },
  "tanzania": { code: "tz", emoji: "🇹🇿" }, "thailand": { code: "th", emoji: "🇹🇭" }, "togo": { code: "tg", emoji: "🇹🇬" },
  "tonga": { code: "to", emoji: "🇹🇴" }, "trinidad": { code: "tt", emoji: "🇹🇹" }, "tunisia": { code: "tn", emoji: "🇹🇳" },
  "turkey": { code: "tr", emoji: "🇹🇷" }, "turkmenistan": { code: "tm", emoji: "🇹🇲" }, "uganda": { code: "ug", emoji: "🇺🇬" },
  "ukraine": { code: "ua", emoji: "🇺🇦" }, "uae": { code: "ae", emoji: "🇦🇪" }, "united arab emirates": { code: "ae", emoji: "🇦🇪" },
  "uk": { code: "gb", emoji: "🇬🇧" }, "united kingdom": { code: "gb", emoji: "🇬🇧" }, "usa": { code: "us", emoji: "🇺🇸" },
  "united states": { code: "us", emoji: "🇺🇸" }, "uruguay": { code: "uy", emoji: "🇺🇾" }, "uzbekistan": { code: "uz", emoji: "🇺🇿" },
  "venezuela": { code: "ve", emoji: "🇻🇪" }, "vietnam": { code: "vn", emoji: "🇻🇳" }, "yemen": { code: "ye", emoji: "🇾🇪" },
  "zambia": { code: "zm", emoji: "🇿🇲" }, "zimbabwe": { code: "zw", emoji: "🇿🇼" },
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface FlagData {
  id: string;
  body: Matter.Body;
  country: string;
  emoji: string;
  img: Image | null;
}

export type GameStateName = "WAITING" | "COUNTDOWN" | "PLAYING" | "ENDED";

export interface ChatMsg { id: string; user: string; msg: string; ts: number; }

export interface GameStateSnapshot {
  gameState: GameStateName;
  countdown: number;
  flagCount: number;
  leaderboard: Record<string, number>;
  chatMessages: ChatMsg[];
  winner: { country: string; emoji: string } | null;
}

// ─── GameEngine ───────────────────────────────────────────────────────────────
export class GameEngine extends EventEmitter {
  private canvas: Canvas;
  private ctx: SKRSContext2D;
  private engine: Matter.Engine;
  private allParts: any[] = [];
  private flags: FlagData[] = [];
  private roundCountries = new Set<string>();
  private gameState: GameStateName = "WAITING";
  private countdown = 3;
  private winner: { country: string; emoji: string } | null = null;
  private leaderboard: Record<string, number> = {};
  private chatMsgs: ChatMsg[] = [];
  private globalAngle = 0;
  private renderTimer: ReturnType<typeof setTimeout> | null = null;
  private gameLoopTimer: ReturnType<typeof setTimeout> | null = null;
  private physicsTimer: ReturnType<typeof setTimeout> | null = null;
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;
  private endingRound = false;
  private lastJpeg: Buffer | null = null;

  constructor() {
    super();
    this.canvas = createCanvas(STREAM_W, STREAM_H);
    this.ctx = this.canvas.getContext("2d");
    this.engine = Matter.Engine.create({ gravity: { x: 0, y: 0, scale: 0 } });
    this.initPhysics();
    this.startGameLoop();
    this.startRenderLoop();
    this.startCleanup();
  }

  // ── Physics ────────────────────────────────────────────────────────────────
  private initPhysics() {
    for (let i = 0; i < TOTAL_SEGMENTS; i++) {
      const segLen = (Math.PI * 2 * RADIUS) / TOTAL_SEGMENTS + 4;
      const part = Matter.Bodies.rectangle(0, 0, 12, segLen, {
        isStatic: true, friction: 0.1, restitution: 0.8,
      });
      (part as any).customIndex = i;
      (part as any).isGap = i < GAP_SEGMENTS;
      this.allParts.push(part);
      Matter.World.add(this.engine.world, part);
    }

    Matter.Events.on(this.engine, "beforeUpdate", () => {
      this.globalAngle += this.gameState === "PLAYING" ? 0.025 : 0.005;

      this.allParts.forEach((part) => {
        const origAngle = (part.customIndex / TOTAL_SEGMENTS) * Math.PI * 2;
        const curAngle = origAngle + this.globalAngle;
        if (part.isGap) {
          Matter.Body.setPosition(part, { x: -1000, y: -1000 });
        } else {
          Matter.Body.setPosition(part, {
            x: CENTER_X + Math.cos(curAngle) * RADIUS,
            y: CENTER_Y + Math.sin(curAngle) * RADIUS,
          });
          Matter.Body.setAngle(part, curAngle);
        }
      });

      for (let i = this.flags.length - 1; i >= 0; i--) {
        const f = this.flags[i];
        if (this.gameState === "PLAYING") {
          const fm = FLAG_FORCE * f.body.mass;
          Matter.Body.applyForce(f.body, f.body.position, {
            x: (Math.random() - 0.5) * fm,
            y: (Math.random() - 0.5) * fm,
          });
          const spd = Matter.Vector.magnitude(f.body.velocity);
          if (spd > FLAG_MAX_SPEED)
            Matter.Body.setVelocity(f.body, Matter.Vector.mult(Matter.Vector.normalise(f.body.velocity), FLAG_MAX_SPEED));
        }
        const dx = f.body.position.x - CENTER_X;
        const dy = f.body.position.y - CENTER_Y;
        if (Math.sqrt(dx * dx + dy * dy) > RADIUS + 30) {
          if (this.gameState === "PLAYING") {
            Matter.World.remove(this.engine.world, f.body);
            this.flags.splice(i, 1);
          } else {
            Matter.Body.setPosition(f.body, { x: CENTER_X, y: CENTER_Y });
            Matter.Body.setVelocity(f.body, {
              x: (Math.random() - 0.5) * FLAG_SPEED,
              y: (Math.random() - 0.5) * FLAG_SPEED,
            });
          }
        }
      }

      if (this.gameState === "PLAYING" && !this.endingRound && this.flags.length <= 1) {
        this.endingRound = true;
        if (this.flags.length === 1) this.endRound(this.flags[0]);
        else this.endRoundDraw();
      }
    });

    // Bounce sound: emit event when a flag hits a ring segment
    Matter.Events.on(this.engine, "collisionStart", (event: any) => {
      for (const pair of event.pairs) {
        const { bodyA, bodyB } = pair;
        const aIsFlag = this.flags.some((f) => f.body.id === bodyA.id);
        const bIsFlag = this.flags.some((f) => f.body.id === bodyB.id);
        const aIsRing = this.allParts.some((p) => p.id === bodyA.id);
        const bIsRing = this.allParts.some((p) => p.id === bodyB.id);
        if ((aIsFlag && bIsRing) || (bIsFlag && aIsRing)) {
          this.emit("bounce");
        }
      }
    });

    // Drive physics manually at 60 Hz — Matter.Runner requires window.requestAnimationFrame
    // which does not exist in Node.js. We replicate it with setInterval.
    const fixedDelta = 1000 / 60;
    this.physicsTimer = setInterval(() => {
      Matter.Engine.update(this.engine, fixedDelta);
    }, fixedDelta);
  }

  private endRound(flag: FlagData) {
    this.gameState = "ENDED";
    this.winner = { country: flag.country, emoji: flag.emoji };
    this.leaderboard[flag.country] = (this.leaderboard[flag.country] || 0) + 1;
    this.broadcastState();
    setTimeout(() => this.resetRound(), 5000);
  }
  private endRoundDraw() {
    this.gameState = "ENDED";
    this.winner = { country: "Nobody", emoji: "🏳️" };
    this.broadcastState();
    setTimeout(() => this.resetRound(), 5000);
  }
  private resetRound() {
    this.flags.forEach((f) => Matter.World.remove(this.engine.world, f.body));
    this.flags = [];
    this.roundCountries.clear();
    this.winner = null;
    this.gameState = "WAITING";
    this.endingRound = false;
    this.broadcastState();
  }

  // ── Game loop ──────────────────────────────────────────────────────────────
  private startGameLoop() {
    this.gameLoopTimer = setInterval(() => {
      if (this.gameState === "WAITING" && this.flags.length >= 2) {
        this.gameState = "COUNTDOWN";
        this.countdown = 10;
        this.broadcastState();
      } else if (this.gameState === "COUNTDOWN") {
        this.countdown--;
        if (this.countdown <= 0) { this.gameState = "PLAYING"; this.countdown = 0; }
        this.broadcastState();
      }
    }, 1000);
  }

  private startCleanup() {
    this.cleanupTimer = setInterval(() => {
      const cutoff = Date.now() - 6000;
      this.chatMsgs = this.chatMsgs.filter((m) => m.ts >= cutoff);
    }, 500);
  }

  // ── Render loop ────────────────────────────────────────────────────────────
  private startRenderLoop() {
    const tick = () => {
      this.render();
      // Encode to JPEG async; emit when ready
      this.canvas.encode("jpeg", 88).then((jpeg) => {
        this.lastJpeg = jpeg;
        this.emit("frame", jpeg);
      }).catch(() => {});
    };
    this.renderTimer = setInterval(tick, Math.floor(1000 / FPS));
  }

  private render() {
    const ctx = this.ctx;

    // Background
    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(0, 0, STREAM_W, STREAM_H);

    // Game area white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(GAME_X, GAME_Y, GAME_SIZE, GAME_SIZE);

    // Ring
    ctx.fillStyle = "#2563EB";
    this.allParts.forEach((part) => {
      if (part.position.x < 0) return;
      ctx.beginPath();
      ctx.moveTo(part.vertices[0].x, part.vertices[0].y);
      for (let j = 1; j < part.vertices.length; j++) ctx.lineTo(part.vertices[j].x, part.vertices[j].y);
      ctx.closePath();
      ctx.fill();
    });

    // Flags
    this.flags.forEach((flag) => {
      ctx.save();
      ctx.translate(flag.body.position.x, flag.body.position.y);
      ctx.rotate(flag.body.angle);
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.clip();
      if (flag.img) {
        ctx.drawImage(flag.img, -60, -45, 120, 90);
      } else {
        ctx.fillStyle = "#334155";
        ctx.fillRect(-40, -40, 80, 80);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(flag.country.slice(0, 3).toUpperCase(), 0, 0);
        ctx.textBaseline = "alphabetic";
      }
      ctx.restore();

      // Border ring
      ctx.save();
      ctx.translate(flag.body.position.x, flag.body.position.y);
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#FF3D68";
      ctx.stroke();
      ctx.restore();
    });

    // ── Status overlays ──

    // WAITING: frosted blur + participation message
    if (this.gameState === "WAITING") {
      // Frosted glass effect — layered semi-transparent fills
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillRect(GAME_X, GAME_Y, GAME_SIZE, GAME_SIZE);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(GAME_X + 4, GAME_Y + 4, GAME_SIZE - 8, GAME_SIZE - 8);
      ctx.fillStyle = "rgba(255,255,255,0.20)";
      ctx.fillRect(GAME_X + 8, GAME_Y + 8, GAME_SIZE - 16, GAME_SIZE - 16);

      // ✍️ Participation banner at top center
      const bannerW = 560;
      const bannerH = 56;
      const bannerX = CENTER_X - bannerW / 2;
      const bannerY = CENTER_Y - 130;

      // Banner background
      ctx.fillStyle = "rgba(255, 61, 104, 0.92)";
      ctx.fillRect(bannerX, bannerY, bannerW, bannerH);

      // Banner text line 1
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✍️  Write your country name in chat", CENTER_X, bannerY + 24);

      // Banner text line 2
      ctx.font = "bold 15px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.fillText("to participate in Flag Fight!", CENTER_X, bannerY + 44);

      // Flag count pill below banner
      const pillY = bannerY + bannerH + 18;
      ctx.fillStyle = "rgba(17,24,39,0.75)";
      ctx.fillRect(CENTER_X - 100, pillY, 200, 28);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${this.flags.length} flag${this.flags.length === 1 ? "" : "s"} ready — need 2 to start`, CENTER_X, pillY + 18);
    }

    // COUNTDOWN: frosted blur + big countdown number + participation reminder
    if (this.gameState === "COUNTDOWN") {
      // Frosted glass layers
      ctx.fillStyle = "rgba(255,255,255,0.60)";
      ctx.fillRect(GAME_X, GAME_Y, GAME_SIZE, GAME_SIZE);
      ctx.fillStyle = "rgba(255,255,255,0.30)";
      ctx.fillRect(GAME_X + 6, GAME_Y + 6, GAME_SIZE - 12, GAME_SIZE - 12);

      // Big countdown number
      ctx.fillStyle = "#FF3D68";
      ctx.font = "bold 180px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(this.countdown), CENTER_X, CENTER_Y - 20);
      ctx.textBaseline = "alphabetic";

      // "Game starts in X" label
      ctx.fillStyle = "rgba(17,24,39,0.85)";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Game starts in ${this.countdown} second${this.countdown === 1 ? "" : "s"}`, CENTER_X, CENTER_Y + 110);

      // Still accepting players banner
      const bW = 480; const bH = 44;
      const bX = CENTER_X - bW / 2; const bY = CENTER_Y + 135;
      ctx.fillStyle = "rgba(255, 61, 104, 0.85)";
      ctx.fillRect(bX, bY, bW, bH);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✍️  Still accepting players — type your country!", CENTER_X, bY + 28);
    }
    if (this.gameState === "ENDED" && this.winner) {
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(GAME_X, GAME_Y + GAME_SIZE - 110, GAME_SIZE, 110);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🏆  THE WINNER IS  🏆", CENTER_X, GAME_Y + GAME_SIZE - 75);
      ctx.font = "bold 42px sans-serif";
      ctx.fillStyle = "#FF3D68";
      const name = this.winner.country.replace(/\b\w/g, (l) => l.toUpperCase());
      ctx.fillText(name, CENTER_X, GAME_Y + GAME_SIZE - 25);
    }

    // ── Header bar ──
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, STREAM_W, 72);
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 72); ctx.lineTo(STREAM_W, 72); ctx.stroke();

    ctx.fillStyle = "#111827";
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("FLAG FIGHT", 24, 46);

    const stateLabel: Record<GameStateName, string> = {
      WAITING: "WAITING FOR PLAYERS",
      COUNTDOWN: `STARTING IN ${this.countdown}`,
      PLAYING: "ROUND IN PROGRESS",
      ENDED: "ROUND ENDED",
    };
    ctx.fillStyle = "#FF3D68";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(stateLabel[this.gameState], STREAM_W / 2, 46);

    ctx.fillStyle = "#6b7280";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${this.flags.length} flags`, STREAM_W - 24, 46);

    // ── Left panel: leaderboard ──
    ctx.fillStyle = "#f9fafb";
    ctx.fillRect(0, 72, GAME_X, STREAM_H - 72);
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(GAME_X, 72); ctx.lineTo(GAME_X, STREAM_H); ctx.stroke();

    ctx.fillStyle = "#6b7280"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "left";
    ctx.fillText("GLOBAL LEADERBOARD", 20, 105);
    const entries = Object.entries(this.leaderboard).sort(([, a], [, b]) => b - a).slice(0, 6);
    if (entries.length === 0) {
      ctx.fillStyle = "#9ca3af"; ctx.font = "12px sans-serif"; ctx.fillText("No wins yet", 20, 135);
    } else {
      entries.forEach(([country, wins], i) => {
        const ey = 130 + i * 45;
        ctx.fillStyle = "#FF3D68"; ctx.font = "bold 14px sans-serif"; ctx.textAlign = "left";
        ctx.fillText(`0${i + 1}`, 20, ey);
        ctx.fillStyle = "#111827"; ctx.font = "13px sans-serif";
        ctx.fillText(country.replace(/\b\w/g, (l) => l.toUpperCase()), 52, ey);
        ctx.fillStyle = "#6b7280"; ctx.font = "12px sans-serif"; ctx.textAlign = "right";
        ctx.fillText(`${wins}w`, GAME_X - 20, ey);
        ctx.textAlign = "left";
      });
    }

    // ── Right panel: chat ──
    const chatX = GAME_X + GAME_SIZE;
    ctx.fillStyle = "#f9fafb";
    ctx.fillRect(chatX, 72, STREAM_W - chatX, STREAM_H - 72);
    ctx.strokeStyle = "#e5e7eb";
    ctx.beginPath(); ctx.moveTo(chatX, 72); ctx.lineTo(chatX, STREAM_H); ctx.stroke();

    ctx.fillStyle = "#111827"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "left";
    ctx.fillText("LIVE CHAT SPAWNS", chatX + 20, 105);

    const msgs = [...this.chatMsgs].reverse().slice(0, 7);
    msgs.forEach((m, i) => {
      const my = 130 + i * 55;
      ctx.fillStyle = "#FF3D68"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "left";
      ctx.fillText(`${m.user}:`, chatX + 16, my);
      ctx.fillStyle = "#374151"; ctx.font = "bold 12px sans-serif";
      const txt = m.msg.length > 20 ? m.msg.slice(0, 20) + "…" : m.msg;
      ctx.fillText(txt, chatX + 16, my + 18);
      ctx.fillStyle = "#f97316"; ctx.font = "10px sans-serif";
      ctx.fillText("+1 Flag Spawned", chatX + 16, my + 33);
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  spawnFlag(countryName: string): boolean {
    if (this.gameState === "ENDED") return false;
    const norm = countryName.trim().toLowerCase();
    const data = COUNTRIES[norm];
    if (!data || this.roundCountries.has(norm)) return false;

    const x = CENTER_X + (Math.random() - 0.5) * 100;
    const y = CENTER_Y + (Math.random() - 0.5) * 100;
    const body = Matter.Bodies.circle(x, y, 40, { restitution: 1.0, friction: 0, frictionAir: 0, density: 0.05 });
    Matter.Body.setVelocity(body, { x: (Math.random() - 0.5) * FLAG_SPEED, y: (Math.random() - 0.5) * FLAG_SPEED });

    const flag: FlagData = { id: Math.random().toString(), body, country: norm, emoji: data.emoji, img: null };
    loadImage(`https://flagcdn.com/w80/${data.code}.png`).then((img) => { flag.img = img; }).catch(() => {});

    Matter.World.add(this.engine.world, body);
    this.flags.push(flag);
    this.roundCountries.add(norm);
    return true;
  }

  addChatMessage(user: string, msg: string) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.chatMsgs = [...this.chatMsgs, { id, user, msg, ts: Date.now() }].slice(-50);
    this.broadcastState();
  }

  broadcastState() { this.emit("stateUpdate", this.getState()); }

  getState(): GameStateSnapshot {
    return {
      gameState: this.gameState,
      countdown: this.countdown,
      flagCount: this.flags.length,
      leaderboard: { ...this.leaderboard },
      chatMessages: this.chatMsgs.map(({ id, user, msg, ts }) => ({ id, user, msg, ts })),
      winner: this.winner,
    };
  }

  getLastJpeg(): Buffer | null { return this.lastJpeg; }

  destroy() {
    if (this.renderTimer) clearInterval(this.renderTimer);
    if (this.gameLoopTimer) clearInterval(this.gameLoopTimer);
    if (this.physicsTimer) clearInterval(this.physicsTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }
}
