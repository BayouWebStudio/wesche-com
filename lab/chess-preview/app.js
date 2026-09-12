import * as THREE from 'three';
import {Chess} from './vendor/chess.js';
import {createCaptureFX} from './capture-fx.js';
import {createWorld,squarePosition} from './world.js';
import {Ops} from './model-match.js';

/* ------------------------------------------------------------------ *
 * Gambit — chess arena preview
 *
 * Two modes, one board, one rules engine (vendor/chess.js is the single
 * source of truth; the 3D scene, the 2D inset, the move list and the
 * highlights are all derived from it).
 *
 *   DEMO  : the 1858 Opera Game, hard-coded, explicitly historical.
 *   MATCH : an arbitrary model game loaded from a validated match record
 *           (schema_version 1) via chessPreview.loadMatch / file input.
 *
 * No model is ever contacted from this page. `connectedModels` is 0.
 * ------------------------------------------------------------------ */

const DEMO='e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#'.split(' ');
const DEMO_META={id:'opera-1858',white:{name:'Paul Morphy',model:''},black:{name:'Duke & Count',model:''},note:'1858 · The Opera Game',provenance:'Historical replay. Not AI gameplay.',result:'1-0',termination:'checkmate'};

const $=id=>document.getElementById(id),game=new Chess(),world=createWorld($('scene'));
const map=$('map'),ctx=map.getContext('2d'),ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
let index=0,playing=false,busy=null,nextAt=0,speed=1,top=false,selected=null,manual=false,lastSquares=[];

/* Active game definition. DEMO to start; swapped wholesale by loadMatch. */
let active={
  kind:'demo',
  id:DEMO_META.id,
  initialFen:null,          /* null => standard start */
  moves:DEMO.slice(),
  meta:DEMO_META,
  label:'demo',
  match:null,               /* the validated record, when kind === 'match' */
};

const fx=createCaptureFX(world.scene);
world.sync(game.board());

function resetToInitial(){
  if(active.initialFen)game.load(active.initialFen,{skipValidation:false});
  else game.reset();
}

/* ---------------- UI projection (pure render of current state) ----- */

function ui(){
  $('play').innerHTML=playing?'Pause replay <span>Ⅱ</span>':'Play replay <span>▶</span>';
  const total=active.moves.length;
  $('ply').textContent=String(index).padStart(2,'0')+' / '+String(total).padStart(2,'0');
  $('turn').textContent=game.isCheckmate()?'CHECKMATE':game.isDraw()?'DRAW':(game.turn()==='w'?'WHITE':'BLACK')+' TO MOVE';
  const hist=game.history();$('move').textContent=hist.length?hist[hist.length-1]:'Your move.';
  $('move-label').textContent=manual?'FREE PLAY':hist.length?'MOVE '+Math.ceil(hist.length/2)+' · '+(hist.length%2?'WHITE':'BLACK'):'OPENING POSITION';
  $('status').textContent=statusLine();
  $('back').disabled=!!busy||index===0||manual;
  $('next').disabled=!!busy||index>=total||manual;
  $('white-name').textContent=active.meta.white.name+playingTag(active.meta.white.model);
  $('black-name').textContent=active.meta.black.name+playingTag(active.meta.black.model);
  $('demo-note').innerHTML='';
  const lines=[active.meta.note||'',active.meta.provenance||''].filter(Boolean);
  for(const line of lines){const b=document.createElement('span');b.textContent=line;$('demo-note').appendChild(b);}
  document.body.dataset.mode=active.kind;
  $('badge').textContent=active.label;
  $('badge').hidden=active.kind==='demo';
}

function playingTag(model){return model?' · '+model:'';}

function statusLine(){
  const term=active.match&&active.match.termination;
  if(manual)return 'Local free play · no AI connected.';
  if(game.isCheckmate())return active.kind==='demo'?'Checkmate. The Opera Game’s final act.':'Checkmate'+(term?' ('+term+')':'')+'.';
  if(game.isStalemate())return 'Stalemate. No legal moves; the game is drawn.';
  if(game.isInsufficientMaterial())return 'Insufficient material. Draw.';
  if(game.isThreefoldRepetition())return 'Threefold repetition. Draw.';
  if(game.isDraw())return 'Draw.';
  if(game.isCheck())return 'Check. The king must respond.';
  return playing?'Replay in progress.':'Press play, or step through the game.';
}

