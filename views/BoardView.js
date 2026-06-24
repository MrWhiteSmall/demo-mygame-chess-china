import {
  CAMP, BOARD_ROWS, BOARD_COLS,
  CELL_SIZE, PIECE_RADIUS, MARGIN_LEFT, MARGIN_TOP,
  CANVAS_WIDTH, CANVAS_HEIGHT
} from '../utils/constants.js';

export class BoardView {
  constructor(canvas, gameController) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.controller = gameController;

    // High-DPI support
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = CANVAS_WIDTH * this.dpr;
    this.canvas.height = CANVAS_HEIGHT * this.dpr;
    this.canvas.style.width = CANVAS_WIDTH + 'px';
    this.canvas.style.height = CANVAS_HEIGHT + 'px';
    this.ctx.scale(this.dpr, this.dpr);

    // Selection state
    this.selectedRow = null;
    this.selectedCol = null;
    this.legalMoves = [];

    // Last move highlight
    this.lastMoveFrom = null;
    this.lastMoveTo = null;

    // UI elements
    this.modeOverlay = document.getElementById('mode-overlay');
    this.gameOverOverlay = document.getElementById('game-over-overlay');
    this.gameResult = document.getElementById('game-result');
    this.statusText = document.getElementById('status-text');

    // Click handler
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
  }

  // ── Coordinate mapping ──

  getCanvasCoords(row, col) {
    return {
      x: MARGIN_LEFT + col * CELL_SIZE,
      y: MARGIN_TOP + row * CELL_SIZE
    };
  }

  getBoardPosition(canvasX, canvasY) {
    const col = Math.round((canvasX - MARGIN_LEFT) / CELL_SIZE);
    const row = Math.round((canvasY - MARGIN_TOP) / CELL_SIZE);

    if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) return null;

    const { x, y } = this.getCanvasCoords(row, col);
    const dist = Math.sqrt((canvasX - x) ** 2 + (canvasY - y) ** 2);
    if (dist > PIECE_RADIUS * 1.4) return null;

    return { row, col };
  }

  // ── Render ──

  render(board) {
    this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.drawBoard();
    this.drawLastMoveHighlight();
    this.drawPieces(board);
    this.drawSelectionHighlight();
    this.drawLegalMoveIndicators(board);
    this.drawStatus(board);
  }

  drawBoard() {
    const ctx = this.ctx;
    ctx.strokeStyle = '#3d2b1f';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = '#f5e6ca';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Horizontal lines
    for (let row = 0; row < BOARD_ROWS; row++) {
      const y = MARGIN_TOP + row * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(MARGIN_LEFT, y);
      ctx.lineTo(MARGIN_LEFT + (BOARD_COLS - 1) * CELL_SIZE, y);
      ctx.stroke();
    }

    // Vertical lines (with river gap)
    for (let col = 0; col < BOARD_COLS; col++) {
      const x = MARGIN_LEFT + col * CELL_SIZE;

      // Top half
      ctx.beginPath();
      ctx.moveTo(x, MARGIN_TOP);
      ctx.lineTo(x, MARGIN_TOP + 4 * CELL_SIZE);
      ctx.stroke();

      // Bottom half
      ctx.beginPath();
      ctx.moveTo(x, MARGIN_TOP + 5 * CELL_SIZE);
      ctx.lineTo(x, MARGIN_TOP + 9 * CELL_SIZE);
      ctx.stroke();

      // Left and right border lines also go through river
      if (col === 0 || col === BOARD_COLS - 1) {
        ctx.beginPath();
        ctx.moveTo(x, MARGIN_TOP + 4 * CELL_SIZE);
        ctx.lineTo(x, MARGIN_TOP + 5 * CELL_SIZE);
        ctx.stroke();
      }
    }

    // Palace diagonals
    const palaces = [
      // Top palace (black): rows 0-2, cols 3-5
      { rowStart: 0, colStart: 3 },
      // Bottom palace (red): rows 7-9, cols 3-5
      { rowStart: 7, colStart: 3 }
    ];

    for (const { rowStart, colStart } of palaces) {
      const x1 = MARGIN_LEFT + colStart * CELL_SIZE;
      const y1 = MARGIN_TOP + rowStart * CELL_SIZE;
      const x2 = MARGIN_LEFT + (colStart + 2) * CELL_SIZE;
      const y2 = MARGIN_TOP + (rowStart + 2) * CELL_SIZE;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x2, y1);
      ctx.lineTo(x1, y2);
      ctx.stroke();
    }

    // River text
    ctx.fillStyle = '#3d2b1f';
    ctx.font = 'bold 22px "KaiTi", "STKaiti", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const riverY = MARGIN_TOP + 4.5 * CELL_SIZE;
    ctx.fillText('楚  河', MARGIN_LEFT + 2 * CELL_SIZE, riverY);
    ctx.fillText('汉  界', MARGIN_LEFT + 6 * CELL_SIZE, riverY);
  }

  drawPieces(board) {
    const ctx = this.ctx;
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const piece = board.getPieceAt(r, c);
        if (piece) {
          this.drawPiece(r, c, piece);
        }
      }
    }
  }

  drawPiece(row, col, piece) {
    const ctx = this.ctx;
    const { x, y } = this.getCanvasCoords(row, col);

    // Shadow
    ctx.beginPath();
    ctx.arc(x + 2, y + 2, PIECE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fill();

    // Circle background
    ctx.beginPath();
    ctx.arc(x, y, PIECE_RADIUS, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, PIECE_RADIUS);
    grad.addColorStop(0, '#fffef0');
    grad.addColorStop(0.7, '#e8d9b5');
    grad.addColorStop(1, '#c4a66a');
    ctx.fillStyle = grad;
    ctx.fill();

    // Border
    ctx.strokeStyle = piece.camp === CAMP.RED ? '#c0392b' : '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Inner ring
    ctx.beginPath();
    ctx.arc(x, y, PIECE_RADIUS - 4, 0, Math.PI * 2);
    ctx.strokeStyle = piece.camp === CAMP.RED ? '#c0392b' : '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Character
    ctx.fillStyle = piece.camp === CAMP.RED ? '#c0392b' : '#1a1a1a';
    ctx.font = `bold ${PIECE_RADIUS * 1.3}px "KaiTi", "STKaiti", "Noto Serif CJK SC", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(piece.getChar(), x, y + 1);
  }

  drawSelectionHighlight() {
    if (this.selectedRow === null || this.selectedCol === null) return;
    const { x, y } = this.getCanvasCoords(this.selectedRow, this.selectedCol);
    const ctx = this.ctx;

    ctx.beginPath();
    ctx.arc(x, y, PIECE_RADIUS + 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#f39c12';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawLegalMoveIndicators(board) {
    const ctx = this.ctx;
    for (const move of this.legalMoves) {
      const { x, y } = this.getCanvasCoords(move.row, move.col);
      const piece = board.getPieceAt(move.row, move.col);

      if (piece) {
        // Capture indicator: red ring
        ctx.beginPath();
        ctx.arc(x, y, PIECE_RADIUS + 3, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        // Empty move: small green dot
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(46, 204, 113, 0.7)';
        ctx.fill();
      }
    }
  }

  drawLastMoveHighlight() {
    if (!this.lastMoveFrom || !this.lastMoveTo) return;
    const ctx = this.ctx;

    for (const pos of [this.lastMoveFrom, this.lastMoveTo]) {
      const { x, y } = this.getCanvasCoords(pos.row, pos.col);
      ctx.fillStyle = 'rgba(241, 196, 15, 0.25)';
      ctx.beginPath();
      ctx.arc(x, y, PIECE_RADIUS + 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawStatus(board) {
    if (this.statusText) {
      const turn = board.currentTurn === CAMP.RED ? '红方' : '黑方';
      this.statusText.textContent = `当前: ${turn}`;
    }
  }

  // ── Interaction ──

  handleClick(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const canvasX = (event.clientX - rect.left) * scaleX;
    const canvasY = (event.clientY - rect.top) * scaleY;

    const pos = this.getBoardPosition(canvasX, canvasY);
    if (!pos) {
      this.clearSelection();
      return;
    }

    this.controller.handleClick(pos.row, pos.col);
  }

  setSelection(row, col, legalMoves) {
    this.selectedRow = row;
    this.selectedCol = col;
    this.legalMoves = legalMoves;
  }

  clearSelection() {
    this.selectedRow = null;
    this.selectedCol = null;
    this.legalMoves = [];
  }

  setLastMove(fromRow, fromCol, toRow, toCol) {
    this.lastMoveFrom = { row: fromRow, col: fromCol };
    this.lastMoveTo = { row: toRow, col: toCol };
  }

  // ── Overlays ──

  showModeSelection() {
    this.modeOverlay.classList.remove('hidden');
    this.gameOverOverlay.classList.add('hidden');
  }

  hideModeSelection() {
    this.modeOverlay.classList.add('hidden');
  }

  showGameOver(winner) {
    this.gameOverOverlay.classList.remove('hidden');
    if (winner === CAMP.RED) {
      this.gameResult.textContent = '红方胜！';
      this.gameResult.style.color = '#c0392b';
    } else if (winner === CAMP.BLACK) {
      this.gameResult.textContent = '黑方胜！';
      this.gameResult.style.color = '#1a1a1a';
    } else {
      this.gameResult.textContent = '和棋！';
      this.gameResult.style.color = '#7f8c8d';
    }
  }
}
