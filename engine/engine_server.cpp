/**
 * engine_server.cpp — Minimal HTTP server wrapping Fairy-Stockfish (UCI protocol)
 *
 * Compile:
 *   g++ -std=c++17 -O2 -o engine_server engine_server.cpp
 *
 * Run:
 *   ./engine_server ./stockfish 9090
 *
 * API:
 *   POST /bestmove   body: {"moves":["b2e2","h9g7",...]}
 *   Response: {"fromRow":7,"fromCol":1,"toRow":7,"toCol":4,"uci":"b2e2"}
 */

#include <sys/socket.h>
#include <sys/wait.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <fcntl.h>
#include <signal.h>

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <sstream>
#include <vector>
#include <thread>
#include <mutex>
#include <atomic>

// ── tiny JSON helper (no dependencies) ──
static std::string json_escape(const std::string& s) {
    std::string r;
    for (char c : s) {
        if (c == '"' || c == '\\') r += '\\';
        r += c;
    }
    return r;
}

static std::string json_extract(const std::string& body, const std::string& key) {
    std::string search = "\"" + key + "\"";
    size_t p = body.find(search);
    if (p == std::string::npos) return "";
    p = body.find('[', p);
    if (p == std::string::npos) return "";
    size_t end = body.find(']', p);
    if (end == std::string::npos) return "";
    return body.substr(p + 1, end - p - 1);
}

static std::vector<std::string> parse_moves(const std::string& raw) {
    std::vector<std::string> moves;
    std::string token;
    bool in_quote = false;
    for (char c : raw) {
        if (c == '"') { in_quote = !in_quote; continue; }
        if (in_quote) token += c;
        else if (c == ',') {
            if (!token.empty()) { moves.push_back(token); token.clear(); }
        }
    }
    if (!token.empty()) moves.push_back(token);
    return moves;
}

// ── UCI <-> array index ──
static inline int file_to_col(char f) { return f - 'a'; }  // a=0 .. i=8
static inline char col_to_file(int c) { return 'a' + c; }
// Fairy-Stockfish UCI ranks: 1=red back rank, 10=black back rank
// Internal: row 0=black back rank, row 9=red back rank
static inline int uci_rank_to_row(const char* s) {
    int rank = (s[0] - '0');
    if (s[1] >= '0' && s[1] <= '9') rank = rank * 10 + (s[1] - '0');
    return 10 - rank;
}

// ── Engine pipe wrapper ──
struct Engine {
    int pin[2], pout[2];   // parent writes to pin[1], reads from pout[0]
    pid_t pid = -1;
    FILE* fin = nullptr;
    FILE* fout = nullptr;

    bool start(const char* path) {
        if (pipe(pin) || pipe(pout)) { perror("pipe"); return false; }
        pid = fork();
        if (pid == 0) {
            dup2(pin[0], STDIN_FILENO);
            dup2(pout[1], STDOUT_FILENO);
            close(pin[0]); close(pin[1]);
            close(pout[0]); close(pout[1]);
            execlp(path, path, nullptr);
            _exit(1);
        }
        close(pin[0]); close(pout[1]);
        fin = fdopen(pin[1], "w");
        fout = fdopen(pout[0], "r");
        if (!fin || !fout) { perror("fdopen"); return false; }
        setlinebuf(fin);
        return true;
    }

    void send(const char* cmd) { fprintf(fin, "%s\n", cmd); }

    std::string read_until(const char* prefix) {
        char buf[4096];
        std::string result;
        while (fgets(buf, sizeof(buf), fout)) {
            result = buf;
            if (strncmp(buf, prefix, strlen(prefix)) == 0) break;
        }
        return result;
    }

    void init_xiangqi() {
        send("uci");
        read_until("uciok");
        send("setoption name UCI_Variant value xiangqi");
        send("isready");
        read_until("readyok");
    }

