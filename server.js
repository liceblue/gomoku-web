import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const app = express();
app.use(cors());
app.get("/", (_, res) => res.send("gomoku server ok"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" } // 上线后可改成只允许你的前端域名
});

const EMPTY = 0, BLACK = 1, WHITE = 2;
const N = 15;

function idx(r, c) { return r * N + c; }
function inb(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }
function opp(p) { return p === BLACK ? WHITE : BLACK; }

function checkWin(board, r, c, p) {
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  for (const [dr,dc] of dirs) {
    let cnt = 1;
    let rr = r + dr, cc = c + dc;
    while (inb(rr,cc) && board[idx(rr,cc)] === p) { cnt++; rr += dr; cc += dc; }
    rr = r - dr; cc = c - dc;
    while (inb(rr,cc) && board[idx(rr,cc)] === p) { cnt++; rr -= dr; cc -= dc; }
    if (cnt >= 5) return true;
  }
  return false;
}

// roomId -> state
const rooms = new Map();
/*
state = {
  players: { black: socketId|null, white: socketId|null },
  names: { black: string, white: string },
  board: Int8Array(N*N),
  moves: [{r,c,p}],
  toMove: BLACK,
  winner: 0/BLACK/WHITE,
  lastMove: {r,c,p}|null
}
*/

function newRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function ensureRoom() {
  let id = newRoomId();
  while (rooms.has(id)) id = newRoomId();
  const st = {
    players: { black: null, white: null },
    names: { black: "", white: "" },
    board: new Int8Array(N * N),
    moves: [],
    toMove: BLACK,
    winner: 0,
    lastMove: null
  };
  rooms.set(id, st);
  return id;
}

function roleOf(st, sid) {
  if (st.players.black === sid) return "black";
  if (st.players.white === sid) return "white";
  return null;
}

function broadcastState(roomId) {
  const st = rooms.get(roomId);
  if (!st) return;
  io.to(roomId).emit("state", {
    roomId,
    players: st.players,
    names: st.names,
    board: Array.from(st.board),
    toMove: st.toMove,
    winner: st.winner,
    lastMove: st.lastMove,
    movesCount: st.moves.length
  });
}

io.on("connection", (socket) => {
  socket.on("create_room", ({ name }) => {
    const roomId = ensureRoom();
    const st = rooms.get(roomId);

    st.players.black = socket.id;
    st.names.black = (name || "Black").slice(0, 18);

    socket.join(roomId);
    socket.emit("room_joined", { roomId, role: "black" });
    broadcastState(roomId);
  });

  socket.on("join_room", ({ roomId, name }) => {
    const id = String(roomId || "").toUpperCase();
    const st = rooms.get(id);
    if (!st) return socket.emit("error_msg", "房间不存在");

    let role = null;
    if (!st.players.black) {
      st.players.black = socket.id;
      st.names.black = (name || "Black").slice(0, 18);
      role = "black";
    } else if (!st.players.white) {
      st.players.white = socket.id;
      st.names.white = (name || "White").slice(0, 18);
      role = "white";
    } else {
      // 允许观战（不占位）
      socket.join(id);
      socket.emit("room_joined", { roomId: id, role: "spectator" });
      broadcastState(id);
      return;
    }

    socket.join(id);
    socket.emit("room_joined", { roomId: id, role });
    broadcastState(id);
  });

  socket.on("move", ({ roomId, r, c }) => {
    const id = String(roomId || "").toUpperCase();
    const st = rooms.get(id);
    if (!st) return;

    if (st.winner) return;

    const role = roleOf(st, socket.id);
    if (!role) return; // 观战/不在房间

    const p = role === "black" ? BLACK : WHITE;
    if (p !== st.toMove) return;

    r = Number(r); c = Number(c);
    if (!inb(r, c)) return;
    const k = idx(r, c);
    if (st.board[k] !== EMPTY) return;

    st.board[k] = p;
    st.moves.push({ r, c, p });
    st.lastMove = { r, c, p };

    if (checkWin(st.board, r, c, p)) {
      st.winner = p;
    }
    st.toMove = opp(p);
    broadcastState(id);
  });

  socket.on("restart", ({ roomId }) => {
    const id = String(roomId || "").toUpperCase();
    const st = rooms.get(id);
    if (!st) return;

    // 只允许玩家重开
    if (!roleOf(st, socket.id)) return;

    st.board.fill(EMPTY);
    st.moves.length = 0;
    st.toMove = BLACK;
    st.winner = 0;
    st.lastMove = null;
    broadcastState(id);
  });

  socket.on("undo", ({ roomId }) => {
    const id = String(roomId || "").toUpperCase();
    const st = rooms.get(id);
    if (!st) return;

    // 只允许玩家悔棋
    if (!roleOf(st, socket.id)) return;

    if (st.moves.length === 0) return;

    // 联机默认悔一步（更公平；要做“双方确认”我也能给你加）
    const last = st.moves.pop();
    st.board[idx(last.r, last.c)] = EMPTY;
    st.winner = 0;
    st.toMove = last.p; // 悔掉谁的棋，就轮到谁
    st.lastMove = st.moves.length ? st.moves[st.moves.length - 1] : null;
    broadcastState(id);
  });

  socket.on("disconnect", () => {
    for (const [roomId, st] of rooms.entries()) {
      let changed = false;
      if (st.players.black === socket.id) { st.players.black = null; st.names.black = ""; changed = true; }
      if (st.players.white === socket.id) { st.players.white = null; st.names.white = ""; changed = true; }

      // 没人了就删房
      if (!st.players.black && !st.players.white) {
        rooms.delete(roomId);
        continue;
      }
      if (changed) broadcastState(roomId);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("server on", PORT));
