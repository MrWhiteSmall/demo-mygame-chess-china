# ── 中国象棋 Docker 镜像 ──
# 构建: docker build -t chinese-chess .
# 运行: docker run -p 8080:8080 -p 9090:9090 chinese-chess

FROM ubuntu:22.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ \
    make \
    python3 \
    lsof \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制引擎源码
COPY engine/ engine/

# 编译 Fairy-Stockfish（根据目标架构选择优化级别）
ARG TARGETARCH
RUN cd engine/src && \
    if [ "$TARGETARCH" = "arm64" ]; then \
      make build ARCH=armv8 largeboards=yes -j$(nproc); \
    else \
      make build ARCH=x86-64-modern largeboards=yes -j$(nproc); \
    fi

# 编译 HTTP 引擎服务
RUN g++ -std=c++17 -O2 -o engine/engine_server engine/engine_server.cpp

# 复制前端文件
COPY *.html *.css ./
COPY assets/ assets/
COPY controllers/ controllers/
COPY models/ models/
COPY utils/ utils/
COPY views/ views/

# 复制启动脚本
COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8080 9090

ENTRYPOINT ["/docker-entrypoint.sh"]
