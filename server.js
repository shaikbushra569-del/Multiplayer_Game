/**
 * Handshake Project: Create a Multiplayer Game
 * Tech Stack: Node.js, Express.js, Socket.IO
 * Standalone production server
 */
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static assets from 'dist' if built, or 'public'
import fs from 'fs';
const staticDir = fs.existsSync(path.join(__dirname, 'dist'))
  ? path.join(__dirname, 'dist')
  : path.join(__dirname, 'public');

app.use(express.static(staticDir));

// Game State Management
const rooms = new Map();

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function checkWinner(board) {
  for (const [a, b, c] of WINNING_COMBOS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  return null;
}

function sanitizeRoom(room) {
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

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// REST endpoints
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));
app.get('/api/stats', (req, res) => {
  let totalPlayers = 0;
  rooms.forEach(r => {
    totalPlayers += Object.keys(r.players).length + Object.keys(r.spectators).length;
  });
  res.json({ activeRooms: rooms.size, totalPlayers });
});

// Socket.IO events
io.on('connection', (socket) => {
  let currentRoomId = null;

  socket.on('room:create', ({ playerName, preferredCode }) => {
    const cleanName = (playerName || 'Player 1').trim().slice(0, 20) || 'Player 1';
    let roomId = preferredCode ? preferredCode.trim().toUpperCase().slice(0, 10) : generateRoomCode();

    if (!preferredCode) {
      while (rooms.has(roomId)) roomId = generateRoomCode();
    } else if (rooms.has(roomId)) {
      socket.emit('room:error', { message: `Room "${roomId}" already exists. Try joining it instead.` });
      return;
    }

    const room = {
      id: roomId,
      players: {
        [socket.id]: { id: socket.id, name: cleanName, symbol: 'X', isHost: true, connected: true }
      },
      spectators: {},
      board: Array(9).fill(null),
      currentTurn: 'X',
      status: 'waiting',
      winner: null,
      winningLine: null,
      scores: { X: 0, O: 0, ties: 0 },
      rematchVotes: [],
    };

    rooms.set(roomId, room);
    currentRoomId = roomId;
    socket.join(roomId);

    socket.emit('room:created', {
      roomId,
      player: room.players[socket.id],
      gameState: sanitizeRoom(room),
    });
  });

  socket.on('room:join', ({ roomId, playerName, asSpectator }) => {
    const cleanCode = (roomId || '').trim().toUpperCase();
    const cleanName = (playerName || 'Player 2').trim().slice(0, 20) || 'Player 2';
    const room = rooms.get(cleanCode);

    if (!room) {
      socket.emit('room:error', { message: `Room "${cleanCode}" not found.` });
      return;
    }

    const currentPlayers = Object.values(room.players);
    if (asSpectator || currentPlayers.length >= 2) {
      room.spectators[socket.id] = { id: socket.id, name: cleanName };
      currentRoomId = cleanCode;
      socket.join(cleanCode);
      socket.emit('room:joined', { roomId: cleanCode, role: 'spectator', gameState: sanitizeRoom(room) });
      io.to(cleanCode).emit('room:update', sanitizeRoom(room));
      io.to(cleanCode).emit('chat:system', { text: `${cleanName} joined as spectator.`, timestamp: Date.now() });
      return;
    }

    const existingSymbols = new Set(currentPlayers.map(p => p.symbol));
    const symbolToAssign = existingSymbols.has('X') ? 'O' : 'X';

    room.players[socket.id] = {
      id: socket.id,
      name: cleanName,
      symbol: symbolToAssign,
      isHost: false,
      connected: true,
    };

    if (Object.keys(room.players).length === 2 && room.status === 'waiting') {
      room.status = 'in_progress';
      room.currentTurn = 'X';
    }

    currentRoomId = cleanCode;
    socket.join(cleanCode);

    socket.emit('room:joined', {
      roomId: cleanCode,
      role: 'player',
      player: room.players[socket.id],
      gameState: sanitizeRoom(room),
    });

    io.to(cleanCode).emit('room:update', sanitizeRoom(room));
    io.to(cleanCode).emit('chat:system', {
      text: `${cleanName} joined as Player (${symbolToAssign}). Game starts!`,
      timestamp: Date.now(),
    });
  });

  socket.on('game:move', ({ cellIndex }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const player = room.players[socket.id];
    if (!player) {
      socket.emit('game:error', { message: 'Only active players can make moves.' });
      return;
    }

    if (room.status !== 'in_progress') {
      socket.emit('game:error', { message: 'Game is not in progress.' });
      return;
    }

    if (player.symbol !== room.currentTurn) {
      socket.emit('game:error', { message: `Wait for Player ${room.currentTurn}'s turn.` });
      return;
    }

    if (cellIndex < 0 || cellIndex > 8 || room.board[cellIndex] !== null) {
      socket.emit('game:error', { message: 'Invalid move.' });
      return;
    }

    room.board[cellIndex] = player.symbol;
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
        gameState: sanitizeRoom(room),
      });
    } else if (room.board.every(cell => cell !== null)) {
      room.status = 'draw';
      room.winner = null;
      room.winningLine = null;
      room.scores.ties++;
      room.rematchVotes = [];

      io.to(room.id).emit('game:over', {
        result: 'draw',
        winner: null,
        winningLine: null,
        gameState: sanitizeRoom(room),
      });
    } else {
      room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';
      io.to(room.id).emit('game:update', sanitizeRoom(room));
    }
  });

  socket.on('game:rematch', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || !room.players[socket.id]) return;

    if (!room.rematchVotes.includes(socket.id)) {
      room.rematchVotes.push(socket.id);
    }

    const requiredVotes = Math.min(2, Object.keys(room.players).length);
    if (room.rematchVotes.length >= requiredVotes) {
      room.board = Array(9).fill(null);
      room.winner = null;
      room.winningLine = null;
      room.rematchVotes = [];
      room.status = 'in_progress';
      room.currentTurn = 'X';

      io.to(room.id).emit('game:rematch_started', sanitizeRoom(room));
      io.to(room.id).emit('chat:system', { text: 'Rematch started!', timestamp: Date.now() });
    } else {
      io.to(room.id).emit('game:rematch_requested', {
        requestedBy: room.players[socket.id].name,
        votes: room.rematchVotes.length,
        totalRequired: requiredVotes,
      });
    }
  });

  socket.on('chat:send', ({ text, type }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const sender = room.players[socket.id] || room.spectators[socket.id];
    const cleanText = (text || '').trim().slice(0, 100);
    if (!cleanText) return;

    io.to(currentRoomId).emit('chat:message', {
      senderId: socket.id,
      senderName: sender ? sender.name : 'Unknown',
      text: cleanText,
      type: type || 'text',
      symbol: sender?.symbol || null,
      timestamp: Date.now(),
    });
  });

  const leave = () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const p = room.players[socket.id];
    if (p) {
      delete room.players[socket.id];
      if (room.status === 'in_progress') room.status = 'abandoned';
      io.to(currentRoomId).emit('room:player_left', {
        playerId: socket.id,
        playerName: p.name,
        symbol: p.symbol,
        gameState: sanitizeRoom(room),
      });
      io.to(currentRoomId).emit('chat:system', { text: `${p.name} disconnected.`, timestamp: Date.now() });
    } else if (room.spectators[socket.id]) {
      delete room.spectators[socket.id];
      io.to(currentRoomId).emit('room:update', sanitizeRoom(room));
    }

    if (Object.keys(room.players).length === 0 && Object.keys(room.spectators).length === 0) {
      setTimeout(() => {
        if (rooms.get(currentRoomId) && Object.keys(rooms.get(currentRoomId).players).length === 0) {
          rooms.delete(currentRoomId);
        }
      }, 10000);
    }
  };

  socket.on('room:leave', leave);
  socket.on('disconnect', leave);
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
