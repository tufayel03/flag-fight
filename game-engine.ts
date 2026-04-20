import { createCanvas, loadImage } from "@napi-rs/canvas";
import type { Canvas, SKRSContext2D, Image } from "@napi-rs/canvas";
import Matter from "matter-js";
import { EventEmitter } from "events";

// ─── Canvas / layout constants ────────────────────────────────────────────────
export const STREAM_W = 720;
export const STREAM_H = 1280;
const GAME_SIZE = 700;
const GAME_X = (STREAM_W - GAME_SIZE) / 2; 
const GAME_Y = (STREAM_H - GAME_SIZE) / 2 + 100; // Shift down for leaderboard space
const CENTER_X = STREAM_W / 2;
const CENTER_Y = GAME_Y + GAME_SIZE / 2;
const RADIUS = 320;
const TOTAL_SEGMENTS = 60;
const GAP_SEGMENTS = 8;
const FLAG_SPEED = 12;
const FLAG_FORCE = 0.0028;
const FLAG_MAX_SPEED = 12;
const FPS = 30;
const MIN_PLAYERS = 2;
const PLAYER_RING_SPACING = 96;
const RADIUS_GROWTH_STEP = 20;
const MAX_RADIUS = 430;
const GAP_SEGMENTS_PER_ROTATION = 2;
const BOT_PLAYER: PlayerInput = {
  id: "bot:flag-fight",
  name: "Flag Fight Bot",
  isBot: true,
};

