(() => {
  // =========================
  // 常量
  // =========================
  const EMPTY = 0, BLACK = 1, WHITE = 2;
  const N = 15;

  const statusEl = document.getElementById("status");
  const canvas = document.getElementById("board");
  const levelSel = document.getElementById("level");
  const undoBtn = document.getElementById("undo");
  const restartBtn = document.getElementById("restart");

  // 画布按 CSS 尺寸自适应
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    draw();
  }
  window.addEventListener("resize", resizeCanvas);

  // =========================
  // 游戏状态
  // =========================
  const board = new Int8Array(N * N); // 0/1/2
  const moves = []; // {r,c,p}
  let toMove = BLACK;
  let winner = 0;
  let thinking = false;
  let lastMove = null;

  function idx(r,c){ return r*N + c; }
  function inb(r,c){ return r>=0 && r<N && c>=0 && c<N; }
  function opp(p){ return p===BLACK ? WHITE : BLACK; }

  function resetGame() {
    board.fill(EMPTY);
    moves.length = 0;
    toMove = BLACK;
    winner = 0;
    thinking = false;
    lastMove = null;
    setStatus("准备开始：轮到你（黑）");
    draw();
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  // =========================
  // 判胜
  // =========================
  function checkWinAt(r,c,p){
    const dirs = [[1,0],[0,1],[1,1],[1,-1]];
    for(const [dr,dc] of dirs){
      let cnt=1;
      let rr=r+dr, cc=c+dc;
      while(inb(rr,cc) && board[idx(rr,cc)]===p){ cnt++; rr+=dr; cc+=dc; }
      rr=r-dr; cc=c-dc;
      while(inb(rr,cc) && board[idx(rr,cc)]===p){ cnt++; rr-=dr; cc-=dc; }
      if(cnt>=5) return true;
    }
    return false;
  }

  function place(r,c,p){
    if(winner || thinking) return false;
    if(!inb(r,c)) return false;
    const k = idx(r,c);
    if(board[k]!==EMPTY) return false;
    board[k]=p;
    moves.push({r,c,p});
    lastMove = {r,c,p};
    if(checkWinAt(r,c,p)){
      winner = p;
    }
    toMove = opp(p);
    return true;
  }

  function undo(){
    if(thinking) return;
    if(moves.length===0) return;
    // 悔两手（人机各一步）
    const steps = moves.length>=2 ? 2 : 1;
    for(let i=0;i<steps;i++){
      const m = moves.pop();
      if(!m) break;
      board[idx(m.r,m.c)] = EMPTY;
    }
    winner = 0;
    toMove = (moves.length % 2 === 0) ? BLACK : WHITE;
    lastMove = moves.length ? moves[moves.length-1] : null;
    draw();
    setStatus(`已悔棋：轮到${toMove===BLACK ? "你（黑）" : "AI（白）"}`);
  }

  // =========================
  // 绘制
  // =========================
  function draw(){
    const ctx = canvas.getContext("2d");
    if(!ctx) return;

    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);

    const margin = Math.floor(Math.min(w,h) * 0.06);
    const size = Math.min(w,h) - margin*2;
    const cell = size / (N-1);

    // 背景（canvas 已有背景色，这里可不画）
    // 网格线
    ctx.strokeStyle = "rgba(30,20,10,0.75)";
    ctx.lineWidth = Math.max(1, Math.floor(Math.min(w,h)/500));

    for(let i=0;i<N;i++){
      const x = margin + i*cell;
      const y = margin + i*cell;
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(margin + (N-1)*cell, y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, margin);
      ctx.lineTo(x, margin + (N-1)*cell);
      ctx.stroke();
    }

    // 星位
    const stars = [
      [3,3],[3,7],[3,11],
      [7,3],[7,7],[7,11],
      [11,3],[11,7],[11,11]
    ];
    ctx.fillStyle = "rgba(20,12,8,0.9)";
    for(const [r,c] of stars){
      const x = margin + c*cell;
      const y = margin + r*cell;
      ctx.beginPath();
      ctx.arc(x,y, Math.max(2, cell*0.09), 0, Math.PI*2);
      ctx.fill();
    }

    // 棋子
    const rr = cell*0.42;
    for(let r=0;r<N;r++){
      for(let c=0;c<N;c++){
        const v = board[idx(r,c)];
        if(v===EMPTY) continue;
        const x = margin + c*cell;
        const y = margin + r*cell;
        ctx.beginPath();
        ctx.arc(x,y, rr, 0, Math.PI*2);
        if(v===BLACK){
          ctx.fillStyle = "#0b0d12";
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth = Math.max(1, rr*0.08);
          ctx.stroke();
        }else{
          ctx.fillStyle = "#f1f3f8";
          ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.25)";
          ctx.lineWidth = Math.max(1, rr*0.08);
          ctx.stroke();
        }
      }
    }

    // 最后一步标记
    if(lastMove){
      const x = margin + lastMove.c*cell;
      const y = margin + lastMove.r*cell;
      ctx.fillStyle = "#ff3b30";
      ctx.beginPath();
      ctx.arc(x,y, rr*0.16, 0, Math.PI*2);
      ctx.fill();
    }

    // 将坐标映射参数存起来用于点击
    draw._geom = {margin, cell, rr, size};
  }

  // 点击/触摸转落点
  function eventToRC(ev){
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    const x = (ev.clientX - rect.left) * dpr;
    const y = (ev.clientY - rect.top) * dpr;

    const {margin, cell} = draw._geom || {margin: 0, cell: 1};
    const c = Math.round((x - margin) / cell);
    const r = Math.round((y - margin) / cell);
    if(!inb(r,c)) return null;

    const gx = margin + c*cell;
    const gy = margin + r*cell;
    const snap = cell*0.45;
    if(Math.abs(x-gx)>snap || Math.abs(y-gy)>snap) return null;
    return {r,c};
  }

  canvas.addEventListener("pointerdown", (ev) => {
    if(thinking || winner) return;
    if(toMove !== BLACK) return;

    const rc = eventToRC(ev);
    if(!rc) return;

    if(place(rc.r, rc.c, BLACK)){
      draw();
      if(winner===BLACK){
        setStatus("你赢了！（五连）");
        return;
      }
      setStatus("AI 思考中…");
      aiMove();
    }
  });

  undoBtn.addEventListener("click", undo);
  restartBtn.addEventListener("click", resetGame);

  // =========================
  // Web Worker：强AI
  // =========================
  const worker = makeAIWorker();

  function aiParams(level){
    // 0 简单 1 普通 2 困难 3 超强 4 地狱
    if(level===0) return {maxDepth:2, topK:8, timeLimitMs:150};
    if(level===1) return {maxDepth:3, topK:10, timeLimitMs:350};
    if(level===2) return {maxDepth:4, topK:12, timeLimitMs:900};
    if(level===3) return {maxDepth:6, topK:14, timeLimitMs:1800};
    return {maxDepth:7, topK:16, timeLimitMs:2800};
  }

  function aiMove(){
    thinking = true;
    const level = parseInt(levelSel.value,10);
    const params = aiParams(level);

    // 把棋盘复制给 worker（转成普通数组更兼容）
    worker.postMessage({
      type: "think",
      n: N,
      board: Array.from(board),
      me: WHITE,
      params
    });
  }

  worker.onmessage = (e) => {
    const msg = e.data;
    if(msg.type === "move"){
      const {r,c} = msg;
      thinking = false;

      if(!winner && toMove===WHITE){
        place(r,c,WHITE);
        draw();
        if(winner===WHITE){
          setStatus("AI 赢了！（五连）");
          return;
        }
        setStatus("轮到你（黑）");
      }else{
        setStatus("轮到你（黑）");
      }
    }else if(msg.type === "info"){
      // 可选调试输出
      // console.log(msg.text);
    }
  };

  levelSel.addEventListener("change", () => {
    const level = parseInt(levelSel.value,10);
    const name = ["简单","普通","困难","超强","地狱"][level] || "超强";
    if(!winner){
      setStatus(`已切换棋力：${name}。轮到${toMove===BLACK ? "你（黑）" : "AI（白）"}`);
    }
  });

  // =========================
  // Worker 代码（字符串创建）
  // =========================
  function makeAIWorker(){
    const code = `
      const EMPTY=0, BLACK=1, WHITE=2;

      function opp(p){ return p===BLACK?WHITE:BLACK; }
      function idx(n,r,c){ return r*n+c; }
      function inb(n,r,c){ return r>=0&&r<n&&c>=0&&c<n; }

      // BigInt 64-bit Zobrist
      function rand64(seed){
        // xorshift64*
        let x = BigInt(seed) || 1n;
        x ^= x >> 12n; x ^= x << 25n; x ^= x >> 27n;
        return (x * 2685821657736338717n) & ((1n<<64n)-1n);
      }

      class Zobrist {
        constructor(n, seed=20260105){
          this.n = n;
          this.side = 0n;
          this.table = new Array(n*n*3);
          let s = BigInt(seed);
          for(let i=0;i<this.table.length;i++){
            s = rand64(s + 0x9e3779b97f4a7c15n + BigInt(i));
            this.table[i] = s;
          }
          this.side = rand64(s + 1234567n);
        }
        hash(board, toMove){
          let h = 0n;
          const n=this.n;
          for(let r=0;r<n;r++){
            for(let c=0;c<n;c++){
              const v = board[idx(n,r,c)];
              if(v!==EMPTY){
                h ^= this.table[(idx(n,r,c)*3)+v];
              }
            }
          }
          if(toMove===WHITE) h ^= this.side;
          return h;
        }
        apply(h, n, r, c, p){
          h ^= this.table[(idx(n,r,c)*3)+p];
          h ^= this.side;
          return h;
        }
      }

      // 预计算所有线坐标（行/列/对角线）
      function precomputeLines(n){
        const lines=[];
        for(let r=0;r<n;r++){
          const a=[];
          for(let c=0;c<n;c++) a.push([r,c]);
          lines.push(a);
        }
        for(let c=0;c<n;c++){
          const a=[];
          for(let r=0;r<n;r++) a.push([r,c]);
          lines.push(a);
        }
        for(let k=-(n-1); k<=n-1; k++){
          const a=[];
          for(let r=0;r<n;r++){
            const c=r-k;
            if(c>=0&&c<n) a.push([r,c]);
          }
          if(a.length>=5) lines.push(a);
        }
        for(let k=0; k<=2*n-2; k++){
          const a=[];
          for(let r=0;r<n;r++){
            const c=k-r;
            if(c>=0&&c<n) a.push([r,c]);
          }
          if(a.length>=5) lines.push(a);
        }
        return lines;
      }

      function countSub(str, sub){
        let cnt=0, pos=0;
        while(true){
          const i = str.indexOf(sub, pos);
          if(i<0) break;
          cnt++; pos = i+1;
        }
        return cnt;
      }

      class AI {
        constructor(n){
          this.n=n;
          this.zob=new Zobrist(n);
          this.lines = precomputeLines(n);
          this.tt = new Map(); // key BigInt -> {depth, flag, val, mv}
          this.radius=2;

          this.EXACT=0; this.LOWER=1; this.UPPER=2;
          this.WIN = 50000000;

          this.S = {
            open4: 4000000,
            half4: 650000,
            open3: 120000,
            broken3: 90000,
            half3: 12000,
            open2: 2000,
            half2: 400,
          };

          this.deadline = 0;
          this.maxDepth = 6;
          this.topK = 14;
        }

        timeUp(){ return performance.now() > this.deadline; }

        generateMoves(board){
          const n=this.n;
          const cand = new Set();
          let any=false;
          for(let r=0;r<n;r++){
            for(let c=0;c<n;c++){
              if(board[idx(n,r,c)]!==EMPTY){
                any=true;
                const rr0=Math.max(0,r-this.radius), rr1=Math.min(n,r+this.radius+1);
                const cc0=Math.max(0,c-this.radius), cc1=Math.min(n,c+this.radius+1);
                for(let rr=rr0; rr<rr1; rr++){
                  for(let cc=cc0; cc<cc1; cc++){
                    if(board[idx(n,rr,cc)]===EMPTY) cand.add(rr*n+cc);
                  }
                }
              }
            }
          }
          if(!any) return [Math.floor(n/2)*n+Math.floor(n/2)];

          const center=(n-1)/2;
          const arr=[...cand];
          arr.sort((a,b)=>{
            const ra=Math.floor(a/n), ca=a%n;
            const rb=Math.floor(b/n), cb=b%n;
            const da=Math.abs(ra-center)+Math.abs(ca-center);
            const db=Math.abs(rb-center)+Math.abs(cb-center);
            return da-db;
          });
          return arr;
        }

        checkWinAt(board, r, c, p){
          const n=this.n;
          const dirs=[[1,0],[0,1],[1,1],[1,-1]];
          for(const [dr,dc] of dirs){
            let cnt=1;
            let rr=r+dr, cc=c+dc;
            while(inb(n,rr,cc) && board[idx(n,rr,cc)]===p){ cnt++; rr+=dr; cc+=dc; }
            rr=r-dr; cc=c-dc;
            while(inb(n,rr,cc) && board[idx(n,rr,cc)]===p){ cnt++; rr-=dr; cc-=dc; }
            if(cnt>=5) return true;
          }
          return false;
        }

        extractLine(board, r, c, dr, dc, p, span=5){
          const n=this.n;
          let s="";
          for(let k=-span;k<=span;k++){
            const rr=r+k*dr, cc=c+k*dc;
            if(!inb(n,rr,cc)) { s+="2"; continue; }
            const v=board[idx(n,rr,cc)];
            if(v===EMPTY) s+="0";
            else if(v===p) s+="1";
            else s+="2";
          }
          return s;
        }

        makesOpen4(board, r, c, p){
          const dirs=[[1,0],[0,1],[1,1],[1,-1]];
          for(const [dr,dc] of dirs){
            const s=this.extractLine(board,r,c,dr,dc,p,5);
            if(s.indexOf("011110")>=0) return true;
          }
          return false;
        }

        makesHalf4(board, r, c, p){
          const dirs=[[1,0],[0,1],[1,1],[1,-1]];
          for(const [dr,dc] of dirs){
            const s=this.extractLine(board,r,c,dr,dc,p,5);
            if(
              s.indexOf("211110")>=0 || s.indexOf("011112")>=0 ||
              s.indexOf("11110")>=0  || s.indexOf("01111")>=0 ||
              s.indexOf("11011")>=0  || s.indexOf("11101")>=0 ||
              s.indexOf("10111")>=0
            ) return true;
          }
          return false;
        }

        scoreLine(line){
          let s=0;
          if(line.indexOf("11111")>=0) s+=this.WIN;
          s += this.S.open4 * countSub(line,"011110");
          s += this.S.half4 * (
            countSub(line,"211110") + countSub(line,"011112") +
            countSub(line,"11110") + countSub(line,"01111") +
            countSub(line,"11011") + countSub(line,"11101") + countSub(line,"10111")
          );
          s += this.S.open3 * countSub(line,"01110");
          s += this.S.broken3 * (countSub(line,"010110")+countSub(line,"011010"));
          s += this.S.half3 * (
            countSub(line,"21110")+countSub(line,"01112")+
            countSub(line,"10110")+countSub(line,"01101")+
            countSub(line,"11010")+countSub(line,"01011")
          );
          s += this.S.open2 * (countSub(line,"00110")+countSub(line,"01100")+countSub(line,"01010")+countSub(line,"010010"));
          s += this.S.half2 * (countSub(line,"21100")+countSub(line,"00112")+countSub(line,"21010")+countSub(line,"01012"));
          return s;
        }

        evaluate(board, root){
          const n=this.n;
          const me=root, op=opp(me);

          const evalP = (p)=>{
            let total=0;
            for(const coords of this.lines){
              let line="";
              for(const [r,c] of coords){
                const v=board[idx(n,r,c)];
                if(v===EMPTY) line+="0";
                else if(v===p) line+="1";
                else line+="2";
              }
              total += this.scoreLine(line);
            }
            return total;
          };

          const sm = evalP(me);
          const so = evalP(op);
          return Math.floor(sm - 1.03*so);
        }

        orderScore(board, move, p){
          const n=this.n;
          const r=Math.floor(move/n), c=move%n;
          const center=(n-1)/2;
          const dist=Math.abs(r-center)+Math.abs(c-center);
          let base = Math.floor((n - dist) * 20);

          board[move]=p;
          let sc=0;
          if(this.checkWinAt(board,r,c,p)) sc+=this.WIN;
          if(this.makesOpen4(board,r,c,p)) sc+=this.S.open4;
          if(this.makesHalf4(board,r,c,p)) sc+=this.S.half4;
          const dirs=[[1,0],[0,1],[1,1],[1,-1]];
          for(const [dr,dc] of dirs){
            const s=this.extractLine(board,r,c,dr,dc,p,5);
            sc += this.scoreLine(s);
          }
          board[move]=EMPTY;
          return base + Math.floor(sc/25);
        }

        // 战术层：赢>挡赢>我方活四>挡对方活四>我方冲四>挡对方冲四
        tactical(board, me, moves){
          const n=this.n, op=opp(me);

          const immediateWin = (p)=>{
            for(const mv of moves){
              if(board[mv]!==EMPTY) continue;
              const r=Math.floor(mv/n), c=mv%n;
              board[mv]=p;
              const ok=this.checkWinAt(board,r,c,p);
              board[mv]=EMPTY;
              if(ok) return mv;
            }
            return -1;
          };

          let mv = immediateWin(me);
          if(mv>=0) return mv;

          mv = immediateWin(op);
          if(mv>=0) return mv;

          // 我方活四
          for(const m of moves){
            if(board[m]!==EMPTY) continue;
            const r=Math.floor(m/n), c=m%n;
            board[m]=me;
            const ok=this.makesOpen4(board,r,c,me);
            board[m]=EMPTY;
            if(ok) return m;
          }
          // 挡对方活四
          for(const m of moves){
            if(board[m]!==EMPTY) continue;
            const r=Math.floor(m/n), c=m%n;
            board[m]=op;
            const ok=this.makesOpen4(board,r,c,op);
            board[m]=EMPTY;
            if(ok) return m; // 我方占这个点即可阻止
          }

          // 我方冲四
          for(const m of moves){
            if(board[m]!==EMPTY) continue;
            const r=Math.floor(m/n), c=m%n;
            board[m]=me;
            const ok=this.makesHalf4(board,r,c,me);
            board[m]=EMPTY;
            if(ok) return m;
          }
          // 挡对方冲四
          for(const m of moves){
            if(board[m]!==EMPTY) continue;
            const r=Math.floor(m/n), c=m%n;
            board[m]=op;
            const ok=this.makesHalf4(board,r,c,op);
            board[m]=EMPTY;
            if(ok) return m;
          }

          return -1;
        }

        negamax(board, depth, alpha, beta, player, root, lastMove, h){
          if(this.timeUp()) return this.evaluate(board, root);

          const n=this.n;
          const lr=Math.floor(lastMove/n), lc=lastMove%n;
          const prev = opp(player);

          if(this.checkWinAt(board, lr, lc, prev)){
            return (prev===root) ? this.WIN : -this.WIN;
          }
          if(depth<=0) return this.evaluate(board, root);

          // TT
          const tt = this.tt.get(h);
          if(tt && tt.depth>=depth){
            if(tt.flag===this.EXACT) return tt.val;
            if(tt.flag===this.LOWER) alpha = Math.max(alpha, tt.val);
            else beta = Math.min(beta, tt.val);
            if(alpha>=beta) return tt.val;
          }

          const moves = this.generateMoves(board);
          if(moves.length===0) return 0;

          // move ordering
          let scored = moves.map(m=>[this.orderScore(board,m,player), m]);
          scored.sort((a,b)=>b[0]-a[0]);
          let list = scored.slice(0,this.topK).map(x=>x[1]);

          // PV move first
          if(tt && tt.mv!=null){
            const i=list.indexOf(tt.mv);
            if(i>0){
              list.splice(i,1);
              list.unshift(tt.mv);
            }
          }

          let best=-1e18;
          let bestMv=null;
          const a0=alpha;

          for(const mv of list){
            if(this.timeUp()) break;
            if(board[mv]!==EMPTY) continue;
            board[mv]=player;
            const nh = this.zob.apply(h,n,Math.floor(mv/n),mv%n,player);
            const val = -this.negamax(board, depth-1, -beta, -alpha, opp(player), root, mv, nh);
            board[mv]=EMPTY;

            if(val>best){
              best=val;
              bestMv=mv;
            }
            alpha = Math.max(alpha, best);
            if(alpha>=beta) break;
          }

          let flag=this.EXACT;
          if(best<=a0) flag=this.UPPER;
          else if(best>=beta) flag=this.LOWER;

          this.tt.set(h,{depth, flag, val:best|0, mv:bestMv});
          return best|0;
        }

        think(boardArr, me, params){
          const n=this.n;
          const board = Int8Array.from(boardArr);

          this.maxDepth = params.maxDepth;
          this.topK = params.topK;
          this.deadline = performance.now() + params.timeLimitMs;

          this.tt.clear();

          const moves = this.generateMoves(board);
          // 战术层先走
          const t = this.tactical(board, me, moves);
          if(t>=0){
            return {r: Math.floor(t/n), c: t%n};
          }

          // 根排序
          let rootMoves = moves.map(m=>[this.orderScore(board,m,me), m]);
          rootMoves.sort((a,b)=>b[0]-a[0]);
          rootMoves = rootMoves.slice(0,this.topK).map(x=>x[1]);

          let bestMv = rootMoves[0];
          let bestVal = -1e18;

          const rootHash = this.zob.hash(board, me);

          for(let depth=1; depth<=this.maxDepth; depth++){
            if(this.timeUp()) break;

            let alpha=-1e18, beta=1e18;
            let curBestMv=bestMv;
            let curBestVal=-1e18;

            const ttRoot = this.tt.get(rootHash);
            if(ttRoot && ttRoot.mv!=null){
              const i=rootMoves.indexOf(ttRoot.mv);
              if(i>0){
                rootMoves.splice(i,1);
                rootMoves.unshift(ttRoot.mv);
              }
            }

            for(const mv of rootMoves){
              if(this.timeUp()) break;
              if(board[mv]!==EMPTY) continue;
              board[mv]=me;
              const nh = this.zob.apply(rootHash,n,Math.floor(mv/n),mv%n,me);
              const val = -this.negamax(board, depth-1, -beta, -alpha, opp(me), me, mv, nh);
              board[mv]=EMPTY;

              if(val>curBestVal){
                curBestVal=val;
                curBestMv=mv;
              }
              alpha=Math.max(alpha, curBestVal);
            }

            if(!this.timeUp()){
              bestMv=curBestMv;
              bestVal=curBestVal;
            }
          }

          return {r: Math.floor(bestMv/n), c: bestMv%n};
        }
      }

      let ai=null;

      self.onmessage = (e)=>{
        const msg=e.data;
        if(msg.type==="think"){
          const {n, board, me, params} = msg;
          if(!ai || ai.n!==n) ai=new AI(n);
          const mv = ai.think(board, me, params);
          self.postMessage({type:"move", ...mv});
        }
      };
    `;

    const blob = new Blob([code], {type:"application/javascript"});
    const url = URL.createObjectURL(blob);
    return new Worker(url);
  }

  // 启动
  resizeCanvas();
  resetGame();
})();