/* ---------------- Seeking / stepping ------------------------------ */

function seek(n){
  fx.clear();playing=false;busy=null;manual=false;selected=null;
  resetToInitial();
  n=Math.max(0,Math.min(n,active.moves.length));
  for(let i=0;i<n;i++){
    let ok=false;
    try{ok=!!game.move(active.moves[i]);}catch(err){ok=false;}
    if(!ok)throw new Error('seek(): illegal move at ply '+(i+1)+': '+active.moves[i]);
  }
  index=n;world.sync(game.board());
  const hist=game.history({verbose:true});
  lastSquares=hist.length?[hist.at(-1).from,hist.at(-1).to]:[];
  world.highlight(lastSquares);ui();
}

function applyPosition(fen){
  /* Hard-set the scene to an arbitrary legal position (used by the
     exporter's fixed-step path and by loadMatch validation). */
  fx.clear();playing=false;busy=null;selected=null;
  game.load(fen);
  world.sync(game.board());
  lastSquares=[];world.highlight(lastSquares);ui();
}

function animateMove(input,isReplay=true){
  if(busy)return false;
  let move;
  try{move=game.move(input);}catch(err){return false;}
  if(!move)return false;
  const moving=world.pieces.get(move.from);
  if(!moving)throw Error('Missing moving piece at '+move.from);
  const capturedSquare=move.flags.includes('e')?move.to[0]+move.from[1]:move.to;
  const victim=world.pieces.get(capturedSquare);
  const transitions=[{obj:moving,from:moving.position.clone(),to:squarePosition(move.to),old:move.from,square:move.to}];
  if(move.flags.includes('k')||move.flags.includes('q')){
    const side=move.flags.includes('k');const old=(side?'h':'a')+move.from[1],sq=(side?'f':'d')+move.from[1],obj=world.pieces.get(old);
    if(obj)transitions.push({obj,from:obj.position.clone(),to:squarePosition(sq),old,square:sq});
  }
  lastSquares=[move.from,move.to];world.highlight(lastSquares);selected=null;
  busy={start:performance.now(),duration:matchMedia('(prefers-reduced-motion: reduce)').matches?80:(victim?1250:850)/speed,transitions,victim,capturedSquare,move,isReplay};
  ui();return true;
}

function finishMove(a){
  if(a.victim){world.scene.remove(a.victim);world.pieces.delete(a.capturedSquare);}
  for(const t of a.transitions){world.pieces.delete(t.old);t.obj.position.copy(t.to);t.obj.userData.square=t.square;world.pieces.set(t.square,t.obj);}
  if(a.move.promotion){world.scene.remove(world.pieces.get(a.move.to));world.pieces.delete(a.move.to);world.addPiece(a.move.promotion,a.move.color,a.move.to);}
  if(a.isReplay)index++;
  busy=null;nextAt=performance.now()+700/speed;
  if(index>=active.moves.length||game.isGameOver())playing=false;
  ui();
}

/* ---------------- 2D inset ---------------------------------------- */

const glyph={p:'♟',r:'♜',n:'♞',b:'♝',q:'♛',k:'♚'};
function drawMap(){
  const cell=60;ctx.clearRect(0,0,480,480);
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){ctx.fillStyle=(x+y)%2?'#3b5147':'#d9d1b9';ctx.fillRect(x*cell,y*cell,cell,cell);}
  for(const s of lastSquares){const p=squarePosition(s);ctx.fillStyle='#dfa94366';ctx.fillRect((p.x+3.5)*cell,(p.z+3.5)*cell,cell,cell);}
  ctx.font='48px Georgia, serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
  for(const obj of world.pieces.values()){
    const x=(obj.position.x+4)*cell,y=(obj.position.z+4)*cell;
    ctx.globalAlpha=obj.userData.alpha??1;
    ctx.strokeStyle=obj.userData.color==='w'?'#443e32':'#d0c6a5';ctx.lineWidth=2.4;
    ctx.fillStyle=obj.userData.color==='w'?'#fff5de':'#17261e';
    ctx.strokeText(glyph[obj.userData.type],x,y+2);ctx.fillText(glyph[obj.userData.type],x,y+2);
  }
  ctx.globalAlpha=1;
}

