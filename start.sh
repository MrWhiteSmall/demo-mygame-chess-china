#!/bin/bash
# 中国象棋 — 一键启动
# 用法: ./start.sh [前端端口] [引擎端口]
# 示例: ./start.sh 8080 9090

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_PORT="${1:-8080}"
ENGINE_PORT="${2:-9090}"
LOG_FILE="$DIR/tmp.log"

# 清空旧日志
> "$LOG_FILE"
echo "日志文件: $LOG_FILE"

# ── 端口冲突检测 ──
check_port() {
  local pid=$(lsof -ti:"$1" 2>/dev/null)
  if [ -n "$pid" ]; then
    echo "错误: 端口 $1 已被占用 (PID: $pid)" | tee -a "$LOG_FILE" >&2
    echo "请先执行: ./killport.sh $1 或更换端口" | tee -a "$LOG_FILE" >&2
    return 1
  fi
}

check_port "$FRONTEND_PORT" || exit 1
check_port "$ENGINE_PORT" || exit 1

# ── 注入引擎端口到 JS ──
sed -i '' "s|http://127\.0\.0\.1:[0-9]\+/bestmove|http://127.0.0.1:${ENGINE_PORT}/bestmove|g" "$DIR/controllers/GameController.js"

# ── 启动引擎服务 ──
echo "=== 启动 Fairy-Stockfish 引擎 (端口 ${ENGINE_PORT}) ===" | tee -a "$LOG_FILE"
"$DIR/engine/engine_server" "$DIR/engine/src/stockfish" "$ENGINE_PORT" >> "$LOG_FILE" 2>&1 &
ENGINE_PID=$!
sleep 2

# 验证引擎启动
if ! kill -0 "$ENGINE_PID" 2>/dev/null; then
  echo "错误: 引擎启动失败，查看日志: $LOG_FILE" | tee -a "$LOG_FILE" >&2
  exit 1
fi
echo "引擎 PID: $ENGINE_PID" | tee -a "$LOG_FILE"

# ── 启动前端 ──
echo "=== 启动前端页面 (端口 ${FRONTEND_PORT}) ===" | tee -a "$LOG_FILE"
cd "$DIR"
python3 -m http.server "$FRONTEND_PORT" >> "$LOG_FILE" 2>&1 &
HTTP_PID=$!
echo "前端 PID: $HTTP_PID" | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "  引擎服务: http://localhost:${ENGINE_PORT}/bestmove" | tee -a "$LOG_FILE"
echo "  前端页面: http://localhost:${FRONTEND_PORT}" | tee -a "$LOG_FILE"
echo "  日志文件: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "  按 Ctrl+C 停止所有服务"

trap "kill $ENGINE_PID $HTTP_PID 2>/dev/null; exit" INT TERM
wait
