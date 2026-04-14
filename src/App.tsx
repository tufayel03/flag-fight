import React, { useEffect, useRef, useState } from 'react';
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
}

const DEFAULT_STATE: GameState = {
  gameState: 'WAITING',
  countdown: 3,
  flagCount: 0,
  leaderboard: {},
  chatMessages: [],
  winner: null,
  isStreaming: false,
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  // Auth
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Credentials
  const [streamUrl, setStreamUrl] = useState('rtmp://a.rtmp.youtube.com/live2');
  const [streamKey, setStreamKey] = useState('');
  const [youtubeApiKey, setYoutubeApiKey] = useState('');
  const [youtubeVideoId, setYoutubeVideoId] = useState('');

  // Game state (from server)
  const [game, setGame] = useState<GameState>(DEFAULT_STATE);

  // Control input
  const [spawnInput, setSpawnInput] = useState('');
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

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
          setGame({
            gameState: msg.gameState,
            countdown: msg.countdown,
            flagCount: msg.flagCount,
            leaderboard: msg.leaderboard || {},
            chatMessages: msg.chatMessages || [],
            winner: msg.winner,
            isStreaming: msg.isStreaming,
          });
          break;
        case 'loginResult':
          if (msg.success) {
            setIsLoggedIn(true);
            setLoginError('');
            // Send credentials to server
            ws.send(JSON.stringify({
              type: 'setCredentials',
              youtubeApiKey,
              youtubeVideoId,
            }));
          } else {
            setLoginError('Invalid email or password');
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
    send({ type: 'login', email, password });
  };

  const handleToggleStream = () => {
    if (game.isStreaming) {
      send({ type: 'stopStream' });
    } else {
      const fullRtmpUrl = streamUrl.endsWith('/') ? `${streamUrl}${streamKey}` : `${streamUrl}/${streamKey}`;
      send({ type: 'startStream', rtmpUrl: fullRtmpUrl });
    }
  };

  const handleSpawn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!spawnInput.trim()) return;
    send({ type: 'spawnFlag', country: spawnInput.trim().toLowerCase(), user: 'Admin' });
    setSpawnInput('');
  };

  // ─── Login screen ──────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border border-gray-200">
          <div className="text-center mb-8">
            <h1 className="font-black text-3xl tracking-tighter uppercase text-black mb-2">Flag Fight</h1>
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
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 text-gray-900 px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-[#FF3D68]"
                placeholder="admin@admin.com" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 text-gray-900 px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-[#FF3D68]"
                placeholder="admin123" required />
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
    <div className="w-full h-screen bg-white text-gray-900 font-sans overflow-hidden grid gap-[1px]"
      style={{ gridTemplateColumns: '280px minmax(0,1fr) 280px', gridTemplateRows: '72px minmax(0,1fr) 100px' }}>

      {/* Header */}
      <header className="col-span-3 bg-gray-50 flex items-center justify-between px-10 border-b border-gray-200">
        <div className="font-black text-2xl tracking-tighter uppercase text-black">Flag Fight // Control</div>
        <div className={`font-bold text-sm tracking-widest uppercase ${stateColor}`}>{stateLabel}</div>
        <div className="flex items-center gap-4">
          <button onClick={handleToggleStream}
            className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-widest transition-colors ${
              game.isStreaming
                ? 'bg-red-500 text-white animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                : 'bg-gray-800 text-white hover:bg-gray-700'
            }`}>
            {game.isStreaming ? '🔴 Stop Stream' : '▶ Start Stream'}
          </button>
          {game.isStreaming && (
            <a href="/preview" target="_blank" rel="noopener noreferrer"
              className="px-3 py-2 rounded text-xs font-bold uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              👁 Preview
            </a>
          )}
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-gray-500">{wsConnected ? 'Live' : 'Disconnected'}</span>
          </div>
        </div>
      </header>

      {/* Left — Leaderboard */}
      <aside className="bg-gray-50/80 p-6 border-r border-gray-200 flex flex-col min-h-0 overflow-hidden">
        <div className="text-[11px] uppercase tracking-widest text-gray-500 mb-5">Global Leaderboard</div>
        {Object.entries(game.leaderboard).length === 0 && (
          <div className="text-center text-xs text-gray-400 py-2">No wins yet</div>
        )}
        {Object.entries(game.leaderboard)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 6)
          .map(([country, wins], i) => (
            <div key={country} className="flex justify-between items-center py-3 border-b border-gray-200">
              <span className="font-black text-[#FF3D68] mr-2">0{i + 1}</span>
              <span className="flex-1 font-medium capitalize text-gray-800">{country}</span>
              <span className="font-mono text-gray-500">{wins}w</span>
            </div>
          ))}
      </aside>

      {/* Center — Live game preview */}
      <main className="relative flex flex-col items-center justify-center min-h-0 overflow-hidden bg-gray-100">
        {game.isStreaming ? (
          <>
            <img
              src="/preview"
              alt="Live game preview"
              className="max-w-full max-h-full object-contain block rounded shadow"
            />
            <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded animate-pulse">
              🔴 LIVE
            </div>
          </>
        ) : (
          <div className="text-center text-gray-400">
            <div className="text-6xl mb-4">🎮</div>
            <div className="font-bold text-lg uppercasemb-2">Stream Not Started</div>
            <div className="text-sm">The game is running on the server.</div>
            <div className="text-sm mt-1">Click <span className="font-bold text-gray-700">Start Stream</span> to go live on YouTube.</div>
            <div className="mt-4">
              <a href="/preview" target="_blank" rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded hover:bg-blue-700 transition-colors">
                👁 Preview Game (no stream)
              </a>
            </div>
          </div>
        )}

        {/* Winner overlay */}
        {game.gameState === 'ENDED' && game.winner && (
          <div className="absolute bottom-8 text-center w-full animate-bounce pointer-events-none">
            <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-2">Last Round Winner</div>
            <div className="text-5xl font-black uppercase text-[#FF3D68] drop-shadow-2xl">
              {game.winner.country.replace(/\b\w/g, l => l.toUpperCase())}
            </div>
          </div>
        )}
      </main>

      {/* Right — Chat */}
      <aside className="bg-gray-50/80 p-6 pl-0 border-l border-gray-200 flex flex-col min-h-0 overflow-hidden">
        <div className="text-lg font-black uppercase tracking-widest text-gray-800 mb-5 border-b border-gray-200 pb-2 pl-6">
          Live Chat Spawns
        </div>
        <div className="flex-1 min-h-0 overflow-hidden pl-6 pr-4">
          <div className="flex flex-col gap-3">
            {[...game.chatMessages].reverse().map(msg => (
              <div key={msg.id} className="border-b border-gray-200 pb-3">
                <span className="font-black text-[#FF3D68]">{msg.user}: </span>
                <span className="text-gray-800 font-bold">{msg.msg}</span>
                <span className="text-orange-500 font-bold italic text-xs block mt-1">+1 Flag Spawned</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Footer */}
      <footer className="col-span-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between px-10">
        <form onSubmit={handleSpawn} className="flex gap-2 w-[400px]">
          <input type="text" value={spawnInput} onChange={e => setSpawnInput(e.target.value)}
            placeholder="Type a country to spawn..."
            className="flex-1 bg-white border border-gray-300 text-gray-900 px-4 py-2 rounded text-[11px] font-bold uppercase tracking-widest focus:outline-none focus:border-[#FF3D68]" />
          <button type="submit"
            className="bg-[#FF3D68] text-white px-6 py-2 rounded text-[11px] font-bold uppercase tracking-widest border border-[#FF3D68] hover:bg-transparent hover:text-[#FF3D68] transition-colors flex items-center gap-2">
            <Send size={12} /> Spawn
          </button>
        </form>

        <div className="flex gap-10">
          <div className="flex flex-col">
            <span className="font-black text-lg text-black">{game.flagCount}</span>
            <span className="text-[9px] text-gray-500 uppercase tracking-widest">Flags in Arena</span>
          </div>
          <div className="flex flex-col">
            <span className="font-black text-lg text-black">{game.chatMessages.length}</span>
            <span className="text-[9px] text-gray-500 uppercase tracking-widest">Chat Commands</span>
          </div>
          <div className="flex flex-col">
            <span className={`font-black text-lg ${game.isStreaming ? 'text-red-500' : 'text-gray-400'}`}>
              {game.isStreaming ? 'ON AIR' : 'OFFLINE'}
            </span>
            <span className="text-[9px] text-gray-500 uppercase tracking-widest">Stream Status</span>
          </div>
        </div>

        <div className="text-[9px] text-gray-500 uppercase tracking-widest">100% Server-Side v2.0</div>
      </footer>
    </div>
  );
}
