#!/bin/bash
# 从阿里云 ACR 拉取并运行镜像
# 用法: ./docker_pull.sh [前端端口] [引擎端口]

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$DIR/tmp.log"

REGISTRY="crpi-iim8qsvovo2fe87d.cn-hangzhou.personal.cr.aliyuncs.com"
NAMESPACE="lushengjie"
IMAGE="chinese-chess"
TAG="latest"

FULL_IMAGE="${REGISTRY}/${NAMESPACE}/${IMAGE}:${TAG}"
FRONTEND_PORT="${1:-8080}"
ENGINE_PORT="${2:-9090}"

> "$LOG_FILE"

# ── 端口冲突检测 ──
check_port() {
  local pid=$(lsof -ti:"$1" 2>/dev/null)
  if [ -n "$pid" ]; then
    echo "错误: 端口 $1 已被占用 (PID: $pid)" | tee -a "$LOG_FILE" >&2
    echo "请先更换端口或执行: ./killport.sh $1" | tee -a "$LOG_FILE" >&2
    return 1
  fi
}

check_port "$FRONTEND_PORT" || exit 1
check_port "$ENGINE_PORT" || exit 1

echo "=== 拉取镜像: ${FULL_IMAGE} ===" | tee -a "$LOG_FILE"
docker pull "${FULL_IMAGE}" 2>&1 | tee -a "$LOG_FILE"

echo "=== 启动容器 ===" | tee -a "$LOG_FILE"
docker run -d \
  -p "${FRONTEND_PORT}:${FRONTEND_PORT}" \
  -p "${ENGINE_PORT}:${ENGINE_PORT}" \
  -e "FRONTEND_PORT=${FRONTEND_PORT}" \
  -e "ENGINE_PORT=${ENGINE_PORT}" \
  --name chinese-chess \
  "${FULL_IMAGE}" 2>&1 | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "  前端页面: http://localhost:${FRONTEND_PORT}" | tee -a "$LOG_FILE"
echo "  引擎服务: http://localhost:${ENGINE_PORT}/bestmove" | tee -a "$LOG_FILE"
echo ""
echo "  停止服务: docker stop chinese-chess && docker rm chinese-chess"
echo "  查看日志: tail -f $LOG_FILE"
