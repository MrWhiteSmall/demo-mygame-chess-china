#!/bin/bash
# 推送镜像到阿里云 ACR
# 用法: ./docker_push.sh [版本标签]

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

REGISTRY="crpi-iim8qsvovo2fe87d.cn-hangzhou.personal.cr.aliyuncs.com"
NAMESPACE="lushengjie"
IMAGE="chinese-chess"
TAG="${1:-latest}"

FULL_IMAGE="${REGISTRY}/${NAMESPACE}/${IMAGE}:${TAG}"

echo "=== 推送镜像: ${FULL_IMAGE} ==="

# 检查登录状态
if ! docker info 2>/dev/null | grep -q "Username"; then
  echo "未登录，请先执行: docker login --username=你的用户名 ${REGISTRY}"
  exit 1
fi

docker tag "${IMAGE}:latest" "${FULL_IMAGE}"
docker push "${FULL_IMAGE}"

echo ""
echo "推送完成: ${FULL_IMAGE}"
echo ""
echo "其他机器拉取:"
echo "  docker pull ${FULL_IMAGE}"
