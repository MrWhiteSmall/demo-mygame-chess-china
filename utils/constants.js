// ── Enums ──
export const CAMP = { RED: 'red', BLACK: 'black' };

export const PIECE_TYPE_NAME = {
  KING: 'king',
  ADVISOR: 'advisor',
  ELEPHANT: 'elephant',
  ROOK: 'rook',
  HORSE: 'horse',
  CANNON: 'cannon',
  PAWN: 'pawn'
};

export const GAME_MODE = { PVP: 'pvp', PVE: 'pve', ENGINE: 'engine' };

// ── Board dimensions ──
export const BOARD_ROWS = 10;
export const BOARD_COLS = 9;

// ── Canvas layout ──
export const CELL_SIZE = 64;
export const PIECE_RADIUS = 27;
export const MARGIN_LEFT = 60;
export const MARGIN_TOP = 50;
export const CANVAS_WIDTH = MARGIN_LEFT * 2 + CELL_SIZE * (BOARD_COLS - 1);
export const CANVAS_HEIGHT = MARGIN_TOP * 2 + CELL_SIZE * (BOARD_ROWS - 1);

// ── Piece values for AI evaluation ──
export const PIECE_VALUE = {
  [PIECE_TYPE_NAME.KING]: 10000,
  [PIECE_TYPE_NAME.ROOK]: 900,
  [PIECE_TYPE_NAME.CANNON]: 450,
  [PIECE_TYPE_NAME.HORSE]: 400,
  [PIECE_TYPE_NAME.ELEPHANT]: 200,
  [PIECE_TYPE_NAME.ADVISOR]: 200,
  [PIECE_TYPE_NAME.PAWN]: 100
};

// ── Position bonus tables (from RED's perspective, row 9 = RED back rank) ──

// King: all 9 palace positions reachable via orthogonal moves
// Bottom/middle rows are safer; center of each row is most flexible
const KING_BONUS = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 4, 6, 4, 0, 0, 0],   // top row (3): forward, slightly exposed
  [0, 0, 0, 6, 8, 6, 0, 0, 0],   // middle row (4): center 4-way flexible, sides 3-way
  [0, 0, 0, 6, 8, 6, 0, 0, 0]    // bottom row (5): safest, original position
];

// Advisor: only 5 reachable positions — follows the two X-shaped diagonal lines in the palace
// Center (8,4) connects to all 4 corners; each corner connects only to center
const ADVISOR_BONUS = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 10, 0, 10, 0, 0, 0],   // (7,3)(7,5) 前角, 护帅前压
  [0, 0, 0, 0, 14, 0, 0, 0, 0],     // (8,4) 九宫中心, 四向斜走, 最灵活
  [0, 0, 0, 5, 0, 5, 0, 0, 0]       // (9,3)(9,5) 开局位/后角
];

// Elephant: 7 reachable positions (田字 diagonal only, cannot cross river)
// (7,4) is the hub: connects to both river positions and both home positions
const ELEPHANT_BONUS = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 12, 0, 0, 0, 12, 0, 0],   // (5,2)(5,6) 河边, 关键防守位
  [0, 0, 0, 0, 0, 0, 0, 0, 0],      // row 6: 兵行, 相到不了
  [6, 0, 0, 0, 18, 0, 0, 0, 6],     // (7,0)(7,8) 边线6, (7,4) 中心枢纽最高18
  [0, 0, 0, 0, 0, 0, 0, 0, 0],      // row 8: 空行, 相到不了
  [0, 0, 5, 0, 0, 0, 5, 0, 0]       // (9,2)(9,6) 开局位
];

// Rook: open files, opponent back rank, center
const ROOK_BONUS = [
  [15, 15, 15, 20, 20, 20, 15, 15, 15],
  [20, 25, 25, 30, 30, 30, 25, 25, 20],
  [10, 15, 15, 20, 20, 20, 15, 15, 10],
  [10, 10, 10, 15, 15, 15, 10, 10, 10],
  [5, 10, 10, 15, 15, 15, 10, 10, 5],
  [5, 5, 10, 10, 10, 10, 10, 5, 5],
  [0, 5, 5, 10, 10, 10, 5, 5, 0],
  [5, 0, 5, 5, 5, 5, 5, 0, 5],
  [0, 5, 0, 0, 0, 0, 0, 5, 0],
  [5, 0, 5, 0, 0, 0, 5, 0, 5]
];

// Horse: center is active, edges are restrictive
const HORSE_BONUS = [
  [0, 0, 5, 10, 10, 10, 5, 0, 0],
  [0, 5, 10, 15, 15, 15, 10, 5, 0],
  [5, 10, 15, 20, 20, 20, 15, 10, 5],
  [5, 10, 15, 20, 25, 20, 15, 10, 5],
  [5, 10, 15, 20, 25, 20, 15, 10, 5],
  [5, 10, 15, 20, 20, 20, 15, 10, 5],
  [5, 10, 15, 20, 20, 20, 15, 10, 5],
  [0, 5, 10, 15, 15, 15, 10, 5, 0],
  [0, 0, 5, 10, 10, 10, 5, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0]
];

// Cannon: behind pawns, active positions
const CANNON_BONUS = [
  [5, 5, 0, 0, 5, 0, 0, 5, 5],
  [5, 10, 10, 10, 10, 10, 10, 10, 5],
  [0, 5, 10, 15, 15, 15, 10, 5, 0],
  [0, 5, 10, 15, 15, 15, 10, 5, 0],
  [0, 5, 10, 15, 15, 15, 10, 5, 0],
  [0, 5, 10, 15, 15, 15, 10, 5, 0],
  [0, 5, 10, 15, 15, 15, 10, 5, 0],
  [5, 10, 10, 10, 10, 10, 10, 10, 5],
  [5, 5, 0, 0, 5, 0, 0, 5, 5],
  [0, 0, 0, 0, 0, 0, 0, 0, 0]
];

// Pawn: high value after crossing river
const PAWN_BONUS = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 5, 10, 20, 25, 20, 10, 5, 0],
  [0, 5, 20, 30, 40, 30, 20, 5, 0],
  [0, 5, 20, 35, 45, 35, 20, 5, 0],
  [0, 5, 20, 30, 40, 30, 20, 5, 0],
  [0, 0, 10, 20, 25, 20, 10, 0, 0],
  [0, 0, 0, 5, 10, 5, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0]
];

export const POSITION_BONUS = {
  [PIECE_TYPE_NAME.KING]: KING_BONUS,
  [PIECE_TYPE_NAME.ADVISOR]: ADVISOR_BONUS,
  [PIECE_TYPE_NAME.ELEPHANT]: ELEPHANT_BONUS,
  [PIECE_TYPE_NAME.ROOK]: ROOK_BONUS,
  [PIECE_TYPE_NAME.HORSE]: HORSE_BONUS,
  [PIECE_TYPE_NAME.CANNON]: CANNON_BONUS,
  [PIECE_TYPE_NAME.PAWN]: PAWN_BONUS
};