    void stop() {
        if (pid > 0) {
            send("quit");
            fclose(fin);
            fclose(fout);
            waitpid(pid, nullptr, 0);
            pid = -1;
        }
    }
};

// ── Coordinate conversion ──
struct MoveResult {
    int fromRow, fromCol, toRow, toCol;
    std::string uci;
};

static MoveResult uci_to_result(const std::string& uci) {
    // "bestmove c1e3" → 4-char move (ranks can be 2 digits for 10)
    std::string m = uci;
    size_t p = m.find("bestmove ");
    if (p != std::string::npos) {
        m = m.substr(p + 9);
        // Trim trailing space/newline and "ponder" part
        size_t sp = m.find(' ');
        if (sp != std::string::npos) m = m.substr(0, sp);
    }
    // Parse: file(1) + rank(1-2digits) + file(1) + rank(1-2digits)
    MoveResult r;
    r.uci = m;
    int pos = 0;
    r.fromCol = file_to_col(m[pos++]);
    // Read rank (1-2 digits)
    std::string rankStr;
    while (pos < (int)m.size() && m[pos] >= '0' && m[pos] <= '9') rankStr += m[pos++];
    r.fromRow = uci_rank_to_row(rankStr.c_str());
    r.toCol = file_to_col(m[pos++]);
    rankStr.clear();
    while (pos < (int)m.size() && m[pos] >= '0' && m[pos] <= '9') rankStr += m[pos++];
    r.toRow = uci_rank_to_row(rankStr.c_str());
    return r;
}

// ── HTTP helpers ──
static std::string http_ok(const std::string& body, const std::string& type = "application/json") {
    return "HTTP/1.1 200 OK\r\n"
           "Content-Type: " + type + "\r\n"
           "Content-Length: " + std::to_string(body.size()) + "\r\n"
           "Access-Control-Allow-Origin: *\r\n"
           "Connection: close\r\n"
           "\r\n" + body;
}

static std::string http_err(int code, const std::string& msg) {
    std::string body = "{\"error\":\"" + json_escape(msg) + "\"}";
    return "HTTP/1.1 " + std::to_string(code) + " Error\r\n"
           "Content-Type: application/json\r\n"
           "Content-Length: " + std::to_string(body.size()) + "\r\n"
           "Access-Control-Allow-Origin: *\r\n"
           "Connection: close\r\n"
           "\r\n" + body;
}

// ── Parse HTTP request body ──
static std::string read_http_body(int fd) {
    char buf[65536];
    int n = (int)recv(fd, buf, sizeof(buf) - 1, 0);
    if (n <= 0) return "";
    buf[n] = 0;
    std::string req(buf, n);
    size_t hdr_end = req.find("\r\n\r\n");
    if (hdr_end == std::string::npos) return "";
    return req.substr(hdr_end + 4);
}

