import * as THREE from 'three';
import {Chess} from './vendor/chess.js';
import {createCaptureFX} from './capture-fx.js';
import {createWorld,squarePosition} from './world.js';
const DEMO='e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#'.split(' ');
const $=id=>document.getElementById(id),game=new Chess(),world=createWorld($('scene'));
const map=$('map'),ctx=map.getContext('2d'),ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
let index=0,playing=false,busy=null,nextAt=0,speed=1,top=false,selected=null,manual=false,lastSquares=[];
const fx=createCaptureFX(world.scene);
world.sync(game.board());
function ui(){
 $('play').innerHTML=playing?'Pause demo <span>Ⅱ</span>':'Play demo <span>▶</span>';
 $('ply').textContent=String(game.history().length).padStart(2,'0')+' / '+(manual?'FREE':DEMO.length);
 $('turn').textContent=game.isCheckmate()?'CHECKMATE':(game.turn()==='w'?'WHITE':'BLACK')+' TO MOVE';
 const hist=game.history();$('move').textContent=hist.length?hist[hist.length-1]:'Your move.';
 $('move-label').textContent=manual?'FREE PLAY':hist.length?'MOVE '+Math.ceil(hist.length/2)+' · '+(hist.length%2?'WHITE':'BLACK'):'OPENING POSITION';
 $('status').textContent=game.isCheckmate()?'Checkmate. The Opera Game’s final act.':game.isDraw()?'Draw.':game.isCheck()?'Check. The king must respond.':manual?'Local free play · no AI connected.':playing?'Historical replay · 1858.':'Play the demo or move a piece.';
 $('back').disabled=!!busy||index===0||manual;$('next').disabled=!!busy||index>=DEMO.length||manual;
}
function seek(n){fx.clear();playing=false;busy=null;manual=false;selected=null;game.reset();for(let i=0;i<n;i++)game.move(DEMO[i]);index=n;world.sync(game.board());const hist=game.history({verbose:true});lastSquares=hist.length?[hist.at(-1).from,hist.at(-1).to]:[];world.highlight(lastSquares);$('white-name').textContent='Paul Morphy';$('black-name').textContent='Duke & Count';ui();}
function animateMove(input,isDemo=true){
 if(busy)return false;
 let move;try{move=game.move(input);}catch{return false;}if(!move)return false;
 const moving=world.pieces.get(move.from);if(!moving)throw Error('Missing moving piece');
 const capturedSquare=move.flags.includes('e')?move.to[0]+move.from[1]:move.to;
 const victim=world.pieces.get(capturedSquare);const transitions=[{obj:moving,from:moving.position.clone(),to:squarePosition(move.to),old:move.from,square:move.to}];
 if(move.flags.includes('k')||move.flags.includes('q')){const side=move.flags.includes('k');const old=(side?'h':'a')+move.from[1],square=(side?'f':'d')+move.from[1],obj=world.pieces.get(old);transitions.push({obj,from:obj.position.clone(),to:squarePosition(square),old,square});}
 lastSquares=[move.from,move.to];world.highlight(lastSquares);selected=null;
 busy={start:performance.now(),duration:matchMedia('(prefers-reduced-motion: reduce)').matches?80:(victim?1250:850)/speed,transitions,victim,capturedSquare,move,isDemo};ui();return true;
}
function finishMove(a){
 if(a.victim){world.scene.remove(a.victim);world.pieces.delete(a.capturedSquare);}
 for(const t of a.transitions){world.pieces.delete(t.old);t.obj.position.copy(t.to);t.obj.userData.square=t.square;world.pieces.set(t.square,t.obj);}
 if(a.move.promotion){world.scene.remove(world.pieces.get(a.move.to));world.pieces.delete(a.move.to);world.addPiece(a.move.promotion,a.move.color,a.move.to);}
 if(a.isDemo)index++;busy=null;nextAt=performance.now()+700/speed;if(index===DEMO.length||game.isGameOver())playing=false;ui();
}
const glyph={p:'♟',r:'♜',n:'♞',b:'♝',q:'♛',k:'♚'};
function drawMap(){
 const cell=60;ctx.clearRect(0,0,480,480);
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){ctx.fillStyle=(x+y)%2?'#3b5147':'#d9d1b9';ctx.fillRect(x*cell,y*cell,cell,cell);}
 for(const s of lastSquares){const p=squarePosition(s);ctx.fillStyle='#dfa94366';ctx.fillRect((p.x+3.5)*cell,(p.z+3.5)*cell,cell,cell);}
 ctx.font='48px Georgia, serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
 for(const obj of world.pieces.values()){
  const x=(obj.position.x+4)*cell,y=(obj.position.z+4)*cell;
  ctx.globalAlpha=obj.userData.alpha??1;ctx.strokeStyle=obj.userData.color==='w'?'#443e32':'#d0c6a5';ctx.lineWidth=2.4;ctx.fillStyle=obj.userData.color==='w'?'#fff5de':'#17261e';ctx.strokeText(glyph[obj.userData.type],x,y+2);ctx.fillText(glyph[obj.userData.type],x,y+2);
 }ctx.globalAlpha=1;
}
$('play').onclick=()=>{if(manual||index===DEMO.length)seek(0);playing=!playing;nextAt=performance.now();ui();};
$('next').onclick=()=>{playing=false;if(index<DEMO.length)animateMove(DEMO[index]);};
$('back').onclick=()=>{if(!busy)seek(Math.max(0,index-1));};$('reset').onclick=()=>seek(0);
$('speed').onchange=e=>{speed=Number(e.target.value);};
$('camera').onclick=()=>{top=!top;world.view(top);$('camera').textContent=top?'Orbit view':'Top view';};
$('export').onclick=()=>{const blob=new Blob([game.pgn()],{type:'application/x-chess-pgn'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='gambit-preview.pgn';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
let down=null;const canvas=$('scene');canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
canvas.addEventListener('pointerup',e=>{
 if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6||busy){down=null;return;}down=null;
 pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);ray.setFromCamera(pointer,world.camera);
 const objects=[...world.tiles,...world.pieces.values()];const hit=ray.intersectObjects(objects,true)[0];if(!hit)return;
 let obj=hit.object;while(!obj.userData.square&&obj.parent)obj=obj.parent;const square=obj.userData.square;if(!square)return;
 if(selected){const from=selected;if(animateMove({from,to:square,promotion:'q'},false)){manual=true;playing=false;$('white-name').textContent='You · White';$('black-name').textContent='You · Black';ui();return;}}
 const piece=game.get(square);selected=piece?.color===game.turn()?square:null;
 world.highlight(selected?[selected,...game.moves({square:selected,verbose:true}).map(m=>m.to)]:lastSquares);
});
addEventListener('keydown',e=>{if(['SELECT','INPUT','BUTTON'].includes(document.activeElement.tagName))return;if(e.code==='Space'){e.preventDefault();$('play').click();}if(e.code==='ArrowRight')$('next').click();if(e.code==='ArrowLeft')$('back').click();});
function frame(now){
 if(busy){
  const a=busy,t=Math.min(1,(now-a.start)/a.duration),travel=a.victim?Math.min(1,t/.62):t,ease=travel*travel*(3-2*travel);
  for(const tr of a.transitions){tr.obj.position.lerpVectors(tr.from,tr.to,ease);tr.obj.position.y+=Math.sin(travel*Math.PI)*(a.victim?.48:a.move.piece==='n'?.65:.18);if(a.victim&&t>.62)tr.obj.position.y+=Math.sin((t-.62)/.38*Math.PI)*.12;}
  if(a.victim&&t>=.62&&!a.impacted){a.impacted=true;fx.smash(a.victim,now);a.victim.visible=false;a.victim.userData.alpha=0;}
  if(t>=1)finishMove(a);
 }

 if(playing&&!busy&&now>=nextAt&&index<DEMO.length)animateMove(DEMO[index]);
 world.render(fx.update(now));drawMap();requestAnimationFrame(frame);
}
window.chessPreview={seek,move:input=>{manual=true;playing=false;return animateMove(input,false);},snapshot:()=>({fen:game.fen(),index,playing,busy:!!busy,checkmate:game.isCheckmate(),pieces:world.pieces.size,moves:game.history(),positions:[...world.pieces.values()].map(p=>[p.userData.square,p.position.x,p.position.y,p.position.z]),fx:fx.stats(),connectedModels:0})};
ui();$('loading').remove();requestAnimationFrame(frame);