// ─── Country map ──────────────────────────────────────────────────────────────
export const COUNTRIES: Record<string, { code: string; emoji: string }> = {
  "afghanistan": { code: "af", emoji: "🇦🇫" }, "albania": { code: "al", emoji: "🇦🇱" }, "algeria": { code: "dz", emoji: "🇩🇿" },
  "andorra": { code: "ad", emoji: "🇦🇩" }, "angola": { code: "ao", emoji: "🇦🇴" }, "antigua": { code: "ag", emoji: "🇦🇬" },
  "argentina": { code: "ar", emoji: "🇦🇷" }, "armenia": { code: "am", emoji: "🇦🇲" }, "australia": { code: "au", emoji: "🇦🇺" },
  "austria": { code: "at", emoji: "🇦🇹" }, "azerbaijan": { code: "az", emoji: "🇦🇿" }, "bahamas": { code: "bs", emoji: "🇧🇸" },
  "bahrain": { code: "bh", emoji: "🇧🇭" }, "bangladesh": { code: "bd", emoji: "🇧🇩" }, "barbados": { code: "bb", emoji: "🇧🇧" },
  "belarus": { code: "by", emoji: "🇧🇾" }, "belgium": { code: "be", emoji: "🇧🇪" }, "belize": { code: "bz", emoji: "🇧🇿" },
  "benin": { code: "bj", emoji: "🇧🇯" }, "bhutan": { code: "bt", emoji: "🇧🇹" }, "bolivia": { code: "bo", emoji: "🇧🇴" },
  "bosnia": { code: "ba", emoji: "🇧🇦" }, "botswana": { code: "bw", emoji: "🇧🇼" }, "brazil": { code: "br", emoji: "🇧🇷" },
  "brunei": { code: "bn", emoji: "🇧🇳" }, "bulgaria": { code: "bg", emoji: "🇧🇬" }, "burkina faso": { code: "bf", emoji: "🇧🇫" },
  "burundi": { code: "bi", emoji: "🇧🇮" }, "cambodia": { code: "kh", emoji: "🇰🇭" }, "cameroon": { code: "cm", emoji: "🇨🇲" },
  "canada": { code: "ca", emoji: "🇨🇦" }, "cape verde": { code: "cv", emoji: "🇨🇻" }, "central african republic": { code: "cf", emoji: "🇨🇫" },
  "chad": { code: "td", emoji: "🇹🇩" }, "chile": { code: "cl", emoji: "🇨🇱" }, "china": { code: "cn", emoji: "🇨🇳" },
  "colombia": { code: "co", emoji: "🇨🇴" }, "comoros": { code: "km", emoji: "🇰🇲" }, "congo": { code: "cg", emoji: "🇨🇬" },
  "costa rica": { code: "cr", emoji: "🇨🇷" }, "croatia": { code: "hr", emoji: "🇭🇷" }, "cuba": { code: "cu", emoji: "🇨🇺" },
  "cyprus": { code: "cy", emoji: "🇨🇾" }, "czech republic": { code: "cz", emoji: "🇨🇿" }, "denmark": { code: "dk", emoji: "🇩🇰" },
  "djibouti": { code: "dj", emoji: "🇩🇯" }, "dominica": { code: "dm", emoji: "🇩🇲" }, "dominican republic": { code: "do", emoji: "🇩🇴" },
  "ecuador": { code: "ec", emoji: "🇪🇨" }, "egypt": { code: "eg", emoji: "🇪🇬" }, "el salvador": { code: "sv", emoji: "🇸🇻" },
  "equatorial guinea": { code: "gq", emoji: "🇬🇶" }, "eritrea": { code: "er", emoji: "🇪🇷" }, "estonia": { code: "ee", emoji: "🇪🇪" },
  "eswatini": { code: "sz", emoji: "🇸🇿" }, "ethiopia": { code: "et", emoji: "🇪🇹" }, "fiji": { code: "fj", emoji: "🇫🇯" },
  "finland": { code: "fi", emoji: "🇫🇮" }, "france": { code: "fr", emoji: "🇫🇷" }, "gabon": { code: "ga", emoji: "🇬🇦" },
  "gambia": { code: "gm", emoji: "🇬🇲" }, "georgia": { code: "ge", emoji: "🇬🇪" }, "germany": { code: "de", emoji: "🇩🇪" },
  "ghana": { code: "gh", emoji: "🇬🇭" }, "greece": { code: "gr", emoji: "🇬🇷" }, "grenada": { code: "gd", emoji: "🇬🇩" },
  "guatemala": { code: "gt", emoji: "🇬🇹" }, "guinea": { code: "gn", emoji: "🇬🇳" }, "guyana": { code: "gy", emoji: "🇬🇾" },
  "haiti": { code: "ht", emoji: "🇭🇹" }, "honduras": { code: "hn", emoji: "🇭🇳" }, "hungary": { code: "hu", emoji: "🇭🇺" },
  "iceland": { code: "is", emoji: "🇮🇸" }, "india": { code: "in", emoji: "🇮🇳" }, "indonesia": { code: "id", emoji: "🇮🇩" },
  "iran": { code: "ir", emoji: "🇮🇷" }, "iraq": { code: "iq", emoji: "🇮🇶" }, "ireland": { code: "ie", emoji: "🇮🇪" },
  "italy": { code: "it", emoji: "🇮🇹" }, "jamaica": { code: "jm", emoji: "🇯🇲" }, "japan": { code: "jp", emoji: "🇯🇵" },
  "jordan": { code: "jo", emoji: "🇯🇴" }, "kazakhstan": { code: "kz", emoji: "🇰🇿" }, "kenya": { code: "ke", emoji: "🇰🇪" },
  "kiribati": { code: "ki", emoji: "🇰🇮" }, "kuwait": { code: "kw", emoji: "🇰🇼" }, "kyrgyzstan": { code: "kg", emoji: "🇰🇬" },
  "laos": { code: "la", emoji: "🇱🇦" }, "latvia": { code: "lv", emoji: "🇱🇻" }, "lebanon": { code: "lb", emoji: "🇱🇧" },
  "lesotho": { code: "ls", emoji: "🇱🇸" }, "liberia": { code: "lr", emoji: "🇱🇷" }, "libya": { code: "ly", emoji: "🇱🇾" },
  "liechtenstein": { code: "li", emoji: "🇱🇮" }, "lithuania": { code: "lt", emoji: "🇱🇹" }, "luxembourg": { code: "lu", emoji: "🇱🇺" },
  "madagascar": { code: "mg", emoji: "🇲🇬" }, "malawi": { code: "mw", emoji: "🇲🇼" }, "malaysia": { code: "my", emoji: "🇲🇾" },
  "maldives": { code: "mv", emoji: "🇲🇻" }, "mali": { code: "ml", emoji: "🇲🇱" }, "malta": { code: "mt", emoji: "🇲🇹" },
  "marshall islands": { code: "mh", emoji: "🇲🇭" }, "mauritania": { code: "mr", emoji: "🇲🇷" }, "mauritius": { code: "mu", emoji: "🇲🇺" },
  "mexico": { code: "mx", emoji: "🇲🇽" }, "micronesia": { code: "fm", emoji: "🇫🇲" }, "moldova": { code: "md", emoji: "🇲🇩" },
  "monaco": { code: "mc", emoji: "🇲🇨" }, "mongolia": { code: "mn", emoji: "🇲🇳" }, "montenegro": { code: "me", emoji: "🇲🇪" },
  "morocco": { code: "ma", emoji: "🇲🇦" }, "mozambique": { code: "mz", emoji: "🇲🇿" }, "myanmar": { code: "mm", emoji: "🇲🇲" },
  "namibia": { code: "na", emoji: "🇳🇦" }, "nauru": { code: "nr", emoji: "🇳🇷" }, "nepal": { code: "np", emoji: "🇳🇵" },
  "netherlands": { code: "nl", emoji: "🇳🇱" }, "new zealand": { code: "nz", emoji: "🇳🇿" }, "nicaragua": { code: "ni", emoji: "🇳🇮" },
  "niger": { code: "ne", emoji: "🇳🇪" }, "nigeria": { code: "ng", emoji: "🇳🇬" }, "north korea": { code: "kp", emoji: "🇰🇵" },
  "north macedonia": { code: "mk", emoji: "🇲🇰" }, "norway": { code: "no", emoji: "🇳🇴" }, "oman": { code: "om", emoji: "🇴🇲" },
  "pakistan": { code: "pk", emoji: "🇵🇰" }, "palau": { code: "pw", emoji: "🇵🇼" }, "palestine": { code: "ps", emoji: "🇵🇸" },
  "panama": { code: "pa", emoji: "🇵🇦" }, "papua new guinea": { code: "pg", emoji: "🇵🇬" }, "paraguay": { code: "py", emoji: "🇵🇾" },
  "peru": { code: "pe", emoji: "🇵🇪" }, "philippines": { code: "ph", emoji: "🇵🇭" }, "poland": { code: "pl", emoji: "🇵🇱" },
  "portugal": { code: "pt", emoji: "🇵🇹" }, "qatar": { code: "qa", emoji: "🇶🇦" }, "romania": { code: "ro", emoji: "🇷🇴" },
  "russia": { code: "ru", emoji: "🇷🇺" }, "rwanda": { code: "rw", emoji: "🇷🇼" }, "saint kitts": { code: "kn", emoji: "🇰🇳" },
  "saint lucia": { code: "lc", emoji: "🇱🇨" }, "saint vincent": { code: "vc", emoji: "🇻🇨" }, "samoa": { code: "ws", emoji: "🇼🇸" },
  "san marino": { code: "sm", emoji: "🇸🇲" }, "sao tome": { code: "st", emoji: "🇸🇹" }, "saudi arabia": { code: "sa", emoji: "🇸🇦" },
  "senegal": { code: "sn", emoji: "🇸🇳" }, "serbia": { code: "rs", emoji: "🇷🇸" }, "seychelles": { code: "sc", emoji: "🇸🇨" },
  "sierra leone": { code: "sl", emoji: "🇸🇱" }, "singapore": { code: "sg", emoji: "🇸🇬" }, "slovakia": { code: "sk", emoji: "🇸🇰" },
  "slovenia": { code: "si", emoji: "🇸🇮" }, "solomon islands": { code: "sb", emoji: "🇸🇧" }, "somalia": { code: "so", emoji: "🇸🇴" },
  "south africa": { code: "za", emoji: "🇿🇦" }, "south korea": { code: "kr", emoji: "🇰🇷" }, "south sudan": { code: "ss", emoji: "🇸🇸" },
  "spain": { code: "es", emoji: "🇪🇸" }, "sri lanka": { code: "lk", emoji: "🇱🇰" }, "sudan": { code: "sd", emoji: "🇸🇩" },
  "suriname": { code: "sr", emoji: "🇸🇷" }, "sweden": { code: "se", emoji: "🇸🇪" }, "switzerland": { code: "ch", emoji: "🇨🇭" },
  "syria": { code: "sy", emoji: "🇸🇾" }, "taiwan": { code: "tw", emoji: "🇹🇼" }, "tajikistan": { code: "tj", emoji: "🇹🇯" },
  "tanzania": { code: "tz", emoji: "🇹🇿" }, "thailand": { code: "th", emoji: "🇹🇭" }, "timor-leste": { code: "tl", emoji: "🇹🇱" },
  "togo": { code: "tg", emoji: "🇹🇬" }, "tonga": { code: "to", emoji: "🇹🇴" }, "trinidad": { code: "tt", emoji: "🇹🇹" },
  "tunisia": { code: "tn", emoji: "🇹🇳" }, "turkey": { code: "tr", emoji: "🇹🇷" }, "turkmenistan": { code: "tm", emoji: "🇹🇲" },
  "tuvalu": { code: "tv", emoji: "🇹🇻" }, "uganda": { code: "ug", emoji: "🇺🇬" }, "ukraine": { code: "ua", emoji: "🇺🇦" },
  "uae": { code: "ae", emoji: "🇦🇪" }, "united arab emirates": { code: "ae", emoji: "🇦🇪" }, "uk": { code: "gb", emoji: "🇬🇧" },
  "united kingdom": { code: "gb", emoji: "🇬🇧" }, "usa": { code: "us", emoji: "🇺🇸" }, "united states": { code: "us", emoji: "🇺🇸" },
  "uruguay": { code: "uy", emoji: "🇺🇾" }, "uzbekistan": { code: "uz", emoji: "🇺🇿" }, "vanuatu": { code: "vu", emoji: "🇻🇺" },
  "vatican city": { code: "va", emoji: "🇻🇦" }, "venezuela": { code: "ve", emoji: "🇻🇪" }, "vietnam": { code: "vn", emoji: "🇻🇳" },
  "yemen": { code: "ye", emoji: "🇾🇪" }, "zambia": { code: "zm", emoji: "🇿🇲" }, "zimbabwe": { code: "zw", emoji: "🇿🇼" },
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PlayerInput {
  id?: string;
  name: string;
  avatarUrl?: string | null;
  isBot?: boolean;
}

interface FlagData {
  id: string;
  body: Matter.Body;
  playerId: string;
  name: string;
  avatarUrl: string | null;
  isBot: boolean;
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
  private queuedPlayers: PlayerInput[] = [];
  private gameState: GameStateName = "WAITING";
  private countdown = 3;
  private winner: { country: string; emoji: string } | null = null;
  private leaderboard: Record<string, number> = {};
  private chatMsgs: ChatMsg[] = [];
  private globalAngle = 0;
  private renderTimer: ReturnType<typeof setInterval> | null = null;
  private gameLoopTimer: ReturnType<typeof setInterval> | null = null;
  private physicsTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private roundResetTimer: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;
  private endingRound = false;
  private lastJpeg: Buffer | null = null;
  private currentRadius = RADIUS;
  private gapGrowthRotations = 0;
  private lastGapRotation = 0;

  constructor() {
    super();
    this.canvas = createCanvas(STREAM_W, STREAM_H);
    this.ctx = this.canvas.getContext("2d");
    this.engine = Matter.Engine.create({ gravity: { x: 0, y: 0, scale: 0 } });
    this.initPhysics();
    this.renderStillFrame();
  }

  // ── Physics ────────────────────────────────────────────────────────────────
  private initPhysics() {
    for (let i = 0; i < TOTAL_SEGMENTS; i++) {
      const segLen = (Math.PI * 2 * RADIUS) / TOTAL_SEGMENTS + 4;
      const part = Matter.Bodies.rectangle(0, 0, 15, segLen, {
        isStatic: true, friction: 0.1, restitution: 0.9,
      });
      (part as any).customIndex = i;
      (part as any).isGap = i < GAP_SEGMENTS;
      this.allParts.push(part);
      Matter.World.add(this.engine.world, part);
    }

    Matter.Events.on(this.engine, "beforeUpdate", () => {
      this.globalAngle += this.gameState === "PLAYING" ? 0.03 : 0.01;
      if (this.gameState === "PLAYING") this.updateGapGrowth();
      
      const gapSegments = this.getGapSegments();
      this.allParts.forEach((part) => {
        const origAngle = (part.customIndex / TOTAL_SEGMENTS) * Math.PI * 2;
        const curAngle = origAngle + this.globalAngle;
        if (part.customIndex < gapSegments) {
          Matter.Body.setPosition(part, { x: -2000, y: -2000 });
        } else {
          Matter.Body.setPosition(part, {
            x: CENTER_X + Math.cos(curAngle) * this.currentRadius,
            y: CENTER_Y + Math.sin(curAngle) * this.currentRadius,
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
        if (Math.sqrt(dx * dx + dy * dy) > this.currentRadius + 50) {
          if (this.gameState === "PLAYING" || this.gameState === "ENDED") {
            Matter.World.remove(this.engine.world, f.body);
            this.flags.splice(i, 1);
          } else {
            Matter.Body.setPosition(f.body, { x: CENTER_X + (Math.random()-0.5)*50, y: CENTER_Y + (Math.random()-0.5)*50 });
          }
        }
      }

      if (this.gameState === "PLAYING" && !this.endingRound && this.flags.length <= 1) {
        this.endingRound = true;
        if (this.flags.length === 1) this.endRound(this.flags[0]);
        else this.endRoundDraw();
      }
    });

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
  }

  private startPhysicsLoop() {
    if (this.physicsTimer) return;
    const fixedDelta = 1000 / 60;
    this.physicsTimer = setInterval(() => {
      Matter.Engine.update(this.engine, fixedDelta);
    }, fixedDelta);
  }

  private endRound(flag: FlagData) {
    this.gameState = "ENDED";
    this.winner = { country: flag.name, emoji: "" };
    this.leaderboard[flag.name] = (this.leaderboard[flag.name] || 0) + 1;
    this.broadcastState();
    this.scheduleRoundReset();
  }
  private endRoundDraw() {
    this.gameState = "ENDED";
    this.winner = { country: "Nobody", emoji: "🏳️" };
    this.broadcastState();
    this.scheduleRoundReset();
  }
  private resetRound() {
    this.removeAllFlags();
    this.winner = null;
    this.gameState = "WAITING";
    this.countdown = 3;
    this.endingRound = false;
    this.currentRadius = RADIUS;
    this.globalAngle = 0;
    this.gapGrowthRotations = 0;
    this.lastGapRotation = 0;
    if (this.isRunning) {
      this.ensureMinimumPlayers();
      this.flushQueuedPlayers();
    }
    this.broadcastState();
  }

  private ensureMinimumPlayers() {
    if (!this.flags.some((f) => f.isBot)) this.spawnPlayer(BOT_PLAYER);
  }

  private flushQueuedPlayers() {
    const queued = this.queuedPlayers.splice(0);
    queued.forEach((player) => this.spawnPlayer(player));
  }

  private getGapSegments() {
    return Math.min(TOTAL_SEGMENTS - 12, GAP_SEGMENTS + this.gapGrowthRotations * GAP_SEGMENTS_PER_ROTATION);
  }

  private updateGapGrowth() {
    const fullRotations = Math.floor(this.globalAngle / (Math.PI * 2));
    if (fullRotations <= this.lastGapRotation) return;
    this.gapGrowthRotations += fullRotations - this.lastGapRotation;
    this.lastGapRotation = fullRotations;
  }

  private updateArenaRadiusForCrowd() {
    const neededRadius = Math.ceil((this.flags.length * PLAYER_RING_SPACING) / (Math.PI * 2));
    const steppedRadius = Math.ceil(Math.max(RADIUS, neededRadius) / RADIUS_GROWTH_STEP) * RADIUS_GROWTH_STEP;
    this.currentRadius = Math.max(this.currentRadius, Math.min(MAX_RADIUS, steppedRadius));
  }

  // ── Game loop ──────────────────────────────────────────────────────────────
  private startGameLoop() {
    if (this.gameLoopTimer) return;
    this.ensureMinimumPlayers();
    this.gameLoopTimer = setInterval(() => {
      if (this.gameState === "WAITING" && this.flags.length >= MIN_PLAYERS) {
        this.gameState = "COUNTDOWN";
        this.countdown = 5; // Shorter wait for viewers
        this.broadcastState();
      } else if (this.gameState === "COUNTDOWN") {
        this.countdown--;
        if (this.countdown <= 0) { 
          this.gameState = "PLAYING"; 
          this.countdown = 0; 
          this.gapGrowthRotations = 0;
          this.lastGapRotation = Math.floor(this.globalAngle / (Math.PI * 2));
          // Boost initial speed
          this.flags.forEach(f => {
            Matter.Body.setVelocity(f.body, {
              x: (Math.random() - 0.5) * FLAG_SPEED * 1.5,
              y: (Math.random() - 0.5) * FLAG_SPEED * 1.5
            });
          });
        }
        this.broadcastState();
      }
    }, 1000);
  }

  private startCleanup() {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      const cutoff = Date.now() - 3000; // Floating messages disappear faster
      this.chatMsgs = this.chatMsgs.filter((m) => m.ts >= cutoff);
    }, 200);
  }

  // ── Render loop ────────────────────────────────────────────────────────────
  private startRenderLoop() {
    if (this.renderTimer) return;
    const tick = () => {
      this.render();
      this.canvas.encode("jpeg", 82).then((jpeg) => {
        this.lastJpeg = jpeg;
        this.emit("frame", jpeg);
      }).catch(() => {});
    };
    tick();
    this.renderTimer = setInterval(tick, Math.floor(1000 / FPS));
  }

  private render() {
    const ctx = this.ctx;

    // Background Gradient (Sleek Dark Look)
    const grad = ctx.createLinearGradient(0, 0, 0, STREAM_H);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(1, "#1e293b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, STREAM_W, STREAM_H);

    // Rotating Ring Shadows
    ctx.shadowBlur = 15;
    ctx.shadowColor = "rgba(37, 99, 235, 0.4)";
    ctx.fillStyle = "#2563EB";
    this.allParts.forEach((part) => {
      if (part.position.x < -100) return;
      ctx.beginPath();
      ctx.moveTo(part.vertices[0].x, part.vertices[0].y);
      for (let j = 1; j < part.vertices.length; j++) ctx.lineTo(part.vertices[j].x, part.vertices[j].y);
      ctx.closePath();
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // Players
    this.flags.forEach((flag) => {
      ctx.save();
      ctx.translate(flag.body.position.x, flag.body.position.y);
      ctx.rotate(flag.body.angle);
      
      // Outer Glow
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#FF3D68";
      
      ctx.beginPath();
      ctx.arc(0, 0, 45, 0, Math.PI * 2);
      ctx.clip();
      
      if (flag.img) {
        ctx.drawImage(flag.img, -45, -45, 90, 90);
      } else {
        ctx.fillStyle = flag.isBot ? "#2563EB" : "#334155";
        ctx.fillRect(-45, -45, 90, 90);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 28px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.getInitials(flag.name), 0, 2);
        ctx.textBaseline = "alphabetic";
      }
      ctx.restore();

      // Border ring
      ctx.save();
      ctx.translate(flag.body.position.x, flag.body.position.y);
      ctx.beginPath();
      ctx.arc(0, 0, 45, 0, Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = flag.isBot ? "#60a5fa" : "#FF3D68";
      ctx.stroke();
      ctx.font = "bold 17px sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.strokeText(this.truncateName(flag.name, 15), 0, 68);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(this.truncateName(flag.name, 15), 0, 68);
      ctx.restore();
    });

    // ── Floating Chat Spawns (Top of Circle) ──
    const latestChats = [...this.chatMsgs].reverse().slice(0, 3);
    latestChats.forEach((m, i) => {
      const age = Date.now() - m.ts;
      const opacity = Math.max(0, 1 - age / 6000);
      const shiftY = (age / 6000) * 100;
      
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.textAlign = "center";
      ctx.font = "bold 28px sans-serif";
      
      // Text Shadow
      ctx.shadowBlur = 4;
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      
      // User name in white
      const baseY = GAME_Y - 40 - i * 40 - shiftY;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`${m.user} joined the arena!`, CENTER_X, baseY);
      ctx.restore();
    });

    // ── Global Leaderboard (Top Left) ──
    ctx.save();
    ctx.translate(30, 40);
    ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
    ctx.roundRect(0, 0, 240, 260, 15);
    ctx.fill();
    
    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("🏆 GLOBAL LEADERBOARD", 15, 25);
    
    const entries = Object.entries(this.leaderboard).sort(([, a], [, b]) => b - a).slice(0, 5);
    entries.forEach(([country, wins], i) => {
      const y = 60 + i * 40;
      ctx.fillStyle = "#FF3D68"; ctx.font = "bold 18px sans-serif";
      ctx.fillText(`#${i+1}`, 15, y);
      ctx.fillStyle = "#ffffff"; ctx.font = "bold 16px sans-serif";
      const name = country.length > 12 ? country.slice(0, 10) + ".." : country;
      ctx.fillText(name.toUpperCase(), 50, y);
      ctx.fillStyle = "#60a5fa"; ctx.textAlign = "right";
      ctx.fillText(`${wins}W`, 220, y);
      ctx.textAlign = "left";
    });
    ctx.restore();

    // ── Instruction Text (Below Leaderboard) ──
    ctx.save();
    ctx.font = "bold 20px sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.textAlign = "center";
    ctx.fillText("COMMENT TO JOIN THE ARENA!", CENTER_X, 350);
    
    // ── Instruction Text (Above Arena) ──
    ctx.font = "bold 24px sans-serif";
    ctx.fillStyle = "#60a5fa";
    ctx.fillText("TYPE ANY CHAT MESSAGE!", CENTER_X, CENTER_Y - this.currentRadius - 40);
    ctx.restore();

    // ── Overlays ──
    if (this.gameState === "COUNTDOWN") {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(0, 0, STREAM_W, STREAM_H);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 200px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(this.countdown), CENTER_X, CENTER_Y);
      ctx.font = "bold 30px sans-serif";
      ctx.fillText("STARTING...", CENTER_X, CENTER_Y + 150);
      ctx.textBaseline = "alphabetic";
    }

    if (this.gameState === "ENDED" && this.winner) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, CENTER_Y - 120, STREAM_W, 240);
      ctx.textAlign = "center";
      ctx.fillStyle = "#FF3D68";
      ctx.font = "bold 34px sans-serif";
      ctx.fillText("ROUND WINNER", CENTER_X, CENTER_Y - 40);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 70px sans-serif";
      ctx.fillText(this.truncateName(this.winner.country, 18).toUpperCase(), CENTER_X, CENTER_Y + 50);
      ctx.restore();
    }

    if (this.gameState === "WAITING") {
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 30px sans-serif";
      ctx.fillText("COMMENT IN CHAT TO PLAY!", CENTER_X, CENTER_Y + RADIUS + 80);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clearRoundResetTimer();
    this.ensureMinimumPlayers();
    this.startPhysicsLoop();
    this.startGameLoop();
    this.startRenderLoop();
    this.startCleanup();
    this.broadcastState();
  }

  stopAndReset() {
    this.isRunning = false;
    this.stopTimers();
    this.clearRoundResetTimer();
    this.resetSessionState();
    this.renderStillFrame();
    this.broadcastState();
  }

  spawnPlayer(player: PlayerInput): boolean {
    if (!this.isRunning) return false;
    const name = this.cleanPlayerName(player.name);
    if (!name) return false;
    const playerId = this.getPlayerId(player, name);
    if (this.gameState === "ENDED") {
      if (this.hasQueuedPlayer(playerId)) return false;
      this.queuedPlayers = [...this.queuedPlayers, { ...player, id: playerId, name }].slice(-100);
      return true;
    }
    if (this.flags.some((f) => f.playerId === playerId)) return false;

    const x = CENTER_X + (Math.random() - 0.5) * 150;
    const y = CENTER_Y + (Math.random() - 0.5) * 150;
    const body = Matter.Bodies.circle(x, y, 45, { restitution: 1.0, friction: 0, frictionAir: 0, density: 0.1 });
    Matter.Body.setVelocity(body, { x: (Math.random() - 0.5) * FLAG_SPEED, y: (Math.random() - 0.5) * FLAG_SPEED });

    const uniqueEntryId = `${playerId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const avatarUrl = (player.avatarUrl || "").trim() || null;
    const flag: FlagData = {
      id: uniqueEntryId,
      body,
      playerId,
      name,
      avatarUrl,
      isBot: !!player.isBot,
      img: null,
    };
    if (avatarUrl) loadImage(avatarUrl).then((img) => { flag.img = img; }).catch(() => {});

    Matter.World.add(this.engine.world, body);
    this.flags.push(flag);
    this.updateArenaRadiusForCrowd();
    if (this.flags.length >= MIN_PLAYERS && this.gameState === "WAITING") {
       // logic handled in startGameLoop
    }
    return true;
  }

  spawnFlag(countryName: string): boolean {
    return this.spawnPlayer({ name: countryName });
  }

  private cleanPlayerName(name: string) {
    return (name || "Viewer").replace(/\s+/g, " ").trim().slice(0, 40);
  }

  private getPlayerId(player: PlayerInput, cleanName: string) {
    return (player.id || cleanName).trim().toLowerCase();
  }

  private hasQueuedPlayer(playerId: string) {
    return this.queuedPlayers.some((player) => this.getPlayerId(player, this.cleanPlayerName(player.name)) === playerId);
  }

  private truncateName(name: string, maxLength: number) {
    return name.length > maxLength ? `${name.slice(0, maxLength - 2)}..` : name;
  }

  private getInitials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
    return initials || "?";
  }

  addChatMessage(user: string, msg: string) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.chatMsgs = [{ id, user, msg, ts: Date.now() }, ...this.chatMsgs].slice(0, 10);
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
    this.isRunning = false;
    this.stopTimers();
    this.clearRoundResetTimer();
    this.removeAllFlags();
  }

  private scheduleRoundReset() {
    this.clearRoundResetTimer();
    this.roundResetTimer = setTimeout(() => {
      this.roundResetTimer = null;
      this.resetRound();
    }, 4000);
  }

  private clearRoundResetTimer() {
    if (!this.roundResetTimer) return;
    clearTimeout(this.roundResetTimer);
    this.roundResetTimer = null;
  }

  private stopTimers() {
    if (this.renderTimer) {
      clearInterval(this.renderTimer);
      this.renderTimer = null;
    }
    if (this.gameLoopTimer) {
      clearInterval(this.gameLoopTimer);
      this.gameLoopTimer = null;
    }
    if (this.physicsTimer) {
      clearInterval(this.physicsTimer);
      this.physicsTimer = null;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private resetSessionState() {
    this.removeAllFlags();
    this.queuedPlayers = [];
    this.gameState = "WAITING";
    this.countdown = 3;
    this.winner = null;
    this.leaderboard = {};
    this.chatMsgs = [];
    this.globalAngle = 0;
    this.endingRound = false;
    this.currentRadius = RADIUS;
    this.gapGrowthRotations = 0;
    this.lastGapRotation = 0;
  }

  private removeAllFlags() {
    this.flags.forEach((f) => Matter.World.remove(this.engine.world, f.body));
    this.flags = [];
  }

  private renderStillFrame() {
    this.render();
    this.canvas.encode("jpeg", 82).then((jpeg) => {
      this.lastJpeg = jpeg;
      this.emit("frame", jpeg);
    }).catch(() => {});
  }
}
