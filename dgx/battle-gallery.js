const buttons=[...document.querySelectorAll('[data-mode]')];
const single=document.querySelector('#single');
const split=document.querySelector('#split');
const frame=document.querySelector('#single-frame');
const title=document.querySelector('#single-title');
const meta=document.querySelector('#single-meta');
const open=document.querySelector('#open');
const config=JSON.parse(document.querySelector('#battle-config').textContent);
function wakeEmbeddedScene(target){
  const wake=()=>setTimeout(()=>{try{target.contentDocument?.querySelector('#enter')?.click()}catch(_){}},120);
  target.addEventListener('load',wake,{once:true});
  if(target.contentDocument?.readyState==='complete')wake();
}
function setMode(mode){
  buttons.forEach(button=>button.classList.toggle('active',button.dataset.mode===mode));
  if(mode==='split'){
    single.classList.add('off');
    split.classList.add('on');
    split.querySelectorAll('iframe').forEach(item=>{
      if(!item.src){item.src=item.dataset.src;wakeEmbeddedScene(item)}
    });
    open.href=config.glm.file;
    open.textContent='Open GLM full-screen ↗';
    return;
  }
  split.classList.remove('on');
  single.classList.remove('off');
  const selected=config[mode];
  frame.src=selected.file;
  title.textContent=selected.title;
  meta.textContent=selected.meta;
  open.href=selected.file;
  open.textContent=`Open ${selected.short} full-screen ↗`;
  wakeEmbeddedScene(frame);
}
buttons.forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.mode)));
wakeEmbeddedScene(frame);
