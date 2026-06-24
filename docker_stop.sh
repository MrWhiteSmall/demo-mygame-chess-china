#!/bin/bash
# 停止容器服务（兼容 docker compose 和 docker run 两种启动方式）
# 用法: ./docker_stop.sh

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

CONTAINER="chinese-chess"
STOPPED=false

echo "=== 停止 chinese-chess 容器 ==="

# 尝试 docker compose 方式停止
if docker compose ps 2>/dev/null | grep -q "${CONTAINER}"; then
  docker compose down
  STOPPED=true
fi

# 尝试 docker run 方式停止（直接运行的容器）
if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx "${CONTAINER}"; then
  docker stop "${CONTAINER}" 2>/dev/null || true
  docker rm "${CONTAINER}" 2>/dev/null || true
  STOPPED=true
fi

if [ "$STOPPED" = true ]; then
  echo "服务已停止"
else
  echo "未找到运行中的容器"
fi
