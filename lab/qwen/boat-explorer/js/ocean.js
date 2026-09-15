// js/ocean.js — sunset ocean: Gerstner vertex displacement synced with waves.js
import * as THREE from 'three';
import { WAVES, WIND_DIR } from './waves.js';

const SUN_DIR = new THREE.Vector3(-0.62, 0.14, -0.77).normalize(); // low, near horizon
export { SUN_DIR };

const MAX_ISLANDS = 6;
const MAX_WAKE = 22;

export function makeSky() {
  const geo = new THREE.SphereGeometry(900, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      sunDir: { value: SUN_DIR },
    },
    vertexShader: `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 sunDir;
      void main(){
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 zenith   = vec3(0.16, 0.10, 0.30);
        vec3 mid      = vec3(0.55, 0.24, 0.38);
        vec3 horizon  = vec3(1.00, 0.55, 0.28);
        vec3 col = mix(mid, zenith, smoothstep(0.14, 0.75, h));
        col = mix(horizon, col, smoothstep(0.0, 0.22, h));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        col += vec3(1.0, 0.72, 0.42) * pow(s, 28.0) * 0.55;   // wide glow
        col += vec3(1.0, 0.85, 0.60) * pow(s, 220.0) * 1.4;    // sun disc halo
        float below = smoothstep(0.0, -0.05, vDir.y);
        col = mix(col, vec3(1.0,0.5,0.26), below);
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = -10;
  return m;
}

export function makeSunSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(128,128,4, 128,128,126);
  rg.addColorStop(0, 'rgba(255,244,214,1)');
  rg.addColorStop(0.14, 'rgba(255,208,140,0.85)');
  rg.addColorStop(0.4, 'rgba(255,140,60,0.28)');
  rg.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = rg; g.fillRect(0,0,256,256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, fog: false, opacity: 0.95 });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(120, 120, 1);
  sp.position.copy(SUN_DIR).multiplyScalar(820);
  sp.frustumCulled = false;
  sp.renderOrder = -9;
  return sp;
}

export function makeOcean() {
  const SIZE = 260, SEG = 150;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);

  const waveDirs = WAVES.map(w => new THREE.Vector2(w[0], w[1]));
  const waveK = WAVES.map(w => (Math.PI * 2) / w[3]);
  const waveA = WAVES.map(w => w[2] / ((Math.PI * 2) / w[3]));
  const waveC = WAVES.map(w => Math.sqrt(9.81 / ((Math.PI * 2) / w[3])) * w[4]);

  const mat = new THREE.ShaderMaterial({
    fog: false, transparent: false,
    uniforms: {
      uTime:        { value: 0 },
      uWaveDir:     { value: waveDirs },
      uWaveK:       { value: waveK },
      uWaveA:       { value: waveA },
      uWaveC:       { value: waveC },
      uCamPos:      { value: new THREE.Vector3() },
      uSunDir:      { value: SUN_DIR },
      uIslands:     { value: Array.from({length: MAX_ISLANDS}, () => new THREE.Vector4(0,0,1e9,1e9+1)) },
      uIslCount:    { value: 0 },
      uWake:        { value: Array.from({length: MAX_WAKE}, () => new THREE.Vector4(0,0,0,0)) },
      uWakeCount:   { value: 0 },
    },
    vertexShader: `
      uniform float uTime;
      uniform vec2 uWaveDir[${WAVES.length}];
      uniform float uWaveK[${WAVES.length}];
      uniform float uWaveA[${WAVES.length}];
      uniform float uWaveC[${WAVES.length}];
      uniform vec4 uIslands[${MAX_ISLANDS}];
      uniform int uIslCount;
      uniform vec4 uWake[${MAX_WAKE}];
      uniform int uWakeCount;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vFoam;
      varying float vJacobian;

      float shelter(vec2 p){
        float s = 1.0;
        for(int i=0;i<${MAX_ISLANDS};i++){
          if(i>=uIslCount) break;
          vec4 I = uIslands[i];
          float d = distance(p, I.xy);
          float sh = smoothstep(I.z, I.w, d);   // 0 inside R1 pool .. 1 open sea
          s = min(s, sh);
        }
        return s;
      }

      void main(){
        vec3 p = position;
        vec2 wp = p.xz + (modelMatrix[3].xz);
        float amp = 0.05 + 0.95 * shelter(wp);
        float j = 1.0, sx = 0.0, sz = 0.0;
        for(int i=0;i<${WAVES.length};i++){
          float k = uWaveK[i]; float a = uWaveA[i]*amp; float c = uWaveC[i];
          float f = k * (dot(uWaveDir[i], wp) - c*uTime);
          float sf = sin(f), cf = cos(f);
          p.y += a*sf;
          p.xz += a*uWaveDir[i]*cf;
          j    -= k*a*cf;
          sx   += a*k*cf*uWaveDir[i].x;
          sz   += a*k*cf*uWaveDir[i].y;
        }
        // wake foam injection bumps tiny crests behind boat
        for(int i=0;i<${MAX_WAKE};i++){
          if(i>=uWakeCount) break;
          vec4 w = uWake[i];
          float d = distance(wp, w.xy);
          if(d < w.z){
            float fall = smoothstep(w.z, 0.0, d);
            p.y += sin(d*2.2 - uTime*6.0)*0.05*w.w*fall;
          }
        }
        vJacobian = j;
        vWorld = (modelMatrix * vec4(p,1.0)).xyz;
        vNormal = normalize(vec3(-sx, 1.0, -sz));
        gl_Position = projectionMatrix * viewMatrix * vec4(vWorld,1.0);
      }`,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform vec3 uCamPos;
      uniform vec3 uSunDir;
      uniform vec4 uIslands[${MAX_ISLANDS}];
      uniform int uIslCount;
      uniform vec4 uWake[${MAX_WAKE}];
      uniform int uWakeCount;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vJacobian;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }

      void main(){
        vec3 N = normalize(vNormal);
        vec3 V = normalize(uCamPos - vWorld);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        fres = clamp(fres, 0.0, 1.0);

        vec3 deep    = vec3(0.043, 0.145, 0.200);
        vec3 shallow = vec3(0.10, 0.34, 0.36);
        vec3 skyHori = vec3(1.00, 0.56, 0.30);
        vec3 skyMid  = vec3(0.62, 0.30, 0.42);

        vec3 col = mix(deep, shallow, clamp(vWorld.y*0.35+0.5, 0.0, 1.0));
        vec3 refl = mix(skyMid, skyHori, smoothstep(0.0, 0.4, fres + vWorld.y*0.002));
        col = mix(col, refl, 0.30 + 0.62*fres);

        // sun glitter road
        vec3 R = reflect(-V, N);
        float sdot = max(dot(R, uSunDir), 0.0);
        float glitter = pow(sdot, 150.0)*1.5 + pow(sdot, 24.0)*0.55;
        // organic sparkle: noise on the wave surface, not a screen grid
        float sparkle = hash(floor(vWorld.xz*0.85) + floor(vWorld.xz*0.33) + vec2(uTime*5.0, -uTime*3.7));
        glitter *= (0.35 + 1.1*pow(sparkle, 2.0));
        col += vec3(1.0, 0.74, 0.40) * glitter;

        // crest foam from Gerstner Jacobian (range ~0.69..1.31 -> foam the sharpest crests)
        float crest = smoothstep(0.80, 0.70, vJacobian);
        // shore shelter
        float shoreR = 1e9; int shored = -1;
        for(int i=0;i<${MAX_ISLANDS};i++){
          if(i>=uIslCount) break;
          float d = distance(vWorld.xz, uIslands[i].xy);
          if(d < uIslands[i].w){ float r = d - uIslands[i].z; if(abs(r)<abs(shoreR)){ shoreR=r; shored=i; } }
        }
        float foam = crest * 0.85;
        if(shored >= 0){
          float sr = shoreR;
          // breaking shore surf: noise-torn foam rolling inward
          float band = sin(sr*1.3 - uTime*2.2 + hash(floor(vWorld.xz*0.7))*1.8);
          float surf = smoothstep(1.9, -0.5, sr) * smoothstep(0.25, 0.85, band);
          surf *= smoothstep(-1.0, 0.4, sr);           // fade below the sandline
          foam = clamp(foam + surf, 0.0, 1.0);
          col = mix(col, vec3(0.16,0.48,0.46), smoothstep(6.0, 1.2, sr)*0.5); // turquoise lagoon
        }
        // boat wake foam
        for(int i=0;i<${MAX_WAKE};i++){
          if(i>=uWakeCount) break;
          vec4 w = uWake[i];
          float d = distance(vWorld.xz, w.xy);
          if(d < w.z){
            float fall = smoothstep(w.z, 0.0, d);
            float sw = sin(d*2.4 - uTime*7.0)*0.5+0.5;
            foam = clamp(foam + fall*w.w*(0.55+0.45*sw), 0.0, 1.0);
          }
        }
        col = mix(col, vec3(0.96, 0.92, 0.86), foam*0.9);

        // distance fog to horizon color
        float dist = length(uCamPos - vWorld);
        float fog = 1.0 - exp(-pow(dist*0.0058, 2.0));
        col = mix(col, vec3(1.0, 0.62, 0.36), fog*0.9);
        col = mix(col, vec3(0.55, 0.32, 0.42), smoothstep(0.86,1.0,fog));

        gl_FragColor = vec4(col, 1.0);
      }`
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 0;
  mesh.userData.mat = mat;
  mesh.userData.SIZE = SIZE;

  mesh.userData.follow = (cam) => {
    // snap to keep the vertex lattice stable (reduces far-field crawl shimmer)
    const snap = 0.5;
    mesh.position.set(Math.round(cam.position.x/snap)*snap, 0, Math.round(cam.position.z/snap)*snap);
    mat.uniforms.uCamPos.value.copy(cam.position);
  };
  return mesh;
}
