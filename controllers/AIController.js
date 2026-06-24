import { CAMP, PIECE_TYPE_NAME, PIECE_VALUE, POSITION_BONUS, BOARD_ROWS, BOARD_COLS } from '../utils/constants.js';

export class AIController {
  constructor(maxDepth = 3) {
    this.maxDepth = maxDepth;
    this.aborted = false;
    this.nodeCount = 0;
    this.qsNodeCount = 0;
  }

  abort() {
    this.aborted = true;
  }

  // ── Entry point ──

  getBestMove(board, camp, callback) {
    this.aborted = false;
    this.nodeCount = 0;
    this.qsNodeCount = 0;

    const moves = board.getAllLegalMoves(camp);
    if (moves.length === 0) {
      callback(null);
      return;
    }
    if (moves.length === 1) {
      const m = moves[0];
      callback({
        fromRow: m.piece.position.row, fromCol: m.piece.position.col,
        toRow: m.toRow, toCol: m.toCol
      });
      return;
    }

    this._orderMoves(moves, camp, board);

    let bestScore = -Infinity;
    let bestMove = moves[0];
    const opponentCamp = camp === CAMP.RED ? CAMP.BLACK : CAMP.RED;

    const BATCH_SIZE = 300;
    let moveIndex = 0;

    const processBatch = () => {
      if (this.aborted) { callback(null); return; }

      const end = Math.min(moveIndex + BATCH_SIZE, moves.length);
      for (let i = moveIndex; i < end; i++) {
        const move = moves[i];
        const clone = board.clone();
        clone.movePiece(move.piece.position.row, move.piece.position.col, move.toRow, move.toCol);

        const score = this._minimax(clone, this.maxDepth - 1, -Infinity, Infinity, false, opponentCamp);

        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }

      moveIndex = end;
      if (moveIndex < moves.length) {
        setTimeout(processBatch, 0);
      } else {
        callback({
          fromRow: bestMove.piece.position.row,
          fromCol: bestMove.piece.position.col,
          toRow: bestMove.toRow,
          toCol: bestMove.toCol
        });
      }
    };

    setTimeout(processBatch, 10);
  }

  // ── Minimax with Alpha-Beta pruning ──

  _minimax(board, depth, alpha, beta, maximizing, camp) {
    this.nodeCount++;
    if (this.aborted) return 0;

    const currentCamp = maximizing ? camp : (camp === CAMP.RED ? CAMP.BLACK : CAMP.RED);
    const moves = board.getAllLegalMoves(currentCamp);

    // Terminal states
    if (moves.length === 0) {
      if (board.isInCheck(currentCamp)) {
        return maximizing ? -100000 + (this.maxDepth - depth) : 100000 - (this.maxDepth - depth);
      }
      return 0;
    }

    // Leaf: quiescence search instead of static eval
    if (depth === 0) {
      return this._quiescence(board, alpha, beta, maximizing, camp, 1);
    }

    this._orderMoves(moves, currentCamp, board);

    if (maximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        const clone = board.clone();
        clone.movePiece(move.piece.position.row, move.piece.position.col, move.toRow, move.toCol);

        const evalScore = this._minimax(clone, depth - 1, alpha, beta, false, camp);
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        const clone = board.clone();
        clone.movePiece(move.piece.position.row, move.piece.position.col, move.toRow, move.toCol);

        const evalScore = this._minimax(clone, depth - 1, alpha, beta, true, camp);
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  // ── Quiescence search: only captures at leaf nodes to avoid horizon effect ──

  _quiescence(board, alpha, beta, maximizing, camp, maxDepth) {
    this.qsNodeCount++;
    if (this.aborted) return 0;

    // Stand-pat score
    const standPat = this._evaluate(board, camp);
    if (maximizing) {
      if (standPat >= beta) return beta;
      if (standPat > alpha) alpha = standPat;
    } else {
      if (standPat <= alpha) return alpha;
      if (standPat < beta) beta = standPat;
    }

    if (maxDepth === 0) return standPat;

    const currentCamp = maximizing ? camp : (camp === CAMP.RED ? CAMP.BLACK : CAMP.RED);
    const allMoves = board.getAllLegalMoves(currentCamp);

    // Only consider captures
    const captures = [];
    for (const m of allMoves) {
      const target = board.getPieceAt(m.toRow, m.toCol);
      if (target) {
        m._capturedPieceType = target.pieceType.typeName;
        captures.push(m);
      }
    }

    if (captures.length === 0) return standPat;

    this._orderMoves(captures, currentCamp, board);

    if (maximizing) {
      for (const move of captures) {
        const clone = board.clone();
        clone.movePiece(move.piece.position.row, move.piece.position.col, move.toRow, move.toCol);

        const score = this._quiescence(clone, alpha, beta, false, camp, maxDepth - 1);
        if (score > alpha) alpha = score;
        if (alpha >= beta) break;
      }
      return alpha;
    } else {
      for (const move of captures) {
        const clone = board.clone();
        clone.movePiece(move.piece.position.row, move.piece.position.col, move.toRow, move.toCol);

        const score = this._quiescence(clone, alpha, beta, true, camp, maxDepth - 1);
        if (score < beta) beta = score;
        if (alpha >= beta) break;
      }
      return beta;
    }
  }

  // ── Move ordering ──

  _orderMoves(moves, camp, board) {
    for (const m of moves) {
      const target = board.getPieceAt(m.toRow, m.toCol);
      m._capturedPieceType = target ? target.pieceType.typeName : null;

      // Bonus for checking the opponent
      const clone = board.clone();
      clone.movePiece(m.piece.position.row, m.piece.position.col, m.toRow, m.toCol);
      const opponentCamp = camp === CAMP.RED ? CAMP.BLACK : CAMP.RED;
      m._givesCheck = clone.isInCheck(opponentCamp);
    }

    moves.sort((a, b) => {
      const scoreA = this._movePriority(a);
      const scoreB = this._movePriority(b);
      return scoreB - scoreA;
    });
  }

  _movePriority(move) {
    let score = 0;
    const piece = move.piece;

    // Captures: MVV-LVA
    if (move._capturedPieceType) {
      const capturedVal = PIECE_VALUE[move._capturedPieceType];
      score += capturedVal * 10;
      score += capturedVal - PIECE_VALUE[piece.pieceType.typeName];
    }

    // Checks
    if (move._givesCheck) {
      score += 500;
    }

    score += PIECE_VALUE[piece.pieceType.typeName];
    return score;
  }

  // ── Evaluation ──

  _evaluate(board, camp) {
    let score = 0;

    const opponentCamp = camp === CAMP.RED ? CAMP.BLACK : CAMP.RED;

    // Material + position
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const piece = board.getPieceAt(r, c);
        if (!piece) continue;

        const value = PIECE_VALUE[piece.pieceType.typeName];
        const bonus = this._getPositionBonus(piece, r, c);

        if (piece.camp === camp) {
          score += value + bonus;
        } else {
          score -= value + bonus;
        }
      }
    }

    // King safety: reward having defenders near the king
    score += this._kingSafety(board, camp);
    score -= this._kingSafety(board, opponentCamp);

    // Rook on open/半 open files
    score += this._rookOpenFile(board, camp);
    score -= this._rookOpenFile(board, opponentCamp);

    // Pawn advancement
    score += this._pawnAdvancement(board, camp);
    score -= this._pawnAdvancement(board, opponentCamp);

    return score;
  }

