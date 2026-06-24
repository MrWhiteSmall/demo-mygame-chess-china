#!/bin/bash
# ── Docker 容器入口脚本 ──
set -e

FRONTEND_PORT="${FRONTEND_PORT:-8080}"
ENGINE_PORT="${ENGINE_PORT:-9090}"
LOG_FILE="/app/tmp.log"

> "$LOG_FILE"
echo "日志文件: $LOG_FILE" | tee -a "$LOG_FILE"

# ── 端口冲突检测 ──
check_port() {
  local pid=$(lsof -ti:"$1" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "错误: 容器内端口 $1 已被占用 (PID: $pid)" | tee -a "$LOG_FILE" >&2
    return 1
  fi
}

echo "=== 端口检测 ===" | tee -a "$LOG_FILE"
check_port "$FRONTEND_PORT" || exit 1
check_port "$ENGINE_PORT" || exit 1
echo "前端端口: ${FRONTEND_PORT}, 引擎端口: ${ENGINE_PORT}" | tee -a "$LOG_FILE"

# ── 注入引擎端口到 JS ──
sed -i "s|http://127\.0\.0\.1:[0-9]\+/bestmove|http://127.0.0.1:${ENGINE_PORT}/bestmove|g" \
  /app/controllers/GameController.js
echo "引擎地址已注入: http://127.0.0.1:${ENGINE_PORT}/bestmove" | tee -a "$LOG_FILE"

# ── 启动引擎 ──
echo "=== 启动引擎服务 ===" | tee -a "$LOG_FILE"
/app/engine/engine_server /app/engine/src/stockfish "$ENGINE_PORT" >> "$LOG_FILE" 2>&1 &
ENGINE_PID=$!
sleep 2

if ! kill -0 "$ENGINE_PID" 2>/dev/null; then
  echo "错误: 引擎启动失败" | tee -a "$LOG_FILE" >&2
  exit 1
fi
echo "引擎 PID: $ENGINE_PID" | tee -a "$LOG_FILE"

# ── 启动前端 (前台运行) ──
echo "=== 启动前端 ===" | tee -a "$LOG_FILE"
echo "访问 http://localhost:${FRONTEND_PORT}" | tee -a "$LOG_FILE"

cleanup() {
  echo "正在停止服务..." | tee -a "$LOG_FILE"
  kill "$ENGINE_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

cd /app
python3 -m http.server "$FRONTEND_PORT" >> "$LOG_FILE" 2>&1 &
HTTP_PID=$!
echo "前端 PID: $HTTP_PID" | tee -a "$LOG_FILE"

wait "$HTTP_PID"
