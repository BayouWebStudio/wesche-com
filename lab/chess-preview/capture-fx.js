import * as THREE from 'three';
export function createCaptureFX(scene){
 const bursts=[];let hits=0,lastHit=-100;const offset=new THREE.Vector3();
 const chunkGeo=new THREE.DodecahedronGeometry(1,0),sparkGeo=new THREE.SphereGeometry(1,6,4);
 const dustCanvas=document.createElement('canvas');dustCanvas.width=dustCanvas.height=64;const c=dustCanvas.getContext('2d'),g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,.7)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,64,64);const dustMap=new THREE.CanvasTexture(dustCanvas);
 function smash(piece,now){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const origin=piece.position.clone();origin.y=.18;const group=new THREE.Group(),parts=[];
  const stone=new THREE.MeshStandardMaterial({color:piece.userData.color==='w'?0xece3ce:0x354b40,roughness:.55,metalness:.13,transparent:true});
  const spark=new THREE.MeshBasicMaterial({color:0xffd891,transparent:true});
  for(let i=0;i<34;i++){
   const m=new THREE.Mesh(chunkGeo,stone);m.scale.set(.07+Math.random()*.12,.06+Math.random()*.15,.06+Math.random()*.12);m.position.copy(origin);m.position.y+=Math.random()*.85;m.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);m.castShadow=true;
   const a=Math.random()*Math.PI*2,v=.7+Math.random()*1.6;parts.push({m,start:m.position.clone(),velocity:new THREE.Vector3(Math.cos(a)*v,1.4+Math.random()*2.1,Math.sin(a)*v),spin:new THREE.Vector3(Math.random()*7,Math.random()*8,Math.random()*7)});group.add(m);
  }
  for(let i=0;i<24;i++){const m=new THREE.Mesh(sparkGeo,spark);m.scale.setScalar(.023+Math.random()*.025);m.position.copy(origin);m.position.y+=.35;const a=Math.random()*Math.PI*2;parts.push({m,start:m.position.clone(),velocity:new THREE.Vector3(Math.cos(a)*(1+Math.random()*2),1+Math.random()*3,Math.sin(a)*(1+Math.random()*2)),spin:new THREE.Vector3()});group.add(m);}
  const dust=[];for(let i=0;i<9;i++){const mat=new THREE.SpriteMaterial({map:dustMap,color:0xc9baa0,transparent:true,opacity:.23,depthWrite:false});const m=new THREE.Sprite(mat);m.position.copy(origin);m.position.y+=.1;const a=i/9*Math.PI*2;dust.push({m,a});group.add(m);}
  const ring=new THREE.Mesh(new THREE.RingGeometry(.35,.40,64),new THREE.MeshBasicMaterial({color:0xeac580,transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.copy(origin);ring.position.y=.085;group.add(ring);
  scene.add(group);bursts.push({group,parts,dust,ring,stone,spark,origin,start:now});lastHit=now;hits++;
 }
 function remove(b){scene.remove(b.group);b.stone.dispose();b.spark.dispose();b.ring.geometry.dispose();b.ring.material.dispose();for(const d of b.dust)d.m.material.dispose();}
 function clear(){bursts.forEach(remove);bursts.length=0;lastHit=-100;offset.set(0,0,0);}
 function update(now){
  for(let i=bursts.length-1;i>=0;i--){const b=bursts[i],t=(now-b.start)/1000;if(t>1.35){remove(b);bursts.splice(i,1);continue;}
   for(const p of b.parts){p.m.position.copy(p.start).addScaledVector(p.velocity,t);p.m.position.y=Math.max(.08,p.start.y+p.velocity.y*t-4.7*t*t);p.m.rotation.set(p.spin.x*t,p.spin.y*t,p.spin.z*t);}
   b.stone.opacity=Math.max(0,1-(t-.65)/.7);b.spark.opacity=Math.max(0,1-t/.8);
   for(const d of b.dust){d.m.position.set(b.origin.x+Math.cos(d.a)*t*.9,.2+t*.3,b.origin.z+Math.sin(d.a)*t*.9);d.m.scale.setScalar(.35+t*1.9);d.m.material.opacity=.23*Math.max(0,1-t/1.2);}
   b.ring.scale.setScalar(1+t*5);b.ring.material.opacity=.45*Math.max(0,1-t/.45);
  }
  const age=(now-lastHit)/1000,k=age>=0&&age<.35?.055*Math.exp(-age*10):0;offset.set(Math.sin(age*95)*k,Math.sin(age*73)*k*.65,0);return offset;
 }
 return {smash,update,clear,stats:()=>({bursts:bursts.length,hits})};
}
