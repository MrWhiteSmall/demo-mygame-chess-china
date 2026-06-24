#!/bin/bash
# 用法: ./killport.sh <port>

if [ -z "$1" ]; then
  echo "用法: $0 <端口号>"
  echo "示例: $0 8080"
  exit 1
fi

PID=$(lsof -ti:"$1" 2>/dev/null)

if [ -z "$PID" ]; then
  echo "端口 $1 没有被占用"
  exit 0
fi

echo "端口 $1 → PID: $PID"
kill $PID && echo "已关闭" || echo "关闭失败"
