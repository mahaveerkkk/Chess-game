import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Trophy, AlertTriangle, XCircle } from 'lucide-react';

// --- Constants ---
const INITIAL_BOARD = [
  ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
  ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
];

const PIECE_VALUES = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
  P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0,
};

const PIECE_SYMBOLS = {
  p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚',
  P: '♟', R: '♜', N: '♞', B: '♝', Q: '♛', K: '♚',
};

// --- Helper Functions ---
const isWhite = (piece) => piece && piece === piece.toUpperCase();
const isBlack = (piece) => piece && piece === piece.toLowerCase();

export default function ChessGame() {
  const [board, setBoard] = useState(INITIAL_BOARD);
  const [turn, setTurn] = useState('white');
  const [selectedPos, setSelectedPos] = useState(null);
  const [validMoves, setValidMoves] = useState([]); // Array of {r, c}
  const [gameState, setGameState] = useState('playing'); // playing, check, checkmate, draw
  const [lastMove, setLastMove] = useState(null);
  const [capturedWhite, setCapturedWhite] = useState([]);
  const [capturedBlack, setCapturedBlack] = useState([]);

  // --- Logic ---

  // Check if a path is clear (for sliding pieces)
  const isPathClear = (boardState, from, to) => {
    const dr = Math.sign(to.r - from.r);
    const dc = Math.sign(to.c - from.c);
    let r = from.r + dr;
    let c = from.c + dc;

    while (r !== to.r || c !== to.c) {
      if (boardState[r][c]) return false;
      r += dr;
      c += dc;
    }
    return true;
  };

  // Validate geometry and rules for a single move
  const isValidMove = useCallback((boardState, from, to, checkTurn = true) => {
    const piece = boardState[from.r][from.c];
    const target = boardState[to.r][to.c];

    if (!piece) return false;
    
    // Turn validation
    if (checkTurn) {
      if (turn === 'white' && !isWhite(piece)) return false;
      if (turn === 'black' && !isBlack(piece)) return false;
    }

    // Friendly fire check
    if (target) {
      if (isWhite(piece) && isWhite(target)) return false;
      if (isBlack(piece) && isBlack(target)) return false;
    }

    const dy = to.r - from.r;
    const dx = to.c - from.c;
    const type = piece.toLowerCase();
    const isMovingPieceWhite = isWhite(piece);
    const direction = isMovingPieceWhite ? -1 : 1; // White moves up (-1), Black moves down (+1)

    switch (type) {
      case 'p': // Pawn
        // 1. Move Forward 1
        if (dx === 0 && dy === direction && !target) return true;
        // 2. Move Forward 2 (Initial)
        if (dx === 0 && dy === direction * 2 && !target) {
          const midRow = from.r + direction;
          if (boardState[midRow][from.c]) return false; // Blocked path
          if ((isMovingPieceWhite && from.r === 6) || (!isMovingPieceWhite && from.r === 1)) return true;
        }
        // 3. Capture Diagonal
        if (Math.abs(dx) === 1 && dy === direction && target) return true;
        return false;

      case 'r': // Rook
        if (dx !== 0 && dy !== 0) return false;
        return isPathClear(boardState, from, to);

      case 'b': // Bishop
        if (Math.abs(dx) !== Math.abs(dy)) return false;
        return isPathClear(boardState, from, to);

      case 'q': // Queen
        if ((dx !== 0 && dy !== 0) && (Math.abs(dx) !== Math.abs(dy))) return false;
        return isPathClear(boardState, from, to);

      case 'k': // King
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return false;
        return true;

      case 'n': // Knight
        if ((Math.abs(dx) === 2 && Math.abs(dy) === 1) || (Math.abs(dx) === 1 && Math.abs(dy) === 2)) return true;
        return false;

      default: return false;
    }
  }, [turn]);

  // Find King's position
  const findKing = (boardState, color) => {
    const kingChar = color === 'white' ? 'K' : 'k';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (boardState[r][c] === kingChar) return { r, c };
      }
    }
    return null; 
  };

  // Check if the King of 'color' is under attack
  const isKingSafe = (boardState, color) => {
    const kingPos = findKing(boardState, color);
    if (!kingPos) return true; // Should not happen unless king is eaten (bug)

    // Check every enemy piece on the board
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = boardState[r][c];
        if (!piece) continue;

        const isEnemy = color === 'white' ? isBlack(piece) : isWhite(piece);
        if (isEnemy) {
          // Can this enemy attack the King's square?
          // We pass checkTurn=false because it's not the enemy's turn to move, we just want to know if they CAN hit that square
          if (isValidMove(boardState, { r, c }, kingPos, false)) {
            return false;
          }
        }
      }
    }
    return true;
  };

  // Generate all legal moves for the current turn (filtering out self-check moves)
  const getLegalMoves = useCallback((boardState, activeTurn) => {
    const moves = []; // Array of { from: {r,c}, to: {r,c} }

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = boardState[r][c];
        if (!piece) continue;
        
        // Only verify moves for the active player's pieces
        if (activeTurn === 'white' && !isWhite(piece)) continue;
        if (activeTurn === 'black' && !isBlack(piece)) continue;

        // Try every square on the board as a target
        for (let tr = 0; tr < 8; tr++) {
          for (let tc = 0; tc < 8; tc++) {
            // 1. Is it geometrically valid?
            if (isValidMove(boardState, { r, c }, { r: tr, c: tc }, false)) {
              // 2. Simulate Move
              const newBoard = boardState.map(row => [...row]);
              newBoard[tr][tc] = newBoard[r][c];
              newBoard[r][c] = null;

              // 3. Is King safe after move?
              if (isKingSafe(newBoard, activeTurn)) {
                moves.push({ from: { r, c }, to: { r: tr, c: tc } });
              }
            }
          }
        }
      }
    }
    return moves;
  }, [isValidMove]);

  // --- Effects ---

  // Check Game State (Check/Mate/Stalemate)
  useEffect(() => {
    const currentKingSafe = isKingSafe(board, turn);
    const legalMoves = getLegalMoves(board, turn);

    if (legalMoves.length === 0) {
      if (!currentKingSafe) {
        setGameState('checkmate');
      } else {
        setGameState('draw');
      }
    } else {
      if (!currentKingSafe) {
        setGameState('check');
      } else {
        setGameState('playing');
      }
    }
  }, [board, turn, getLegalMoves]);

  // --- Handlers ---

  const handleSquareClick = (r, c) => {
    if (gameState === 'checkmate' || gameState === 'draw') return;

    const clickedPiece = board[r][c];
    const isSameColor = clickedPiece && ((turn === 'white' && isWhite(clickedPiece)) || (turn === 'black' && isBlack(clickedPiece)));

    // 1. Select New Piece
    if (isSameColor) {
      // Calculate valid moves for THIS piece
      const allLegalMoves = getLegalMoves(board, turn);
      const movesForPiece = allLegalMoves
        .filter(m => m.from.r === r && m.from.c === c)
        .map(m => m.to);
      
      setSelectedPos({ r, c });
      setValidMoves(movesForPiece);
      return;
    }

    // 2. Move Selected Piece
    if (selectedPos) {
      const isMoveValid = validMoves.some(m => m.r === r && m.c === c);

      if (isMoveValid) {
        // Execute Move
        const newBoard = board.map(row => [...row]);
        const piece = newBoard[selectedPos.r][selectedPos.c];
        const targetPiece = newBoard[r][c];

        // Handle Capture Lists
        if (targetPiece) {
          if (isWhite(targetPiece)) setCapturedWhite(prev => [...prev, targetPiece]);
          else setCapturedBlack(prev => [...prev, targetPiece]);
        }

        // Move
        newBoard[r][c] = piece;
        newBoard[selectedPos.r][selectedPos.c] = null;

        // Auto-Promotion (Simple Queen promotion)
        if (piece === 'P' && r === 0) newBoard[r][c] = 'Q';
        if (piece === 'p' && r === 7) newBoard[r][c] = 'q';

        setBoard(newBoard);
        setLastMove({ from: selectedPos, to: { r, c } });
        setTurn(turn === 'white' ? 'black' : 'white');
        
        // Clear selection
        setSelectedPos(null);
        setValidMoves([]);
      } else {
        // Clicked invalid empty square or enemy piece -> Deselect
        setSelectedPos(null);
        setValidMoves([]);
      }
    }
  };

  const resetGame = () => {
    setBoard(INITIAL_BOARD);
    setTurn('white');
    setGameState('playing');
    setLastMove(null);
    setSelectedPos(null);
    setValidMoves([]);
    setCapturedWhite([]);
    setCapturedBlack([]);
  };

  // --- Render Helpers ---

  const getSquareColor = (r, c) => {
    const isDark = (r + c) % 2 === 1;
    const base = isDark ? 'bg-[#769656]' : 'bg-[#eeeed2]'; // Standard Green/Beige theme

    // Highlight Selected
    if (selectedPos && selectedPos.r === r && selectedPos.c === c) return 'bg-yellow-200/80';
    
    // Highlight Last Move
    if (lastMove && ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c))) {
      return 'bg-yellow-200/50';
    }

    // Check Highlight
    if (gameState === 'check' || gameState === 'checkmate') {
      const kingPos = findKing(board, turn);
      if (kingPos && kingPos.r === r && kingPos.c === c) return 'bg-red-500 radial-gradient';
    }

    return base;
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans text-slate-100">
      
      {/* --- Header --- */}
      <div className="w-full max-w-[500px] flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="text-yellow-400" /> Chess
          </h1>
          <p className="text-xs text-slate-400">React Engine v1.0</p>
        </div>
        
        <div className="flex flex-col items-end gap-1">
          <button onClick={resetGame} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded text-sm transition-colors">
            <RefreshCw size={14} /> New Game
          </button>
          {gameState !== 'playing' && (
            <div className="bg-red-500/20 text-red-200 px-3 py-1 rounded text-sm font-bold border border-red-500/50 flex items-center gap-2">
              <AlertTriangle size={14} />
              {gameState === 'checkmate' ? 'Checkmate!' : gameState === 'check' ? 'Check!' : 'Draw'}
            </div>
          )}
        </div>
      </div>

      {/* --- Opponent Info (Black) --- */}
      <div className="w-full max-w-[480px] flex justify-between items-end mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${turn === 'black' ? 'bg-yellow-400 text-black ring-2 ring-yellow-200' : 'bg-slate-700 text-slate-400'}`}>
            B
          </div>
          <span className={turn === 'black' ? 'text-white font-semibold' : 'text-slate-500'}>Opponent</span>
        </div>
        <div className="flex gap-1 h-6">
          {capturedWhite.map((p, i) => <span key={i} className="text-xl text-slate-400">{PIECE_SYMBOLS[p]}</span>)}
        </div>
      </div>

      {/* --- The Board --- */}
      <div className="relative shadow-2xl rounded-sm overflow-hidden select-none">
        <div className="grid grid-cols-8 w-[320px] h-[320px] sm:w-[480px] sm:h-[480px]">
          {board.map((row, r) => (
            row.map((piece, c) => (
              <div
                key={`${r}-${c}`}
                onClick={() => handleSquareClick(r, c)}
                className={`relative flex items-center justify-center text-[2.5rem] sm:text-[3.5rem] cursor-pointer ${getSquareColor(r, c)}`}
              >
                {/* 1. Coordinate Labels (A1, H8 style) */}
                {c === 0 && r % 2 === 0 && <span className="absolute left-0.5 top-0 text-[10px] sm:text-xs font-bold text-slate-700/50">{8 - r}</span>}
                {c === 0 && r % 2 !== 0 && <span className="absolute left-0.5 top-0 text-[10px] sm:text-xs font-bold text-[#eeeed2]/50">{8 - r}</span>}
                {r === 7 && c % 2 !== 0 && <span className="absolute right-0.5 bottom-0 text-[10px] sm:text-xs font-bold text-slate-700/50">{String.fromCharCode(97 + c)}</span>}
                {r === 7 && c % 2 === 0 && <span className="absolute right-0.5 bottom-0 text-[10px] sm:text-xs font-bold text-[#eeeed2]/50">{String.fromCharCode(97 + c)}</span>}

                {/* 2. Valid Move Hint (Dot or Corners) */}
                {validMoves.some(m => m.r === r && m.c === c) && (
                  <>
                    {!piece ? (
                      // Empty square hint
                      <div className="absolute w-3 h-3 sm:w-4 sm:h-4 bg-black/20 rounded-full pointer-events-none" />
                    ) : (
                      // Capture hint (Corners)
                      <div className="absolute inset-0 border-4 border-black/20 rounded-none pointer-events-none" />
                    )}
                  </>
                )}

                {/* 3. The Piece */}
                {piece && (
                  <div className={`
                    z-10 leading-none drop-shadow-lg transition-transform hover:scale-105 active:scale-95
                    ${isWhite(piece) ? 'text-white drop-shadow-[0_2px_1px_rgba(0,0,0,0.6)]' : 'text-black drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]'}
                  `}>
                    {PIECE_SYMBOLS[piece]}
                  </div>
                )}
              </div>
            ))
          ))}
        </div>
        
        {/* Game Over Overlay */}
        {gameState === 'checkmate' && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 backdrop-blur-sm">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 text-center shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-2">Checkmate!</h2>
              <p className="text-slate-400 mb-4">{turn === 'white' ? 'Black' : 'White'} wins the game.</p>
              <button onClick={resetGame} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-6 rounded-full transition-transform hover:scale-105">
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- Player Info (White) --- */}
      <div className="w-full max-w-[480px] flex justify-between items-start mt-2 px-1">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${turn === 'white' ? 'bg-yellow-400 text-black ring-2 ring-yellow-200' : 'bg-slate-700 text-slate-400'}`}>
            W
          </div>
          <span className={turn === 'white' ? 'text-white font-semibold' : 'text-slate-500'}>You</span>
        </div>
        <div className="flex gap-1 h-6">
          {capturedBlack.map((p, i) => <span key={i} className="text-xl text-slate-400">{PIECE_SYMBOLS[p]}</span>)}
        </div>
      </div>
      
    </div>
  );
}


