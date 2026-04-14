import React, { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import { Send } from 'lucide-react';

type ChatMessage = {
  id: string;
  user: string;
  msg: string;
  createdAt: number;
};

const COUNTRIES: Record<string, { code: string, emoji: string }> = {
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
  "cape verde": { code: "cv", emoji: "🇨🇻" }, "central african republic": { code: "cf", emoji: "🇨🇫" }, "chad": { code: "td", emoji: "🇹🇩" },
  "chile": { code: "cl", emoji: "🇨🇱" }, "china": { code: "cn", emoji: "🇨🇳" }, "colombia": { code: "co", emoji: "🇨🇴" },
  "comoros": { code: "km", emoji: "🇰🇲" }, "congo": { code: "cg", emoji: "🇨🇬" }, "costa rica": { code: "cr", emoji: "🇨🇷" },
  "croatia": { code: "hr", emoji: "🇭🇷" }, "cuba": { code: "cu", emoji: "🇨🇺" }, "cyprus": { code: "cy", emoji: "🇨🇾" },
  "czech republic": { code: "cz", emoji: "🇨🇿" }, "denmark": { code: "dk", emoji: "🇩🇰" }, "djibouti": { code: "dj", emoji: "🇩🇯" },
  "dominica": { code: "dm", emoji: "🇩🇲" }, "dominican republic": { code: "do", emoji: "🇩🇴" }, "ecuador": { code: "ec", emoji: "🇪🇨" },
  "egypt": { code: "eg", emoji: "🇪🇬" }, "el salvador": { code: "sv", emoji: "🇸🇻" }, "equatorial guinea": { code: "gq", emoji: "🇬🇶" },
  "eritrea": { code: "er", emoji: "🇪🇷" }, "estonia": { code: "ee", emoji: "🇪🇪" }, "eswatini": { code: "sz", emoji: "🇸🇿" },
  "ethiopia": { code: "et", emoji: "🇪🇹" }, "fiji": { code: "fj", emoji: "🇫🇯" }, "finland": { code: "fi", emoji: "🇫🇮" },
  "france": { code: "fr", emoji: "🇫🇷" }, "gabon": { code: "ga", emoji: "🇬🇦" }, "gambia": { code: "gm", emoji: "🇬🇲" },
  "georgia": { code: "ge", emoji: "🇬🇪" }, "germany": { code: "de", emoji: "🇩🇪" }, "ghana": { code: "gh", emoji: "🇬🇭" },
  "greece": { code: "gr", emoji: "🇬🇷" }, "grenada": { code: "gd", emoji: "🇬🇩" }, "guatemala": { code: "gt", emoji: "🇬🇹" },
  "guinea": { code: "gn", emoji: "🇬🇳" }, "guinea-bissau": { code: "gw", emoji: "🇬🇼" }, "guyana": { code: "gy", emoji: "🇬🇾" },
  "haiti": { code: "ht", emoji: "🇭🇹" }, "honduras": { code: "hn", emoji: "🇭🇳" }, "hungary": { code: "hu", emoji: "🇭🇺" },
  "iceland": { code: "is", emoji: "🇮🇸" }, "india": { code: "in", emoji: "🇮🇳" }, "indonesia": { code: "id", emoji: "🇮🇩" },
  "iran": { code: "ir", emoji: "🇮🇷" }, "iraq": { code: "iq", emoji: "🇮🇶" }, "ireland": { code: "ie", emoji: "🇮🇪" },
  "italy": { code: "it", emoji: "🇮🇹" }, "jamaica": { code: "jm", emoji: "🇯🇲" },
  "japan": { code: "jp", emoji: "🇯🇵" }, "jordan": { code: "jo", emoji: "🇯🇴" }, "kazakhstan": { code: "kz", emoji: "🇰🇿" },
  "kenya": { code: "ke", emoji: "🇰🇪" }, "kiribati": { code: "ki", emoji: "🇰🇮" }, "kuwait": { code: "kw", emoji: "🇰🇼" },
  "kyrgyzstan": { code: "kg", emoji: "🇰🇬" }, "laos": { code: "la", emoji: "🇱🇦" }, "latvia": { code: "lv", emoji: "🇱🇻" },
  "lebanon": { code: "lb", emoji: "🇱🇧" }, "lesotho": { code: "ls", emoji: "🇱🇸" }, "liberia": { code: "lr", emoji: "🇱🇷" },
  "libya": { code: "ly", emoji: "🇱🇾" }, "liechtenstein": { code: "li", emoji: "🇱🇮" }, "lithuania": { code: "lt", emoji: "🇱🇹" },
  "luxembourg": { code: "lu", emoji: "🇱🇺" }, "madagascar": { code: "mg", emoji: "🇲🇬" }, "malawi": { code: "mw", emoji: "🇲🇼" },
  "malaysia": { code: "my", emoji: "🇲🇾" }, "maldives": { code: "mv", emoji: "🇲🇻" }, "mali": { code: "ml", emoji: "🇲🇱" },
  "malta": { code: "mt", emoji: "🇲🇹" }, "marshall islands": { code: "mh", emoji: "🇲🇭" }, "mauritania": { code: "mr", emoji: "🇲🇷" },
  "mauritius": { code: "mu", emoji: "🇲🇺" }, "mexico": { code: "mx", emoji: "🇲🇽" }, "micronesia": { code: "fm", emoji: "🇫🇲" },
  "moldova": { code: "md", emoji: "🇲🇩" }, "monaco": { code: "mc", emoji: "🇲🇨" }, "mongolia": { code: "mn", emoji: "🇲🇳" },
  "montenegro": { code: "me", emoji: "🇲🇪" }, "morocco": { code: "ma", emoji: "🇲🇦" }, "mozambique": { code: "mz", emoji: "🇲🇿" },
  "myanmar": { code: "mm", emoji: "🇲🇲" }, "namibia": { code: "na", emoji: "🇳🇦" }, "nauru": { code: "nr", emoji: "🇳🇷" },
  "nepal": { code: "np", emoji: "🇳🇵" }, "netherlands": { code: "nl", emoji: "🇳🇱" }, "new zealand": { code: "nz", emoji: "🇳🇿" },
  "nicaragua": { code: "ni", emoji: "🇳🇮" }, "niger": { code: "ne", emoji: "🇳🇪" }, "nigeria": { code: "ng", emoji: "🇳🇬" },
  "north korea": { code: "kp", emoji: "🇰🇵" }, "north macedonia": { code: "mk", emoji: "🇲🇰" }, "norway": { code: "no", emoji: "🇳🇴" },
  "oman": { code: "om", emoji: "🇴🇲" }, "pakistan": { code: "pk", emoji: "🇵🇰" }, "palau": { code: "pw", emoji: "🇵🇼" },
  "palestine": { code: "ps", emoji: "🇵🇸" }, "panama": { code: "pa", emoji: "🇵🇦" }, "papua new guinea": { code: "pg", emoji: "🇵🇬" },
  "paraguay": { code: "py", emoji: "🇵🇾" }, "peru": { code: "pe", emoji: "🇵🇪" }, "philippines": { code: "ph", emoji: "🇵🇭" },
  "poland": { code: "pl", emoji: "🇵🇱" }, "portugal": { code: "pt", emoji: "🇵🇹" }, "qatar": { code: "qa", emoji: "🇶🇦" },
  "romania": { code: "ro", emoji: "🇷🇴" }, "russia": { code: "ru", emoji: "🇷🇺" }, "rwanda": { code: "rw", emoji: "🇷🇼" },
  "saint kitts": { code: "kn", emoji: "🇰🇳" }, "saint lucia": { code: "lc", emoji: "🇱🇨" }, "saint vincent": { code: "vc", emoji: "🇻🇨" },
  "samoa": { code: "ws", emoji: "🇼🇸" }, "san marino": { code: "sm", emoji: "🇸🇲" }, "sao tome": { code: "st", emoji: "🇸🇹" },
  "saudi arabia": { code: "sa", emoji: "🇸🇦" }, "senegal": { code: "sn", emoji: "🇸🇳" }, "serbia": { code: "rs", emoji: "🇷🇸" },
  "seychelles": { code: "sc", emoji: "🇸🇨" }, "sierra leone": { code: "sl", emoji: "🇸🇱" }, "singapore": { code: "sg", emoji: "🇸🇬" },
  "slovakia": { code: "sk", emoji: "🇸🇰" }, "slovenia": { code: "si", emoji: "🇸🇮" }, "solomon islands": { code: "sb", emoji: "🇸🇧" },
  "somalia": { code: "so", emoji: "🇸🇴" }, "south africa": { code: "za", emoji: "🇿🇦" }, "south korea": { code: "kr", emoji: "🇰🇷" },
  "south sudan": { code: "ss", emoji: "🇸🇸" }, "spain": { code: "es", emoji: "🇪🇸" }, "sri lanka": { code: "lk", emoji: "🇱🇰" },
  "sudan": { code: "sd", emoji: "🇸🇩" }, "suriname": { code: "sr", emoji: "🇸🇷" }, "sweden": { code: "se", emoji: "🇸🇪" },
  "switzerland": { code: "ch", emoji: "🇨🇭" }, "syria": { code: "sy", emoji: "🇸🇾" }, "taiwan": { code: "tw", emoji: "🇹🇼" },
  "tajikistan": { code: "tj", emoji: "🇹🇯" }, "tanzania": { code: "tz", emoji: "🇹🇿" }, "thailand": { code: "th", emoji: "🇹🇭" },
  "togo": { code: "tg", emoji: "🇹🇬" }, "tonga": { code: "to", emoji: "🇹🇴" }, "trinidad": { code: "tt", emoji: "🇹🇹" },
  "tunisia": { code: "tn", emoji: "🇹🇳" }, "turkey": { code: "tr", emoji: "🇹🇷" }, "turkmenistan": { code: "tm", emoji: "🇹🇲" },
  "tuvalu": { code: "tv", emoji: "🇹🇻" }, "uganda": { code: "ug", emoji: "🇺🇬" }, "ukraine": { code: "ua", emoji: "🇺🇦" },
  "uae": { code: "ae", emoji: "🇦🇪" }, "united arab emirates": { code: "ae", emoji: "🇦🇪" }, "uk": { code: "gb", emoji: "🇬🇧" },
  "united kingdom": { code: "gb", emoji: "🇬🇧" }, "usa": { code: "us", emoji: "🇺🇸" }, "united states": { code: "us", emoji: "🇺🇸" },
  "uruguay": { code: "uy", emoji: "🇺🇾" }, "uzbekistan": { code: "uz", emoji: "🇺🇿" }, "vanuatu": { code: "vu", emoji: "🇻🇺" },
  "vatican city": { code: "va", emoji: "🇻🇦" }, "venezuela": { code: "ve", emoji: "🇻🇪" }, "vietnam": { code: "vn", emoji: "🇻🇳" },
  "yemen": { code: "ye", emoji: "🇾🇪" }, "zambia": { code: "zm", emoji: "🇿🇲" }, "zimbabwe": { code: "zw", emoji: "🇿🇼" }
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const reqRef = useRef<number>();

  const [gameState, setGameState] = useState<'WAITING' | 'COUNTDOWN' | 'PLAYING' | 'ENDED'>('WAITING');
  const [countdown, setCountdown] = useState(10);
  const [winner, setWinner] = useState<{country: string, emoji: string, img?: HTMLImageElement} | null>(null);
  const [leaderboard, setLeaderboard] = useState<Record<string, number>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Login State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [streamKey, setStreamKey] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [youtubeApiKey, setYoutubeApiKey] = useState('');
  const [youtubeVideoId, setYoutubeVideoId] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const liveChatIdRef = useRef<string | null>(null);
  const nextPageTokenRef = useRef<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'admin@admin.com' && password === 'admin123') {
      setIsLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('Invalid email or password');
    }
  };

  const gameStateRef = useRef({
    state: 'WAITING',
    flags: [] as { id: string, body: Matter.Body, country: string, emoji: string, img?: HTMLImageElement }[],
    roundCountries: new Set<string>(),
  });

  const canvasWidth = 700;
  const canvasHeight = 700;
  const center = { x: canvasWidth / 2, y: canvasHeight / 2 };
  const radius = 280;
  const flagInitialSpeed = 11;
  const flagForceScale = 0.0024;
  const flagMaxSpeed = 11;
  const chatMessageLifetimeMs = 6000;
  const maxVisibleChatMessages = 8;
  const totalSegments = 60;
  const gapSegments = 8;
  let globalAngle = 0;

  // Audio Context for bounce sound
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastSoundTimeRef = useRef<number>(0);

  const playBounceSound = () => {
      if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const now = Date.now();
      if (now - lastSoundTimeRef.current < 50) return; // limit sound rate
      lastSoundTimeRef.current = now;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      if (!audioDestRef.current) {
          audioDestRef.current = ctx.createMediaStreamDestination();
      }

      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.connect(audioDestRef.current);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
  };

  const addChatMessage = (user: string, msg: string) => {
      const createdAt = Date.now();
      const nextMessage: ChatMessage = {
          id: `${createdAt}-${Math.random().toString(36).slice(2)}`,
          user,
          msg,
          createdAt
      };

      setChatMessages(prev => {
          return [...prev, nextMessage].slice(-50);
      });
  };

  const stopStreamingSession = () => {
      const recorder = mediaRecorderRef.current;
      mediaRecorderRef.current = null;
      if (recorder && recorder.state !== 'inactive') {
          recorder.stop();
      }

      const ws = wsRef.current;
      wsRef.current = null;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
          ws.close();
      }

      const displayStream = displayStreamRef.current;
      displayStreamRef.current = null;
      if (displayStream) {
          displayStream.getTracks().forEach(track => track.stop());
      }

      setIsStreaming(false);
  };

  const toggleStream = async () => {
      if (isStreaming) {
          stopStreamingSession();
          return;
      }

      if (!streamUrl || !streamKey) {
          alert('Please provide Stream URL and Stream Key in the login screen.');
          return;
      }

      // Initialize audio context if not already
      if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (!audioDestRef.current) {
          audioDestRef.current = audioCtxRef.current.createMediaStreamDestination();
      }

      if (!navigator.mediaDevices?.getDisplayMedia) {
          alert('This browser does not support full-tab capture for streaming.');
          return;
      }

      let displayStream: MediaStream;
      try {
          displayStream = await navigator.mediaDevices.getDisplayMedia({
              video: {
                  frameRate: 30,
                  width: { ideal: 1920 },
                  height: { ideal: 1080 }
              },
              audio: false,
              preferCurrentTab: true,
              selfBrowserSurface: 'include',
              surfaceSwitching: 'exclude'
          } as MediaStreamConstraints & {
              preferCurrentTab?: boolean;
              selfBrowserSurface?: 'include' | 'exclude';
              surfaceSwitching?: 'include' | 'exclude';
          });
      } catch (error) {
          console.error('Display capture was cancelled or failed:', error);
          return;
      }

      const videoTrack = displayStream.getVideoTracks()[0];
      if (!videoTrack) {
          displayStream.getTracks().forEach(track => track.stop());
          alert('No video track was provided by screen capture.');
          return;
      }

      displayStreamRef.current = displayStream;
      videoTrack.addEventListener('ended', () => {
          stopStreamingSession();
      }, { once: true });

      const audioStream = audioDestRef.current.stream;
      const combinedStream = new MediaStream([
          videoTrack,
          ...audioStream.getAudioTracks()
      ]);

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
          const fullRtmpUrl = streamUrl.endsWith('/') ? `${streamUrl}${streamKey}` : `${streamUrl}/${streamKey}`;
          ws.send(JSON.stringify({ type: 'start', rtmpUrl: fullRtmpUrl }));

          const mimeType = [
              'video/webm; codecs=vp9,opus',
              'video/webm; codecs=vp8,opus',
              'video/webm'
          ].find(type => MediaRecorder.isTypeSupported(type));
          const mediaRecorder = mimeType
              ? new MediaRecorder(combinedStream, { mimeType })
              : new MediaRecorder(combinedStream);

          mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                  ws.send(e.data);
              }
          };

          mediaRecorder.onstop = () => {
              if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                  ws.close();
              }
          };

          mediaRecorder.start(1000); // Send chunks every second
          mediaRecorderRef.current = mediaRecorder;
          setIsStreaming(true);
      };

      ws.onerror = (err) => {
          console.error('WebSocket error:', err);
          alert('Failed to connect to streaming server.');
          stopStreamingSession();
      };

      ws.onclose = () => {
          displayStream.getTracks().forEach(track => track.stop());
          displayStreamRef.current = null;
          mediaRecorderRef.current = null;
          wsRef.current = null;
          setIsStreaming(false);
      };
  };

  useEffect(() => {
    return () => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
        }

        const ws = wsRef.current;
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            ws.close();
        }

        const displayStream = displayStreamRef.current;
        if (displayStream) {
            displayStream.getTracks().forEach(track => track.stop());
        }
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
        const cutoff = Date.now() - 5000;
        setChatMessages(prev => prev.filter(item => item.createdAt >= cutoff));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const engine = Matter.Engine.create();
    engine.gravity.y = 0;
    engine.gravity.x = 0;
    engine.gravity.scale = 0;
    engineRef.current = engine;

    const allParts: any[] = [];
    for (let i = 0; i < totalSegments; i++) {
        const segmentLength = (Math.PI * 2 * radius) / totalSegments + 4;
        const part = Matter.Bodies.rectangle(0, 0, 12, segmentLength, {
            isStatic: true,
            friction: 0.1,
            restitution: 0.8,
        });
        (part as any).customIndex = i;
        (part as any).isGap = i < gapSegments;
        allParts.push(part);
        Matter.World.add(engine.world, part);
    }

    const toTitleCase = (str: string) =>
        str.replace(/\b\w/g, (l) => l.toUpperCase());

    const handleWin = (winningFlag: any) => {
        gameStateRef.current.state = 'ENDED';
        setGameState('ENDED');
        setWinner(winningFlag);

        setLeaderboard(prev => ({
            ...prev,
            [winningFlag.country]: (prev[winningFlag.country] || 0) + 1
        }));

        // Delay speech so it fires outside the physics engine callback
        setTimeout(() => {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel(); // clear any queued speech
                const utterance = new SpeechSynthesisUtterance(`${toTitleCase(winningFlag.country)} wins!`);
                utterance.rate = 0.95;
                utterance.pitch = 1.1;
                utterance.volume = 1;
                window.speechSynthesis.speak(utterance);
            }
        }, 200);

        setTimeout(() => {
            gameStateRef.current.flags.forEach(f => Matter.World.remove(engine.world, f.body));
            gameStateRef.current.flags = [];
            gameStateRef.current.roundCountries.clear();
            setWinner(null);
            gameStateRef.current.state = 'WAITING';
            setGameState('WAITING');
        }, 5000);
    };

    const handleDraw = () => {
        gameStateRef.current.state = 'ENDED';
        setGameState('ENDED');
        setWinner({ country: 'Nobody', emoji: '🏳️' });

        setTimeout(() => {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(`It's a draw!`);
                utterance.rate = 0.95;
                utterance.pitch = 1.1;
                utterance.volume = 1;
                window.speechSynthesis.speak(utterance);
            }
        }, 200);

        setTimeout(() => {
            gameStateRef.current.flags.forEach(f => Matter.World.remove(engine.world, f.body));
            gameStateRef.current.flags = [];
            gameStateRef.current.roundCountries.clear();
            setWinner(null);
            gameStateRef.current.state = 'WAITING';
            setGameState('WAITING');
        }, 5000);
    }

    Matter.Events.on(engine, 'collisionStart', (event) => {
        playBounceSound();
    });

    Matter.Events.on(engine, 'beforeUpdate', () => {
        const currentState = gameStateRef.current.state;

        if (currentState === 'PLAYING') {
            globalAngle += 0.025;
        } else {
            globalAngle += 0.005;
        }

        allParts.forEach((part) => {
            const originalAngle = (part.customIndex / totalSegments) * Math.PI * 2;
            const currentAngle = originalAngle + globalAngle;
            let px = center.x + Math.cos(currentAngle) * radius;
            let py = center.y + Math.sin(currentAngle) * radius;

            if (part.isGap) {
                px = -1000;
                py = -1000;
            }

            Matter.Body.setPosition(part, { x: px, y: py });
            Matter.Body.setAngle(part, currentAngle);
        });

        const flags = gameStateRef.current.flags;
        for (let i = flags.length - 1; i >= 0; i--) {
            const flag = flags[i];

            // Molecule movement
            if (currentState === 'PLAYING') {
                const forceMag = flagForceScale * flag.body.mass;
                Matter.Body.applyForce(flag.body, flag.body.position, {
                    x: (Math.random() - 0.5) * forceMag,
                    y: (Math.random() - 0.5) * forceMag
                });
                
                const speed = Matter.Vector.magnitude(flag.body.velocity);
                if (speed > flagMaxSpeed) {
                    Matter.Body.setVelocity(flag.body, Matter.Vector.mult(Matter.Vector.normalise(flag.body.velocity), flagMaxSpeed));
                }
            }

            const dx = flag.body.position.x - center.x;
            const dy = flag.body.position.y - center.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist > radius + 30) {
                if (currentState === 'PLAYING') {
                    // Eliminate flag only during active game
                    Matter.World.remove(engine.world, flag.body);
                    flags.splice(i, 1);
                } else {
                    // During WAITING/COUNTDOWN: bounce flag back to center
                    Matter.Body.setPosition(flag.body, { x: center.x, y: center.y });
                    Matter.Body.setVelocity(flag.body, {
                        x: (Math.random() - 0.5) * flagInitialSpeed,
                        y: (Math.random() - 0.5) * flagInitialSpeed
                    });
                }
            }
        }

        if (currentState === 'PLAYING' && flags.length <= 1) {
            if (flags.length === 1) {
                handleWin(flags[0]);
            } else {
                handleDraw();
            }
        }
    });

    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);

    const render = () => {
        reqRef.current = requestAnimationFrame(render);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw ring
        ctx.fillStyle = '#2563EB'; // Blue
        allParts.forEach(part => {
            if (part.position.x < 0) return; // Skip hidden gap parts
            ctx.beginPath();
            ctx.moveTo(part.vertices[0].x, part.vertices[0].y);
            for (let j = 1; j < part.vertices.length; j++) {
                ctx.lineTo(part.vertices[j].x, part.vertices[j].y);
            }
            ctx.lineTo(part.vertices[0].x, part.vertices[0].y);
            ctx.fill();
        });

        // Draw flags
        gameStateRef.current.flags.forEach(flag => {
            ctx.save();
            ctx.translate(flag.body.position.x, flag.body.position.y);
            ctx.rotate(flag.body.angle);
            
            // Clip to circle
            ctx.beginPath();
            ctx.arc(0, 0, 40, 0, Math.PI * 2);
            ctx.clip();

            if (flag.img && flag.img.complete && flag.img.naturalWidth > 0) {
                // Draw image to cover the 80x80 area (maintaining 4:3)
                ctx.drawImage(flag.img, -60, -45, 120, 90);
            } else {
                ctx.fillStyle = '#333333';
                ctx.fill();
                ctx.font = '40px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = 'white';
                ctx.fillText(flag.emoji, 0, 4);
            }
            ctx.restore();

            // Draw border separately so it's not clipped
            ctx.save();
            ctx.translate(flag.body.position.x, flag.body.position.y);
            ctx.beginPath();
            ctx.arc(0, 0, 40, 0, Math.PI * 2);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#FF3D68';
            ctx.shadowColor = 'rgba(255, 61, 104, 0.3)';
            ctx.shadowBlur = 15;
            ctx.stroke();
            ctx.restore();
        });
    };
    render();

    return () => {
        Matter.Runner.stop(runner);
        Matter.Engine.clear(engine);
        if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, []);

  // Game State Logic Loop
  useEffect(() => {
    const interval = setInterval(() => {
        const state = gameStateRef.current.state;
        const flags = gameStateRef.current.flags;

        if (state === 'WAITING' && flags.length >= 2) {
            setGameState('COUNTDOWN');
            gameStateRef.current.state = 'COUNTDOWN';
            setCountdown(3);
        } else if (state === 'COUNTDOWN') {
            setCountdown(c => {
                if (c <= 1) {
                    setGameState('PLAYING');
                    gameStateRef.current.state = 'PLAYING';
                    return 0;
                }
                return c - 1;
            });
        }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const spawnFlag = (countryName: string) => {
    const state = gameStateRef.current.state;
    if (state === 'ENDED') return;

    const normalized = countryName.trim().toLowerCase();
    const countryData = COUNTRIES[normalized as keyof typeof COUNTRIES];
    if (!countryData) return;

    if (gameStateRef.current.roundCountries.has(normalized)) return;

    const x = center.x + (Math.random() - 0.5) * 100;
    const y = center.y + (Math.random() - 0.5) * 100;

    const body = Matter.Bodies.circle(x, y, 40, {
        restitution: 1.0,
        friction: 0,
        frictionAir: 0,
        density: 0.05,
    });

    Matter.Body.setVelocity(body, {
        x: (Math.random() - 0.5) * flagInitialSpeed,
        y: (Math.random() - 0.5) * flagInitialSpeed
    });

    const img = new Image();
    img.src = `https://flagcdn.com/w80/${countryData.code}.png`;

    if (engineRef.current) {
        Matter.World.add(engineRef.current.world, body);
        gameStateRef.current.flags.push({
            id: Math.random().toString(),
            body,
            country: normalized,
            emoji: countryData.emoji,
            img
        });
        gameStateRef.current.roundCountries.add(normalized);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const msg = chatInput.trim();
    addChatMessage('You', msg);
    spawnFlag(msg);
    setChatInput('');
  };

  // YouTube Live Chat Polling
  useEffect(() => {
    if (!isLoggedIn || !youtubeApiKey || !youtubeVideoId) return;

    let isPolling = true;
    let pollTimeout: any;

    const fetchLiveChatId = async () => {
        try {
            const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${youtubeVideoId}&key=${youtubeApiKey}`);
            const data = await res.json();
            if (data.items && data.items.length > 0 && data.items[0].liveStreamingDetails) {
                liveChatIdRef.current = data.items[0].liveStreamingDetails.activeLiveChatId;
                pollChat();
            } else {
                console.error("No active live stream found for this video ID.");
            }
        } catch (e) {
            console.error("Error fetching live chat ID", e);
        }
    };

    const pollChat = async () => {
        if (!isPolling || !liveChatIdRef.current) return;
        try {
            let url = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${liveChatIdRef.current}&part=snippet,authorDetails&key=${youtubeApiKey}`;
            if (nextPageTokenRef.current) {
                url += `&pageToken=${nextPageTokenRef.current}`;
            }
            const res = await fetch(url);
            const data = await res.json();

            if (data.items && data.items.length > 0) {
                const sortedCountries = Object.keys(COUNTRIES).sort((a, b) => b.length - a.length);
                
                data.items.forEach((item: any) => {
                    const msg = item.snippet.displayMessage.toLowerCase();
                    const author = item.authorDetails.displayName;
                    
                    const matchedCountry = sortedCountries.find(c => msg.includes(c));
                    
                    if (matchedCountry) {
                        addChatMessage(author, matchedCountry);
                        spawnFlag(matchedCountry);
                    }
                });
            }

            nextPageTokenRef.current = data.nextPageToken;
            const nextPoll = data.pollingIntervalMillis || 5000;
            pollTimeout = setTimeout(pollChat, nextPoll);

        } catch (e) {
            console.error("Error polling chat", e);
            pollTimeout = setTimeout(pollChat, 5000);
        }
    };

    fetchLiveChatId();

    return () => {
        isPolling = false;
        clearTimeout(pollTimeout);
    };
  }, [isLoggedIn, youtubeApiKey, youtubeVideoId]);

  // Removed auto-simulate chat (Fallback) mock data

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border border-gray-200">
          <div className="text-center mb-8">
            <h1 className="font-black text-3xl tracking-tighter uppercase text-black mb-2">Flag Flight</h1>
            <p className="text-gray-500 text-sm font-medium">Streamer Dashboard Login</p>
          </div>

          {loginError && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm font-bold text-center border border-red-200">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 text-gray-900 px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-[#FF3D68] focus:ring-1 focus:ring-[#FF3D68]"
                placeholder="admin@admin.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 text-gray-900 px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-[#FF3D68] focus:ring-1 focus:ring-[#FF3D68]"
                placeholder="admin123"
                required
              />
            </div>

            <div className="pt-4 border-t border-gray-100 mt-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">YouTube Live Chat Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">YouTube API Key</label>
                  <input
                    type="password"
                    value={youtubeApiKey}
                    onChange={(e) => setYoutubeApiKey(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 text-gray-900 px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-[#FF3D68] focus:ring-1 focus:ring-[#FF3D68]"
                    placeholder="AIzaSy..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">YouTube Video ID</label>
                  <input
                    type="text"
                    value={youtubeVideoId}
                    onChange={(e) => setYoutubeVideoId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 text-gray-900 px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-[#FF3D68] focus:ring-1 focus:ring-[#FF3D68]"
                    placeholder="dQw4w9WgXcQ"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Leave these blank to use simulated chat.</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 mt-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">YouTube Stream Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Stream URL</label>
                  <input
                    type="text"
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 text-gray-900 px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-[#FF3D68] focus:ring-1 focus:ring-[#FF3D68]"
                    placeholder="rtmp://a.rtmp.youtube.com/live2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Stream Key</label>
                  <input
                    type="password"
                    value={streamKey}
                    onChange={(e) => setStreamKey(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 text-gray-900 px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-[#FF3D68] focus:ring-1 focus:ring-[#FF3D68]"
                    placeholder="xxxx-xxxx-xxxx-xxxx"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#FF3D68] text-white font-black uppercase tracking-widest py-4 rounded-lg mt-8 hover:bg-[#e0355b] transition-colors shadow-md"
            >
              Login & Start Game
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-screen bg-white text-gray-900 font-sans overflow-hidden grid gap-[1px]"
      style={{
        gridTemplateColumns: '280px minmax(0, 1fr) 280px',
        gridTemplateRows: '80px minmax(0, 1fr) 100px',
      }}
    >
      <header className="col-span-3 bg-gray-50 flex items-center justify-between px-10 border-b border-gray-200">
          <div className="font-black text-2xl tracking-tighter uppercase text-black">Flag Flight // Control</div>
          <div className="font-bold text-[#FF3D68] text-sm tracking-widest uppercase">
              {gameState === 'PLAYING' ? 'Round in Progress' : gameState === 'WAITING' ? 'Waiting for Players' : 'Round Ended'}
          </div>
          <div className="flex items-center gap-4">
              <button 
                  onClick={toggleStream}
                  className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-widest transition-colors ${
                      isStreaming 
                          ? 'bg-red-500 text-white animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]' 
                          : 'bg-gray-800 text-white hover:bg-gray-700'
                  }`}
              >
                  {isStreaming ? 'Stop Stream' : 'Start Stream'}
              </button>
              <div className="flex items-center gap-2 text-[#FF3D68] text-xs">
                  <div className="w-2 h-2 bg-[#FF3D68] rounded-full shadow-[0_0_10px_#FF3D68] animate-pulse"></div>
                  Voice Synthesis Ready
              </div>
          </div>
      </header>

      <aside className="bg-gray-50/80 p-6 border-r border-gray-200 flex flex-col min-h-0 overflow-hidden">
          <div className="text-[11px] uppercase tracking-widest text-gray-500 mb-5">Global Leaderboard</div>
          {Object.entries(leaderboard).length === 0 && (
              <div className="text-center text-xs text-gray-400 py-2">No wins yet</div>
          )}
          {Object.entries(leaderboard)
              .sort(([,a], [,b]) => (b as number) - (a as number))
              .slice(0, 6)
              .map(([country, wins], i) => (
                  <div key={country} className="flex justify-between items-center py-3 border-b border-gray-200">
                      <span className="font-black text-[#FF3D68] mr-2">0{i + 1}</span>
                      <span className="flex-1 font-medium capitalize text-gray-800">{country}</span>
                      <span className="font-mono text-gray-500">{wins}w</span>
                  </div>
          ))}
      </aside>

      <main className="relative flex items-center justify-center min-h-0 overflow-hidden">
          {/* Status Overlay */}
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-10 pointer-events-none text-center w-full">
              {gameState === 'WAITING' && (
                  <div className="bg-white border border-gray-300 text-[#FF3D68] px-4 py-2 rounded font-bold animate-pulse uppercase tracking-widest text-xs shadow-sm inline-block">
                      Waiting for players... ({gameStateRef.current.flags.length}/2)
                  </div>
              )}
          </div>

          {gameState === 'COUNTDOWN' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-white/90">
                  <div className="text-gray-500 font-black tracking-[0.5em] uppercase text-2xl mb-4">Match Starts In</div>
                  <div className="text-[#FF3D68] font-black text-[150px] leading-none animate-ping drop-shadow-2xl">
                      {countdown}
                  </div>
              </div>
          )}

          {/* Canvas */}
          <canvas 
              ref={canvasRef} 
              width={canvasWidth} 
              height={canvasHeight}
              className="max-w-full max-h-full object-contain block"
          />

          {/* Winner Overlay */}
          {gameState === 'ENDED' && winner && (
              <div className="absolute bottom-10 text-center w-full animate-bounce">
                  <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-2">Last Round Winner</div>
                  <div className="text-[82px] font-black leading-[0.9] tracking-[-4px] uppercase text-black drop-shadow-2xl flex items-center justify-center gap-4">
                      {winner.img ? (
                          <img src={winner.img.src} alt={winner.country} className="w-24 h-24 object-cover rounded-full border-4 border-[#FF3D68] shadow-[0_0_30px_rgba(255,61,104,0.5)]" />
                      ) : (
                          winner.emoji
                      )}
                      {winner.country.replace(/\b\w/g, (l) => l.toUpperCase())}
                  </div>
              </div>
          )}
      </main>

      <aside className="bg-gray-50/80 p-6 pl-0 border-l border-gray-200 flex flex-col min-h-0 overflow-hidden">
          <div className="text-lg font-black uppercase tracking-widest text-gray-800 mb-5 border-b border-gray-200 pb-2 pl-6">Live Chat Spawns</div>
          <div className="flex-1 min-h-0 overflow-hidden pl-6 pr-4">
              <div className="flex flex-col gap-3 text-lg leading-[1.35]">
                  {[...chatMessages].reverse().map(msg => (
                  <div key={msg.id} className="animate-fade-in-up border-b border-gray-200 pb-3">
                      <span className="font-black text-[#FF3D68]">{msg.user}: </span>
                      <span className="text-gray-800 font-bold">{msg.msg}</span>
                      <span className="text-orange-500 font-bold italic text-xs block mt-1">+1 Flag Spawned</span>
                  </div>
              ))}
              </div>
          </div>
      </aside>

      <footer className="col-span-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between px-10">
          <form onSubmit={handleChatSubmit} className="flex gap-2 w-[400px]">
              <input 
                  type="text" 
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Type a country name..."
                  className="flex-1 bg-white border border-gray-300 text-gray-900 px-4 py-2 rounded text-[11px] font-bold uppercase tracking-widest focus:outline-none focus:border-[#FF3D68]"
              />
              <button type="submit" className="bg-[#FF3D68] text-white px-6 py-2 rounded text-[11px] font-bold uppercase tracking-widest border border-[#FF3D68] hover:bg-transparent hover:text-[#FF3D68] transition-colors">
                  Spawn
              </button>
          </form>

          <div className="flex gap-10">
              <div className="flex flex-col">
                  <span className="font-black text-lg text-black">{gameStateRef.current.flags.length}</span>
                  <span className="text-[9px] text-gray-500 uppercase tracking-widest">Flags in Arena</span>
              </div>
              <div className="flex flex-col">
                  <span className="font-black text-lg text-black">1.2s</span>
                  <span className="text-[9px] text-gray-500 uppercase tracking-widest">Rotation Speed</span>
              </div>
              <div className="flex flex-col">
                  <span className="font-black text-lg text-black">{chatMessages.length}</span>
                  <span className="text-[9px] text-gray-500 uppercase tracking-widest">Chat Commands</span>
              </div>
          </div>

          <div className="text-[9px] text-gray-500 uppercase tracking-widest">Running v1.0.4-STABLE</div>
      </footer>
    </div>
  );
}
