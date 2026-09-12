import * as THREE from 'three';
export function createPiece(type,color){
 const group=new THREE.Group();group.userData={type,color};
 const body=new THREE.MeshStandardMaterial({color:color==='w'?0xece3ce:0x26322e,roughness:.27,metalness:.24});
 const gold=new THREE.MeshStandardMaterial({color:0xc9a35a,roughness:.24,metalness:.74});
 const add=(geometry,mat,y=0)=>{const m=new THREE.Mesh(geometry,mat);m.position.y=y;m.castShadow=true;m.receiveShadow=true;group.add(m);return m;};
 const lathe=points=>new THREE.LatheGeometry(points.map(([r,y])=>new THREE.Vector2(r,y)),40);
 add(lathe([[0,0],[.29,0],[.32,.04],[.32,.10],[.29,.15],[.26,.17],[.24,.23],[.20,.26],[.16,.38],[.125,.58],[.18,.64],[.20,.68],[.18,.73],[0,.73]]),body);
 add(new THREE.TorusGeometry(.291,.017,8,40),gold,.13).rotation.x=Math.PI/2;
 const sphere=(radius,y,scale)=>{const m=add(new THREE.SphereGeometry(radius,28,20),body,y);if(scale)m.scale.set(...scale);return m;};
 if(type==='p'){sphere(.20,.83);group.scale.setScalar(.83);}
 if(type==='r'){
  add(new THREE.CylinderGeometry(.25,.19,.34,32),body,.84);
  add(new THREE.TorusGeometry(.236,.018,8,32),gold,1).rotation.x=Math.PI/2;
  for(let i=0;i<6;i++){const a=i*Math.PI/3;const m=add(new THREE.BoxGeometry(.115,.14,.13),body,1.06);m.position.x=Math.sin(a)*.19;m.position.z=Math.cos(a)*.19;m.rotation.y=a;}
 }
 if(type==='b'){
  sphere(.215,.94,[.8,1.45,.8]);sphere(.065,1.27);
  const slash=add(new THREE.BoxGeometry(.025,.26,.012),gold,1.02);slash.position.z=.16;slash.rotation.z=-.35;
  group.scale.y=1.05;
 }
 if(type==='q'){
  add(new THREE.CylinderGeometry(.23,.13,.23,32),body,.88);
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const m=add(new THREE.ConeGeometry(.065,.26,12),body,1.10);m.position.x=Math.sin(a)*.17;m.position.z=Math.cos(a)*.17;const bead=add(new THREE.SphereGeometry(.032,12,8),gold,1.25);bead.position.x=m.position.x;bead.position.z=m.position.z;}
  sphere(.08,1.08);group.scale.y=1.12;
 }
 if(type==='k'){
  sphere(.20,.91);add(new THREE.CylinderGeometry(.17,.21,.11,32),body,1.07);
  add(new THREE.BoxGeometry(.075,.37,.075),gold,1.29);add(new THREE.BoxGeometry(.27,.073,.075),gold,1.36);group.scale.y=1.12;
 }
 if(type==='n'){
  const shape=new THREE.Shape();const pts=[[-.22,0],[-.22,.28],[-.11,.47],[-.18,.64],[-.06,.60],[.01,.70],[.07,.60],[.25,.45],[.30,.29],[.22,.24],[.06,.32],[-.02,.22],[.13,0]];
  shape.moveTo(...pts[0]);pts.slice(1).forEach(p=>shape.lineTo(...p));shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:.20,bevelEnabled:true,bevelThickness:.04,bevelSize:.035,bevelSegments:3,steps:1});geo.translate(0,0,-.1);const horse=add(geo,body,.63);
  for(const z of [-.144,.144]){const eye=add(new THREE.SphereGeometry(.028,12,10),gold,1.1);eye.position.set(.105,1.1,z);}
  group.rotation.y=color==='w'?Math.PI/2:-Math.PI/2;
 }
 return group;
}
