#!/bin/bash
# 构建 Docker 镜像
# 用法: ./docker_build.sh

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "=== 构建 chinese-chess 镜像 ==="
docker compose build
echo ""
echo "构建完成，运行 ./docker_run.sh 启动服务"
