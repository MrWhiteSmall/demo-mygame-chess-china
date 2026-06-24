import { CAMP, PIECE_TYPE_NAME, BOARD_ROWS, BOARD_COLS } from '../utils/constants.js';
import { PieceFactory } from './Piece.js';

export class Board {
  constructor() {
    /** @type {(import('./Piece.js').Piece|null)[][]} */
    this.grid = [];
    /** @type {Map<string, import('./Piece.js').Piece>} */
    this.pieceMap = new Map();
    /** @type {string} */
    this.currentTurn = CAMP.RED;
    /** @type {{fromRow:number,fromCol:number,toRow:number,toCol:number,piece:import('./Piece.js').Piece,captured:import('./Piece.js').Piece|null}[]} */
    this.moveHistory = [];
    /** @type {{row:number,col:number}} */
    this.redKingPos = null;
    /** @type {{row:number,col:number}} */
    this.blackKingPos = null;

    this._factory = new PieceFactory();
  }

  initBoard() {
    // Reset state
    this.grid = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
    this.pieceMap.clear();
    this.moveHistory = [];
    this.currentTurn = CAMP.RED;

    const pieces = this._factory.createAllPieces();
    for (const p of pieces) {
      this.grid[p.position.row][p.position.col] = p;
      this.pieceMap.set(p.id, p);
      if (p.pieceType.typeName === PIECE_TYPE_NAME.KING) {
        if (p.camp === CAMP.RED) this.redKingPos = { ...p.position };
        else this.blackKingPos = { ...p.position };
      }
    }
  }

  getPieceAt(row, col) {
    if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) return null;
    return this.grid[row][col];
  }

  /**
   * Execute a move. Returns the captured piece or null.
   */
  movePiece(fromRow, fromCol, toRow, toCol) {
    const piece = this.grid[fromRow][fromCol];
    if (!piece) return null;

    const captured = this.grid[toRow][toCol];

    // Record in history
    this.moveHistory.push({
      fromRow, fromCol, toRow, toCol,
      piece,
      captured,
      oldRedKingPos: this.redKingPos ? { ...this.redKingPos } : null,
      oldBlackKingPos: this.blackKingPos ? { ...this.blackKingPos } : null
    });

    // Execute move
    this.grid[fromRow][fromCol] = null;
    this.grid[toRow][toCol] = piece;
    piece.position.row = toRow;
    piece.position.col = toCol;

    if (captured) {
      this.pieceMap.delete(captured.id);
    }

    // Update king position cache
    if (piece.pieceType.typeName === PIECE_TYPE_NAME.KING) {
      if (piece.camp === CAMP.RED) this.redKingPos = { row: toRow, col: toCol };
      else this.blackKingPos = { row: toRow, col: toCol };
    }

    return captured;
  }

  undoMove() {
    if (this.moveHistory.length === 0) return;
    const last = this.moveHistory.pop();

    const piece = last.piece;
    // Restore position
    this.grid[last.fromRow][last.fromCol] = piece;
    this.grid[last.toRow][last.toCol] = last.captured;
    piece.position.row = last.fromRow;
    piece.position.col = last.fromCol;

    if (last.captured) {
      this.pieceMap.set(last.captured.id, last.captured);
    }

    // Restore king positions
    this.redKingPos = last.oldRedKingPos;
    this.blackKingPos = last.oldBlackKingPos;
  }

  /** "Flying general" rule: kings in same column with nothing between */
  isKingFacingKing() {
    if (!this.redKingPos || !this.blackKingPos) return false;
    if (this.redKingPos.col !== this.blackKingPos.col) return false;

    const col = this.redKingPos.col;
    const topRow = Math.min(this.redKingPos.row, this.blackKingPos.row);
    const bottomRow = Math.max(this.redKingPos.row, this.blackKingPos.row);

    for (let r = topRow + 1; r < bottomRow; r++) {
      if (this.grid[r][col]) return false;
    }
    return true;
  }

  /**
   * Is the given camp's king in check?
   */
  isInCheck(camp) {
    const kingPos = camp === CAMP.RED ? this.redKingPos : this.blackKingPos;
    if (!kingPos) return false;

    const opponentCamp = camp === CAMP.RED ? CAMP.BLACK : CAMP.RED;
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const piece = this.grid[r][c];
        if (piece && piece.camp === opponentCamp) {
          const rawMoves = piece.getRawMoves(this);
          for (const m of rawMoves) {
            if (m.row === kingPos.row && m.col === kingPos.col) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * Get all legal moves for a camp (filtering self-check + king-facing-king).
   * Returns [{piece, toRow, toCol}, ...]
   */
  getAllLegalMoves(camp) {
    const legalMoves = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const piece = this.grid[r][c];
        if (!piece || piece.camp !== camp) continue;

        const rawMoves = piece.getRawMoves(this);
        for (const target of rawMoves) {
          // Simulate move
          const captured = this.movePiece(r, c, target.row, target.col);

          // Check legality
          const inCheck = this.isInCheck(camp);
          const facing = this.isKingFacingKing();

          // Undo
          this.undoMove();

          if (!inCheck && !facing) {
            legalMoves.push({ piece, toRow: target.row, toCol: target.col });
          }
        }
      }
    }
    return legalMoves;
  }

  /** Returns {checkmate: boolean, stalemate: boolean} */
  isCheckmateOrStalemate(camp) {
    const legalMoves = this.getAllLegalMoves(camp);
    if (legalMoves.length > 0) return { checkmate: false, stalemate: false };

    const inCheck = this.isInCheck(camp);
    return { checkmate: inCheck, stalemate: !inCheck };
  }

  /** Deep clone for AI search. Piece instances are cloned, PieceTypes are shared. */
  clone() {
    const b = new Board();
    b.grid = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
    b.currentTurn = this.currentTurn;
    b.moveHistory = []; // Clone doesn't need history

    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const piece = this.grid[r][c];
        if (piece) {
          const clone = piece.clone();
          b.grid[r][c] = clone;
          b.pieceMap.set(clone.id, clone);
          if (clone.pieceType.typeName === PIECE_TYPE_NAME.KING) {
            if (clone.camp === CAMP.RED) b.redKingPos = { row: r, col: c };
            else b.blackKingPos = { row: r, col: c };
          }
        }
      }
    }

    return b;
  }

  toString() {
    const lines = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
      const row = [];
      for (let c = 0; c < BOARD_COLS; c++) {
        const p = this.grid[r][c];
        row.push(p ? p.getChar() : '·');
      }
      lines.push(row.join(' '));
    }
    return lines.join('\n');
  }
}