/* ---------------- Controls ---------------------------------------- */

$('play').onclick=()=>{
  if(manual||index>=active.moves.length)seek(0);
  playing=!playing;nextAt=performance.now();ui();
};
$('next').onclick=()=>{playing=false;if(index<active.moves.length)animateMove(active.moves[index]);};
$('back').onclick=()=>{if(!busy)seek(Math.max(0,index-1));};
$('reset').onclick=()=>seek(0);
$('speed').onchange=e=>{speed=Number(e.target.value);};
$('camera').onclick=()=>{top=!top;world.view(top);$('camera').textContent=top?'Orbit view':'Top view';};
$('export').onclick=()=>{
  const pgn=game.pgn();
  const blob=new Blob([pgn],{type:'application/x-chess-pgn'});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=(active.id||'game')+'.pgn';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};

/* ---------------- Model match loader ------------------------------ */

/* Every failure path below throws an Error. We surface the message into the
   status line and return null. Nothing from the record reaches innerHTML —
   all record-derived text goes through textContent / value assignment. */
function loadMatch(record,opts={}){
  const parsed=Ops.validate(record);
  if(!Ops.ok(parsed)){
    const msg=Ops.errorText(parsed);
    $('status').textContent='Match load failed: '+msg;
    $('status').dataset.error='true';
    return null;
  }
  const {moves,meta,fens}=Ops.project(parsed.value);
  /* Replay once with a throwaway engine to be sure the sequence is legal
     from initial_fen in the real app engine before we touch the scene. */
  const probe=new Chess();
  try{if(parsed.value.initial_fen)probe.load(parsed.value.initial_fen);}catch(e){$('status').textContent='Match load failed: invalid initial position';return null;}
  for(let i=0;i<moves.length;i++){
    let ok=false;
    try{const row=parsed.value.moves[i];if(row.fen_before&&new Chess(row.fen_before).fen()!==probe.fen())throw Error('FEN before mismatch');const moved=probe.move(moves[i]);ok=!!moved;if(row.fen_after&&new Chess(row.fen_after).fen()!==probe.fen())throw Error('FEN after mismatch');if(row.san&&row.san!==moved.san)throw Error('SAN mismatch');}catch(err){ok=false;}
    if(!ok){
      $('status').textContent='Match load failed: illegal move at ply '+parsed.value.moves[i].ply+' ('+moves[i]+').';
      $('status').dataset.error='true';
      return null;
    }
  }
  if(parsed.value.status==='completed'&&parsed.value.termination==='checkmate'&&(!probe.isCheckmate()||parsed.value.result!==(probe.turn()==='w'?'0-1':'1-0'))){$('status').textContent='Match load failed: result does not match board';return null;}
  active={
    kind:'match',
    id:parsed.value.id,
    initialFen:parsed.value.initial_fen,
    moves,
    meta,
    label:opsLabel(parsed.value),
    match:{...parsed.value,fens},
  };
  delete $('status').dataset.error;
  seek(moves.length&&opts.end!=='start'?0:0);
  return {id:active.id,total:moves.length,label:active.label,result:parsed.value.result,termination:parsed.value.termination};
}

function opsLabel(rec){
  const tags=[];
  if(rec.test||rec.fixture)tags.push('TEST FIXTURE');
  if(rec.incomplete||rec.status==='incomplete'||rec.status==='aborted')tags.push('INCOMPLETE');
  if(rec.status)tags.push(String(rec.status).toUpperCase());
  tags.push(rec.result==='*'?'NO RESULT':rec.result);
  return tags.join(' · ');
}

/* Local file input. FileReader text -> JSON.parse -> loadMatch.
   No fetch, no network, nothing rendered as HTML. */
async function loadMatchFile(file){
  try{
    const text=await file.text();
    let record;
    try{record=JSON.parse(text);}catch(err){throw new Error('not valid JSON ('+err.message+')');}
    const res=loadMatch(record);
    if(res)$('status').textContent='Loaded '+(res.label||res.id)+' — '+res.total+' plies.';
    return res;
  }catch(err){
    $('status').textContent='Match load failed: '+String(err.message||err);
    $('status').dataset.error='true';
    return null;
  }
}

