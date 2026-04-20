import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Send } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type GameStateName = 'WAITING' | 'COUNTDOWN' | 'PLAYING' | 'ENDED';

interface GameState {
  gameState: GameStateName;
  countdown: number;
  flagCount: number;
  leaderboard: Record<string, number>;
  chatMessages: Array<{ id: string; user: string; msg: string }>;
  winner: { country: string; emoji: string } | null;
  isStreaming: boolean;
  currentQuality: string;
}

const DEFAULT_STATE: GameState = {
  gameState: 'WAITING',
  countdown: 3,
  flagCount: 0,
  leaderboard: {},
  chatMessages: [],
  winner: null,
  isStreaming: false,
  currentQuality: '720p',
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  // Auth
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Credentials
  const [streamUrl, setStreamUrl] = useState('rtmp://a.rtmp.youtube.com/live2');
  const [streamKey, setStreamKey] = useState('');
  const [youtubeApiKey, setYoutubeApiKey] = useState('');
  const [youtubeVideoId, setYoutubeVideoId] = useState('');

  // Refs so closures always see latest values
  const streamUrlRef = useRef(streamUrl);
  const streamKeyRef = useRef(streamKey);
  const youtubeApiKeyRef = useRef(youtubeApiKey);
  const youtubeVideoIdRef = useRef(youtubeVideoId);
  useEffect(() => { streamUrlRef.current = streamUrl; }, [streamUrl]);
  useEffect(() => { streamKeyRef.current = streamKey; }, [streamKey]);
  useEffect(() => { youtubeApiKeyRef.current = youtubeApiKey; }, [youtubeApiKey]);
  useEffect(() => { youtubeVideoIdRef.current = youtubeVideoId; }, [youtubeVideoId]);

  // Game state (from server)
  const [game, setGame] = useState<GameState>(DEFAULT_STATE);

  // Control input
  const [spawnInput, setSpawnInput] = useState('');
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  // ─── Audio context for bounce beep ───────────────────────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playBounceBeep = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } catch (_) {}
  }, []);

  // ─── Speech synthesis winner announcement ─────────────────────────────────────
  const prevGameStateRef = useRef<string>('WAITING');
  const announceWinner = useCallback((country: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(
      `The winner is ${country}`
    );
    utter.lang = 'en-US';
    utter.rate = 0.95;
    utter.pitch = 1.1;
    utter.volume = 1;
    window.speechSynthesis.speak(utter);
  }, []);

  // ─── WebSocket connection ─────────────────────────────────────────────────
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => { setWsConnected(false); setIsLoggedIn(false); };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case 'state':
          setGame(prev => {
            // Announce winner when transitioning into ENDED state
            if (
              prevGameStateRef.current !== 'ENDED' &&
              msg.gameState === 'ENDED' &&
              msg.winner
            ) {
              const country = msg.winner.country.replace(/\b\w/g, (l: string) => l.toUpperCase());
              announceWinner(country);
            }
            prevGameStateRef.current = msg.gameState;
            return {
              gameState: msg.gameState,
              countdown: msg.countdown,
              flagCount: msg.flagCount,
              leaderboard: msg.leaderboard || {},
              chatMessages: msg.chatMessages || [],
              winner: msg.winner,
              isStreaming: msg.isStreaming,
              currentQuality: msg.currentQuality || prev.currentQuality
            };
          });
          break;
        case 'bounce':
          playBounceBeep();
          break;
        case 'loginResult':
          if (msg.success) {
            setIsLoggedIn(true);
            setLoginError('');
          } else {
            setLoginError('Invalid password');
          }
          break;
        case 'streamStatus':
          setGame(prev => ({ ...prev, isStreaming: msg.isStreaming }));
          if (msg.error) console.error('Stream error:', msg.error);
          break;
        case 'error':
          console.error('Server error:', msg.message);
          break;
      }
    };

    return () => ws.close();
  }, []);

  const send = (data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  };

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    send({ type: 'login', password });
    // Also send credentials now while values are fresh (avoids stale closure)
    send({
      type: 'setCredentials',
      youtubeApiKey: youtubeApiKeyRef.current,
      youtubeVideoId: youtubeVideoIdRef.current,
    });
  };

  const handleToggleStream = () => {
    if (game.isStreaming) {
      send({ type: 'stopStream' });
    } else {
      const url = streamUrlRef.current;
      const key = streamKeyRef.current;
      const fullRtmpUrl = url.endsWith('/') ? `${url}${key}` : `${url}/${key}`;
      // Re-send credentials in case they changed since login
      send({
        type: 'setCredentials',
        youtubeApiKey: youtubeApiKeyRef.current,
        youtubeVideoId: youtubeVideoIdRef.current,
      });
      send({ type: 'startStream', rtmpUrl: fullRtmpUrl });
    }
  };

  const handleSpawn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!game.isStreaming || !spawnInput.trim()) return;
    send({ type: 'spawnPlayer', name: spawnInput.trim(), user: 'Admin' });
    setSpawnInput('');
  };

  const handleQualityChange = (q: string) => {
    send({ type: 'changeQuality', quality: q });
  };

  // ─── Login screen ──────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border border-gray-200">
          <div className="text-center mb-8">
            <h1 className="font-black text-3xl tracking-tighter uppercase text-black mb-2">Bot</h1>
            <p className="text-gray-500 text-sm font-medium">Streamer Dashboard Login</p>
            <div className={`mt-2 inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full ${wsConnected ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-400'}`}></span>
              {wsConnected ? 'Server Connected' : 'Connecting...'}
            </div>
          </div>

          {loginError && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm font-bold text-center border border-red-200">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 text-gray-900 px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-[#FF3D68]"
                placeholder="••••••••••" required />
            </div>

            <div className="pt-4 border-t border-gray-100 mt-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">YouTube Live Chat (optional)</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">YouTube API Key</label>
                  <input type="password" value={youtubeApiKey} onChange={e => setYoutubeApiKey(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 text-gray-900 px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-[#FF3D68]"
                    placeholder="AIzaSy..." />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">YouTube Video ID</label>
                  <input type="text" value={youtubeVideoId} onChange={e => setYoutubeVideoId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 text-gray-900 px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-[#FF3D68]"
                    placeholder="dQw4w9WgXcQ" />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 mt-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">YouTube Stream Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Stream URL</label>
                  <input type="text" value={streamUrl} onChange={e => setStreamUrl(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 text-gray-900 px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-[#FF3D68]"
                    placeholder="rtmp://a.rtmp.youtube.com/live2" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Stream Key</label>
                  <input type="password" value={streamKey} onChange={e => setStreamKey(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 text-gray-900 px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-[#FF3D68]"
                    placeholder="xxxx-xxxx-xxxx-xxxx" required />
                </div>
              </div>
            </div>

            <button type="submit" disabled={!wsConnected}
              className="w-full bg-[#FF3D68] text-white font-black uppercase tracking-widest py-4 rounded-lg mt-8 hover:bg-[#e0355b] transition-colors shadow-md disabled:opacity-50">
              Login &amp; Enter Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── Dashboard ─────────────────────────────────────────────────────────────
  const stateColor = {
    WAITING: 'text-yellow-500',
    COUNTDOWN: 'text-blue-500',
    PLAYING: 'text-green-500',
    ENDED: 'text-purple-500',
  }[game.gameState];

  const stateLabel = {
    WAITING: 'Waiting for Players',
    COUNTDOWN: `Starting in ${game.countdown}...`,
    PLAYING: 'Round in Progress',
    ENDED: 'Round Ended',
  }[game.gameState];

  return (
    <div className="w-full h-screen bg-[#0f172a] text-white font-sans overflow-hidden flex flex-col">
      {/* Top Header */}
      <header className="h-16 bg-[#1e293b]/80 backdrop-blur-md flex items-center justify-between px-6 border-b border-white/10 shrink-0">
        <div className="flex flex-col">
          <h1 className="font-black text-xl tracking-tighter uppercase leading-none">Bot</h1>
          <span className="text-[10px] text-blue-400 font-bold tracking-widest uppercase">Admin Panel</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className={`font-black text-sm uppercase tracking-widest ${stateColor}`}>{stateLabel}</div>
          </div>
          
          <div className="h-8 w-[1px] bg-white/10"></div>

          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest text-center">Quality</span>
            <select 
              value={game.currentQuality}
              onChange={(e) => handleQualityChange(e.target.value)}
              className="bg-[#0f172a] border border-white/10 rounded-md px-2 py-1 text-[10px] font-black uppercase outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              <option value="480p">480p (Low)</option>
              <option value="720p">720p (Norm)</option>
              <option value="1080p">1080p (High)</option>
            </select>
          </div>
          
          <div className="h-8 w-[1px] bg-white/10"></div>
          
          <button onClick={handleToggleStream}
            className={`px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${
              game.isStreaming
                ? 'bg-red-500 hover:bg-red-600 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}>
            {game.isStreaming ? '🔴 Stop Stream' : '▶ Go Live'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Control Panel */}
        <div className="w-80 bg-[#1e293b]/50 border-r border-white/10 p-6 flex flex-col gap-8 hidden md:flex">
          <section>
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Quick Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0f172a] p-4 rounded-xl border border-white/5">
                <div className="text-2xl font-black">{game.flagCount}</div>
                <div className="text-[9px] text-gray-500 uppercase font-bold">In Arena</div>
              </div>
              <div className="bg-[#0f172a] p-4 rounded-xl border border-white/5">
                <div className="text-2xl font-black">{Object.keys(game.leaderboard).length}</div>
                <div className="text-[9px] text-gray-500 uppercase font-bold">Total Winners</div>
              </div>
            </div>
          </section>

          <section className="flex-1 flex flex-col min-h-0">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Recent Players</h3>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {game.chatMessages.slice(0, 10).map(msg => (
                <div key={msg.id} className="text-xs bg-white/5 p-3 rounded-lg border border-white/5">
                  <span className="text-blue-400 font-bold">{msg.user}</span>
                  <span className="text-gray-400 mx-1">joined</span>
                  <span className="text-white font-black uppercase">arena</span>
                </div>
              ))}
            </div>
          </section>

          <form onSubmit={handleSpawn} className="mt-auto">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 block">Manual Player</label>
            <div className="flex gap-2">
              <input type="text" value={spawnInput} onChange={e => setSpawnInput(e.target.value)}
                disabled={!game.isStreaming}
                placeholder={game.isStreaming ? "Username..." : "Start stream first"}
                className="flex-1 bg-[#0f172a] border border-white/10 px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" />
              <button type="submit" disabled={!game.isStreaming} className="bg-blue-600 p-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <Send size={18} />
              </button>
            </div>
          </form>
        </div>

        {/* Center Status - preview disabled to save VPS bandwidth */}
        <main className="flex-1 bg-[#0f172a] relative flex items-center justify-center p-8">
          <div className="relative w-full max-w-2xl bg-[#111c2f] border border-white/10 rounded-lg p-8 shadow-[0_0_50px_rgba(0,0,0,0.35)]">
            <div className="text-center">
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 ${game.isStreaming ? 'bg-green-500/15' : 'bg-blue-500/15'}`}>
                <div className={`w-6 h-6 rounded-full ${game.isStreaming ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}`}></div>
              </div>
              <h2 className="text-2xl font-black uppercase mb-3">
                {game.isStreaming ? 'Stream Running' : 'Ready To Stream'}
              </h2>
              <p className="text-gray-400 text-sm max-w-md mx-auto">
                Browser preview is disabled to save VPS bandwidth. The backend still renders and streams the full game to YouTube.
              </p>
              <div className="mt-8 grid grid-cols-3 gap-3 text-center">
                <div className="bg-[#0f172a] border border-white/5 rounded-lg p-4">
                  <div className="text-2xl font-black">{game.flagCount}</div>
                  <div className="text-[9px] text-gray-500 uppercase font-bold">In Arena</div>
                </div>
                <div className="bg-[#0f172a] border border-white/5 rounded-lg p-4">
                  <div className="text-2xl font-black">{Object.keys(game.leaderboard).length}</div>
                  <div className="text-[9px] text-gray-500 uppercase font-bold">Winners</div>
                </div>
                <div className="bg-[#0f172a] border border-white/5 rounded-lg p-4">
                  <div className={`text-lg font-black uppercase ${stateColor}`}>{game.gameState}</div>
                  <div className="text-[9px] text-gray-500 uppercase font-bold">State</div>
                </div>
              </div>
            </div>
            
            <div className="absolute top-4 right-4 flex gap-2">
              <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10">
                <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                <span className="text-[10px] font-black uppercase tracking-widest">{wsConnected ? 'Server Live' : 'Connecting'}</span>
              </div>
            </div>
          </div>
        </main>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}} />
    </div>
  );
}
