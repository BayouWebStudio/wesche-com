import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {createPiece} from './pieces.js';
export const squarePosition=s=>new THREE.Vector3(s.charCodeAt(0)-97-3.5,.04,3.5-(Number(s[1])-1));
export function createWorld(canvas){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x111514);scene.fog=new THREE.Fog(0x111514,50,100);
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
 const camera=new THREE.PerspectiveCamera(37,1,.1,100);const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.08;controls.enablePan=false;controls.minDistance=10;controls.maxDistance=60;controls.minPolarAngle=.08;controls.maxPolarAngle=Math.PI*.47;controls.target.set(0,0,0);
 const warm=new THREE.DirectionalLight(0xffe0ab,4.3);warm.position.set(-5,12,7);warm.castShadow=true;warm.shadow.mapSize.set(2048,2048);Object.assign(warm.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:35});warm.shadow.normalBias=.035;warm.shadow.bias=-.0001;scene.add(warm);
 const fill=new THREE.DirectionalLight(0xb8d9e4,2.3);fill.position.set(7,7,-7);scene.add(fill,new THREE.HemisphereLight(0xd6e5de,0x28271d,2));
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x171c19,roughness:.85}));floor.rotation.x=-Math.PI/2;floor.position.y=-.68;floor.receiveShadow=true;scene.add(floor);
 const edgeMat=new THREE.MeshStandardMaterial({color:0x252721,roughness:.28,metalness:.5});
 const base=new THREE.Mesh(new THREE.BoxGeometry(8.85,.48,8.85),edgeMat);base.position.y=-.30;base.castShadow=true;base.receiveShadow=true;scene.add(base);
 const gold=new THREE.MeshStandardMaterial({color:0xbc9751,roughness:.3,metalness:.65});
 for(const y of [-.12,-.48]){const m=new THREE.Mesh(new THREE.BoxGeometry(8.91,.035,8.91),gold);m.position.y=y;scene.add(m);}
 const rim=new THREE.Mesh(new THREE.BoxGeometry(8.7,.12,8.7),edgeMat);rim.position.y=-.025;scene.add(rim);
 function marble(light){const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.fillStyle=light?'#d9d2bd':'#283b34';x.fillRect(0,0,512,512);for(let i=0;i<55;i++){x.beginPath();const offset=i*19-240;for(let t=0;t<540;t+=4){const yy=offset+t*.7+Math.sin(t*.012+i)*18+Math.sin(t*.042+i*.7)*6;if(t===0)x.moveTo(t,yy);else x.lineTo(t,yy);}x.strokeStyle=light?'rgba(85,75,54,.09)':'rgba(193,213,177,.09)';x.lineWidth=i%6===0?2.4:.6;x.stroke();}const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;}
 const materials=[false,true].map(light=>new THREE.MeshStandardMaterial({map:marble(light),roughness:.34,metalness:.08}));
 const tiles=[];const tileGeo=new THREE.BoxGeometry(.994,.075,.994);
 for(let rank=0;rank<8;rank++)for(let file=0;file<8;file++){const tile=new THREE.Mesh(tileGeo,materials[(file+rank)%2]);tile.position.set(file-3.5,0,3.5-rank);tile.receiveShadow=true;tile.userData.square=String.fromCharCode(97+file)+(rank+1);scene.add(tile);tiles.push(tile);}
 function letter(text,x,z){const c=document.createElement('canvas');c.width=128;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#c4ad79';ctx.font='48px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,64,64);const tex=new THREE.CanvasTexture(c);const m=new THREE.Mesh(new THREE.PlaneGeometry(.3,.3),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(x,.049,z);scene.add(m);}
 for(let i=0;i<8;i++){letter('abcdefgh'[i],i-3.5,4.19);letter(String(i+1),-4.19,3.5-i);}
 const pieces=new Map();let marks=[];
 function clearPieces(){for(const obj of pieces.values())scene.remove(obj);pieces.clear();}
 function addPiece(type,color,square){const obj=createPiece(type,color);obj.position.copy(squarePosition(square));obj.userData.square=square;scene.add(obj);pieces.set(square,obj);return obj;}
 function sync(board){clearPieces();for(const row of board)for(const p of row)if(p)addPiece(p.type,p.color,p.square);}
 function highlight(squares){for(const m of marks){scene.remove(m);m.geometry.dispose();m.material.dispose();}marks=squares.map((s,i)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(.94,.94),new THREE.MeshBasicMaterial({color:i<2?0xd5b46d:0x8ed4b1,transparent:true,opacity:.25,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.copy(squarePosition(s));m.position.y=.045;scene.add(m);return m;});}
 function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
 function view(top=false){const mobile=innerWidth<650;camera.position.copy(top?new THREE.Vector3(0,19,.01):new THREE.Vector3(mobile?11:11,mobile?15:12,mobile?16:13));camera.position.multiplyScalar(Math.max(1,.86/(innerWidth/innerHeight)));controls.target.set(0,0,0);controls.update();}
 resize();view();addEventListener('resize',resize);
 return {scene,camera,renderer,controls,pieces,tiles,sync,addPiece,highlight,view,render(){controls.update();renderer.render(scene,camera);}};
}
