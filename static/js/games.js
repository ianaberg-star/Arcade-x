(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const modal=$("#gameModal"),stage=$("#gameStage"),title=$("#modalTitle"),help=$("#gameHelp"),toast=$("#toast");
  const authModal=$("#authModal"),authForm=$("#authForm"),authMessage=$("#authMessage");
  let currentGame=null,cleanupGame=()=>{},toastTimer,authMode="login",loggedInUser=null;
  const gameNames={snake:"Snake",memory:"Memory Match",tictactoe:"Tic-Tac-Toe",ski:"Alpine Rush"};
  function notify(message){toast.textContent=message;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2100);}
  async function api(url,options={}){const response=await fetch(url,{headers:{"Content-Type":"application/json",...(options.headers||{})},...options});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"Something went wrong.");return data;}
  function updateAccount(){const b=$("#accountButton");b.textContent=loggedInUser?loggedInUser.username.toUpperCase():"SIGN IN";b.title=loggedInUser?"Click to sign out":"Sign in or create an account";}
  async function loadUser(){try{const data=await api("/api/me");loggedInUser=data.user;updateAccount();}catch{loggedInUser=null;updateAccount();}}
  $("#accountButton").addEventListener("click",async()=>{if(loggedInUser){if(confirm("Sign out of ARCADE X?")){try{await api("/api/logout",{method:"POST"});loggedInUser=null;updateAccount();notify("Signed out");}catch(e){notify(e.message);}}}else openAuth("login");});
  function openAuth(mode="login"){authMode=mode;authMessage.textContent="";authMessage.className="auth-message";authModal.classList.remove("hidden");setAuthMode(mode);}
  function closeAuth(){authModal.classList.add("hidden");}
  function setAuthMode(mode){authMode=mode;$("#authTitle").textContent=mode==="login"?"WELCOME BACK":"CREATE YOUR PLAYER";$("#authSubmit").innerHTML=mode==="login"?'SIGN IN <span>→</span>':'CREATE ACCOUNT <span>→</span>';$("#authPassword").autocomplete=mode==="login"?"current-password":"new-password";$$("[data-auth-mode]").forEach(b=>b.classList.toggle("active",b.dataset.authMode===mode));}
  $$("[data-auth-mode]").forEach(b=>b.addEventListener("click",()=>setAuthMode(b.dataset.authMode)));
  $("#closeAuth").addEventListener("click",closeAuth);
  authModal.addEventListener("click",e=>{if(e.target===authModal)closeAuth();});
  authForm.addEventListener("submit",async e=>{e.preventDefault();const username=$("#authUsername").value.trim(),password=$("#authPassword").value;authMessage.textContent="Please wait…";try{const data=await api(authMode==="login"?"/api/login":"/api/register",{method:"POST",body:JSON.stringify({username,password})});loggedInUser=data.user;updateAccount();authMessage.textContent=data.message;authMessage.classList.add("success");setTimeout(closeAuth,500);loadLeaderboard();notify("Welcome, "+loggedInUser.username+"!");}catch(err){authMessage.textContent=err.message;authMessage.classList.remove("success");}});

  function showModal(id){currentGame=id;modal.classList.remove("hidden");document.body.style.overflow="hidden";startGame(id);}
  function closeModal(){cleanupGame();cleanupGame=()=>{};modal.classList.add("hidden");document.body.style.overflow="";stage.innerHTML="";}
  $("#closeModal").addEventListener("click",closeModal);modal.addEventListener("click",e=>{if(e.target===modal)closeModal();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(!modal.classList.contains("hidden"))closeModal();if(!authModal.classList.contains("hidden"))closeAuth();}});
  $$("[data-play]").forEach(b=>b.addEventListener("click",()=>showModal(b.dataset.play)));
  $("#restartGame").addEventListener("click",()=>currentGame&&startGame(currentGame));
  async function saveScore(gameId,score){if(!loggedInUser){notify("Sign in to save your score.");openAuth("login");return;}try{await api("/api/scores",{method:"POST",body:JSON.stringify({game_id:gameId,score:Math.max(0,Math.floor(score))})});notify("Score saved to leaderboard!");loadLeaderboard();}catch(e){notify(e.message);}}
  async function loadLeaderboard(){const game=$("#leaderboardGame").value;const box=$("#leaderboardRows");box.innerHTML='<div class="leaderboard-empty">Loading scores…</div>';try{const rows=await api("/api/leaderboard?game="+encodeURIComponent(game));if(!rows.length){box.innerHTML='<div class="leaderboard-empty">No scores yet. Play a game and post the first score!</div>';return;}box.innerHTML=rows.map((r,i)=>`<div class="leaderboard-row"><span class="rank">#${i+1}</span><strong>${escapeHtml(r.username)}</strong><span>${gameNames[r.game_id]||r.game_id}</span><span class="leaderboard-score">${Number(r.score).toLocaleString()}</span></div>`).join("");}catch(e){box.innerHTML=`<div class="leaderboard-empty">${escapeHtml(e.message)}</div>`;}}
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  $("#leaderboardGame").addEventListener("change",loadLeaderboard);$("#refreshLeaderboard").addEventListener("click",loadLeaderboard);

  let activeFilter="All";
  function filterCards(){const q=$("#searchInput").value.toLowerCase().trim();let visible=0;$$(".game-card").forEach(card=>{const match=(activeFilter==="All"||card.dataset.category===activeFilter)&&(card.dataset.name.includes(q)||card.textContent.toLowerCase().includes(q));card.classList.toggle("hidden",!match);if(match)visible++;});$("#emptyState").classList.toggle("hidden",visible!==0);$("#gameCount").textContent=visible;}
  $("#searchInput").addEventListener("input",filterCards);$$(".filter").forEach(b=>b.addEventListener("click",()=>{activeFilter=b.dataset.filter;$$(".filter").forEach(x=>x.classList.toggle("active",x===b));filterCards();}));
  const favorites=new Set(JSON.parse(localStorage.getItem("arcade-x-favorites")||"[]"));
  function paintFavorites(){$$("[data-favorite]").forEach(b=>{const on=favorites.has(b.dataset.favorite);b.classList.toggle("selected",on);b.textContent=on?"♥":"♡";});}
  $$("[data-favorite]").forEach(b=>b.addEventListener("click",()=>{const id=b.dataset.favorite;favorites.has(id)?favorites.delete(id):favorites.add(id);localStorage.setItem("arcade-x-favorites",JSON.stringify([...favorites]));paintFavorites();notify(favorites.has(id)?"Added to favorites":"Removed from favorites");}));paintFavorites();
  $("#themeButton").addEventListener("click",()=>{document.body.classList.toggle("light");localStorage.setItem("arcade-x-light",document.body.classList.contains("light")?"1":"0");});if(localStorage.getItem("arcade-x-light")==="1")document.body.classList.add("light");

  function startGame(id){cleanupGame();cleanupGame=()=>{};stage.innerHTML="";title.textContent=gameNames[id]||"Game";if(id==="snake")cleanupGame=snakeGame();else if(id==="memory")cleanupGame=memoryGame();else if(id==="tictactoe")cleanupGame=ticTacToe();else if(id==="ski")cleanupGame=skiGame();}

  function snakeGame(){help.textContent="Arrow keys / WASD or touch controls. Save your score when you crash.";stage.innerHTML=`<div class="snake-wrap"><div class="snake-top"><span>SCORE: <b id="snakeScore">0</b></span><span id="snakeState">PLAYING</span></div><canvas id="snakeCanvas" width="320" height="320"></canvas><div class="mobile-controls"><button data-dir="up">↑</button><button data-dir="left">←</button><button data-dir="down">↓</button><button data-dir="right">→</button></div><div class="game-instructions">Eat the red food. Don't hit the walls or yourself.</div></div>`;
    const canvas=$("#snakeCanvas"),ctx=canvas.getContext("2d"),scoreEl=$("#snakeScore"),stateEl=$("#snakeState"),cell=16,cells=20;let snake,food,dir,nextDir,score,timer,over=false,submitted=false;
    function reset(){clearInterval(timer);snake=[{x:9,y:10},{x:8,y:10},{x:7,y:10}];dir={x:1,y:0};nextDir={x:1,y:0};score=0;over=false;submitted=false;scoreEl.textContent="0";stateEl.textContent="PLAYING";placeFood();draw();timer=setInterval(tick,115);}
    function placeFood(){do{food={x:Math.floor(Math.random()*cells),y:Math.floor(Math.random()*cells)};}while(snake.some(p=>p.x===food.x&&p.y===food.y));}
    function draw(){ctx.fillStyle="#101016";ctx.fillRect(0,0,320,320);ctx.strokeStyle="#ffffff08";for(let i=0;i<=320;i+=cell){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,320);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(320,i);ctx.stroke();}ctx.fillStyle="#ff344f";ctx.beginPath();ctx.arc(food.x*cell+8,food.y*cell+8,6,0,Math.PI*2);ctx.fill();snake.forEach((p,i)=>{ctx.fillStyle=i===0?"#71e5b0":"#319d7b";ctx.fillRect(p.x*cell+1,p.y*cell+1,cell-2,cell-2);});if(over){ctx.fillStyle="#000b";ctx.fillRect(0,0,320,320);ctx.fillStyle="#fff";ctx.font="bold 23px sans-serif";ctx.textAlign="center";ctx.fillText("GAME OVER",160,150);ctx.font="13px sans-serif";ctx.fillText("Score: "+score,160,177);}}
    function tick(){dir=nextDir;const h={x:snake[0].x+dir.x,y:snake[0].y+dir.y};if(h.x<0||h.y<0||h.x>=cells||h.y>=cells||snake.some(p=>p.x===h.x&&p.y===h.y)){over=true;clearInterval(timer);stateEl.textContent="GAME OVER";draw();if(!submitted&&score>0){submitted=true;saveScore("snake",score);}return;}snake.unshift(h);if(h.x===food.x&&h.y===food.y){score+=10;scoreEl.textContent=score;placeFood();}else snake.pop();draw();}
    function setDir(n){const d={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}}[n];if(d&&!(d.x===-dir.x&&d.y===-dir.y))nextDir=d;}
    function key(e){const m={ArrowUp:"up",w:"up",ArrowDown:"down",s:"down",ArrowLeft:"left",a:"left",ArrowRight:"right",d:"right"};if(m[e.key]){e.preventDefault();setDir(m[e.key]);}}
    document.addEventListener("keydown",key);$$("[data-dir]",stage).forEach(b=>b.addEventListener("click",()=>setDir(b.dataset.dir)));reset();return()=>{clearInterval(timer);document.removeEventListener("keydown",key);};
  }

  function memoryGame(){help.textContent="Flip pairs. Fewer moves earn a higher score.";const symbols=["🚀","🎮","👾","⭐","🎧","💎","🔥","🛸"];let deck=[...symbols,...symbols].sort(()=>Math.random()-.5),first=null,lock=false,moves=0,matches=0,timeout;stage.innerHTML=`<div><div class="game-status" id="memoryStatus">Moves: 0 · Pairs: 0/8</div><div class="memory-board" id="memoryBoard"></div></div>`;const board=$("#memoryBoard"),status=$("#memoryStatus");deck.forEach(symbol=>{const b=document.createElement("button");b.className="memory-card";b.textContent="?";b.addEventListener("click",()=>{if(lock||b.classList.contains("flipped")||b.classList.contains("matched"))return;b.textContent=symbol;b.classList.add("flipped");if(!first){first={b,symbol};return;}moves++;lock=true;if(first.symbol===symbol){first.b.classList.add("matched");b.classList.add("matched");first=null;matches++;lock=false;status.textContent=`Moves: ${moves} · Pairs: ${matches}/8`;if(matches===8){const score=Math.max(100,1000-moves*35);status.textContent=`Completed! Score: ${score} 🎉`;saveScore("memory",score);}}else{const prev=first.b;first=null;status.textContent=`Moves: ${moves} · Pairs: ${matches}/8`;timeout=setTimeout(()=>{prev.textContent="?";b.textContent="?";prev.classList.remove("flipped");b.classList.remove("flipped");lock=false;},750);}});board.appendChild(b);});return()=>clearTimeout(timeout);}

  function ticTacToe(){help.textContent="Two-player mode. X goes first. Win by getting three in a row.";let cells=Array(9).fill(""),turn="X",done=false;stage.innerHTML=`<div><div class="game-status" id="tttStatus">Player X's turn</div><div class="ttt-board" id="tttBoard"></div></div>`;const board=$("#tttBoard"),status=$("#tttStatus"),wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];cells.forEach((_,i)=>{const b=document.createElement("button");b.className="ttt-cell";b.addEventListener("click",()=>{if(done||cells[i])return;cells[i]=turn;b.textContent=turn;b.style.color=turn==="X"?"#ff5268":"#71e5b0";const won=wins.some(line=>line.every(n=>cells[n]===turn));if(won){status.textContent=`Player ${turn} wins!`;done=true;notify("Tic-Tac-Toe complete. Sign in to play more games!");}else if(cells.every(Boolean)){status.textContent="It's a draw!";done=true;}else{turn=turn==="X"?"O":"X";status.textContent=`Player ${turn}'s turn`;}});board.appendChild(b);});return()=>{};}


  // Alpine Rush 3D-style perspective downhill game.
  function skiGame(){
    help.textContent="← / → steer · SPACE jump · ↑ / ↓ spin tricks · Land cleanly for bonus points. Touch controls work too.";
    stage.innerHTML=`<div class="ski-wrap"><div class="ski-hud"><span>DISTANCE <strong id="skiDistance">0</strong> m</span><span>SCORE <strong id="skiScore">0</strong></span><span id="skiStatus">RUN</span></div>
      <canvas id="skiCanvas" width="520" height="390" aria-label="Alpine Rush perspective skiing game"></canvas>
      <div class="ski-result" id="skiResult">Choose your skis, then carve down the mountain.</div>
      <div class="ski-controls"><button data-ski="left">← CARVE</button><button data-ski="jump">JUMP / SPACE</button><button data-ski="trick">↑ SPIN</button><button data-ski="flip">↓ FLIP</button><button data-ski="right">CARVE →</button></div>
      <div class="ski-garage" id="skiGarage"><span>SKI SETUP</span><button data-ski-choice="basic" class="selected">ALL-MOUNTAIN</button><button data-ski-choice="freestyle">FREESTYLE · 500 PTS</button><button data-ski-choice="pro">PRO · 1500 PTS</button></div>
    </div>`;
    const canvas=$("#skiCanvas"),ctx=canvas.getContext("2d"),distanceEl=$("#skiDistance"),scoreEl=$("#skiScore"),statusEl=$("#skiStatus"),resultEl=$("#skiResult");
    const W=520,H=390, horizon=68;
    let player,objects,score,distance,speed,frame,raf,keys={},ended=false,air=0,airAction="",airRotation=0,airBonus=0,selectedSki="basic",lastTime=0,combo=0,runStarted=false;
    const skiStyles={basic:{name:"ALL-MOUNTAIN",color:"#ff4058",speed:1,jump:1},freestyle:{name:"FREESTYLE",color:"#41c9b0",speed:1.05,jump:1.18},pro:{name:"PRO",color:"#f0b64b",speed:1.12,jump:1.3}};
    function project(x,z){const t=1-z;const scale=.22+t*1.18;return {x:W/2+x*scale*1.9,y:horizon+Math.pow(t,1.55)*(H-horizon),scale};}
    function reset(){cancelAnimationFrame(raf);player={x:0,vx:0};objects=[];score=0;distance=0;speed=2.9;frame=0;ended=false;air=0;airAction="";airRotation=0;airBonus=0;lastTime=0;combo=0;runStarted=true;distanceEl.textContent="0";scoreEl.textContent="0";statusEl.textContent="RUN";resultEl.textContent="Carve through the gates. Find ramps and rails for big combos.";raf=requestAnimationFrame(loop);}
    function addObject(type){objects.push({type,x:(Math.random()-.5)*1.55,z:1.08,done:false,phase:Math.random()*6.28});}
    function spawn(){if(frame%42===0)addObject(Math.random()<.62?"tree":"rock");if(frame%145===0)addObject("ramp");if(frame%190===0)addObject("rail");if(frame%260===0)addObject("gate");}
    function mountainBackground(){
      const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,"#b7d9e8");sky.addColorStop(.45,"#e8f5f8");sky.addColorStop(1,"#a5cbd9");ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
      // distant peaks
      ctx.fillStyle="#7598aa";ctx.beginPath();ctx.moveTo(0,155);for(let x=0;x<=W;x+=65)ctx.lineTo(x,95+Math.sin(x*.027)*27+(x%3)*4);ctx.lineTo(W,190);ctx.closePath();ctx.fill();
      ctx.fillStyle="#f4fbfc";ctx.beginPath();ctx.moveTo(0,158);for(let x=0;x<=W;x+=65)ctx.lineTo(x,108+Math.sin(x*.027)*27+(x%3)*4);ctx.lineTo(W,160);ctx.closePath();ctx.fill();
      // slope edges and groomed snow
      ctx.fillStyle="#dceef3";ctx.beginPath();ctx.moveTo(0,horizon);ctx.lineTo(W,horizon);ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fill();
      ctx.fillStyle="#c4e0e9";ctx.beginPath();ctx.moveTo(0,horizon);ctx.lineTo(110,horizon);ctx.lineTo(260,H);ctx.lineTo(0,H);ctx.fill();ctx.beginPath();ctx.moveTo(W,horizon);ctx.lineTo(W-110,horizon);ctx.lineTo(260,H);ctx.fill();
      ctx.strokeStyle="#ffffff99";ctx.lineWidth=2;
      for(let i=-4;i<=4;i++){ctx.beginPath();ctx.moveTo(W/2+i*26,horizon);ctx.lineTo(W/2+i*72,H);ctx.stroke();}
      // subtle snow flecks flowing toward player
      for(let i=0;i<32;i++){const z=((i*37+frame*2.2)%350)/350;const p=project(Math.sin(i*9.3)*.85,z);ctx.fillStyle="#ffffff99";ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.7,p.scale*1.5),0,Math.PI*2);ctx.fill();}
    }
    function drawTree(p){const s=p.scale*18;ctx.fillStyle="#174f4a";ctx.beginPath();ctx.moveTo(p.x,p.y-s*2.2);ctx.lineTo(p.x-s,p.y+s*.35);ctx.lineTo(p.x+s,p.y+s*.35);ctx.closePath();ctx.fill();ctx.fillStyle="#267467";ctx.beginPath();ctx.moveTo(p.x,p.y-s*1.5);ctx.lineTo(p.x-s*.8,p.y+s*.8);ctx.lineTo(p.x+s*.8,p.y+s*.8);ctx.closePath();ctx.fill();ctx.fillStyle="#74543d";ctx.fillRect(p.x-s*.12,p.y+s*.55,s*.24,s*.55);}
    function drawObject(o){const p=project(o.x,o.z),s=p.scale;
      if(o.type==="tree"){drawTree(p);return;}
      if(o.type==="rock"){ctx.fillStyle="#687e89";ctx.beginPath();ctx.ellipse(p.x,p.y,s*12,s*7,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#a9c0c8";ctx.beginPath();ctx.ellipse(p.x-s*3,p.y-s*2,s*4,s*2,-.3,0,Math.PI*2);ctx.fill();return;}
      if(o.type==="ramp"){ctx.fillStyle="#d58e39";ctx.beginPath();ctx.moveTo(p.x-s*25,p.y+s*5);ctx.lineTo(p.x+s*25,p.y+s*5);ctx.lineTo(p.x+s*15,p.y-s*8);ctx.lineTo(p.x-s*15,p.y-s*8);ctx.closePath();ctx.fill();ctx.fillStyle="#fff0d1";ctx.fillRect(p.x-s*8,p.y-s*4,s*16,s*2);return;}
      if(o.type==="rail"){ctx.strokeStyle="#344c5b";ctx.lineWidth=Math.max(2,s*3);ctx.beginPath();ctx.moveTo(p.x-s*28,p.y+s*5);ctx.lineTo(p.x+s*28,p.y-s*8);ctx.stroke();ctx.strokeStyle="#e7f5f8";ctx.lineWidth=Math.max(1,s);ctx.beginPath();ctx.moveTo(p.x-s*28,p.y+s*2);ctx.lineTo(p.x+s*28,p.y-s*11);ctx.stroke();return;}
      if(o.type==="gate"){ctx.strokeStyle="#ff4058";ctx.lineWidth=Math.max(2,s*2);ctx.beginPath();ctx.moveTo(p.x-s*15,p.y-s*18);ctx.lineTo(p.x-s*15,p.y+s*18);ctx.moveTo(p.x+s*15,p.y-s*18);ctx.lineTo(p.x+s*15,p.y+s*18);ctx.stroke();ctx.fillStyle="#fff";ctx.fillRect(p.x-s*16,p.y-s*19,s*32,s*4);}
    }
    function drawPlayer(){const x=W/2+player.x*155,y=H-68-(air>0?Math.min(52,air*1.8):0),lean=player.vx*.12;
      ctx.fillStyle="#183c4b33";ctx.beginPath();ctx.ellipse(x+4,H-48,22,8,0,0,Math.PI*2);ctx.fill();
      ctx.save();ctx.translate(x,y);ctx.rotate(lean+airRotation);
      ctx.strokeStyle="#263d50";ctx.lineWidth=5;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-15,17);ctx.lineTo(15,17);ctx.moveTo(-15,23);ctx.lineTo(15,23);ctx.stroke();
      ctx.fillStyle=skiStyles[selectedSki].color;ctx.beginPath();ctx.ellipse(0,-3,9,17,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#26394b";ctx.beginPath();ctx.arc(0,-23,8,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle="#26394b";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-6,-7);ctx.lineTo(-17,9);ctx.moveTo(6,-7);ctx.lineTo(17,9);ctx.stroke();
      ctx.restore();
      if(air>0){ctx.fillStyle="#17384a";ctx.font="bold 13px sans-serif";ctx.textAlign="center";ctx.fillText(airAction||"AIR!",x,y-39);}
    }
    function draw(){mountainBackground();objects.slice().sort((a,b)=>a.z-b.z).forEach(drawObject);drawPlayer();if(ended){ctx.fillStyle="#07121bdc";ctx.fillRect(0,0,W,H);ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font="bold 31px sans-serif";ctx.fillText("RUN COMPLETE",W/2,145);ctx.font="15px sans-serif";ctx.fillText(`${score.toLocaleString()} POINTS  ·  ${Math.floor(distance)} m`,W/2,177);ctx.font="12px sans-serif";ctx.fillText("Restart to hit the slopes again",W/2,205);}}
    function doJump(){if(ended||air>0)return;air=54;airAction="AIR TIME";airRotation=0;airBonus=0;resultEl.textContent="You're airborne! Try a spin or flip before landing.";}
    function doTrick(kind){if(ended||air<=0)return;const points=kind==="SPIN"?300:450;airBonus+=points;airAction=kind+"!";airRotation+=kind==="SPIN"?Math.PI*2:Math.PI;combo++;resultEl.innerHTML=`<span class="trick-pill">${kind} · +${points} · COMBO x${combo}</span>`;}
    function land(){if(airBonus>0){const bonus=airBonus+combo*100;score+=bonus;resultEl.textContent=`Clean landing! Trick combo +${bonus} points.`;}else resultEl.textContent="Solid landing. Keep carving.";air=0;airAction="";airRotation=0;airBonus=0;combo=0;}
    function finish(){if(ended)return;ended=true;statusEl.textContent="FINISHED";resultEl.textContent=`Mountain run complete: ${score.toLocaleString()} points.`;saveScore("ski",score);}
    function loop(ts){if(ended){draw();return;}if(!lastTime)lastTime=ts;const dt=Math.min(2,(ts-lastTime)/16.67);lastTime=ts;frame++;distance+=speed*.1*dt;speed=Math.min(7.2,2.9+distance/950);spawn();
      if(keys.left)player.vx-=.045*dt;if(keys.right)player.vx+=.045*dt;if(!keys.left&&!keys.right)player.vx*=Math.pow(.9,dt);player.vx=Math.max(-.42,Math.min(.42,player.vx));player.x+=player.vx*dt;player.x=Math.max(-1.1,Math.min(1.1,player.x));
      objects.forEach(o=>{o.z-=speed*.0028*dt;if(o.z<.14&&!o.done){o.done=true;const close=Math.abs(o.x-player.x);if(o.type==="ramp"&&close<.34){doJump();}else if(o.type==="rail"&&close<.34){score+=200;resultEl.textContent="Rail slide! +200 points";}else if(o.type==="gate"&&close<.27){score+=100;resultEl.textContent="Clean gate! +100 points";}else if((o.type==="tree"||o.type==="rock")&&close<.19&&air<=0){finish();}}});
      objects=objects.filter(o=>o.z>-.08);
      if(air>0){air-=dt;if(air<=0)land();}
      score+=Math.floor(speed*dt);distanceEl.textContent=Math.floor(distance);scoreEl.textContent=score.toLocaleString();draw();raf=requestAnimationFrame(loop);
    }
    function keydown(e){if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(e.key))e.preventDefault();if(e.key==="ArrowLeft"||e.key==="a")keys.left=true;if(e.key==="ArrowRight"||e.key==="d")keys.right=true;if(e.key===" "||e.key==="w")doJump();if(e.key==="ArrowUp")doTrick("SPIN");if(e.key==="ArrowDown")doTrick("FLIP");}
    function keyup(e){if(e.key==="ArrowLeft"||e.key==="a")keys.left=false;if(e.key==="ArrowRight"||e.key==="d")keys.right=false;}
    document.addEventListener("keydown",keydown);document.addEventListener("keyup",keyup);
    $$("[data-ski]",stage).forEach(b=>{const action=b.dataset.ski;const down=e=>{e.preventDefault();if(action==="left")keys.left=true;if(action==="right")keys.right=true;if(action==="jump")doJump();if(action==="trick")doTrick("SPIN");if(action==="flip")doTrick("FLIP");};const up=()=>{if(action==="left")keys.left=false;if(action==="right")keys.right=false;};b.addEventListener("pointerdown",down);b.addEventListener("pointerup",up);b.addEventListener("pointerleave",up);});
    const unlocked=()=>({basic:true,freestyle:score>=500,pro:score>=1500});
    $$("[data-ski-choice]",stage).forEach(b=>b.addEventListener("click",()=>{const choice=b.dataset.skiChoice;if(!unlocked()[choice]){resultEl.textContent="Earn more points in a run to unlock these skis.";return;}selectedSki=choice;$$("[data-ski-choice]",stage).forEach(x=>x.classList.toggle("selected",x===b));resultEl.textContent=`${skiStyles[choice].name} selected. Restart for a fresh run.`;}));
    reset();return()=>{cancelAnimationFrame(raf);document.removeEventListener("keydown",keydown);document.removeEventListener("keyup",keyup);};
  }

  loadUser();loadLeaderboard();
})();
