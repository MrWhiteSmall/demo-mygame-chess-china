# 中国象棋 (Chinese Chess)

纯 HTML/CSS/JS 实现的中国象棋游戏，支持双人对战、JS AI 对弈、Fairy-Stockfish 引擎对战。

## 快速启动

```bash
cd chess_china
./start.sh
```

浏览器打开 `http://localhost:8080`，选择模式开始。如需停止：

```bash
./killport.sh 8080
./killport.sh 9090
```

也可指定端口：

```bash
./start.sh 3000 9999
```

## 游戏模式

| 模式 | 说明 |
|------|------|
| 双人对战 | 红黑双方轮流走子 |
| 人机对弈(JS) | 玩家执红，AI 执黑（Minimax + Alpha-Beta，深度 3） |
| 引擎对战(C++) | 玩家执红，Fairy-Stockfish 执黑（专业级棋力） |

## Docker 部署

### 方式一：直接拉取运行（无需编译）

```bash
./docker_pull.sh             # 默认端口 8080 / 9090
./docker_pull.sh 3000 9999  # 自定义端口
```

停止：`docker stop chinese-chess && docker rm chinese-chess`

### 方式二：本地构建

```bash
./docker_build.sh            # 构建镜像
./docker_run.sh 8080 9090    # 启动服务
./docker_stop.sh             # 停止
```

### 方式三：手动 Docker 命令

```bash
# 拉取
docker pull crpi-iim8qsvovo2fe87d.cn-hangzhou.personal.cr.aliyuncs.com/lushengjie/chinese-chess:latest

# 运行（替换端口号为你需要的）
docker run -d \
  -p 8080:8080 \
  -p 9090:9090 \
  -e FRONTEND_PORT=8080 \
  -e ENGINE_PORT=9090 \
  --name chinese-chess \
  crpi-iim8qsvovo2fe87d.cn-hangzhou.personal.cr.aliyuncs.com/lushengjie/chinese-chess:latest
```

详见 [DOCKER.md](DOCKER.md)。

## 架构

```
chess_china/
├── index.html
├── styles.css
├── utils/constants.js          # 枚举、棋盘常量、棋子估值、位置奖励表
├── models/
│   ├── Piece.js                # 享元模式：PieceType(共享) + Piece(实例)
│   └── Board.js                # 棋盘状态、走子校验、将军/将死检测
├── views/
│   └── BoardView.js            # Canvas 渲染、点击交互
├── controllers/
│   ├── GameController.js       # 回合管理、引擎通信
│   └── AIController.js         # AI 搜索与评估
├── engine/
│   ├── engine_server.cpp       # C++ HTTP 引擎服务
│   └── src/                    # Fairy-Stockfish 源码
├── start.sh / killport.sh      # 本地启动脚本
├── Dockerfile / docker-compose.yml
├── docker_build.sh / docker_run.sh / docker_stop.sh
└── DOCKER.md
```

## 设计要点

### 享元模式

- **PieceType（内在/共享）** — 7 种棋子类型各一个实例，含走法生成器与显示字符
- **Piece（外在/实例）** — 32 个棋子各自持有 `id`、`camp`、`position` 和 `PieceType` 引用。AI 深拷贝时只克隆 Piece，复用 PieceType

### 走子规则

完整支持：帅/将（九宫直行）、仕/士（九宫斜行）、相/象（田字塞眼不过河）、馬（日字蹩脚）、車（直线滑行）、炮（翻山吃子）、兵/卒（过河可横走）、将帅对面检测。

### JS AI

- Minimax + Alpha-Beta 剪枝，搜索深度 3 + 静态搜索深度 1
- 评估 = 子力估值 + 位置奖励（每种棋子 10×9 表）
- 走法排序：吃子优先（MVV-LVA）→ 将军优先 → 高价值子优先
- setTimeout 分片，不阻塞 UI

### 引擎模式

- C++ HTTP 服务（raw socket）包装 Fairy-Stockfish，UCI 协议通信
- 引擎编译时启用 `largeboards=yes` 支持 xiangqi
- 前端 POST 着法历史到 `/bestmove`，引擎返回 UCI 最佳走子
- CORS 预检处理 + 线程安全互斥锁

## 浏览器兼容

Chrome / Firefox / Safari / Edge，零依赖。
