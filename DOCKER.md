# Docker 部署指南

## 环境准备

```bash
# macOS
brew install --cask docker

# Linux
curl -fsSL https://get.docker.com | bash
```

**国内网络配置镜像加速**（Docker Hub 不可用时）：

编辑 `~/.docker/daemon.json`：

```json
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io"
  ]
}
```

重启 Docker Desktop 后生效。

## 一键部署

| 脚本 | 用途 |
|------|------|
| `./docker_build.sh` | 构建镜像（编译引擎 + 打包前端） |
| `./docker_run.sh [前端端口] [引擎端口]` | 启动容器，端口冲突自动检测 |
| `./docker_stop.sh` | 停止并移除容器 |

```bash
# 构建
./docker_build.sh

# 启动（默认 8080 / 9090）
./docker_run.sh

# 或指定端口
./docker_run.sh 3000 9999

# 查看日志
tail -f tmp.log

# 停止
./docker_stop.sh
```

## 手动 Docker Compose

```bash
# 默认端口
docker compose up -d

# 自定义端口
FRONTEND_PORT=3000 ENGINE_PORT=9999 docker compose up -d

# 日志
docker compose logs -f

# 停止
docker compose down
```

## 镜像上传

### Docker Hub

```bash
docker tag chinese-chess:latest your-username/chinese-chess:latest
docker push your-username/chinese-chess:latest
```

### 阿里云 ACR（国内推荐）

```bash
# 登录
docker login --username=你的阿里云账号 registry.cn-hangzhou.aliyuncs.com

# 打标签
docker tag chinese-chess:latest \
  registry.cn-hangzhou.aliyuncs.com/命名空间/chinese-chess:latest

# 推送
docker push registry.cn-hangzhou.aliyuncs.com/命名空间/chinese-chess:latest
```

其他用户拉取运行：

```bash
# Docker Hub
docker run -d -p 8080:8080 -p 9090:9090 your-username/chinese-chess:latest

# 阿里云 ACR
docker run -d -p 8080:8080 -p 9090:9090 \
  registry.cn-hangzhou.aliyuncs.com/命名空间/chinese-chess:latest
```

## 文件说明

| 文件 | 作用 |
|------|------|
| `Dockerfile` | 多阶段构建：源码编译 stockfish（armv8/x86-64 自适应） + HTTP 引擎服务 |
| `docker-compose.yml` | 服务编排，端口通过环境变量配置 |
| `docker-entrypoint.sh` | 容器入口：端口检测 → 注入引擎地址 → 启动服务 → 日志写入 tmp.log |
| `docker_build.sh` | 构建脚本封装 |
| `docker_run.sh` | 启动脚本，含宿主机端口冲突检测 |
| `docker_stop.sh` | 停止脚本 |
| `.dockerignore` | 排除编译产物和日志，减小构建上下文 |