  /** King safety: reward advisors and elephants near the king */
  _kingSafety(board, camp) {
    const kingPos = camp === CAMP.RED ? board.redKingPos : board.blackKingPos;
    if (!kingPos) return 0;

    let safety = 0;
    // Count remaining advisors and elephants
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const p = board.getPieceAt(r, c);
        if (!p || p.camp !== camp) continue;
        const t = p.pieceType.typeName;
        if (t === PIECE_TYPE_NAME.ADVISOR) safety += 15;
        if (t === PIECE_TYPE_NAME.ELEPHANT) safety += 15;
      }
    }
    // Bonus if king is not on the edge column
    if (kingPos.col >= 3 && kingPos.col <= 5) safety += 5;

    return safety;
  }

  /** Rook on open files (no pawns) or half-open files (only enemy pawns) */
  _rookOpenFile(board, camp) {
    let bonus = 0;
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const p = board.getPieceAt(r, c);
        if (!p || p.camp !== camp || p.pieceType.typeName !== PIECE_TYPE_NAME.ROOK) continue;

        let hasFriendlyPawn = false;
        let hasEnemyPawn = false;
        for (let rr = 0; rr < BOARD_ROWS; rr++) {
          const fp = board.getPieceAt(rr, c);
          if (fp && fp.pieceType.typeName === PIECE_TYPE_NAME.PAWN) {
            if (fp.camp === camp) hasFriendlyPawn = true;
            else hasEnemyPawn = true;
          }
        }

        if (!hasFriendlyPawn && !hasEnemyPawn) bonus += 20;        // Open file
        else if (!hasFriendlyPawn && hasEnemyPawn) bonus += 12;    // Half-open (can attack)
      }
    }
    return bonus;
  }

  /** Pawn advancement: bonus for pawns that crossed the river */
  _pawnAdvancement(board, camp) {
    let bonus = 0;
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const p = board.getPieceAt(r, c);
        if (!p || p.camp !== camp || p.pieceType.typeName !== PIECE_TYPE_NAME.PAWN) continue;

        const crossed = camp === CAMP.RED ? r <= 4 : r >= 5;
        if (crossed) {
          bonus += 25;  // Crossed river
          // Center pawns are more valuable
          if (c >= 3 && c <= 5) bonus += 10;
        }
      }
    }
    return bonus;
  }

  _getPositionBonus(piece, row, col) {
    const bonusTable = POSITION_BONUS[piece.pieceType.typeName];
    if (!bonusTable) return 0;

    if (piece.camp === CAMP.RED) {
      return bonusTable[row][col];
    } else {
      return bonusTable[BOARD_ROWS - 1 - row][col];
    }
  }
}
