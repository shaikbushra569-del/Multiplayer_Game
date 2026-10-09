import express from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Enable Socket.IO with CORS
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(express.json());

// Game Types
export interface Player {
  id: string;
  name: string;
  symbol: 'X' | 'O';
  isHost: boolean;
  connected: boolean;
}

export interface Spectator {
  id: string;
  name: string;
}

export interface GameRoom {
  id: string;
  players: { [id: string]: Player };
  spectators: { [id: string]: Spectator };
  board: (string | null)[];
  currentTurn: 'X' | 'O';
  status: 'waiting' | 'in_progress' | 'won' | 'draw' | 'abandoned';
  winner: 'X' | 'O' | null;
  winningLine: number[] | null;
  scores: { X: number; O: number; ties: number };
  rematchVotes: string[];
  lastActive: number;
}

// In-memory rooms storage
const rooms: Map<string, GameRoom> = new Map();

// Winning combinations for 3x3 Tic-Tac-Toe
const WINNING_COMBOS = [
  [0, 1, 2], // rows
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6], // columns
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8], // diagonals
  [2, 4, 6],
];

// Helper to check win
function checkWinner(board: (string | null)[]): { winner: 'X' | 'O'; line: number[] } | null {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a] as 'X' | 'O', line: combo };
    }
  }
  return null;
}

// Helper to sanitize room payload for clients
function getSanitizedRoomState(room: GameRoom) {
  return {
    id: room.id,
    players: Object.values(room.players),
    spectators: Object.values(room.spectators),
    board: room.board,
    currentTurn: room.currentTurn,
    status: room.status,
    winner: room.winner,
    winningLine: room.winningLine,
    scores: room.scores,
    rematchVotes: room.rematchVotes,
  };
}

// Helper to generate a unique 6-character room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // exclude similar-looking chars like 0, O, 1, I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/stats', (req, res) => {
  const activeRooms = rooms.size;
  let totalPlayers = 0;
  rooms.forEach((r) => {
    totalPlayers += Object.keys(r.players).length + Object.keys(r.spectators).length;
  });
  res.json({ activeRooms, totalPlayers });
});

app.get('/api/room/:code/exists', (req, res) => {
  const code = (req.params.code || '').trim().toUpperCase();
  const room = rooms.get(code);
  if (!room) {
    return res.json({ exists: false });
  }
  const playerCount = Object.keys(room.players).length;
  res.json({
    exists: true,
    playerCount,
    status: room.status,
    isFull: playerCount >= 2,
  });
});

