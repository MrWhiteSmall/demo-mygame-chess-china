import { CAMP, PIECE_TYPE_NAME, BOARD_ROWS, BOARD_COLS } from '../utils/constants.js';

// ──────────────────────────────────────────────
// Move generators — geometry-only, no self-check filtering
// ──────────────────────────────────────────────

function isInBounds(row, col) {
  return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS;
}

function isEnemy(piece, target) {
  return target && target.camp !== piece.camp;
}

function isFriend(piece, target) {
  return target && target.camp === piece.camp;
}

// ── King (帥/將): 1 step orthogonal inside palace ──
function getKingMoves(piece, board) {
  const moves = [];
  const palaceRowMin = piece.camp === CAMP.RED ? 7 : 0;
  const palaceRowMax = piece.camp === CAMP.RED ? 9 : 2;
  const palaceColMin = 3;
  const palaceColMax = 5;
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [dr, dc] of dirs) {
    const r = piece.position.row + dr;
    const c = piece.position.col + dc;
    if (r >= palaceRowMin && r <= palaceRowMax && c >= palaceColMin && c <= palaceColMax) {
      const target = board.getPieceAt(r, c);
      if (!target || isEnemy(piece, target)) {
        moves.push({ row: r, col: c });
      }
    }
  }
  return moves;
}

// ── Advisor (仕/士): 1 step diagonal inside palace ──
function getAdvisorMoves(piece, board) {
  const moves = [];
  const palaceRowMin = piece.camp === CAMP.RED ? 7 : 0;
  const palaceRowMax = piece.camp === CAMP.RED ? 9 : 2;
  const palaceColMin = 3;
  const palaceColMax = 5;
  const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  for (const [dr, dc] of dirs) {
    const r = piece.position.row + dr;
    const c = piece.position.col + dc;
    if (r >= palaceRowMin && r <= palaceRowMax && c >= palaceColMin && c <= palaceColMax) {
      const target = board.getPieceAt(r, c);
      if (!target || isEnemy(piece, target)) {
        moves.push({ row: r, col: c });
      }
    }
  }
  return moves;
}

// ── Elephant (相/象): 2-step diagonal, blocked by eye, cannot cross river ──
function getElephantMoves(piece, board) {
  const moves = [];
  const dirs = [[-2, -2], [-2, 2], [2, -2], [2, 2]];

  for (const [dr, dc] of dirs) {
    const r = piece.position.row + dr;
    const c = piece.position.col + dc;
    const eyeR = piece.position.row + dr / 2;
    const eyeC = piece.position.col + dc / 2;

    if (!isInBounds(r, c)) continue;

    // Cannot cross river
    if (piece.camp === CAMP.RED && r < 5) continue;
    if (piece.camp === CAMP.BLACK && r > 4) continue;

    // Eye must be empty
    if (board.getPieceAt(eyeR, eyeC)) continue;

    const target = board.getPieceAt(r, c);
    if (!target || isEnemy(piece, target)) {
      moves.push({ row: r, col: c });
    }
  }
  return moves;
}

// ── Horse (馬): L-shape, blocked by leg ──
function getHorseMoves(piece, board) {
  const moves = [];
  // [legDr, legDc, moveDr, moveDc]
  const patterns = [
    [-1, 0, -2, -1], [-1, 0, -2, 1],
    [1, 0, 2, -1], [1, 0, 2, 1],
    [0, -1, -1, -2], [0, -1, 1, -2],
    [0, 1, -1, 2], [0, 1, 1, 2]
  ];

  for (const [legDr, legDc, dr, dc] of patterns) {
    const legR = piece.position.row + legDr;
    const legC = piece.position.col + legDc;
    const r = piece.position.row + dr;
    const c = piece.position.col + dc;

    if (!isInBounds(r, c)) continue;

    // Leg must be empty
    if (board.getPieceAt(legR, legC)) continue;

    const target = board.getPieceAt(r, c);
    if (!target || isEnemy(piece, target)) {
      moves.push({ row: r, col: c });
    }
  }
  return moves;
}

