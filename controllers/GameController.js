import { CAMP, GAME_MODE } from '../utils/constants.js';
import { Board } from '../models/Board.js';
import { AIController } from './AIController.js';

// ── UCI coordinate conversion ──
// Fairy-Stockfish UCI: rank 1=red back, rank 10=black back, files a-i
// Internal: row 0=black back, row 9=red back, col 0-8
const FILES = 'abcdefghi';
function toUci(row, col) {
  return FILES[col] + String(10 - row);
}
function fromUci(uci) {
  const col = FILES.indexOf(uci[0]);
  const row = 10 - parseInt(uci.substring(1));
  return { row, col };
}
// Parse a full UCI move string like "b3e3" or "b10c8" into from/to coordinates
function parseUciMove(uci) {
  let i = 0;
  const fromCol = FILES.indexOf(uci[i++]);
  let r = '';
  while (i < uci.length && uci[i] >= '0' && uci[i] <= '9') r += uci[i++];
  const fromRow = 10 - parseInt(r);
  const toCol = FILES.indexOf(uci[i++]);
  r = '';
  while (i < uci.length && uci[i] >= '0' && uci[i] <= '9') r += uci[i++];
  const toRow = 10 - parseInt(r);
  return { fromRow, fromCol, toRow, toCol };
}

export class GameController {
  constructor(view) {
    this.board = new Board();
    this.view = view;
    this.ai = null;
    this.gameMode = GAME_MODE.PVP;
    this.currentTurn = CAMP.RED;
    this.gameOver = false;
    this.winner = null;
    this.aiThinking = false;
    /** @type {string[]} UCI move history for engine communication */
    this.uciMoves = [];
    this.engineUrl = 'http://127.0.0.1:9090/bestmove';
  }

  startGame(mode) {
    this.board.initBoard();
    this.gameMode = mode;
    this.currentTurn = CAMP.RED;
    this.gameOver = false;
    this.winner = null;
    this.aiThinking = false;
    this.uciMoves = [];

    if (mode === GAME_MODE.PVE) {
      this.ai = new AIController(3);
    } else {
      this.ai = null;
    }

    this.view.clearSelection();
    this.view.lastMoveFrom = null;
    this.view.lastMoveTo = null;
    this.view.hideModeSelection();
    this.view.render(this.board);
  }

  handleClick(row, col) {
    if (this.gameOver || this.aiThinking) return;

    const piece = this.board.getPieceAt(row, col);

    if (this.view.selectedRow === null) {
      if (!piece || piece.camp !== this.currentTurn) return;
      const legalMoves = this._getLegalMovesForPiece(piece);
      this.view.setSelection(row, col, legalMoves);
      this.view.render(this.board);
      return;
    }

    const selectedRow = this.view.selectedRow;
    const selectedCol = this.view.selectedCol;

    if (piece && piece.camp === this.currentTurn) {
      const legalMoves = this._getLegalMovesForPiece(piece);
      this.view.setSelection(row, col, legalMoves);
      this.view.render(this.board);
      return;
    }

    const isLegal = this.view.legalMoves.some(m => m.row === row && m.col === col);
    if (isLegal) {
      this._executeMove(selectedRow, selectedCol, row, col);
      return;
    }

    this.view.clearSelection();
    this.view.render(this.board);
  }

  _getLegalMovesForPiece(piece) {
    const allLegal = this.board.getAllLegalMoves(piece.camp);
    return allLegal
      .filter(m => m.piece.id === piece.id)
      .map(m => ({ row: m.toRow, col: m.toCol }));
  }

  _executeMove(fromRow, fromCol, toRow, toCol) {
    const uci = toUci(fromRow, fromCol) + toUci(toRow, toCol);
    this.uciMoves.push(uci);

    this.board.movePiece(fromRow, fromCol, toRow, toCol);
    this.view.setLastMove(fromRow, fromCol, toRow, toCol);
    this.view.clearSelection();

    const opponentCamp = this.currentTurn === CAMP.RED ? CAMP.BLACK : CAMP.RED;
    const { checkmate, stalemate } = this.board.isCheckmateOrStalemate(opponentCamp);

    if (checkmate) {
      this.gameOver = true;
      this.winner = this.currentTurn;
      this.view.render(this.board);
      this.view.showGameOver(this.currentTurn);
      return;
    }
    if (stalemate) {
      this.gameOver = true;
      this.winner = null;
      this.view.render(this.board);
      this.view.showGameOver(null);
      return;
    }

    this.currentTurn = opponentCamp;
    this.board.currentTurn = this.currentTurn;
    this.view.render(this.board);

    if (this.gameMode === GAME_MODE.PVE && this.currentTurn === CAMP.BLACK) {
      this._triggerAI();
    } else if (this.gameMode === GAME_MODE.ENGINE && this.currentTurn === CAMP.BLACK) {
      this._triggerEngine();
    }
  }

  _triggerAI() {
    this.aiThinking = true;
    this.view.render(this.board);

    this.ai.getBestMove(this.board, CAMP.BLACK, (move) => {
      this.aiThinking = false;
      if (!move || this.gameOver) return;

      setTimeout(() => {
        this.board.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol);
        this.view.setLastMove(move.fromRow, move.fromCol, move.toRow, move.toCol);

        const { checkmate, stalemate } = this.board.isCheckmateOrStalemate(CAMP.RED);
        if (checkmate) {
          this.gameOver = true;
          this.winner = CAMP.BLACK;
          this.view.render(this.board);
          this.view.showGameOver(CAMP.BLACK);
          return;
        }
        if (stalemate) {
          this.gameOver = true;
          this.winner = null;
          this.view.render(this.board);
          this.view.showGameOver(null);
          return;
        }

        this.currentTurn = CAMP.RED;
        this.board.currentTurn = this.currentTurn;
        this.view.render(this.board);
      }, 300);
    });
  }

  _triggerEngine() {
    this.aiThinking = true;
    this.view.render(this.board);

    fetch(this.engineUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moves: this.uciMoves })
    })
      .then(res => res.json())
      .then(data => {
        this.aiThinking = false;
        if (!data || this.gameOver) return;

        const move = parseUciMove(data.uci);
        this.uciMoves.push(data.uci);

        this.board.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol);
        this.view.setLastMove(move.fromRow, move.fromCol, move.toRow, move.toCol);

        const { checkmate, stalemate } = this.board.isCheckmateOrStalemate(CAMP.RED);
        if (checkmate) {
          this.gameOver = true;
          this.winner = CAMP.BLACK;
          this.view.render(this.board);
          this.view.showGameOver(CAMP.BLACK);
          return;
        }
        if (stalemate) {
          this.gameOver = true;
          this.winner = null;
          this.view.render(this.board);
          this.view.showGameOver(null);
          return;
        }

        this.currentTurn = CAMP.RED;
        this.board.currentTurn = this.currentTurn;
        this.view.render(this.board);
      })
      .catch(err => {
        this.aiThinking = false;
        console.error('Engine error:', err);
        alert('引擎连接失败，请确认已启动: ./engine/engine_server ./engine/src/stockfish 9090');
      });
  }
}