// Socket.IO Real-Time Handlers
io.on('connection', (socket: Socket) => {
  let currentRoomId: string | null = null;
  let currentRole: 'player' | 'spectator' | null = null;

  // Create a new room
  socket.on('room:create', ({ playerName, preferredCode }: { playerName: string; preferredCode?: string }) => {
    const cleanName = (playerName || 'Player 1').trim().slice(0, 20) || 'Player 1';
    let roomId = preferredCode ? preferredCode.trim().toUpperCase().slice(0, 10) : generateRoomCode();

    // Prevent collision if random code already in use
    if (!preferredCode) {
      while (rooms.has(roomId)) {
        roomId = generateRoomCode();
      }
    } else if (rooms.has(roomId)) {
      socket.emit('room:error', { message: `Room "${roomId}" already exists. Try joining it instead.` });
      return;
    }

    const newRoom: GameRoom = {
      id: roomId,
      players: {
        [socket.id]: {
          id: socket.id,
          name: cleanName,
          symbol: 'X', // Host is always 'X'
          isHost: true,
          connected: true,
        },
      },
      spectators: {},
      board: Array(9).fill(null),
      currentTurn: 'X',
      status: 'waiting',
      winner: null,
      winningLine: null,
      scores: { X: 0, O: 0, ties: 0 },
      rematchVotes: [],
      lastActive: Date.now(),
    };

    rooms.set(roomId, newRoom);
    currentRoomId = roomId;
    currentRole = 'player';
    socket.join(roomId);

    socket.emit('room:created', {
      roomId,
      player: newRoom.players[socket.id],
      gameState: getSanitizedRoomState(newRoom),
    });

    console.log(`[Room Created] ${roomId} by ${cleanName} (${socket.id})`);
  });

  // Join an existing room
  socket.on('room:join', ({ roomId, playerName, asSpectator }: { roomId: string; playerName: string; asSpectator?: boolean }) => {
    const cleanCode = (roomId || '').trim().toUpperCase();
    const cleanName = (playerName || 'Player 2').trim().slice(0, 20) || 'Player 2';
    const room = rooms.get(cleanCode);

    if (!room) {
      socket.emit('room:error', { message: `Room code "${cleanCode}" not found. Please check and try again.` });
      return;
    }

    const currentPlayers = Object.values(room.players);

    // If joining as spectator explicitly, or if 2 players already exist
    if (asSpectator || currentPlayers.length >= 2) {
      room.spectators[socket.id] = { id: socket.id, name: cleanName };
      currentRoomId = cleanCode;
      currentRole = 'spectator';
      socket.join(cleanCode);

      socket.emit('room:joined', {
        roomId: cleanCode,
        role: 'spectator',
        gameState: getSanitizedRoomState(room),
      });

      io.to(cleanCode).emit('room:update', getSanitizedRoomState(room));
      io.to(cleanCode).emit('chat:system', {
        text: `${cleanName} joined as a spectator`,
        timestamp: Date.now(),
      });
      return;
    }

    // Joining as Player 2
    // Determine which symbol is free (host is X, so Player 2 is O)
    const existingSymbols = new Set(currentPlayers.map((p) => p.symbol));
    const symbolToAssign: 'X' | 'O' = existingSymbols.has('X') ? 'O' : 'X';

    room.players[socket.id] = {
      id: socket.id,
      name: cleanName,
      symbol: symbolToAssign,
      isHost: false,
      connected: true,
    };

    // Both players present: start game!
    if (Object.keys(room.players).length === 2 && room.status === 'waiting') {
      room.status = 'in_progress';
      room.currentTurn = 'X';
    }

    room.lastActive = Date.now();
    currentRoomId = cleanCode;
    currentRole = 'player';
    socket.join(cleanCode);

    socket.emit('room:joined', {
      roomId: cleanCode,
      role: 'player',
      player: room.players[socket.id],
      gameState: getSanitizedRoomState(room),
    });

    // Notify all participants in room
    io.to(cleanCode).emit('room:update', getSanitizedRoomState(room));
    io.to(cleanCode).emit('chat:system', {
      text: `${cleanName} joined as Player (${symbolToAssign}). Game is ready!`,
      timestamp: Date.now(),
    });

    console.log(`[Player Joined] ${cleanName} joined ${cleanCode} as ${symbolToAssign}`);
  });

  // Make a Move - Server Authoritative Validation
  socket.on('game:move', ({ cellIndex }: { cellIndex: number }) => {
    if (!currentRoomId) {
      socket.emit('game:error', { message: 'You are not in an active room.' });
      return;
    }

    const room = rooms.get(currentRoomId);
    if (!room) {
      socket.emit('game:error', { message: 'Game room no longer exists.' });
      return;
    }

    const player = room.players[socket.id];
    if (!player) {
      socket.emit('game:error', { message: 'Only active players can make moves.' });
      return;
    }

    // 1. Strict status check
    if (room.status !== 'in_progress') {
      socket.emit('game:error', {
        message: room.status === 'waiting' ? 'Waiting for opponent to join!' : 'The game has already ended.',
      });
      return;
    }

    // 2. Strict turn validation
    if (player.symbol !== room.currentTurn) {
      socket.emit('game:error', { message: `It's not your turn! Waiting for Player ${room.currentTurn}.` });
      return;
    }

    // 3. Cell boundary & emptiness validation
    if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex > 8 || !Number.isInteger(cellIndex)) {
      socket.emit('game:error', { message: 'Invalid board coordinate.' });
      return;
    }

    if (room.board[cellIndex] !== null) {
      socket.emit('game:error', { message: 'This cell is already occupied!' });
      return;
    }

    // Apply move authoritatively
    room.board[cellIndex] = player.symbol;
    room.lastActive = Date.now();

    // Check for win
    const winResult = checkWinner(room.board);

    if (winResult) {
      room.status = 'won';
      room.winner = winResult.winner;
      room.winningLine = winResult.line;
      room.scores[winResult.winner]++;
      room.rematchVotes = [];

      io.to(room.id).emit('game:over', {
        result: 'win',
        winner: winResult.winner,
        winningLine: winResult.line,
        winnerName: player.name,
        gameState: getSanitizedRoomState(room),
      });

      console.log(`[Game Won] Room ${room.id}: ${player.name} (${winResult.winner}) won!`);
    } else {
      // Check for draw (all cells filled, no winner)
      const isBoardFull = room.board.every((cell) => cell !== null);
      if (isBoardFull) {
        room.status = 'draw';
        room.winner = null;
        room.winningLine = null;
        room.scores.ties++;
        room.rematchVotes = [];

        io.to(room.id).emit('game:over', {
          result: 'draw',
          winner: null,
          winningLine: null,
          gameState: getSanitizedRoomState(room),
        });

        console.log(`[Game Draw] Room ${room.id} ended in a draw.`);
      } else {
        // Toggle turn
        room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';
        io.to(room.id).emit('game:update', getSanitizedRoomState(room));
      }
    }
  });

  // Rematch request
  socket.on('game:rematch', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    if (!room.players[socket.id]) return;

    if (!room.rematchVotes.includes(socket.id)) {
      room.rematchVotes.push(socket.id);
    }

    const playerNames = Object.values(room.players);
    const requestingPlayer = room.players[socket.id];

    // If both players agreed (or only 1 player is connected in testing)
    const requiredVotes = Math.min(2, playerNames.length);

    if (room.rematchVotes.length >= requiredVotes) {
      // Reset board
      room.board = Array(9).fill(null);
      room.winner = null;
      room.winningLine = null;
      room.rematchVotes = [];
      room.status = 'in_progress';
      // Alternate who starts or default to X
      room.currentTurn = 'X';
      room.lastActive = Date.now();

      io.to(room.id).emit('game:rematch_started', getSanitizedRoomState(room));
      io.to(room.id).emit('chat:system', {
        text: 'Both players agreed to a rematch! Round started.',
        timestamp: Date.now(),
      });
    } else {
      // Broadcast that 1 player voted for rematch
      io.to(room.id).emit('game:rematch_requested', {
        requestedBy: requestingPlayer.name,
        votes: room.rematchVotes.length,
        totalRequired: requiredVotes,
      });
    }
  });

  // Chat and Emoji Reaction
  socket.on('chat:send', ({ text, type }: { text: string; type?: 'text' | 'reaction' }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const sender = room.players[socket.id] || room.spectators[socket.id];
    const senderName = sender ? sender.name : 'Unknown';
    const isHost = sender && 'isHost' in sender ? (sender as Player).isHost : false;
    const symbol = sender && 'symbol' in sender ? (sender as Player).symbol : null;

    const cleanText = (text || '').trim().slice(0, 100);
    if (!cleanText) return;

    io.to(currentRoomId).emit('chat:message', {
      senderId: socket.id,
      senderName,
      text: cleanText,
      type: type || 'text',
      symbol,
      isHost,
      timestamp: Date.now(),
    });
  });

  // Leave room manually
  socket.on('room:leave', () => {
    handlePlayerLeaving(socket, currentRoomId);
    currentRoomId = null;
    currentRole = null;
  });

  // Disconnection handler
  socket.on('disconnect', () => {
    handlePlayerLeaving(socket, currentRoomId);
  });
});

