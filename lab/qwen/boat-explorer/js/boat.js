// js/boat.js — sunset sloop: hull, sails, boom, tillar; wave-reactive trim rig
import * as THREE from 'three';

// curved billowing sail: luff at z=0 (mast/forestay), foot spans aft along -Z, belly bulges +X (leeward)
function curvedSailGeo(width, height, belly) {
  const NU = 10, NV = 8;
  const pos = [], idx = [];
  for (let iv = 0; iv <= NV; iv++) {
    const v = iv / NV;
    const y = v * height;
    const taper = width * (1 - v * 0.72);          // triangular: full foot -> near luff peak
    const bellyV = belly * Math.sin(Math.PI * (0.25 + 0.75 * v)); // belly aloft
    for (let iu = 0; iu <= NU; iu++) {
      const u = iu / NU;
      const z = -u * taper;                          // aft from mast
      const x = bellyV * Math.sin(Math.PI * u * 0.9); // sideways billow
      pos.push(x, y, z);
    }
  }
  for (let iv = 0; iv < NV; iv++) for (let iu = 0; iu < NU; iu++) {
    const a = iv * (NU + 1) + iu, b = a + 1, c = a + (NU + 1), d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function makeBoat() {
  const root = new THREE.Group();          // world placement (position + yaw handled by main)
  const bob = new THREE.Group();          // wave heave/pitch/roll applied here

  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf5efe4, roughness: 0.55, metalness: 0.05 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x8a3324, roughness: 0.5 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 0.8 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x3a2b22, roughness: 0.7 });

  // ---- hull: LatheGeometry profile, scaled to a sleek sloop
  // profile from bow tip (bottom) up the stem; lathe axis = Y
  const pts = [];
  pts.push(new THREE.Vector2(0.001, -1.35));   // keel/bow tip
  pts.push(new THREE.Vector2(0.34, -1.12));
  pts.push(new THREE.Vector2(0.56, -0.72));
  pts.push(new THREE.Vector2(0.66, -0.28));
  pts.push(new THREE.Vector2(0.70,  0.10));
  pts.push(new THREE.Vector2(0.62,  0.34));
  const hull = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), hullMat);
  hull.scale.set(1, 1, 2.6);                    // stretch along Z => length ~ 3.6+
  hull.geometry.computeVertexNormals();
  bob.add(hull);

  // pointed bow wedge (the lathe is round; add a V-deck bow for character)
  const bowGeo = new THREE.ConeGeometry(0.68, 1.7, 4, 1);
  bowGeo.rotateX(Math.PI / 2);
  bowGeo.rotateZ(Math.PI / 4);
  const bow = new THREE.Mesh(bowGeo, hullMat);
  bow.position.set(0, 0.12, 1.55);
  bow.scale.set(1, 0.52, 1);
  bob.add(bow);

  // rubrail / trim stripe ring
  const rubGeo = new THREE.TorusGeometry(0.68, 0.05, 6, 22);
  const rub = new THREE.Mesh(rubGeo, trimMat);
  rub.rotation.x = Math.PI / 2;
  rub.position.y = 0.30;
  rub.scale.set(1, 2.6 / 2.0, 1); // stretch to match hull z
  rub.scale.set(1, 1, 2.6);
  bob.add(rub);

  // deck
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 14), deckMat);
  deck.scale.z = 2.3;
  deck.position.y = 0.32;
  bob.add(deck);

  // cockpit well
  const cockpit = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.14, 12), darkMat);
  cockpit.scale.z = 1.5;
  cockpit.position.set(0, 0.34, -0.55);
  bob.add(cockpit);

  // tiller
  const tiller = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.85), darkMat);
  tiller.position.set(0, 0.42, -1.05);
  tiller.rotation.x = -0.35;
  bob.add(tiller);

  // ---- mast
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 4.6, 8), darkMat);
  mast.position.set(0, 2.55, 0.42);
  bob.add(mast);

  // ---- boom: swings about Y from centerline toward leeward
  const boomPivot = new THREE.Group();
  boomPivot.position.set(0, 0.9, 0.42);
  bob.add(boomPivot);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 2.6, 6), darkMat);
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, 0, -1.3);
  boomPivot.add(boom);

  // ---- mainsail: curved billowing bag, eased out to leeward (reads from any angle)
  const sailMat = new THREE.MeshStandardMaterial({
    color: 0xfff6e8, roughness: 0.85, metalness: 0,
    side: THREE.DoubleSide, transparent: true, opacity: 0.97,
    emissive: 0xffb877, emissiveIntensity: 0.12,
  });
  const mainsail = new THREE.Mesh(curvedSailGeo(2.9, 3.6, 0.42), sailMat);
  mainsail.position.set(0, 0.08, 0);
  boomPivot.add(mainsail);

  // jib: smaller bag off the bow, mirrored to leeward
  const jib = new THREE.Mesh(curvedSailGeo(1.7, 2.3, 0.3), sailMat.clone());
  jib.material.color.set(0xffeed8);
  jib.position.set(0.15, 1.0, 1.35);
  jib.rotation.y = 0.75;
  bob.add(jib);

  // forestay + backstays (lines)
  const lineMat = new THREE.LineBasicMaterial({ color: 0x6b5a44, transparent: true, opacity: 0.8 });
  const mkLine = (a, b) => {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    return new THREE.Line(g, lineMat);
  };
  bob.add(mkLine(new THREE.Vector3(0, 4.75, 0.42), new THREE.Vector3(0, 0.32, 2.2)));
  bob.add(mkLine(new THREE.Vector3(0, 4.75, 0.42), new THREE.Vector3(0.5, 0.3, -1.3)));
  bob.add(mkLine(new THREE.Vector3(0, 4.75, 0.42), new THREE.Vector3(-0.5, 0.3, -1.3)));

  // pennant on masthead — flutters
  const pennant = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.16),
    new THREE.MeshBasicMaterial({ color: 0xff8c42, side: THREE.DoubleSide }));
  pennant.position.set(0.26, 4.85, 0.42);
  bob.add(pennant);

  // warm sunset key light is scene-level; add a tiny fill for the deck
  root.add(bob);

  return {
    root, bob, mainsail, jib, boom, boomPivot, pennant, mast,
    // called each frame: wave-trim + sail billow + flutter
    animate(t, apparentWind, speed, helm) {
      // boom + mainsail swing out to leeward with apparent wind
      const easeOut = -0.5 - apparentWind * 0.5 - helm * 0.15;
      boomPivot.rotation.y = easeOut + Math.sin(t * 1.4) * 0.04;
      // sail billow breathing
      mainsail.scale.x = 1 + Math.sin(t * 2.1) * 0.08 + apparentWind * 0.22;
      jib.scale.x = 1 + Math.sin(t * 2.4 + 1) * 0.07 + apparentWind * 0.18;
      jib.rotation.y = easeOut * 0.6;
      // pennant flutter
      pennant.rotation.y = Math.sin(t * 9) * 0.5;
      pennant.scale.x = 0.8 + Math.sin(t * 7) * 0.2;
    },
  };
}