// ── Rook (車): slide orthogonally ──
function getRookMoves(piece, board) {
  const moves = [];
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [dr, dc] of dirs) {
    let r = piece.position.row + dr;
    let c = piece.position.col + dc;
    while (isInBounds(r, c)) {
      const target = board.getPieceAt(r, c);
      if (target) {
        if (isEnemy(piece, target)) {
          moves.push({ row: r, col: c });
        }
        break;
      }
      moves.push({ row: r, col: c });
      r += dr;
      c += dc;
    }
  }
  return moves;
}

// ── Cannon (炮/砲): slide non-capture, jump-capture ──
function getCannonMoves(piece, board) {
  const moves = [];
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [dr, dc] of dirs) {
    let r = piece.position.row + dr;
    let c = piece.position.col + dc;

    // Non-capture: slide until hitting any piece
    while (isInBounds(r, c)) {
      const target = board.getPieceAt(r, c);
      if (target) break;
      moves.push({ row: r, col: c });
      r += dr;
      c += dc;
    }

    // Jump over the blocking piece (platform)
    r += dr;
    c += dc;

    // Capture: find first enemy after platform
    while (isInBounds(r, c)) {
      const target = board.getPieceAt(r, c);
      if (target) {
        if (isEnemy(piece, target)) {
          moves.push({ row: r, col: c });
        }
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return moves;
}

// ── Pawn (兵/卒): forward only before river, +left/right after ──
function getPawnMoves(piece, board) {
  const moves = [];
  const forward = piece.camp === CAMP.RED ? -1 : 1;
  const crossed = piece.camp === CAMP.RED
    ? piece.position.row <= 4
    : piece.position.row >= 5;

  // Forward
  const fr = piece.position.row + forward;
  const fc = piece.position.col;
  if (isInBounds(fr, fc)) {
    const target = board.getPieceAt(fr, fc);
    if (!target || isEnemy(piece, target)) {
      moves.push({ row: fr, col: fc });
    }
  }

  // Sideways (only after crossing river)
  if (crossed) {
    for (const dc of [-1, 1]) {
      const sc = piece.position.col + dc;
      if (isInBounds(piece.position.row, sc)) {
        const target = board.getPieceAt(piece.position.row, sc);
        if (!target || isEnemy(piece, target)) {
          moves.push({ row: piece.position.row, col: sc });
        }
      }
    }
  }
  return moves;
}

// ── Map typeName → move generator + display chars ──
const PIECE_DEFS = {
  [PIECE_TYPE_NAME.KING]:    { redChar: '帥', blackChar: '將', getMoves: getKingMoves },
  [PIECE_TYPE_NAME.ADVISOR]: { redChar: '仕', blackChar: '士', getMoves: getAdvisorMoves },
  [PIECE_TYPE_NAME.ELEPHANT]:{ redChar: '相', blackChar: '象', getMoves: getElephantMoves },
  [PIECE_TYPE_NAME.ROOK]:    { redChar: '車', blackChar: '車', getMoves: getRookMoves },
  [PIECE_TYPE_NAME.HORSE]:   { redChar: '馬', blackChar: '馬', getMoves: getHorseMoves },
  [PIECE_TYPE_NAME.CANNON]:  { redChar: '炮', blackChar: '砲', getMoves: getCannonMoves },
  [PIECE_TYPE_NAME.PAWN]:    { redChar: '兵', blackChar: '卒', getMoves: getPawnMoves }
};

// ──────────────────────────────────────────────
// PieceType — intrinsic / flyweight (shared)
// ──────────────────────────────────────────────
export class PieceType {
  /**
   * @param {string} typeName
   * @param {string} redChar
   * @param {string} blackChar
   * @param {Function} getMoves — (piece, board) => [{row, col}]
   */
  constructor(typeName, redChar, blackChar, getMoves) {
    this.typeName = typeName;
    this.redChar = redChar;
    this.blackChar = blackChar;
    this._getMoves = getMoves;
  }

  getMoves(piece, board) {
    return this._getMoves(piece, board);
  }
}

// ──────────────────────────────────────────────
// Piece — extrinsic state (per instance)
// ──────────────────────────────────────────────
let pieceIdCounter = 0;

export class Piece {
  /**
   * @param {string} camp
   * @param {{row:number, col:number}} position
   * @param {PieceType} pieceType
   */
  constructor(camp, position, pieceType) {
    this.id = `${camp}_${pieceType.typeName}_${++pieceIdCounter}`;
    this.camp = camp;
    this.position = { row: position.row, col: position.col };
    this.pieceType = pieceType;
  }

  getChar() {
    return this.camp === CAMP.RED
      ? this.pieceType.redChar
      : this.pieceType.blackChar;
  }

  getRawMoves(board) {
    return this.pieceType.getMoves(this, board);
  }

  clone() {
    return new Piece(this.camp, { ...this.position }, this.pieceType);
  }
}

// ──────────────────────────────────────────────
// PieceFactory — creates & caches PieceTypes
// ──────────────────────────────────────────────
export class PieceFactory {
  constructor() {
    /** @type {Map<string, PieceType>} */
    this.pieceTypes = new Map();
    this._counter = 0;
  }

  getPieceType(typeName) {
    if (!this.pieceTypes.has(typeName)) {
      const def = PIECE_DEFS[typeName];
      const pt = new PieceType(typeName, def.redChar, def.blackChar, def.getMoves);
      this.pieceTypes.set(typeName, pt);
    }
    return this.pieceTypes.get(typeName);
  }

  createPiece(typeName, camp, position) {
    pieceIdCounter++;
    const pt = this.getPieceType(typeName);
    const id = `${camp}_${typeName}_${pieceIdCounter}`;
    const p = new Piece(camp, position, pt);
    p.id = id; // override to keep counter in sync
    return p;
  }

  /** Create all 32 pieces in standard opening formation */
  createAllPieces() {
    const pieces = [];

    const backRank = [
      PIECE_TYPE_NAME.ROOK,
      PIECE_TYPE_NAME.HORSE,
      PIECE_TYPE_NAME.ELEPHANT,
      PIECE_TYPE_NAME.ADVISOR,
      PIECE_TYPE_NAME.KING,
      PIECE_TYPE_NAME.ADVISOR,
      PIECE_TYPE_NAME.ELEPHANT,
      PIECE_TYPE_NAME.HORSE,
      PIECE_TYPE_NAME.ROOK
    ];

    // Black back rank (row 0)
    for (let col = 0; col < 9; col++) {
      pieces.push(this.createPiece(backRank[col], CAMP.BLACK, { row: 0, col }));
    }

    // Black cannons (row 2, col 1 and 7)
    pieces.push(this.createPiece(PIECE_TYPE_NAME.CANNON, CAMP.BLACK, { row: 2, col: 1 }));
    pieces.push(this.createPiece(PIECE_TYPE_NAME.CANNON, CAMP.BLACK, { row: 2, col: 7 }));

    // Black pawns (row 3, cols 0,2,4,6,8)
    for (let col = 0; col < 9; col += 2) {
      pieces.push(this.createPiece(PIECE_TYPE_NAME.PAWN, CAMP.BLACK, { row: 3, col }));
    }

    // Red pawns (row 6, cols 0,2,4,6,8)
    for (let col = 0; col < 9; col += 2) {
      pieces.push(this.createPiece(PIECE_TYPE_NAME.PAWN, CAMP.RED, { row: 6, col }));
    }

    // Red cannons (row 7, col 1 and 7)
    pieces.push(this.createPiece(PIECE_TYPE_NAME.CANNON, CAMP.RED, { row: 7, col: 1 }));
    pieces.push(this.createPiece(PIECE_TYPE_NAME.CANNON, CAMP.RED, { row: 7, col: 7 }));

    // Red back rank (row 9)
    for (let col = 0; col < 9; col++) {
      pieces.push(this.createPiece(backRank[col], CAMP.RED, { row: 9, col }));
    }

    return pieces;
  }
}