// ── Handle one client ──
static void handle_client(int fd, Engine& engine, std::mutex& engine_mtx) {
    // Read full request to inspect method
    char buf[65536];
    int n = (int)recv(fd, buf, sizeof(buf) - 1, 0);
    if (n <= 0) { fprintf(stderr, "[server] recv returned %d\n", n); close(fd); return; }
    buf[n] = 0;
    std::string req(buf, n);

    fprintf(stderr, "[server] === REQUEST (%d bytes) ===\n%s\n[server] === END REQUEST ===\n", n, req.c_str());

    // Handle CORS preflight
    if (req.find("OPTIONS") == 0) {
        fprintf(stderr, "[server] Handling OPTIONS preflight\n");
        std::string resp =
            "HTTP/1.1 204 No Content\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "Access-Control-Allow-Methods: POST, OPTIONS\r\n"
            "Access-Control-Allow-Headers: Content-Type\r\n"
            "Connection: close\r\n"
            "\r\n";
        send(fd, resp.c_str(), resp.size(), 0);
        close(fd);
        return;
    }

    size_t hdr_end = req.find("\r\n\r\n");
    if (hdr_end == std::string::npos) {
        fprintf(stderr, "[server] ERROR: no \\r\\n\\r\\n found in request\n");
        std::string resp = http_err(400, "Empty request");
        send(fd, resp.c_str(), resp.size(), 0);
        close(fd);
        return;
    }
    std::string body = req.substr(hdr_end + 4);
    fprintf(stderr, "[server] Body: %s\n", body.c_str());

    if (body.empty()) {
        fprintf(stderr, "[server] ERROR: empty body\n");
        std::string resp = http_err(400, "Empty request");
        send(fd, resp.c_str(), resp.size(), 0);
        close(fd);
        return;
    }

    std::string moves_raw = json_extract(body, "moves");
    fprintf(stderr, "[server] moves_raw: [%s]\n", moves_raw.c_str());

    auto moves = parse_moves(moves_raw);
    fprintf(stderr, "[server] Parsed %zu moves\n", moves.size());

    // Build position command
    std::ostringstream pos_cmd;
    pos_cmd << "position startpos";
    if (!moves.empty()) {
        pos_cmd << " moves";
        for (auto& m : moves) pos_cmd << " " << m;
    }

    // Lock engine for thread-safe UCI communication
    std::string resp;
    {
        std::lock_guard<std::mutex> lock(engine_mtx);
        fprintf(stderr, "[server] -> engine: %s\n", pos_cmd.str().c_str());
        engine.send(pos_cmd.str().c_str());
        fprintf(stderr, "[server] -> engine: go movetime 800\n");
        engine.send("go movetime 800");
        resp = engine.read_until("bestmove");
        fprintf(stderr, "[server] <- engine: %s", resp.c_str());
    }

    MoveResult mr = uci_to_result(resp);
    fprintf(stderr, "[server] MoveResult: from(%d,%d) to(%d,%d) uci=%s\n",
            mr.fromRow, mr.fromCol, mr.toRow, mr.toCol, mr.uci.c_str());

    std::ostringstream json;
    json << "{"
         << "\"fromRow\":" << mr.fromRow << ","
         << "\"fromCol\":" << mr.fromCol << ","
         << "\"toRow\":" << mr.toRow << ","
         << "\"toCol\":" << mr.toCol << ","
         << "\"uci\":\"" << mr.uci << "\""
         << "}";

    fprintf(stderr, "[server] Response JSON: %s\n", json.str().c_str());

    std::string http_resp = http_ok(json.str());
    send(fd, http_resp.c_str(), http_resp.size(), 0);
    close(fd);
}

// ── Main ──
int main(int argc, char* argv[]) {
    if (argc < 3) {
        fprintf(stderr, "Usage: %s <stockfish-path> <port>\n", argv[0]);
        return 1;
    }
    const char* engine_path = argv[1];
    int port = atoi(argv[2]);

    // Ignore SIGPIPE
    signal(SIGPIPE, SIG_IGN);

    // Start engine
    Engine engine;
    if (!engine.start(engine_path)) {
        fprintf(stderr, "Failed to start engine\n");
        return 1;
    }
    engine.init_xiangqi();
    fprintf(stderr, "Engine started, listening on port %d\n", port);

    std::mutex engine_mtx;

    // Create socket
    int sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock < 0) { perror("socket"); return 1; }

    int opt = 1;
    setsockopt(sock, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port = htons(port);
    if (bind(sock, (sockaddr*)&addr, sizeof(addr)) < 0) { perror("bind"); return 1; }
    if (listen(sock, 5) < 0) { perror("listen"); return 1; }

    while (true) {
        sockaddr_in client{};
        socklen_t len = sizeof(client);
        int fd = accept(sock, (sockaddr*)&client, &len);
        if (fd < 0) { perror("accept"); continue; }

        std::thread([fd, &engine, &engine_mtx]() {
            handle_client(fd, engine, engine_mtx);
        }).detach();
    }

    engine.stop();
    close(sock);
    return 0;
}
