import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import confetti from 'canvas-confetti';
import {
  Swords,
  Copy,
  Check,
  RotateCcw,
  Volume2,
  VolumeX,
  Share2,
  Users,
  Bot,
  Wifi,
  WifiOff,
  LogOut,
  AlertCircle,
  HelpCircle,
  Send,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { sounds } from './utils/audio';
import { getBestMove, checkBoardWinner } from './utils/aiBot';
import { HandshakeGuideModal } from './components/HandshakeGuideModal';

export interface Player {
  id: string;
  name: string;
  symbol: 'X' | 'O';
  isHost: boolean;
  connected: boolean;
}

export interface GameState {
  id: string;
  players: Player[];
  spectators: { id: string; name: string }[];
  board: (string | null)[];
  currentTurn: 'X' | 'O';
  status: 'waiting' | 'in_progress' | 'won' | 'draw' | 'abandoned';
  winner: 'X' | 'O' | null;
  winningLine: number[] | null;
  scores: { X: number; O: number; ties: number };
  rematchVotes: string[];
}

interface ChatMsg {
  senderId: string;
  senderName: string;
  text: string;
  type: 'text' | 'reaction';
  symbol?: 'X' | 'O' | null;
  timestamp: number;
}

type PlayMode = 'online' | 'local' | 'ai';

export default function App() {
  // Navigation & Mode
  const [playMode, setPlayMode] = useState<PlayMode>('online');
  const [isInRoom, setIsInRoom] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  // User Profile
  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem('ttt_player_name') || `Player_${Math.floor(100 + Math.random() * 900)}`;
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Online Multiplayer State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);
  const [onlineGameState, setOnlineGameState] = useState<GameState | null>(null);
  const [statusAlert, setStatusAlert] = useState<{ message: string; type: 'error' | 'info' | 'success' } | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // In-Game Chat
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Local / AI Offline Mode State
  const [localBoard, setLocalBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [localTurn, setLocalTurn] = useState<'X' | 'O'>('X');
  const [localScores, setLocalScores] = useState<{ X: number; O: number; ties: number }>({ X: 0, O: 0, ties: 0 });
  const [localWinner, setLocalWinner] = useState<'X' | 'O' | null>(null);
  const [localWinningLine, setLocalWinningLine] = useState<number[] | null>(null);
  const [localGameOver, setLocalGameOver] = useState<boolean>(false);
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('hard');
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);

  // Sound sync
  useEffect(() => {
    sounds.enabled = soundEnabled;
  }, [soundEnabled]);

  // Save Player Name
  useEffect(() => {
    localStorage.setItem('ttt_player_name', playerName);
  }, [playerName]);

  // Check URL query for room code auto-fill
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setRoomCodeInput(roomParam.toUpperCase());
    }
  }, []);

  // Initialize Socket.IO connection
  useEffect(() => {
    const newSocket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });

    newSocket.on('connect', () => {
      setConnected(true);
      console.log('Socket connected:', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('Socket disconnected');
    });

    newSocket.on('room:created', (data: { roomId: string; player: Player; gameState: GameState }) => {
      setMyPlayer(data.player);
      setOnlineGameState(data.gameState);
      setIsInRoom(true);
      setStatusAlert(null);
      sounds.playClick();
    });

    newSocket.on('room:joined', (data: { roomId: string; role: string; player?: Player; gameState: GameState }) => {
      if (data.player) setMyPlayer(data.player);
      setOnlineGameState(data.gameState);
      setIsInRoom(true);
      setStatusAlert(null);
      sounds.playClick();
    });

    newSocket.on('room:update', (state: GameState) => {
      setOnlineGameState(state);
    });

    newSocket.on('game:update', (state: GameState) => {
      setOnlineGameState(state);
      sounds.playMove(state.currentTurn === 'X' ? 'O' : 'X');
    });

    newSocket.on('game:over', (data: { result: 'win' | 'draw'; winner: 'X' | 'O' | null; winningLine: number[] | null; gameState: GameState }) => {
      setOnlineGameState(data.gameState);

      if (data.result === 'win') {
        if (myPlayer && data.winner === myPlayer.symbol) {
          sounds.playWin();
          triggerConfetti();
        } else if (myPlayer) {
          sounds.playLose();
        } else {
          sounds.playWin();
        }
      } else {
        sounds.playDraw();
      }
    });

    newSocket.on('game:rematch_started', (state: GameState) => {
      setOnlineGameState(state);
      sounds.playClick();
      setStatusAlert({ message: 'Rematch started! Round in progress.', type: 'info' });
      setTimeout(() => setStatusAlert(null), 3000);
    });

    newSocket.on('game:rematch_requested', (data: { requestedBy: string; votes: number; totalRequired: number }) => {
      sounds.playClick();
      setStatusAlert({
        message: `${data.requestedBy} requested a rematch (${data.votes}/${data.totalRequired} agreed). Click Play Again!`,
        type: 'info',
      });
    });

    newSocket.on('room:player_left', (data: { playerName: string; gameState: GameState }) => {
      setOnlineGameState(data.gameState);
      setStatusAlert({ message: `${data.playerName} disconnected from the match.`, type: 'error' });
    });

    newSocket.on('chat:message', (msg: ChatMsg) => {
      setChatMessages((prev) => [...prev.slice(-30), msg]);
      if (msg.type === 'reaction') {
        sounds.playClick();
      }
    });

    newSocket.on('chat:system', (data: { text: string }) => {
      setChatMessages((prev) => [
        ...prev.slice(-30),
        { senderId: 'system', senderName: 'System', text: data.text, type: 'text', timestamp: Date.now() },
      ]);
    });

    newSocket.on('room:error', (data: { message: string }) => {
      setStatusAlert({ message: data.message, type: 'error' });
    });

    newSocket.on('game:error', (data: { message: string }) => {
      setStatusAlert({ message: data.message, type: 'error' });
      setTimeout(() => setStatusAlert(null), 4000);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [myPlayer]);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00f2fe', '#ff007f', '#7928ca', '#10b981'],
      });
    } catch {}
  };

  // Online Room Actions
  const handleCreateRoom = () => {
    if (!socket || !connected) {
      setStatusAlert({ message: 'Waiting for server connection...', type: 'error' });
      return;
    }
    sounds.playClick();
    socket.emit('room:create', {
      playerName: playerName.trim() || 'Player 1',
      preferredCode: roomCodeInput.trim() ? roomCodeInput.trim().toUpperCase() : undefined,
    });
  };

  const handleJoinRoom = () => {
    if (!socket || !connected) {
      setStatusAlert({ message: 'Waiting for server connection...', type: 'error' });
      return;
    }
    const cleanCode = roomCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      setStatusAlert({ message: 'Please enter a valid 6-character room code.', type: 'error' });
      return;
    }
    sounds.playClick();
    socket.emit('room:join', {
      roomId: cleanCode,
      playerName: playerName.trim() || 'Player 2',
    });
  };

  const handleOnlineMove = (cellIndex: number) => {
    if (!socket || !onlineGameState || !myPlayer) return;
    if (onlineGameState.status !== 'in_progress') return;
    if (onlineGameState.currentTurn !== myPlayer.symbol) {
      setStatusAlert({ message: `Wait for Player ${onlineGameState.currentTurn}'s turn.`, type: 'error' });
      setTimeout(() => setStatusAlert(null), 2000);
      return;
    }
    if (onlineGameState.board[cellIndex] !== null) return;

    sounds.playClick();
    socket.emit('game:move', { cellIndex });
  };

  const handleOnlineRematch = () => {
    if (!socket || !onlineGameState) return;
    sounds.playClick();
    socket.emit('game:rematch');
    setStatusAlert({ message: 'Rematch request sent! Waiting for opponent...', type: 'info' });
  };

  const handleLeaveRoom = () => {
    if (socket) {
      socket.emit('room:leave');
    }
    setIsInRoom(false);
    setMyPlayer(null);
    setOnlineGameState(null);
    setChatMessages([]);
    setStatusAlert(null);
    sounds.playClick();
  };

  const copyRoomCode = () => {
    if (!onlineGameState?.id) return;
    navigator.clipboard.writeText(onlineGameState.id);
    setCopiedLink(true);
    sounds.playClick();
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyInviteLink = () => {
    if (!onlineGameState?.id) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${onlineGameState.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    sounds.playClick();
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const sendChatMessage = (textToSend?: string) => {
    const text = (textToSend || chatInput).trim();
    if (!text || !socket || !onlineGameState) return;
    const isReaction = ['🔥', '👏', '😱', '🎉', '🧠', '👍', '💀', '⚔️'].includes(text);
    socket.emit('chat:send', { text, type: isReaction ? 'reaction' : 'text' });
    if (!textToSend) setChatInput('');
  };

  // Offline / AI / Local Logic
  const handleLocalMove = (index: number) => {
    if (localBoard[index] !== null || localGameOver || isAiThinking) return;

    const newBoard = [...localBoard];
    newBoard[index] = localTurn;
    setLocalBoard(newBoard);
    sounds.playMove(localTurn);

    const winResult = checkBoardWinner(newBoard);
    if (winResult) {
      setLocalWinner(winResult.winner);
      setLocalWinningLine(winResult.line);
      setLocalGameOver(true);
      setLocalScores((prev) => ({ ...prev, [winResult.winner]: prev[winResult.winner] + 1 }));
      sounds.playWin();
      triggerConfetti();
      return;
    }

    if (newBoard.every((c) => c !== null)) {
      setLocalGameOver(true);
      setLocalScores((prev) => ({ ...prev, ties: prev.ties + 1 }));
      sounds.playDraw();
      return;
    }

    const nextTurn = localTurn === 'X' ? 'O' : 'X';
    setLocalTurn(nextTurn);

    // If AI Mode and it's AI's turn (O)
    if (playMode === 'ai' && nextTurn === 'O') {
      setIsAiThinking(true);
      setTimeout(() => {
        const aiMoveIdx = getBestMove(newBoard, 'O', aiDifficulty);
        if (aiMoveIdx !== -1) {
          const aiBoard = [...newBoard];
          aiBoard[aiMoveIdx] = 'O';
          setLocalBoard(aiBoard);
          sounds.playMove('O');

          const aiWinResult = checkBoardWinner(aiBoard);
          if (aiWinResult) {
            setLocalWinner(aiWinResult.winner);
            setLocalWinningLine(aiWinResult.line);
            setLocalGameOver(true);
            setLocalScores((prev) => ({ ...prev, O: prev.O + 1 }));
            sounds.playLose();
          } else if (aiBoard.every((c) => c !== null)) {
            setLocalGameOver(true);
            setLocalScores((prev) => ({ ...prev, ties: prev.ties + 1 }));
            sounds.playDraw();
          } else {
            setLocalTurn('X');
          }
        }
        setIsAiThinking(false);
      }, 450);
    }
  };

  const resetLocalGame = () => {
    setLocalBoard(Array(9).fill(null));
    setLocalTurn('X');
    setLocalWinner(null);
    setLocalWinningLine(null);
    setLocalGameOver(false);
    setIsAiThinking(false);
    sounds.playClick();
  };

  // Player helper computations
  const playerX = onlineGameState?.players.find((p) => p.symbol === 'X');
  const playerO = onlineGameState?.players.find((p) => p.symbol === 'O');
  const isMyTurnOnline =
    myPlayer &&
    onlineGameState?.status === 'in_progress' &&
    onlineGameState.currentTurn === myPlayer.symbol;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background Glow Accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[450px] bg-cyan-600/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 right-10 w-[500px] h-[450px] bg-purple-600/10 rounded-full blur-[140px]" />
      </div>

      {/* Top Header */}
      <header className="relative z-10 w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
              <Swords className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-wider text-white">
                  TIC-TAC-TOE <span className="text-cyan-400">ARENA</span>
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 rounded-full">
                  Real-Time
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Handshake Multiplayer Project</p>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Connection indicator */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                connected
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50'
                  : 'bg-rose-950/60 text-rose-400 border-rose-800/50'
              }`}
              title={connected ? 'Connected to WebSocket Server' : 'Reconnecting to Server...'}
            >
              {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5 animate-pulse" />}
              <span className="hidden sm:inline">{connected ? 'Online' : 'Connecting'}</span>
            </div>

            {/* Audio Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition"
              title={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>

            {/* Handshake Guide & Submission Button */}
            <button
              onClick={() => setIsGuideOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-700/60 text-cyan-300 text-xs font-bold transition shadow-sm hover:shadow-cyan-500/10"
            >
              <HelpCircle className="w-4 h-4 text-cyan-400" />
              <span className="hidden md:inline">Project Guide & Submission</span>
              <span className="md:hidden">Guide</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex flex-col items-center justify-center">
        {/* Mode Selector Tabs (when not inside an active online match) */}
        {!isInRoom && (
          <div className="w-full max-w-md mb-6 p-1 bg-slate-900/80 border border-slate-800 rounded-2xl flex shadow-inner">
            <button
              onClick={() => {
                setPlayMode('online');
                sounds.playClick();
              }}
              className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                playMode === 'online'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              Online 2P
            </button>
            <button
              onClick={() => {
                setPlayMode('ai');
                sounds.playClick();
              }}
              className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                playMode === 'ai'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bot className="w-4 h-4" />
              Practice vs AI
            </button>
            <button
              onClick={() => {
                setPlayMode('local');
                sounds.playClick();
              }}
              className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                playMode === 'local'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              Pass & Play
            </button>
          </div>
        )}

        {/* Global Toast / Status Alert */}
        {statusAlert && (
          <div
            className={`w-full max-w-md mb-4 p-3 rounded-xl border flex items-center gap-2.5 text-xs sm:text-sm animate-fadeIn ${
              statusAlert.type === 'error'
                ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                : statusAlert.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                : 'bg-cyan-950/60 border-cyan-800 text-cyan-300'
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <div className="flex-1">{statusAlert.message}</div>
          </div>
        )}

        {/* -------------------- VIEW 1: ONLINE LOBBY SCREEN -------------------- */}
        {playMode === 'online' && !isInRoom && (
          <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black text-white tracking-tight">Play Across Devices</h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Real-time WebSocket multiplayer. Join from two devices or browser windows!
              </p>
            </div>

            {/* Gamer Tag Input */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Your Gamer Tag
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value.slice(0, 15))}
                placeholder="Enter your nickname"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-medium text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition"
              />
            </div>

            {/* Host Game Box */}
            <div className="space-y-4">
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    Host New Match
                  </span>
                  <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Player 1 (X)</span>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Generates an instant 6-character room code to invite your opponent.
                </p>
                <button
                  onClick={handleCreateRoom}
                  disabled={!connected}
                  className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-slate-950 font-black text-sm rounded-xl transition shadow-lg shadow-cyan-500/20 active:scale-[0.98]"
                >
                  Create Match Room
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 text-xs text-slate-500 font-bold">
                <div className="flex-1 h-px bg-slate-800" />
                <span>OR JOIN EXISTING</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              {/* Join Game Box */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Enter Room Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. ARENA1"
                    maxLength={10}
                    className="flex-1 px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold tracking-widest text-center text-sm focus:outline-none focus:border-cyan-400 uppercase"
                  />
                  <button
                    onClick={handleJoinRoom}
                    disabled={!connected}
                    className="px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-purple-600/20 active:scale-[0.98]"
                  >
                    Join
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- VIEW 2: ONLINE ACTIVE ROOM SCREEN -------------------- */}
        {playMode === 'online' && isInRoom && onlineGameState && (
          <div className="w-full max-w-2xl bg-slate-900/95 border border-slate-800 rounded-3xl p-4 sm:p-7 shadow-2xl backdrop-blur-xl">
            {/* Top Room Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">ROOM CODE:</span>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-950 border border-cyan-800/60 rounded-xl">
                  <span className="font-mono font-black text-cyan-300 text-sm tracking-wider">
                    {onlineGameState.id}
                  </span>
                  <button
                    onClick={copyRoomCode}
                    className="text-slate-400 hover:text-cyan-300 p-1 rounded transition"
                    title="Copy Room Code"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <button
                  onClick={copyInviteLink}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                  title="Copy full invite link"
                >
                  <Share2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Invite Link</span>
                </button>
              </div>

              <button
                onClick={handleLeaveRoom}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-950/70 border border-rose-900/50 rounded-xl transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                Exit Room
              </button>
            </div>

            {/* Scoreboard */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-5">
              {/* Player X */}
              <div
                className={`p-3 rounded-2xl border transition-all ${
                  onlineGameState.currentTurn === 'X' && onlineGameState.status === 'in_progress'
                    ? 'bg-cyan-950/40 border-cyan-400 shadow-lg shadow-cyan-500/20'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-400/40 font-black text-sm flex items-center justify-center">
                    X
                  </div>
                  <span className="text-xl font-black text-white">{onlineGameState.scores.X}</span>
                </div>
                <div className="truncate text-xs font-bold text-slate-200">
                  {playerX ? playerX.name : 'Waiting...'}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  {playerX?.id === socket?.id ? <span className="text-cyan-400 font-semibold">(You)</span> : 'Host'}
                </div>
              </div>

              {/* Ties / Draws */}
              <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl flex flex-col items-center justify-center text-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ties</span>
                <span className="text-xl font-black text-slate-200 mt-1">{onlineGameState.scores.ties}</span>
                <span className="text-[10px] text-slate-500">Draws</span>
              </div>

              {/* Player O */}
              <div
                className={`p-3 rounded-2xl border transition-all ${
                  onlineGameState.currentTurn === 'O' && onlineGameState.status === 'in_progress'
                    ? 'bg-pink-950/40 border-pink-500 shadow-lg shadow-pink-500/20'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="w-7 h-7 rounded-lg bg-pink-500/20 text-pink-400 border border-pink-400/40 font-black text-sm flex items-center justify-center">
                    O
                  </div>
                  <span className="text-xl font-black text-white">{onlineGameState.scores.O}</span>
                </div>
                <div className="truncate text-xs font-bold text-slate-200">
                  {playerO ? playerO.name : 'Waiting...'}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  {playerO?.id === socket?.id ? <span className="text-pink-400 font-semibold">(You)</span> : 'Guest'}
                </div>
              </div>
            </div>

            {/* Turn Status Banner */}
            <div className="mb-5 text-center py-2.5 px-4 rounded-xl font-bold text-sm bg-slate-950/70 border border-slate-800/80">
              {onlineGameState.status === 'waiting' && (
                <div className="text-amber-300 flex items-center justify-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  Waiting for Player 2 to join with room code{' '}
                  <strong className="text-white underline">{onlineGameState.id}</strong>
                </div>
              )}
              {onlineGameState.status === 'in_progress' && (
                <div>
                  {isMyTurnOnline ? (
                    <span className="text-cyan-300 animate-pulse">
                      🎯 It's YOUR TURN ({myPlayer?.symbol}) — Choose a square!
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      ⏳ Waiting for opponent ({onlineGameState.currentTurn}) to move...
                    </span>
                  )}
                </div>
              )}
              {onlineGameState.status === 'won' && (
                <div className="text-emerald-400 flex items-center justify-center gap-1.5">
                  <Trophy className="w-4 h-4" />
                  {myPlayer && onlineGameState.winner === myPlayer.symbol
                    ? '🎉 VICTORY! You won this round!'
                    : `Player ${onlineGameState.winner} won this round!`}
                </div>
              )}
              {onlineGameState.status === 'draw' && (
                <span className="text-amber-300">🤝 Round ended in a DRAW! Well fought.</span>
              )}
              {onlineGameState.status === 'abandoned' && (
                <span className="text-rose-400">Opponent left the room. Share code to invite another player.</span>
              )}
            </div>

            {/* 3x3 Grid Board */}
            <div className="flex justify-center mb-6">
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3 p-3 bg-slate-950/80 border border-slate-800/90 rounded-2xl shadow-inner">
                {onlineGameState.board.map((cellValue, idx) => {
                  const isWinningCell = onlineGameState.winningLine?.includes(idx);
                  return (
                    <button
                      key={idx}
                      onClick={() => handleOnlineMove(idx)}
                      disabled={cellValue !== null || !isMyTurnOnline}
                      aria-label={`Cell ${idx + 1}, ${cellValue || 'Empty'}`}
                      className={`w-20 h-20 sm:w-24 sm:h-24 rounded-xl flex items-center justify-center font-black text-3xl sm:text-4xl transition-all duration-150 ${
                        cellValue === 'X'
                          ? 'text-cyan-400 drop-shadow-[0_0_12px_rgba(0,242,254,0.6)]'
                          : cellValue === 'O'
                          ? 'text-pink-400 drop-shadow-[0_0_12px_rgba(255,0,127,0.6)]'
                          : ''
                      } ${
                        isWinningCell
                          ? 'bg-emerald-950/70 border-2 border-emerald-400 scale-105 shadow-lg shadow-emerald-500/30'
                          : cellValue
                          ? 'bg-slate-900 border border-slate-800'
                          : isMyTurnOnline
                          ? 'bg-slate-900/60 border border-slate-800 hover:border-cyan-400 hover:bg-slate-800/80 hover:scale-[1.03] cursor-pointer'
                          : 'bg-slate-900/40 border border-slate-800/60 opacity-80 cursor-not-allowed'
                      }`}
                    >
                      {cellValue}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rematch & Controls */}
            {(onlineGameState.status === 'won' ||
              onlineGameState.status === 'draw' ||
              onlineGameState.status === 'abandoned') && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6 animate-fadeIn">
                <button
                  onClick={handleOnlineRematch}
                  disabled={onlineGameState.rematchVotes.includes(socket?.id || '')}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50 text-slate-950 font-black text-sm rounded-xl transition shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  {onlineGameState.rematchVotes.includes(socket?.id || '')
                    ? 'Waiting for Opponent...'
                    : 'Play Rematch'}
                </button>
                <button
                  onClick={handleLeaveRoom}
                  className="w-full sm:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl transition"
                >
                  Back to Lobby
                </button>
              </div>
            )}

            {/* In-Game Reactions & Quick Chat */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3">
              {/* Emoji bar */}
              <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2 border-b border-slate-800 mb-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0 mr-1">React:</span>
                {['🔥', '👏', '🧠', '😱', '🎉', '👍', '💀', '⚔️'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => sendChatMessage(emoji)}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-base transition active:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Chat Message Feed */}
              <div ref={chatScrollRef} className="max-h-24 overflow-y-auto space-y-1 text-xs mb-2 pr-1">
                {chatMessages.length === 0 ? (
                  <div className="text-[11px] text-slate-500 text-center py-1">
                    Send quick messages or emojis to your opponent
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={i} className="flex items-baseline gap-1.5 leading-tight">
                      <span
                        className={`font-bold ${
                          msg.symbol === 'X'
                            ? 'text-cyan-400'
                            : msg.symbol === 'O'
                            ? 'text-pink-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {msg.senderName}:
                      </span>
                      <span className="text-slate-200">{msg.text}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Chat Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendChatMessage();
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Say something (e.g. Good game!)..."
                  maxLength={60}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-slate-950 font-bold rounded-xl text-xs transition flex items-center gap-1"
                >
                  <Send className="w-3 h-3" />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* -------------------- VIEW 3: PRACTICE VS AI / PASS & PLAY -------------------- */}
        {(playMode === 'ai' || playMode === 'local') && (
          <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl backdrop-blur-xl">
            {/* Header info */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  {playMode === 'ai' ? (
                    <>
                      <Bot className="w-5 h-5 text-purple-400" />
                      Single Player vs AI
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-5 h-5 text-emerald-400" />
                      Local Pass & Play (Same Device)
                    </>
                  )}
                </h3>
                <p className="text-xs text-slate-400">
                  {playMode === 'ai'
                    ? 'Sharpen your moves against the Minimax algorithm'
                    : 'Take turns playing on this device'}
                </p>
              </div>

              {playMode === 'ai' && (
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-[10px]">
                  {(['easy', 'medium', 'hard'] as const).map((diff) => (
                    <button
                      key={diff}
                      onClick={() => setAiDifficulty(diff)}
                      className={`px-2 py-0.5 rounded-lg capitalize font-bold transition ${
                        aiDifficulty === diff
                          ? 'bg-purple-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Offline Scoreboard */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <div className="flex items-center justify-between mb-1">
                  <div className="w-6 h-6 rounded bg-cyan-500/20 text-cyan-400 font-black text-xs flex items-center justify-center">
                    X
                  </div>
                  <span className="text-lg font-black text-white">{localScores.X}</span>
                </div>
                <div className="text-xs font-bold text-slate-300">Player 1</div>
              </div>

              <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-2xl text-center flex flex-col justify-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Ties</span>
                <span className="text-lg font-black text-slate-200">{localScores.ties}</span>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <div className="flex items-center justify-between mb-1">
                  <div className="w-6 h-6 rounded bg-pink-500/20 text-pink-400 font-black text-xs flex items-center justify-center">
                    O
                  </div>
                  <span className="text-lg font-black text-white">{localScores.O}</span>
                </div>
                <div className="text-xs font-bold text-slate-300">
                  {playMode === 'ai' ? 'AI Bot' : 'Player 2'}
                </div>
              </div>
            </div>

            {/* Offline Status */}
            <div className="mb-5 text-center py-2 px-3 rounded-xl font-bold text-xs sm:text-sm bg-slate-950/70 border border-slate-800">
              {localGameOver ? (
                localWinner ? (
                  <span className="text-emerald-400">
                    🏆 {localWinner === 'X' ? 'Player 1' : playMode === 'ai' ? 'AI Bot' : 'Player 2'} Wins!
                  </span>
                ) : (
                  <span className="text-amber-400">🤝 Round ended in a Draw!</span>
                )
              ) : isAiThinking ? (
                <span className="text-purple-300 animate-pulse">🤖 AI Bot is thinking...</span>
              ) : (
                <span className={localTurn === 'X' ? 'text-cyan-300' : 'text-pink-300'}>
                  Current Turn: Player {localTurn}
                </span>
              )}
            </div>

            {/* Offline 3x3 Grid */}
            <div className="flex justify-center mb-6">
              <div className="grid grid-cols-3 gap-2.5 p-3 bg-slate-950/80 border border-slate-800 rounded-2xl shadow-inner">
                {localBoard.map((val, idx) => {
                  const isWinningCell = localWinningLine?.includes(idx);
                  return (
                    <button
                      key={idx}
                      onClick={() => handleLocalMove(idx)}
                      disabled={val !== null || localGameOver || isAiThinking}
                      className={`w-20 h-20 sm:w-24 sm:h-24 rounded-xl flex items-center justify-center font-black text-3xl transition-all duration-150 ${
                        val === 'X'
                          ? 'text-cyan-400 drop-shadow-[0_0_12px_rgba(0,242,254,0.6)]'
                          : val === 'O'
                          ? 'text-pink-400 drop-shadow-[0_0_12px_rgba(255,0,127,0.6)]'
                          : ''
                      } ${
                        isWinningCell
                          ? 'bg-emerald-950/70 border-2 border-emerald-400 scale-105'
                          : val
                          ? 'bg-slate-900 border border-slate-800'
                          : 'bg-slate-900/60 border border-slate-800 hover:border-cyan-400 hover:bg-slate-800 cursor-pointer'
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={resetLocalGame}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition shadow-lg shadow-cyan-500/20 active:scale-95 flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                {localGameOver ? 'Play Again' : 'Reset Board'}
              </button>
              <button
                onClick={() => setPlayMode('online')}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs sm:text-sm rounded-xl transition"
              >
                Go Online
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-slate-900 bg-slate-950/80 px-4 py-3 text-center text-xs text-slate-500">
        Tic-Tac-Toe Arena • Built with Node.js, Express & Socket.IO for Handshake • Server-Authoritative
      </footer>

      {/* Handshake Guide & Submission Modal */}
      <HandshakeGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        appUrl={window.location.origin}
      />
    </div>
  );
}
