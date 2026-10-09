/**
 * Minimax AI for Tic-Tac-Toe
 */

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

export function checkBoardWinner(board: (string | null)[]): { winner: 'X' | 'O'; line: number[] } | null {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a] as 'X' | 'O', line: combo };
    }
  }
  return null;
}

export function getBestMove(board: (string | null)[], aiSymbol: 'X' | 'O', difficulty: 'easy' | 'medium' | 'hard' = 'hard'): number {
  const emptyIndices = board
    .map((val, idx) => (val === null ? idx : null))
    .filter((val): val is number => val !== null);

  if (emptyIndices.length === 0) return -1;

  // Easy: random move
  if (difficulty === 'easy') {
    return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
  }

  // Medium: 40% random, 60% optimal
  if (difficulty === 'medium' && Math.random() < 0.35) {
    return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
  }

  const humanSymbol = aiSymbol === 'X' ? 'O' : 'X';

  // Hard: Minimax algorithm
  function minimax(currentBoard: (string | null)[], depth: number, isMaximizing: boolean): number {
    const winResult = checkBoardWinner(currentBoard);
    if (winResult) {
      return winResult.winner === aiSymbol ? 10 - depth : depth - 10;
    }
    if (currentBoard.every((c) => c !== null)) {
      return 0; // tie
    }

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (currentBoard[i] === null) {
          currentBoard[i] = aiSymbol;
          const evaluation = minimax(currentBoard, depth + 1, false);
          currentBoard[i] = null;
          maxEval = Math.max(maxEval, evaluation);
        }
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (let i = 0; i < 9; i++) {
        if (currentBoard[i] === null) {
          currentBoard[i] = humanSymbol;
          const evaluation = minimax(currentBoard, depth + 1, true);
          currentBoard[i] = null;
          minEval = Math.min(minEval, evaluation);
        }
      }
      return minEval;
    }
  }

  let bestScore = -Infinity;
  let bestMove = emptyIndices[0];

  for (const idx of emptyIndices) {
    board[idx] = aiSymbol;
    const score = minimax(board, 0, false);
    board[idx] = null;
    if (score > bestScore) {
      bestScore = score;
      bestMove = idx;
    }
  }

  return bestMove;
}
