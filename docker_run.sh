#!/bin/bash
# 启动容器服务
# 用法: ./docker_run.sh [前端端口] [引擎端口]
# 示例: ./docker_run.sh 8080 9090

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

FRONTEND_PORT="${1:-8080}"
ENGINE_PORT="${2:-9090}"
LOG_FILE="$DIR/tmp.log"

> "$LOG_FILE"
echo "日志文件: $LOG_FILE"

# ── 端口冲突检测（宿主机） ──
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

echo "=== 启动 chinese-chess 容器 ===" | tee -a "$LOG_FILE"
echo "前端端口: ${FRONTEND_PORT}, 引擎端口: ${ENGINE_PORT}" | tee -a "$LOG_FILE"

FRONTEND_PORT="$FRONTEND_PORT" ENGINE_PORT="$ENGINE_PORT" \
  docker compose up -d 2>&1 | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "  前端页面: http://localhost:${FRONTEND_PORT}" | tee -a "$LOG_FILE"
echo "  引擎服务: http://localhost:${ENGINE_PORT}/bestmove" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "  停止服务: ./docker_stop.sh" | tee -a "$LOG_FILE"
echo "  实时日志: tail -f $LOG_FILE" | tee -a "$LOG_FILE"