const fileInput=$('match-file');
if(fileInput){
  fileInput.addEventListener('change',e=>{
    const file=e.target.files&&e.target.files[0];
    if(file)loadMatchFile(file);
    e.target.value='';
  });
}

/* ---------------- Board interaction ------------------------------- */

let down=null;const canvas=$('scene');
canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
canvas.addEventListener('pointerup',e=>{
  if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6||busy){down=null;return;}
  down=null;
  pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);
  ray.setFromCamera(pointer,world.camera);
  const objects=[...world.tiles,...world.pieces.values()];const hit=ray.intersectObjects(objects,true)[0];
  if(!hit)return;
  let obj=hit.object;while(!obj.userData.square&&obj.parent)obj=obj.parent;
  const square=obj.userData.square;if(!square)return;
  if(selected){
    const from=selected;
    if(animateMove({from,to:square,promotion:'q'},false)){
      manual=true;playing=false;
      $('white-name').textContent='You · White';$('black-name').textContent='You · Black';
      ui();return;
    }
  }
  const piece=game.get(square);
  selected=piece?.color===game.turn()?square:null;
  world.highlight(selected?[selected,...game.moves({square:selected,verbose:true}).map(m=>m.to)]:lastSquares);
});
addEventListener('keydown',e=>{
  if(['SELECT','INPUT','BUTTON'].includes(document.activeElement.tagName))return;
  if(e.code==='Space'){e.preventDefault();$('play').click();}
  if(e.code==='ArrowRight')$('next').click();
  if(e.code==='ArrowLeft')$('back').click();
});

/* ---------------- Frame loop -------------------------------------- */

function frame(now){
  if(busy){
    const a=busy,t=Math.min(1,(now-a.start)/a.duration),travel=a.victim?Math.min(1,t/.62):t,ease=travel*travel*(3-2*travel);
    for(const tr of a.transitions){
      tr.obj.position.lerpVectors(tr.from,tr.to,ease);
      tr.obj.position.y+=Math.sin(travel*Math.PI)*(a.victim?.48:a.move.piece==='n'?.65:.18);
      if(a.victim&&t>.62)tr.obj.position.y+=Math.sin((t-.62)/.38*Math.PI)*.12;
    }
    if(a.victim&&t>=.62&&!a.impacted){a.impacted=true;fx.smash(a.victim,now);a.victim.visible=false;a.victim.userData.alpha=0;}
    if(t>=1)finishMove(a);
  }
  if(playing&&!busy&&now>=nextAt&&index<active.moves.length)animateMove(active.moves[index]);
  const offset=fx.update(now);if(window.chessPreview.renderEnabled!==false){world.render(offset);drawMap();}requestAnimationFrame(frame);
}

/* ---------------- Public API -------------------------------------- */

window.chessPreview={
  seek,
  loadMatch,
  loadMatchFile,
  /* position/fen may be given; `fen` wins. Returns false when it cannot. */
  move:input=>{manual=true;playing=false;return animateMove(input,false);},
  applyPosition,
  mode:()=>active.kind,
  matchInfo:()=>({kind:active.kind,id:active.id,total:active.moves.length,label:active.label,
                meta:active.meta,result:active.match?active.match.result:(active.kind==='demo'?'1-0':null),
                termination:active.match?active.match.termination:(active.kind==='demo'?'checkmate':null),
                hasMatch:!!active.match}),
  fenAt:n=>{const probe=new Chess();if(active.initialFen)probe.load(active.initialFen);
            const upto=Math.max(0,Math.min(n,active.moves.length));
            for(let i=0;i<upto;i++)probe.move(active.moves[i]);return probe.fen();},
  snapshot:()=>({
    fen:game.fen(),index,total:active.moves.length,mode:active.kind,
    playing,busy:!!busy,checkmate:game.isCheckmate(),
    draw:game.isDraw(),gameOver:game.isGameOver(),
    pieces:world.pieces.size,moves:game.history(),
    positions:[...world.pieces.values()].map(p=>[p.userData.square,p.position.x,p.position.y,p.position.z]),
    fx:fx.stats(),connectedModels:0,
  }),
};

ui();$('loading').remove();requestAnimationFrame(frame);
