/**
 * Client Socket.IO logic for Vanilla multiplayer frontend
 */
const socket = io();

// State
let myPlayer = null;
let currentGameState = null;

// DOM Elements
const connectionStatus = document.getElementById('connectionStatus');
const lobbyScreen = document.getElementById('lobbyScreen');
const gameScreen = document.getElementById('gameScreen');

const playerNameInput = document.getElementById('playerNameInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomInput = document.getElementById('joinRoomInput');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const lobbyError = document.getElementById('lobbyError');

const displayRoomCode = document.getElementById('displayRoomCode');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');

const namePlayerX = document.getElementById('namePlayerX');
const namePlayerO = document.getElementById('namePlayerO');
const cardPlayerX = document.getElementById('cardPlayerX');
const cardPlayerO = document.getElementById('cardPlayerO');
const scoreX = document.getElementById('scoreX');
const scoreO = document.getElementById('scoreO');
const scoreTies = document.getElementById('scoreTies');

const turnBanner = document.getElementById('turnBanner');
const gameBoard = document.getElementById('gameBoard');
const cells = document.querySelectorAll('.cell');
const rematchBtn = document.getElementById('rematchBtn');
const gameError = document.getElementById('gameError');

// Connection tracking
socket.on('connect', () => {
  connectionStatus.textContent = '🟢 Online';
  connectionStatus.classList.add('connected');
});

socket.on('disconnect', () => {
  connectionStatus.textContent = '🔴 Disconnected';
  connectionStatus.classList.remove('connected');
});

// Create Room
createRoomBtn.addEventListener('click', () => {
  const playerName = playerNameInput.value.trim() || 'Player 1';
  clearErrors();
  socket.emit('room:create', { playerName });
});

// Join Room
joinRoomBtn.addEventListener('click', () => {
  const playerName = playerNameInput.value.trim() || 'Player 2';
  const roomId = joinRoomInput.value.trim().toUpperCase();
  if (!roomId) {
    showError(lobbyError, 'Please enter a valid room code.');
    return;
  }
  clearErrors();
  socket.emit('room:join', { roomId, playerName });
});

// Copy Code
copyCodeBtn.addEventListener('click', () => {
  if (currentGameState && currentGameState.id) {
    navigator.clipboard.writeText(currentGameState.id);
    const orig = copyCodeBtn.textContent;
    copyCodeBtn.textContent = '✓';
    setTimeout(() => { copyCodeBtn.textContent = orig; }, 1500);
  }
});

// Leave Room
leaveRoomBtn.addEventListener('click', () => {
  socket.emit('room:leave');
  myPlayer = null;
  currentGameState = null;
  gameScreen.classList.remove('active');
  lobbyScreen.classList.add('active');
});

// Rematch
rematchBtn.addEventListener('click', () => {
  socket.emit('game:rematch');
  rematchBtn.disabled = true;
  rematchBtn.textContent = 'Waiting for opponent...';
});

// Board Clicks
cells.forEach(cell => {
  cell.addEventListener('click', () => {
    const idx = parseInt(cell.getAttribute('data-index'), 10);
    if (!myPlayer) return;
    if (currentGameState.status !== 'in_progress') return;
    if (currentGameState.currentTurn !== myPlayer.symbol) return;
    if (currentGameState.board[idx] !== null) return;

    socket.emit('game:move', { cellIndex: idx });
  });
});

// Socket Events
socket.on('room:created', (data) => {
  myPlayer = data.player;
  currentGameState = data.gameState;
  enterGameScreen();
  updateGameView();
});

socket.on('room:joined', (data) => {
  myPlayer = data.player;
  currentGameState = data.gameState;
  enterGameScreen();
  updateGameView();
});

socket.on('room:update', (state) => {
  currentGameState = state;
  updateGameView();
});

socket.on('game:update', (state) => {
  currentGameState = state;
  updateGameView();
});

socket.on('game:over', (data) => {
  currentGameState = data.gameState;
  updateGameView();
  rematchBtn.classList.remove('hidden');
  rematchBtn.disabled = false;
  rematchBtn.textContent = 'Play Again';
});

socket.on('game:rematch_started', (state) => {
  currentGameState = state;
  rematchBtn.classList.add('hidden');
  rematchBtn.disabled = false;
  rematchBtn.textContent = 'Play Again';
  updateGameView();
});

socket.on('game:rematch_requested', (data) => {
  if (myPlayer && data.requestedBy !== myPlayer.name) {
    turnBanner.textContent = `${data.requestedBy} wants a rematch! Click Play Again.`;
  }
});

socket.on('room:player_left', (data) => {
  currentGameState = data.gameState;
  updateGameView();
  showError(gameError, `${data.playerName} left the match.`);
});

socket.on('room:error', (data) => {
  showError(lobbyError, data.message);
});

socket.on('game:error', (data) => {
  showError(gameError, data.message);
  setTimeout(() => { gameError.classList.add('hidden'); }, 3000);
});

function enterGameScreen() {
  lobbyScreen.classList.remove('active');
  gameScreen.classList.add('active');
  displayRoomCode.textContent = currentGameState.id;
  clearErrors();
}

function updateGameView() {
  if (!currentGameState) return;

  // Update players
  const playerX = currentGameState.players.find(p => p.symbol === 'X');
  const playerO = currentGameState.players.find(p => p.symbol === 'O');

  namePlayerX.textContent = playerX ? (playerX.id === socket.id ? `${playerX.name} (You)` : playerX.name) : 'Waiting...';
  namePlayerO.textContent = playerO ? (playerO.id === socket.id ? `${playerO.name} (You)` : playerO.name) : 'Waiting...';

  scoreX.textContent = currentGameState.scores.X;
  scoreO.textContent = currentGameState.scores.O;
  scoreTies.textContent = currentGameState.scores.ties;

  // Active turn glow
  cardPlayerX.classList.toggle('active-turn', currentGameState.currentTurn === 'X' && currentGameState.status === 'in_progress');
  cardPlayerO.classList.toggle('active-turn', currentGameState.currentTurn === 'O' && currentGameState.status === 'in_progress');

  // Turn banner
  if (currentGameState.status === 'waiting') {
    turnBanner.textContent = '⏳ Waiting for another player to join...';
  } else if (currentGameState.status === 'in_progress') {
    if (myPlayer) {
      if (currentGameState.currentTurn === myPlayer.symbol) {
        turnBanner.textContent = '🎯 Your turn! Make your move.';
      } else {
        turnBanner.textContent = `⏳ Waiting for opponent (${currentGameState.currentTurn})...`;
      }
    } else {
      turnBanner.textContent = `Spectating: Turn Player ${currentGameState.currentTurn}`;
    }
  } else if (currentGameState.status === 'won') {
    if (myPlayer && currentGameState.winner === myPlayer.symbol) {
      turnBanner.textContent = '🏆 Victory! You won this round!';
    } else if (myPlayer) {
      turnBanner.textContent = `Defeat! Player ${currentGameState.winner} won.`;
    } else {
      turnBanner.textContent = `Player ${currentGameState.winner} won!`;
    }
  } else if (currentGameState.status === 'draw') {
    turnBanner.textContent = "🤝 It's a draw! Well played.";
  } else if (currentGameState.status === 'abandoned') {
    turnBanner.textContent = 'Opponent disconnected.';
  }

  // Render board
  cells.forEach((cell, idx) => {
    const val = currentGameState.board[idx];
    cell.textContent = val || '';
    cell.className = 'cell';
    if (val === 'X') cell.classList.add('x-mark');
    if (val === 'O') cell.classList.add('o-mark');

    // Winning line highlight
    if (currentGameState.winningLine && currentGameState.winningLine.includes(idx)) {
      cell.classList.add('winning-cell');
    }

    // Disable if cell taken or not my turn
    const isMyTurn = myPlayer && currentGameState.currentTurn === myPlayer.symbol && currentGameState.status === 'in_progress';
    cell.disabled = val !== null || !isMyTurn;
  });
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearErrors() {
  lobbyError.classList.add('hidden');
  gameError.classList.add('hidden');
}