function handlePlayerLeaving(socket: Socket, roomId: string | null) {
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;

  const leavingPlayer = room.players[socket.id];
  const leavingSpectator = room.spectators[socket.id];

  if (leavingPlayer) {
    delete room.players[socket.id];

    // If still in progress, set status to abandoned
    if (room.status === 'in_progress') {
      room.status = 'abandoned';
    }

    io.to(roomId).emit('room:player_left', {
      playerId: socket.id,
      playerName: leavingPlayer.name,
      symbol: leavingPlayer.symbol,
      gameState: getSanitizedRoomState(room),
    });

    io.to(roomId).emit('chat:system', {
      text: `${leavingPlayer.name} disconnected.`,
      timestamp: Date.now(),
    });

    console.log(`[Player Left] ${leavingPlayer.name} left room ${roomId}`);
  } else if (leavingSpectator) {
    delete room.spectators[socket.id];
    io.to(roomId).emit('room:update', getSanitizedRoomState(room));
  }

  // If room is completely empty, clean it up after a brief grace period
  const totalRemaining = Object.keys(room.players).length + Object.keys(room.spectators).length;
  if (totalRemaining === 0) {
    setTimeout(() => {
      const checkRoom = rooms.get(roomId);
      if (checkRoom) {
        const stillEmpty = Object.keys(checkRoom.players).length + Object.keys(checkRoom.spectators).length === 0;
        if (stillEmpty) {
          rooms.delete(roomId);
          console.log(`[Room Purged] Room ${roomId} purged from memory.`);
        }
      }
    }, 15000);
  }
}

// Full-Stack Server & Vite Integration
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Tic-Tac-Toe Arena server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
