// @ts-nocheck
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BUILDINGS, OBSTACLES } from './data';
import { S } from './state';
import type { GameCallbacks } from './types';

// Module-level vars (replacing window._ globals)
let _smokeParticles = [];
let _obstacleGroups = [];
let _obstacleRaycastTargets = [];
let _obstacleMeshes = {};
let _obstacleHoverRing = null;
let _stageGroup = null;
let _selTimeout;
let _forceNightUpdate = false;
let _gameCbs: GameCallbacks | null = null;

export function setGameCallbacks(cbs: GameCallbacks) { _gameCbs = cbs; }

    // ============================================================
    // THREE.JS SETUP
    // ============================================================
    const canvas = document.getElementById('threeCanvas');
    const wrap = document.getElementById('canvas-wrap');
    let W = wrap.clientWidth, H = wrap.clientHeight;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x0e0c08, 1);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0e0c08, 0.018);

    // Day/night cycle
    const DAY_LENGTH_MS = 480000;
    const TIME_STATES = [
      { t: 0.00, amb: 0x0d1530, ambI: 0.06, sun: 0x182040, sunI: 0.02, fog: 0x020204, bg: 0x010103 },
      { t: 0.20, amb: 0xff9944, ambI: 0.35, sun: 0xff7030, sunI: 0.55, fog: 0x1a100a, bg: 0x0a0604 },
      { t: 0.35, amb: 0xd4b880, ambI: 0.55, sun: 0xffe8b0, sunI: 1.0,  fog: 0x140f08, bg: 0x0a0806 },
      { t: 0.50, amb: 0xd4c090, ambI: 0.60, sun: 0xfff0c0, sunI: 1.2,  fog: 0x0e0c08, bg: 0x0e0c08 },
      { t: 0.75, amb: 0xe0b060, ambI: 0.50, sun: 0xffcc60, sunI: 0.9,  fog: 0x120d06, bg: 0x0c0a06 },
      { t: 0.85, amb: 0xff6622, ambI: 0.35, sun: 0xff4010, sunI: 0.55, fog: 0x180a04, bg: 0x0e0604 },
      { t: 0.95, amb: 0x0d1530, ambI: 0.06, sun: 0x182040, sunI: 0.02, fog: 0x020204, bg: 0x010103 },
    ];
    const TIME_NAMES = ['Nacht','Morgengrauen','Morgen','Tag','Nachmittag','Abenddämmerung'];
    let _dayStartMs = parseInt(localStorage.getItem('dorf_dayStartMs') || '0') || Date.now();
    localStorage.setItem('dorf_dayStartMs', String(_dayStartMs));
    let _prevNightFactor = -1;

    // Smoke particles
    // _smokeParticles initialized at module level

    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 200);
    camera.position.set(18, 22, 18);
    camera.lookAt(0, 0, 0);

    // Post-processing: subtle bloom for fire, torches, lanterns and golden accents
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(W, H),
      0.32,   // strength  — subtle atmospheric glow, not game-y
      0.55,   // radius    — medium spread
      0.60    // threshold — only fire/torch/window emissives bloom
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    // Lights
    const ambient = new THREE.AmbientLight(0xd4c090, 0.6);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffe8b0, 1.2);
    sun.position.set(15, 25, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -36;
    sun.shadow.camera.right = 36;
    sun.shadow.camera.top = 36;
    sun.shadow.camera.bottom = -36;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x8090c0, 0.35);
    fill.position.set(-10, 8, -5);
    scene.add(fill);

    // GROUND
    const GRID = 14; // 14x14 grid
    const CELL = 2.0;
    const groundGeo = new THREE.PlaneGeometry(GRID * CELL + 2, GRID * CELL + 2, GRID, GRID);
    const groundMat = new THREE.MeshLambertMaterial({ map: createGroundTexture() });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    createStonePlaza();

    // Environment: dense forest border + rocky mountains
    buildForestBorder();
    buildMountainBorder();

    // ============================================================
    // STRUCTURED CAMERA CONTROLS (isometric-style)
    // ============================================================
    // 4 cardinal view angles (SW, NW, NE, SE)
    const CAM_ANGLES = [
      { theta: Math.PI * 0.75, label: 'SW' },
      { theta: Math.PI * 1.25, label: 'NW' },
      { theta: Math.PI * 1.75, label: 'NO' },
      { theta: Math.PI * 0.25, label: 'SO' },
    ];
    let camAngleIdx = 0;

    // Tilt steps: angle from vertical (phi)
    const CAM_TILTS = [Math.PI / 5, Math.PI / 3.8, Math.PI / 2.8];
    let camTiltIdx = 1;

    // Zoom steps
    const CAM_ZOOMS = [14, 20, 28, 38, 52];
    let camZoomIdx = 2;

    // Camera transition animation
    let camAnimating = false;
    let camCurrent = {
      theta: CAM_ANGLES[0].theta,
      phi: CAM_TILTS[1],
      dist: CAM_ZOOMS[2]
    };
    let camTarget_anim = { ...camCurrent };

    const camTarget = new THREE.Vector3(0, 0, 0);
    let _panDragging = false, _panMoved = false, _panStart = { x: 0, y: 0 };

    function updateCamera() {
      camera.position.x = camTarget.x + camCurrent.dist * Math.sin(camCurrent.phi) * Math.sin(camCurrent.theta);
      camera.position.y = camTarget.y + camCurrent.dist * Math.cos(camCurrent.phi);
      camera.position.z = camTarget.z + camCurrent.dist * Math.sin(camCurrent.phi) * Math.cos(camCurrent.theta);
      camera.lookAt(camTarget);
    }

    function animateCamera() {
      // Smooth interpolation toward target
      const speed = 0.12;
      let needUpdate = false;

      // Handle theta wrapping for shortest path
      let dTheta = camTarget_anim.theta - camCurrent.theta;
      if (dTheta > Math.PI) dTheta -= Math.PI * 2;
      if (dTheta < -Math.PI) dTheta += Math.PI * 2;

      if (Math.abs(dTheta) > 0.001) { camCurrent.theta += dTheta * speed; needUpdate = true; }
      else { camCurrent.theta = camTarget_anim.theta; }

      const dPhi = camTarget_anim.phi - camCurrent.phi;
      if (Math.abs(dPhi) > 0.001) { camCurrent.phi += dPhi * speed; needUpdate = true; }
      else { camCurrent.phi = camTarget_anim.phi; }

      const dDist = camTarget_anim.dist - camCurrent.dist;
      if (Math.abs(dDist) > 0.05) { camCurrent.dist += dDist * speed; needUpdate = true; }
      else { camCurrent.dist = camTarget_anim.dist; }

      if (needUpdate) updateCamera();
    }

    function rotateCam(dir) {
      camAngleIdx = (camAngleIdx + dir + CAM_ANGLES.length) % CAM_ANGLES.length;
      camTarget_anim.theta = CAM_ANGLES[camAngleIdx].theta;
      document.getElementById('view-label').textContent = CAM_ANGLES[camAngleIdx].label;
    }

    function zoomCam(dir) {
      camZoomIdx = Math.max(0, Math.min(CAM_ZOOMS.length - 1, camZoomIdx + dir));
      camTarget_anim.dist = CAM_ZOOMS[camZoomIdx];
      updateZoomBar();
    }

    function tiltCam(dir) {
      camTiltIdx = Math.max(0, Math.min(CAM_TILTS.length - 1, camTiltIdx + dir));
      camTarget_anim.phi = CAM_TILTS[camTiltIdx];
    }

    function zoomClick(e) {
      const track = document.getElementById('zoom-track');
      const rect = track.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      camZoomIdx = Math.round(pct * (CAM_ZOOMS.length - 1));
      camZoomIdx = Math.max(0, Math.min(CAM_ZOOMS.length - 1, camZoomIdx));
      camTarget_anim.dist = CAM_ZOOMS[camZoomIdx];
      updateZoomBar();
    }

    function updateZoomBar() {
      const pct = ((CAM_ZOOMS.length - 1 - camZoomIdx) / (CAM_ZOOMS.length - 1)) * 100;
      document.getElementById('zoom-fill').style.width = pct + '%';
    }

    // Scroll wheel → zoom steps
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      zoomCam(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    // Middle mouse → rotate view; Right mouse → start pan
    canvas.addEventListener('mousedown', e => {
      if (e.button === 1) { e.preventDefault(); rotateCam(1); return; }
      if (e.button === 2) {
        _panDragging = true; _panMoved = false;
        _panStart.x = e.clientX; _panStart.y = e.clientY;
      }
    });
    canvas.addEventListener('mouseup', e => {
      if (e.button === 2) _panDragging = false;
    });

    updateCamera();
    updateZoomBar();

    // RAYCASTER for clicking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // ============================================================
    // 3D BUILDING MESHES
    // ============================================================
    const buildingMeshes = {}; // id -> [{mesh, gridX, gridZ}]
    const gridOccupied = {}; // "x,z" -> buildingId or '__obstacle__'
    const buildingGroups = []; // all placed groups for raycasting
    const roadMeshes = {}; // "x,z" -> Three.Group
    let roadMode = false;

    // Obstacle tracking initialized at module level

    function gridKey(x, z) { return x + ',' + z; }

    function findFreeCell(bldId, requireRoad) {
      const cx = 0, cz = 0;
      for (let r = 0; r <= GRID / 2; r++) {
        for (let dx = -r; dx <= r; dx++) {
          for (let dz = -r; dz <= r; dz++) {
            if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
            const x = cx + dx, z = cz + dz;
            if (Math.abs(x) > GRID / 2 - 1 || Math.abs(z) > GRID / 2 - 1) continue;
            const key = gridKey(x, z);
            if (gridOccupied[key]) continue;
            if (requireRoad && (S.roads || []).indexOf(key) >= 0) continue;
            if (requireRoad && !hasRoadAccess(x, z, bldId)) continue;
            return { x, z };
          }
        }
      }
      return null;
    }

    function makeBuildingMesh(b, x, z, index, inst) {
      const group = new THREE.Group();
      const c = b.color3d;
      const darkerC = new THREE.Color(c).multiplyScalar(0.6).getHex();
      const h = b.height;

      const mat = new THREE.MeshLambertMaterial({ color: c });
      const darkMat = new THREE.MeshLambertMaterial({ color: darkerC });
      const wMat = new THREE.MeshLambertMaterial({ color: 0xffe890, emissive: 0x806020, emissiveIntensity: 0.5 });
      const wMatHot = new THREE.MeshLambertMaterial({ color: 0xffcc80, emissive: 0x903010, emissiveIntensity: 0.6 });
      const mkWinX = (px, py, pz) => { const ww = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.18), wMat); ww.position.set(px, py, pz); group.add(ww); };
      const mkWinZ = (px, py, pz) => { const ww = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.02), wMat); ww.position.set(px, py, pz); group.add(ww); };
      const mkSlit = (px, py, pz, onZ) => { const s = new THREE.Mesh(onZ ? new THREE.BoxGeometry(0.08, 0.3, 0.02) : new THREE.BoxGeometry(0.02, 0.3, 0.08), wMat); s.position.set(px, py, pz); group.add(s); };

      // Wall damage tint: HP 3=grey, 2=reddish, 1=red
      let wallBodyMat = mat;
      if (b.shape === 'wall' && inst && inst.hp !== undefined) {
        if (inst.hp <= 1) wallBodyMat = new THREE.MeshLambertMaterial({ color: 0xaa4040 });
        else if (inst.hp <= 2) wallBodyMat = new THREE.MeshLambertMaterial({ color: 0x8a6055 });
      }

      // Every building: foundation
      const foundGeo = new THREE.BoxGeometry(CELL * 0.88, 0.12, CELL * 0.88);
      const found = new THREE.Mesh(foundGeo, new THREE.MeshLambertMaterial({ color: 0x4a3a28 }));
      found.position.y = 0.06;
      found.castShadow = true;
      found.receiveShadow = true;
      group.add(found);

      if (b.shape === 'house' || b.shape === 'hut' || b.shape === 'bakery' || b.shape === 'brewery') {
        const w = b.shape === 'hut' ? 0.7 : b.shape === 'brewery' ? 1.0 : 0.9;
        const bGeo = new THREE.BoxGeometry(CELL * w, h * 0.6, CELL * w);
        const body = new THREE.Mesh(bGeo, mat);
        body.position.y = h * 0.3 + 0.12;
        body.castShadow = true; body.receiveShadow = true;
        group.add(body);
        // Roof
        const rGeo = new THREE.ConeGeometry(CELL * w * 0.72, h * 0.5, 4);
        const roof = new THREE.Mesh(rGeo, darkMat);
        roof.position.y = h * 0.6 + h * 0.25 + 0.12;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        group.add(roof);
        if (b.shape === 'house') {
          mkWinX(CELL * w * 0.5 + 0.01, h * 0.35, 0);
          mkWinZ(0, h * 0.35, CELL * w * 0.5 + 0.01);
        }
        if (b.shape === 'hut') {
          // Log pile next to hut
          const logMat = new THREE.MeshLambertMaterial({ color: 0x5a3a18 });
          for (let li = 0; li < 3; li++) {
            const logGeo = new THREE.CylinderGeometry(0.09, 0.1, 0.55, 6);
            const lg = new THREE.Mesh(logGeo, logMat);
            lg.rotation.z = Math.PI / 2;
            lg.position.set(-CELL * 0.35, 0.16 + li * 0.12, (li - 1) * 0.19);
            lg.castShadow = true;
            group.add(lg);
          }
          mkWinX(CELL * w * 0.5 + 0.01, h * 0.35, 0);
        }
        if (b.shape === 'bakery') {
          mkWinX(CELL * w * 0.5 + 0.01, h * 0.35, 0);
          mkWinZ(0.2, h * 0.35, CELL * w * 0.5 + 0.01);
        }
        if (b.shape === 'brewery') {
          mkWinX(CELL * w * 0.5 + 0.01, h * 0.35, -0.22);
          mkWinX(CELL * w * 0.5 + 0.01, h * 0.35, 0.22);
        }
      } else if (b.shape === 'tower' || b.shape === 'watchtower') {
        const tw = b.shape === 'watchtower' ? 0.55 : 0.5;
        const tGeo = new THREE.BoxGeometry(CELL * tw, h, CELL * tw);
        const tower = new THREE.Mesh(tGeo, mat);
        tower.position.y = h * 0.5 + 0.12;
        tower.castShadow = true; group.add(tower);
        const topGeo = new THREE.BoxGeometry(CELL * tw * 1.2, 0.18, CELL * tw * 1.2);
        const top = new THREE.Mesh(topGeo, darkMat);
        top.position.y = h + 0.21;
        top.castShadow = true; group.add(top);
        if (b.shape === 'watchtower') {
          const flagGeo = new THREE.BoxGeometry(0.05, 0.6, 0.05);
          const flag = new THREE.Mesh(flagGeo, new THREE.MeshLambertMaterial({ color: 0xd43030 }));
          flag.position.y = h + 0.6;
          group.add(flag);
        }
        mkSlit(CELL * tw * 0.5 + 0.01, h * 0.5, 0, false);
        mkSlit(0, h * 0.5, CELL * tw * 0.5 + 0.01, true);
      } else if (b.shape === 'farm') {
        const fGeo = new THREE.BoxGeometry(CELL * 0.9, 0.12, CELL * 0.9);
        const farm = new THREE.Mesh(fGeo, new THREE.MeshLambertMaterial({ color: 0x2e1a0a }));
        farm.position.y = 0.18;
        farm.castShadow = true; group.add(farm);
        // Crop rows on the left side
        const cropCols = [0x5a8820, 0x7aaa30, 0xc4a020];
        for (let ri = -1; ri <= 1; ri++) {
          const rowGeo = new THREE.BoxGeometry(CELL * 0.42, 0.1, 0.22);
          const row = new THREE.Mesh(rowGeo, new THREE.MeshLambertMaterial({ color: cropCols[ri + 1] }));
          row.position.set(-CELL * 0.26, 0.26, ri * 0.35);
          group.add(row);
        }
        const hGeo = new THREE.BoxGeometry(CELL * 0.5, 0.7, CELL * 0.5);
        const hm = new THREE.Mesh(hGeo, mat);
        hm.position.set(CELL * 0.2, 0.47, CELL * 0.2);
        hm.castShadow = true; group.add(hm);
        const rGeo = new THREE.ConeGeometry(CELL * 0.38, 0.4, 4);
        const rm = new THREE.Mesh(rGeo, darkMat);
        rm.position.set(CELL * 0.2, 1.07, CELL * 0.2);
        rm.rotation.y = Math.PI / 4;
        group.add(rm);
        mkWinX(CELL * 0.2 + CELL * 0.25 + 0.01, 0.47 + 0.7 * 0.35, CELL * 0.2);
      } else if (b.shape === 'quarry') {
        const qGeo = new THREE.BoxGeometry(CELL * 0.85, 0.5, CELL * 0.85);
        const q = new THREE.Mesh(qGeo, mat);
        q.position.y = 0.37;
        q.castShadow = true; group.add(q);
        for (let i = 0; i < 4; i++) {
          const sg = new THREE.BoxGeometry(0.22, 0.22 + Math.random() * 0.2, 0.22);
          const s = new THREE.Mesh(sg, new THREE.MeshLambertMaterial({ color: 0xa0a090 }));
          s.position.set((Math.random() - 0.5) * 1.0, 0.73, (Math.random() - 0.5) * 1.0);
          group.add(s);
        }
      } else if (b.shape === 'mill') {
        const mGeo = new THREE.CylinderGeometry(0.45, 0.5, h, 6);
        const m = new THREE.Mesh(mGeo, mat);
        m.position.y = h * 0.5 + 0.12;
        m.castShadow = true; group.add(m);
        const tGeo = new THREE.ConeGeometry(0.52, 0.6, 6);
        const t = new THREE.Mesh(tGeo, darkMat);
        t.position.y = h + 0.42;
        group.add(t);
        // Sails
        for (let i = 0; i < 4; i++) {
          const sGeo = new THREE.BoxGeometry(0.08, 0.7, 0.12);
          const sail = new THREE.Mesh(sGeo, new THREE.MeshLambertMaterial({ color: 0xd4c090 }));
          sail.position.set(Math.sin(i * Math.PI / 2) * 0.6, h + 0.3, Math.cos(i * Math.PI / 2) * 0.6);
          sail.rotation.z = i * Math.PI / 2;
          group.add(sail);
        }
      } else if (b.shape === 'church' || b.shape === 'cathedral') {
        const bGeo = new THREE.BoxGeometry(CELL * 0.85, h * 0.5, CELL * 0.85);
        const body = new THREE.Mesh(bGeo, mat);
        body.position.y = h * 0.25 + 0.12;
        body.castShadow = true; body.receiveShadow = true; group.add(body);
        // Spire
        const spW = b.shape === 'cathedral' ? 0.45 : 0.32;
        const spGeo = new THREE.BoxGeometry(CELL * spW, h * 0.4, CELL * spW);
        const sp = new THREE.Mesh(spGeo, mat);
        sp.position.y = h * 0.5 + h * 0.2 + 0.12;
        sp.castShadow = true; group.add(sp);
        const tGeo = new THREE.ConeGeometry(CELL * spW * 0.6, h * 0.45, 4);
        const top = new THREE.Mesh(tGeo, darkMat);
        top.position.y = h * 0.5 + h * 0.4 + h * 0.22 + 0.12;
        top.rotation.y = Math.PI / 4;
        top.castShadow = true; group.add(top);
        if (b.shape === 'cathedral') {
          // Side towers
          for (const [sx, sz] of [[-0.6, -0.6], [0.6, -0.6]]) {
            const stG = new THREE.BoxGeometry(0.4, h * 0.6, 0.4);
            const st = new THREE.Mesh(stG, mat);
            st.position.set(sx, h * 0.3 + 0.12, sz);
            st.castShadow = true; group.add(st);
            const stTG = new THREE.ConeGeometry(0.3, 0.7, 4);
            const stT = new THREE.Mesh(stTG, darkMat);
            stT.position.set(sx, h * 0.6 + 0.47, sz);
            stT.rotation.y = Math.PI / 4; group.add(stT);
          }
        }
        // Cross
        const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.06), new THREE.MeshLambertMaterial({ color: 0xf0e0a0 }));
        crossV.position.y = h + 0.12 + (b.shape === 'cathedral' ? 0.6 : 0.3);
        group.add(crossV);
        const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 0.06), new THREE.MeshLambertMaterial({ color: 0xf0e0a0 }));
        crossH.position.y = h + 0.12 + (b.shape === 'cathedral' ? 0.75 : 0.42);
        group.add(crossH);
        // Tall church windows
        const cw1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.42, 0.15), wMat);
        cw1.position.set(CELL * 0.425 + 0.01, h * 0.28 + 0.12, 0);
        group.add(cw1);
        const cw2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.42, 0.02), wMat);
        cw2.position.set(0, h * 0.28 + 0.12, CELL * 0.425 + 0.01);
        group.add(cw2);
        if (b.shape === 'cathedral') {
          const cw3 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.42, 0.15), wMat);
          cw3.position.set(-(CELL * 0.425 + 0.01), h * 0.28 + 0.12, 0);
          group.add(cw3);
          const cw4 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.42, 0.02), wMat);
          cw4.position.set(0, h * 0.28 + 0.12, -(CELL * 0.425 + 0.01));
          group.add(cw4);
        }
      } else if (b.shape === 'market') {
        const mGeo = new THREE.BoxGeometry(CELL * 0.9, 0.15, CELL * 0.9);
        const mf = new THREE.Mesh(mGeo, mat);
        mf.position.y = 0.195;
        mf.receiveShadow = true; group.add(mf);
        // Stalls
        for (let i = 0; i < 4; i++) {
          const angle = i * Math.PI / 2;
          const stG = new THREE.BoxGeometry(0.5, 0.6, 0.3);
          const st = new THREE.Mesh(stG, new THREE.MeshLambertMaterial({ color: [0xc83030, 0x30a030, 0xe09020, 0x3060c0][i] }));
          st.position.set(Math.sin(angle) * 0.6, 0.6, Math.cos(angle) * 0.6);
          group.add(st);
        }
        // Central well
        const wellGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.35, 8);
        const well = new THREE.Mesh(wellGeo, new THREE.MeshLambertMaterial({ color: 0x7a6a50 }));
        well.position.y = 0.37;
        well.castShadow = true; group.add(well);
        const rimGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.07, 8);
        const rim = new THREE.Mesh(rimGeo, new THREE.MeshLambertMaterial({ color: 0x5a4a30 }));
        rim.position.y = 0.58;
        group.add(rim);
      } else if (b.shape === 'forge' || b.shape === 'smelter' || b.shape === 'armory') {
        const bGeo = new THREE.BoxGeometry(CELL * 0.8, h * 0.55, CELL * 0.8);
        const body = new THREE.Mesh(bGeo, mat);
        body.position.y = h * 0.275 + 0.12;
        body.castShadow = true; group.add(body);
        // Chimney
        const cGeo = new THREE.CylinderGeometry(0.18, 0.22, h * 0.6, 6);
        const chim = new THREE.Mesh(cGeo, darkMat);
        chim.position.set(0.3, h * 0.55 + 0.12, 0.3);
        chim.castShadow = true; group.add(chim);
        if (b.shape === 'smelter') {
          // Fire glow
          const fGeo = new THREE.SphereGeometry(0.15, 8, 8);
          const fMat = new THREE.MeshLambertMaterial({ color: 0xff6020, emissive: 0xff3000, emissiveIntensity: 1.0 });
          const fire = new THREE.Mesh(fGeo, fMat);
          fire.position.set(0.3, h * 0.55 + h * 0.3 + 0.12, 0.3);
          group.add(fire);
        }
        const fwin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.18), wMatHot);
        fwin.position.set(CELL * 0.4 + 0.01, h * 0.28 + 0.12, 0);
        group.add(fwin);
      } else if (b.shape === 'kiln') {
        const kGeo = new THREE.CylinderGeometry(0.5, 0.6, h, 8);
        const k = new THREE.Mesh(kGeo, mat);
        k.position.y = h * 0.5 + 0.12;
        k.castShadow = true; group.add(k);
        const tGeo = new THREE.ConeGeometry(0.52, 0.4, 8);
        const t = new THREE.Mesh(tGeo, darkMat);
        t.position.y = h + 0.32;
        group.add(t);
        const fMat = new THREE.MeshLambertMaterial({ color: 0xff4000, emissive: 0xff2000, emissiveIntensity: 0.8 });
        const fGeo = new THREE.SphereGeometry(0.12, 8, 8);
        const f = new THREE.Mesh(fGeo, fMat);
        f.position.y = h * 0.5 + 0.32;
        group.add(f);
      } else if (b.shape === 'mine') {
        const eGeo = new THREE.BoxGeometry(CELL * 0.7, h * 0.5, CELL * 0.7);
        const ent = new THREE.Mesh(eGeo, mat);
        ent.position.y = h * 0.25 + 0.12;
        ent.castShadow = true; group.add(ent);
        const arGeo = new THREE.BoxGeometry(CELL * 0.5, h * 0.5 + 0.1, 0.12);
        const ar = new THREE.Mesh(arGeo, darkMat);
        ar.position.set(0, h * 0.25 + 0.12, CELL * 0.35);
        group.add(ar);
        const topGeo = new THREE.BoxGeometry(CELL * 0.75, 0.12, 0.12);
        const top = new THREE.Mesh(topGeo, darkMat);
        top.position.set(0, h * 0.52, CELL * 0.35);
        group.add(top);
        // Rail tracks leading into mine
        const railMat2 = new THREE.MeshLambertMaterial({ color: 0x909080 });
        for (const rx of [-0.22, 0.22]) {
          const railGeo2 = new THREE.BoxGeometry(0.06, 0.04, CELL * 0.55);
          const rail2 = new THREE.Mesh(railGeo2, railMat2);
          rail2.position.set(rx, 0.14, 0);
          group.add(rail2);
        }
        for (let ti = -1; ti <= 1; ti++) {
          const tieGeo = new THREE.BoxGeometry(0.5, 0.04, 0.09);
          const tie = new THREE.Mesh(tieGeo, new THREE.MeshLambertMaterial({ color: 0x4a3220 }));
          tie.position.set(0, 0.12, ti * 0.35);
          group.add(tie);
        }
        const mlMat = new THREE.MeshLambertMaterial({ color: 0xffb030, emissive: 0xff8010, emissiveIntensity: 0.9 });
        const ml = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), mlMat);
        ml.position.set(0, h * 0.38, CELL * 0.35 - 0.1);
        group.add(ml);
      } else if (b.shape === 'barracks' || b.shape === 'wall') {
        const bGeo = new THREE.BoxGeometry(CELL * 0.88, h * 0.55, CELL * 0.88);
        const body = new THREE.Mesh(bGeo, wallBodyMat);
        body.position.y = h * 0.275 + 0.12;
        body.castShadow = true; body.receiveShadow = true; group.add(body);
        if (b.shape === 'barracks') {
          mkWinX(CELL * 0.44 + 0.01, h * 0.35, -0.3);
          mkWinX(CELL * 0.44 + 0.01, h * 0.35, 0.3);
          mkWinZ(-0.3, h * 0.35, CELL * 0.44 + 0.01);
          mkWinZ(0.3, h * 0.35, CELL * 0.44 + 0.01);
        }
        if (b.shape === 'wall') {
          // Crenellations
          for (let i = -1; i <= 1; i++) {
            const cGeo = new THREE.BoxGeometry(0.3, 0.3, CELL * 0.88);
            const cr = new THREE.Mesh(cGeo, wallBodyMat);
            cr.position.set(i * 0.55, h * 0.55 + 0.27, 0);
            group.add(cr);
            const cGeo2 = new THREE.BoxGeometry(CELL * 0.88, 0.3, 0.3);
            const cr2 = new THREE.Mesh(cGeo2, wallBodyMat);
            cr2.position.set(0, h * 0.55 + 0.27, i * 0.55);
            group.add(cr2);
          }
          // HP indicator: small colored spheres on top
          if (inst && inst.hp !== undefined) {
            const maxHp = S.skills?.mauermeister ? 4 : 3;
            for (let i = 0; i < maxHp; i++) {
              const hpGeo = new THREE.SphereGeometry(0.09, 6, 6);
              const hpColor = i < inst.hp ? 0x60e040 : 0x4a3030;
              const hpMesh = new THREE.Mesh(hpGeo, new THREE.MeshLambertMaterial({ color: hpColor, emissive: i < inst.hp ? 0x204010 : 0 }));
              hpMesh.position.set((i - 1) * 0.28, h * 0.55 + 0.6, 0);
              group.add(hpMesh);
            }
          }
        }
      } else if (b.shape === 'hall') {
        // Rathaus: wide main hall + central tower + flag
        const mainGeo = new THREE.BoxGeometry(CELL * 1.0, h * 0.5, CELL * 1.0);
        const main = new THREE.Mesh(mainGeo, mat);
        main.position.y = h * 0.25 + 0.12;
        main.castShadow = true; main.receiveShadow = true; group.add(main);
        const towerGeo = new THREE.BoxGeometry(CELL * 0.38, h * 0.85, CELL * 0.38);
        const tower = new THREE.Mesh(towerGeo, mat);
        tower.position.set(0, h * 0.425 + 0.12, 0);
        tower.castShadow = true; group.add(tower);
        const spireGeo = new THREE.ConeGeometry(CELL * 0.22, h * 0.4, 4);
        const spire = new THREE.Mesh(spireGeo, darkMat);
        spire.position.set(0, h * 0.85 + h * 0.2 + 0.12, 0);
        spire.rotation.y = Math.PI / 4;
        spire.castShadow = true; group.add(spire);
        const flagPoleGeo = new THREE.BoxGeometry(0.06, 0.55, 0.06);
        const flagPole = new THREE.Mesh(flagPoleGeo, new THREE.MeshLambertMaterial({ color: 0xd4a840 }));
        flagPole.position.y = h * 0.85 + h * 0.4 + 0.55 + 0.12;
        group.add(flagPole);
        const flagGeo = new THREE.BoxGeometry(0.32, 0.2, 0.04);
        const flag = new THREE.Mesh(flagGeo, new THREE.MeshLambertMaterial({ color: 0xf0c000, emissive: 0xd4a000, emissiveIntensity: 0.3 }));
        flag.position.set(0.17, h * 0.85 + h * 0.4 + 0.72 + 0.12, 0);
        group.add(flag);
        mkWinX(CELL * 0.5 + 0.01, h * 0.3 + 0.12, -0.35);
        mkWinX(CELL * 0.5 + 0.01, h * 0.3 + 0.12, 0.35);
        mkWinZ(-0.35, h * 0.3 + 0.12, CELL * 0.5 + 0.01);
        mkWinZ(0.35, h * 0.3 + 0.12, CELL * 0.5 + 0.01);
      } else if (b.shape === 'warehouse' || b.shape === 'library') {
        const bGeo = new THREE.BoxGeometry(CELL * 0.88, h, CELL * 0.88);
        const body = new THREE.Mesh(bGeo, mat);
        body.position.y = h * 0.5 + 0.12;
        body.castShadow = true; body.receiveShadow = true; group.add(body);
        const rGeo = new THREE.BoxGeometry(CELL * 0.95, 0.12, CELL * 0.95);
        const roof = new THREE.Mesh(rGeo, darkMat);
        roof.position.y = h + 0.18;
        roof.castShadow = true; group.add(roof);
        if (b.shape === 'warehouse') {
          mkWinX(CELL * 0.44 + 0.01, h * 0.65, -0.25);
          mkWinX(CELL * 0.44 + 0.01, h * 0.65, 0.25);
          mkWinZ(-0.25, h * 0.65, CELL * 0.44 + 0.01);
        }
        if (b.shape === 'library') {
          const colMat = new THREE.MeshLambertMaterial({ color: 0xd4c090 });
          for (const [cx2, cz2] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) {
            const colGeo = new THREE.CylinderGeometry(0.1, 0.12, h, 6);
            const col = new THREE.Mesh(colGeo, colMat);
            col.position.set(cx2, h * 0.5 + 0.12, cz2);
            group.add(col);
          }
          const lw1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.45, 0.15), wMat);
          lw1.position.set(CELL * 0.44 + 0.01, h * 0.55, 0);
          group.add(lw1);
          const lw2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.45, 0.02), wMat);
          lw2.position.set(0, h * 0.55, CELL * 0.44 + 0.01);
          group.add(lw2);
        }
      } else {
        // Default box
        const bGeo = new THREE.BoxGeometry(CELL * 0.75, h, CELL * 0.75);
        const body = new THREE.Mesh(bGeo, mat);
        body.position.y = h * 0.5 + 0.12;
        body.castShadow = true; group.add(body);
      }

      // Level-based cosmetic details
      const _lvl = inst ? (inst.level || 1) : 1;
      addLevelDetail(group, b, h, _lvl);

      // Smoke emitters for chimney buildings
      if (b.shape === 'forge' || b.shape === 'smelter' || b.shape === 'armory') {
        createSmokeEmitter(group, 0.3, h * 0.85 + 0.12, 0.3);
      } else if (b.shape === 'kiln') {
        createSmokeEmitter(group, 0, h + 0.35, 0);
      }

      // Window point light — fades in smoothly at dusk (see day/night cycle code)
      const winLight = new THREE.PointLight(0xffa050, 0, 7.0);
      winLight.position.set(0, Math.max(h * 0.5, 0.6), 0);
      winLight.userData._isWindowLight = true;
      winLight.userData._nightInt = b.shape === 'forge' || b.shape === 'smelter' || b.shape === 'armory' || b.shape === 'kiln' ? 1.2 : 1.8;
      group.add(winLight);

      // Index label (small sphere on top for identification)
      if (index > 0) {
        const lGeo = new THREE.SphereGeometry(0.12, 6, 6);
        const lMat = new THREE.MeshLambertMaterial({ color: 0xf0c060, emissive: 0xd4a840, emissiveIntensity: 0.4 });
        const label = new THREE.Mesh(lGeo, lMat);
        label.position.y = h + 0.6;
        group.add(label);
      }

      group.position.set(x * CELL, 0, z * CELL);
      group.userData = { buildingId: b.id, gridX: x, gridZ: z, instIndex: index, cellRadius: 0.65 };
      scene.add(group);

      // Add all child meshes to buildingGroups for raycasting (skip smoke)
      group.traverse(child => {
        if (child.isMesh && !child._smokeParticle) {
          child.userData.buildingId = b.id;
          child.userData.group = group;
          buildingGroups.push(child);
        }
      });

      return group;
    }

    // Frees GPU resources (geometry/material/textures) of a mesh tree before
    // it's dropped — scene.remove() alone leaks WebGL buffers, which adds up
    // fast across repeated rebuild3D() calls (every upgrade, raid, prestige).
    function disposeObject3D(root) {
      root.traverse(child => {
        if (!child.isMesh && !child.isSprite) return;
        child.geometry?.dispose();
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(m => {
          if (!m) return;
          m.map?.dispose();
          m.emissiveMap?.dispose();
          m.dispose();
        });
      });
    }

    function rebuild3D() {
      _forceNightUpdate = true;
      buildingGroups.length = 0;
      _smokeParticles = [];
      for (const key in buildingMeshes) {
        buildingMeshes[key].forEach(g => { disposeObject3D(g); scene.remove(g); });
        delete buildingMeshes[key];
      }
      for (const key in gridOccupied) delete gridOccupied[key];

      // Process rathaus first so it always claims center position
      const orderedEntries = Object.entries(S.buildings).sort(([a], [b]) => {
        if (a === 'rathaus') return -1;
        if (b === 'rathaus') return 1;
        return 0;
      });

      for (const [id, instances] of orderedEntries) {
        if (!Array.isArray(instances) || !instances.length) continue;
        const b = BUILDINGS.find(x => x.id === id);
        if (!b) continue;
        buildingMeshes[id] = [];
        instances.forEach((inst, i) => {
          let x = inst.x, z = inst.z;
          if (x === null || x === undefined || z === null || z === undefined) {
            const pos = findFreeCell();
            x = pos.x; z = pos.z;
            inst.x = x; inst.z = z;
          } else if (gridOccupied[gridKey(x, z)]) {
            // Collision: find new free cell (can happen after migration)
            const pos = findFreeCell();
            x = pos.x; z = pos.z;
            inst.x = x; inst.z = z;
          }
          gridOccupied[gridKey(x, z)] = id;
          const group = makeBuildingMesh(b, x, z, i, inst);
          buildingMeshes[id].push(group);
          if ((inst.level || 1) > 1) updateLevelRing(group, inst.level || 1);
        });
      }
      rebuildRoads();
      renderObstacles();
      updateGroundTexture();
    }

    function addBuilding3D(id) {
      const b = BUILDINGS.find(x => x.id === id);
      if (!b) return;
      if (!buildingMeshes[id]) buildingMeshes[id] = [];
      const pos = findFreeCell(id, true);
      if (!pos) { _gameCbs?.notify('Kein Straßenzugang — baue erst Straßen in der Nähe.', 'warning'); return; }
      const { x, z } = pos;
      gridOccupied[gridKey(x, z)] = id;
      const idx = buildingMeshes[id].length;
      const instForMesh = (S.buildings[id] && S.buildings[id][idx]) ? S.buildings[id][idx] : { level: 1 };
      const group = makeBuildingMesh(b, x, z, idx, instForMesh);
      buildingMeshes[id].push(group);

      // Persist position in state (buyBuilding already pushed the entry with null x/z)
      if (S.buildings[id] && S.buildings[id].length > idx) {
        S.buildings[id][idx].x = x;
        S.buildings[id][idx].z = z;
      }

      updateGroundTexture();

      // Animate: scale from 0
      group.scale.set(0.01, 0.01, 0.01);
      let t = 0;
      const anim = () => {
        t += 0.06;
        const s = Math.min(1, t);
        const bounce = s < 0.8 ? s / 0.8 : 1 + Math.sin((s - 0.8) / 0.2 * Math.PI) * 0.15;
        group.scale.set(bounce, bounce, bounce);
        if (t < 1.2) requestAnimationFrame(anim);
        else group.scale.set(1, 1, 1);
      };
      requestAnimationFrame(anim);
    }

    // ============================================================
    // MOVE MODE SYSTEM
    // ============================================================
    let selectedGroup = null;
    let moveMode = false;        // true = waiting for target cell
    let moveGroup = null;        // the group being moved
    let moveBuildingId = null;   // building id being moved
    let moveOrigX = null;        // original grid coords
    let moveOrigZ = null;
    let moveGhostMeshes = [];    // highlight ring on ground
    let moveHoverCell = { x: null, z: null }; // currently hovered cell

    // Invisible plane for raycasting ground position
    const groundPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(GRID * CELL * 4, GRID * CELL * 4),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    );
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = 0;
    scene.add(groundPlane);

    // Cell highlight mesh (shown at hover target)
    const cellHighlightGeo = new THREE.PlaneGeometry(CELL * 0.92, CELL * 0.92);
    const cellHighlightMat = new THREE.MeshBasicMaterial({
      color: 0xe09050, transparent: true, opacity: 0.35,
      side: THREE.DoubleSide, depthWrite: false
    });
    const cellHighlight = new THREE.Mesh(cellHighlightGeo, cellHighlightMat);
    cellHighlight.rotation.x = -Math.PI / 2;
    cellHighlight.position.y = 0.04;
    cellHighlight.visible = false;
    scene.add(cellHighlight);

    // Blocked cell highlight (red for occupied)
    const cellBlockedMat = new THREE.MeshBasicMaterial({
      color: 0xc04030, transparent: true, opacity: 0.35,
      side: THREE.DoubleSide, depthWrite: false
    });
    const cellBlocked = new THREE.Mesh(cellHighlightGeo.clone(), cellBlockedMat);
    cellBlocked.rotation.x = -Math.PI / 2;
    cellBlocked.position.y = 0.04;
    cellBlocked.visible = false;
    scene.add(cellBlocked);

    // Road placement highlight (olive/green)
    const cellRoadMat = new THREE.MeshBasicMaterial({
      color: 0xc8a030, transparent: true, opacity: 0.4,
      side: THREE.DoubleSide, depthWrite: false
    });
    const cellRoadHighlight = new THREE.Mesh(cellHighlightGeo.clone(), cellRoadMat);
    cellRoadHighlight.rotation.x = -Math.PI / 2;
    cellRoadHighlight.position.y = 0.04;
    cellRoadHighlight.visible = false;
    scene.add(cellRoadHighlight);

    // ============================================================
    // ROAD MESH SYSTEM
    // ============================================================
    function getRoadConnections(x, z) {
      const rs = new Set(S.roads || []);
      return {
        n: rs.has(`${x},${z - 1}`), s: rs.has(`${x},${z + 1}`),
        e: rs.has(`${x + 1},${z}`), w: rs.has(`${x - 1},${z}`)
      };
    }

    function makeRoadMesh(x, z) {
      const W = 0.36;
      const armLen = CELL / 2 - W / 2;
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color: 0x8a7a5a });
      const center = new THREE.Mesh(new THREE.BoxGeometry(W, 0.07, W), mat);
      center.position.y = 0.04;
      center.receiveShadow = true;
      group.add(center);
      const conn = getRoadConnections(x, z);
      if (conn.n) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(W, 0.07, armLen), mat);
        arm.position.set(0, 0.04, -(W / 2 + armLen / 2));
        arm.receiveShadow = true; group.add(arm);
      }
      if (conn.s) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(W, 0.07, armLen), mat);
        arm.position.set(0, 0.04, W / 2 + armLen / 2);
        arm.receiveShadow = true; group.add(arm);
      }
      if (conn.e) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.07, W), mat);
        arm.position.set(W / 2 + armLen / 2, 0.04, 0);
        arm.receiveShadow = true; group.add(arm);
      }
      if (conn.w) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.07, W), mat);
        arm.position.set(-(W / 2 + armLen / 2), 0.04, 0);
        arm.receiveShadow = true; group.add(arm);
      }
      // Street lantern every 2 tiles (checkerboard pattern)
      if (((x + z) % 2 + 2) % 2 === 0) {
        const lPostMat = new THREE.MeshLambertMaterial({ color: 0x4a3820 });
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), lPostMat);
        post.position.set(W / 2 + 0.16, 0.57, 0);
        group.add(post);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.04), lPostMat);
        arm.position.set(W / 2 + 0.16 - 0.14, 1.0, 0);
        group.add(arm);
        const lantMat = new THREE.MeshLambertMaterial({ color: 0xffd080, emissive: 0xffa020, emissiveIntensity: 0.8 });
        const lant = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.1), lantMat);
        lant.position.set(W / 2 + 0.16 - 0.28, 1.06, 0);
        group.add(lant);
        const lLight = new THREE.PointLight(0xffb040, 0, 8.0);
        lLight.position.set(W / 2 + 0.16 - 0.28, 1.1, 0);
        lLight.userData._isWindowLight = true;
        lLight.userData._nightInt = 2.2;
        group.add(lLight);
      }
      group.position.set(x * CELL, 0, z * CELL);
      scene.add(group);
      return group;
    }

    function updateRoadNeighbors(x, z) {
      const rs = new Set(S.roads || []);
      [{ x, z: z - 1 }, { x, z: z + 1 }, { x: x + 1, z }, { x: x - 1, z }].forEach(n => {
        const key = gridKey(n.x, n.z);
        if (rs.has(key)) {
          if (roadMeshes[key]) scene.remove(roadMeshes[key]);
          roadMeshes[key] = makeRoadMesh(n.x, n.z);
        }
      });
    }

    function rebuildRoads() {
      for (const key in roadMeshes) { disposeObject3D(roadMeshes[key]); scene.remove(roadMeshes[key]); delete roadMeshes[key]; }
      (S.roads || []).forEach(key => {
        const [x, z] = key.split(',').map(Number);
        roadMeshes[key] = makeRoadMesh(x, z);
      });
    }

    function addRoadMesh(key) {
      const [x, z] = key.split(',').map(Number);
      if (roadMeshes[key]) scene.remove(roadMeshes[key]);
      roadMeshes[key] = makeRoadMesh(x, z);
      updateRoadNeighbors(x, z);
    }

    function removeRoadMesh(key) {
      if (roadMeshes[key]) { scene.remove(roadMeshes[key]); delete roadMeshes[key]; }
      const [x, z] = key.split(',').map(Number);
      updateRoadNeighbors(x, z);
    }

    function enterRoadMode() {
      if (moveMode) exitMoveMode(true);
      roadMode = true;
      document.getElementById('sel-info').style.display = 'none';
      document.getElementById('road-banner').classList.add('active');
      document.getElementById('road-mode-btn').classList.add('active');
      canvas.style.cursor = 'crosshair';
    }

    function exitRoadMode() {
      roadMode = false;
      cellRoadHighlight.visible = false;
      document.getElementById('road-banner').classList.remove('active');
      document.getElementById('road-mode-btn').classList.remove('active');
      canvas.style.cursor = '';
    }

    function toggleRoadMode() {
      if (roadMode) exitRoadMode();
      else enterRoadMode();
    }

    function getGridCellFromMouse(e) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(groundPlane);
      if (!hits.length) return null;
      const p = hits[0].point;
      const gx = Math.round(p.x / CELL);
      const gz = Math.round(p.z / CELL);
      // Clamp to grid bounds
      const half = Math.floor(GRID / 2) - 1;
      if (Math.abs(gx) > half || Math.abs(gz) > half) return null;
      return { x: gx, z: gz };
    }

    function applyPickupVisual(grp) {
      // Make building semi-transparent + lift it slightly
      grp.traverse(c => {
        if (c.isMesh) {
          c.material = c.material.clone();
          c.material.transparent = true;
          c.material.opacity = 0.55;
          if (c.material.emissive) c.material.emissive.setHex(0x886622);
          c.material.emissiveIntensity = 0.6;
        }
      });
      // Float animation
      grp._moveFloatT = 0;
    }

    function clearPickupVisual(grp) {
      grp.traverse(c => {
        if (c.isMesh) {
          c.material = c.material.clone();
          c.material.transparent = false;
          c.material.opacity = 1.0;
          if (c.material.emissive) {
            c.material.emissive.setHex(0);
            c.material.emissiveIntensity = 0;
          }
        }
      });
      grp.position.y = 0;
      grp.rotation.y = 0;
      grp._moveFloatT = undefined;
      grp._moveFloatY = undefined;
    }

    function enterMoveMode(grp, bid, gx, gz) {
      // Cancel existing selection info
      document.getElementById('sel-info').style.display = 'none';
      clearTimeout(_selTimeout);

      moveMode = true;
      moveGroup = grp;
      moveBuildingId = bid;
      moveOrigX = gx;
      moveOrigZ = gz;

      applyPickupVisual(grp);
      document.getElementById('move-banner').classList.add('active');
      canvas.style.cursor = 'crosshair';
    }

    function exitMoveMode(cancelled) {
      if (!moveMode) return;
      moveMode = false;

      if (cancelled && moveGroup) {
        // Snap back to original position
        clearPickupVisual(moveGroup);
        moveGroup.position.set(moveOrigX * CELL, 0, moveOrigZ * CELL);
        moveGroup.userData.gridX = moveOrigX;
        moveGroup.userData.gridZ = moveOrigZ;
      }

      cellHighlight.visible = false;
      cellBlocked.visible = false;
      moveGroup = null;
      moveBuildingId = null;
      moveOrigX = null;
      moveOrigZ = null;
      moveHoverCell = { x: null, z: null };
      document.getElementById('move-banner').classList.remove('active');
      canvas.style.cursor = '';
    }

    function commitMove(tx, tz) {
      if (!hasRoadAccess(tx, tz, moveBuildingId)) {
        _gameCbs?.notify('Kein Straßenzugang hier!', 'warning');
        cellBlocked.visible = true;
        cellBlocked.position.set(tx * CELL, 0.04, tz * CELL);
        setTimeout(() => { cellBlocked.visible = false; }, 800);
        return;
      }
      delete gridOccupied[gridKey(moveOrigX, moveOrigZ)];
      gridOccupied[gridKey(tx, tz)] = moveBuildingId;

      clearPickupVisual(moveGroup);
      moveGroup.position.set(tx * CELL, 0, tz * CELL);
      moveGroup.userData.gridX = tx;
      moveGroup.userData.gridZ = tz;

      // Persist new position in state
      const instances = S.buildings[moveBuildingId];
      if (instances) {
        const inst = instances.find(i => i.x === moveOrigX && i.z === moveOrigZ);
        if (inst) { inst.x = tx; inst.z = tz; }
      }
      _gameCbs?.save();

      // Pop animation
      let t = 0;
      const grp = moveGroup;
      const anim = () => {
        t += 0.08;
        const bounce = t < 0.7 ? 1 + Math.sin(t / 0.7 * Math.PI) * 0.12 : 1;
        grp.scale.set(bounce, bounce, bounce);
        if (t < 0.7) requestAnimationFrame(anim);
        else grp.scale.set(1, 1, 1);
      };
      requestAnimationFrame(anim);

      exitMoveMode(false);
      _gameCbs?.notify('Gebäude verschoben');
    }

    // MOUSEMOVE: pan + hover highlight + tooltip
    canvas.addEventListener('mousemove', e => {
      // Right-mouse pan
      if (_panDragging) {
        const dx = e.clientX - _panStart.x;
        const dy = e.clientY - _panStart.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) _panMoved = true;
        _panStart.x = e.clientX; _panStart.y = e.clientY;
        const right = new THREE.Vector3();
        right.setFromMatrixColumn(camera.matrixWorld, 0);
        right.y = 0; right.normalize();
        const fwd = new THREE.Vector3(-right.z, 0, right.x);
        const spd = camCurrent.dist * 0.0012;
        camTarget.addScaledVector(right, -dx * spd);
        camTarget.addScaledVector(fwd, dy * spd);
        camTarget.x = Math.max(-12, Math.min(12, camTarget.x));
        camTarget.z = Math.max(-12, Math.min(12, camTarget.z));
        updateCamera();
      }

      if (roadMode) {
        const cell = getGridCellFromMouse(e);
        if (!cell) { cellRoadHighlight.visible = false; return; }
        const key = gridKey(cell.x, cell.z);
        if (gridOccupied[key]) { cellRoadHighlight.visible = false; return; }
        const hasRoad = (S.roads || []).indexOf(key) >= 0;
        cellRoadHighlight.material.color.setHex(hasRoad ? 0xc04030 : 0xc8a030);
        cellRoadHighlight.visible = true;
        cellRoadHighlight.position.set(cell.x * CELL, 0.04, cell.z * CELL);
        document.getElementById('hoverTooltip').style.display = 'none';
        return;
      }

      if (moveMode) {
        const cell = getGridCellFromMouse(e);
        if (!cell) {
          cellHighlight.visible = false;
          cellBlocked.visible = false;
          return;
        }
        const { x, z } = cell;
        const key = gridKey(x, z);
        const isOrig = (x === moveOrigX && z === moveOrigZ);
        const isOccupied = gridOccupied[key] && !isOrig;
        const noRoadAccess = !isOrig && !hasRoadAccess(x, z, moveBuildingId);
        const worldX = x * CELL, worldZ = z * CELL;
        if (isOccupied || noRoadAccess) {
          cellHighlight.visible = false;
          cellBlocked.visible = true;
          cellBlocked.position.set(worldX, 0.04, worldZ);
        } else {
          cellBlocked.visible = false;
          cellHighlight.visible = true;
          cellHighlight.position.set(worldX, 0.04, worldZ);
        }
        moveGroup.position.set(worldX, moveGroup._moveFloatY || 0.5, worldZ);
        moveHoverCell = { x, z, occupied: isOccupied || noRoadAccess };
        document.getElementById('hoverTooltip').style.display = 'none';
        return;
      }

      // Hover tooltip
      const htRect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - htRect.left) / htRect.width) * 2 - 1;
      mouse.y = -((e.clientY - htRect.top) / htRect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const htEl = document.getElementById('hoverTooltip');

      // Check obstacle hover first
      const obsHoverHits = raycaster.intersectObjects(_obstacleRaycastTargets, false);
      if (obsHoverHits.length > 0 && obsHoverHits[0].object.userData.isObstacle) {
        const obj = obsHoverHits[0].object;
        const obsDef = OBSTACLES.find(o => o.id === obj.userData.obstacleId);
        if (obsDef) {
          const yieldStr = Object.entries(obsDef.yield || {}).map(([k, v]) => `+${v} ${k}`).join(', ');
          const costStr = obsDef.cost && obsDef.cost.gold > 0 ? ` (kostet ${obsDef.cost.gold}🪙)` : '';
          htEl.innerHTML = `<strong>${obsDef.name}</strong><br><span style="color:var(--green2);font-size:11px">Klicken → ${yieldStr}${costStr}</span>`;
          htEl.style.left = (e.clientX + 14) + 'px';
          htEl.style.top = (e.clientY - 10) + 'px';
          htEl.style.display = 'block';
          showObstacleHoverRing(obj.userData.obstacleX, obj.userData.obstacleZ);
        }
        return;
      }
      hideObstacleHoverRing();

      const htHits = raycaster.intersectObjects(buildingGroups, false);
      if (htHits.length > 0) {
        const htObj = htHits[0].object;
        const htBid = htObj.userData.buildingId;
        const htGrp = htObj.userData.group;
        if (htBid && htGrp) {
          const htB = BUILDINGS.find(x => x.id === htBid);
          const htInstIdx = htGrp.userData.instIndex || 0;
          const htInst = (S.buildings[htBid] || [])[htInstIdx];
          const htLvl = htInst ? (htInst.level || 1) : 1;
          const htLM = [1.0, 1.3, 1.7, 2.2, 3.0][htLvl - 1];
          const htIcons = { holz: '🪵', stein: '🪨', nahrung: '🌾', gold: '🪙', eisen: '⚙️', kohle: '🔥' };
          let prodHtml = '';
          if (htB && htB.prod) {
            const entries = Object.entries(htB.prod).filter(([, v]) => v !== 0);
            if (entries.length) {
              prodHtml = '<hr class="ht-sep">' + entries.map(([res, rate]) => {
                const actual = (rate * htLM).toFixed(2);
                const cls = rate >= 0 ? 'ht-pos' : 'ht-neg';
                const sign = rate >= 0 ? '+' : '';
                return `<div class="ht-prod ${cls}">${htIcons[res] || res} ${sign}${actual}/s</div>`;
              }).join('');
            }
          }
          htEl.innerHTML = `<strong>${htB ? htB.name : htBid}</strong> <span style="color:var(--gold);font-size:11px">Lv.${htLvl}</span>${prodHtml}`;
          htEl.style.left = (e.clientX + 14) + 'px';
          htEl.style.top = (e.clientY - 10) + 'px';
          htEl.style.display = 'block';
        }
      } else {
        htEl.style.display = 'none';
        hideObstacleHoverRing();
      }
    });

    // CLICK handler
    canvas.addEventListener('click', e => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      if (roadMode) {
        const cell = getGridCellFromMouse(e);
        if (!cell) return;
        const key = gridKey(cell.x, cell.z);
        if (gridOccupied[key]) { _gameCbs?.notify('Hier steht ein Gebäude!', 'warning'); return; }
        _gameCbs?.toggleRoad(key, cell.x, cell.z);
        return;
      }

      if (moveMode) {
        // Klick 2: place building
        if (moveHoverCell.x === null) return;
        if (moveHoverCell.occupied) {
          _gameCbs?.notify('Feld besetzt!');
          return;
        }
        commitMove(moveHoverCell.x, moveHoverCell.z);
        return;
      }

      // Klick: obstacle removal check first
      const obsClickHits = raycaster.intersectObjects(_obstacleRaycastTargets, false);
      if (obsClickHits.length > 0 && obsClickHits[0].object.userData.isObstacle) {
        const obj = obsClickHits[0].object;
        _gameCbs?.removeObstacle(obj.userData.obstacleId, obj.userData.obstacleX, obj.userData.obstacleZ);
        hideObstacleHoverRing();
        return;
      }

      // Klick 1: select building
      const intersects = raycaster.intersectObjects(buildingGroups, false);
      if (intersects.length > 0) {
        const obj = intersects[0].object;
        const bid = obj.userData.buildingId;
        const grp = obj.userData.group;
        const instIdx = grp.userData.instIndex || 0;
        window.showBuildingInfo(bid, instIdx, grp);
      } else {
        // Click on empty space — cancel move or deselect
        if (!moveMode) {
          document.getElementById('sel-info').style.display = 'none';
        }
      }
    });

    // Right-click → cancel move (only if not panning)
    canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (_panMoved) { _panMoved = false; return; }
      if (moveMode) exitMoveMode(true);
    });

    // ESC → cancel move
    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') { exitMoveMode(true); exitRoadMode(); return; }
      if (e.key === 'ArrowLeft') rotateCam(-1);
      else if (e.key === 'ArrowRight') rotateCam(1);
      else if (e.key === '+' || e.key === '=') zoomCam(-1);
      else if (e.key === '-') zoomCam(1);
      else if (e.key === 'ArrowUp') tiltCam(-1);
      else if (e.key === 'ArrowDown') tiltCam(1);
    });

    // ============================================================
    // HELPER FUNCTIONS (Phase 5)
    // ============================================================
    function hasRoadAccess(gx, gz, bldId) {
      if (bldId === 'rathaus') return true;
      const rs = new Set(S.roads || []);
      return rs.has(`${gx},${gz - 1}`) || rs.has(`${gx},${gz + 1}`) ||
             rs.has(`${gx - 1},${gz}`) || rs.has(`${gx + 1},${gz}`);
    }

    // ============================================================
    // ENVIRONMENT: FOREST BORDER + MOUNTAINS
    // ============================================================
    function buildForestBorder() {
      const G = GRID * CELL / 2 + 1.5; // inner clear zone (~15.5 units)
      const outer = G + 9;
      const step = 2.1;
      const positions = [];

      for (let wx = -outer; wx <= outer; wx += step) {
        for (let wz = -outer; wz <= outer; wz += step) {
          if (Math.abs(wx) < G && Math.abs(wz) < G) continue;
          const s = Math.sin(wx * 13.9898 + wz * 78.2334) * 43758.5453;
          const rng = s - Math.floor(s);
          if (rng > 0.68) continue;
          const jx = Math.sin(wx * 7.7 + wz * 3.1) * 0.7;
          const jz = Math.sin(wx * 5.3 + wz * 11.2) * 0.7;
          positions.push({ x: wx + jx, z: wz + jz, seed: rng });
        }
      }

      const N = Math.min(positions.length, 320);
      const coneGeo = new THREE.ConeGeometry(0.7, 2.9, 6);
      const colors = [0x2a4a10, 0x1a3005, 0x3a5a15];
      const groupCount = [0, 0, 0];
      positions.slice(0, N).forEach((_, i) => groupCount[i % 3]++);

      const iMeshes = colors.map((c, ci) => {
        const m = new THREE.InstancedMesh(
          coneGeo,
          new THREE.MeshLambertMaterial({ color: c }),
          groupCount[ci]
        );
        m.castShadow = true;
        return m;
      });

      const counts = [0, 0, 0];
      const dummy = new THREE.Object3D();
      positions.slice(0, N).forEach((pos, i) => {
        const ci = i % 3;
        const scale = 0.72 + pos.seed * 0.58;
        dummy.position.set(pos.x, scale * 1.45, pos.z);
        dummy.rotation.y = pos.seed * Math.PI * 2;
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        iMeshes[ci].setMatrixAt(counts[ci]++, dummy.matrix);
      });
      iMeshes.forEach(m => { m.instanceMatrix.needsUpdate = true; scene.add(m); });

      // Trunks as a single InstancedMesh
      const trunkGeo = new THREE.CylinderGeometry(0.1, 0.155, 0.8, 5);
      const trunkIM = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x3a2010 }), N);
      let tc = 0;
      positions.slice(0, N).forEach(pos => {
        const scale = 0.72 + pos.seed * 0.58;
        dummy.position.set(pos.x, 0.4 * scale, pos.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunkIM.setMatrixAt(tc++, dummy.matrix);
      });
      trunkIM.count = tc;
      trunkIM.instanceMatrix.needsUpdate = true;
      scene.add(trunkIM);
    }

    function buildMountainBorder() {
      const peakGeo = new THREE.ConeGeometry(1.9, 4.5, 5);
      const smallGeo = new THREE.DodecahedronGeometry(0.95);
      const matLight = new THREE.MeshLambertMaterial({ color: 0x708090 });
      const matDark  = new THREE.MeshLambertMaterial({ color: 0x4a5a6a });
      const matSnow  = new THREE.MeshLambertMaterial({ color: 0xb0bcc0 });

      const peaks = [
        { x: -22, z: -8,  s: 1.4 }, { x: -20, z: -2,  s: 1.1 },
        { x: -21, z:  4,  s: 1.3 }, { x: -19, z: 10,  s: 1.0 },
        { x: -23, z: -14, s: 0.9 }, { x: -24, z: 16,  s: 1.2 },
        { x: -16, z: -20, s: 0.9 }, { x: -22, z: -20, s: 1.1 },
      ];
      peaks.forEach(p => {
        const peak = new THREE.Mesh(peakGeo, matLight);
        peak.position.set(p.x, p.s * 2.25, p.z);
        peak.scale.setScalar(p.s);
        peak.castShadow = true;
        scene.add(peak);
        const snow = new THREE.Mesh(new THREE.ConeGeometry(0.8 * p.s, 1.6 * p.s, 5), matSnow);
        snow.position.set(p.x, p.s * 3.85, p.z);
        scene.add(snow);
        const boulder = new THREE.Mesh(smallGeo, matDark);
        boulder.position.set(p.x + 1.6, 0.5, p.z - 1.2);
        boulder.rotation.set(0.3, 0.5, 0.2);
        scene.add(boulder);
      });

      // Scattered small rocks (fixed positions for determinism)
      const rockData = [
        [-17,-6,0.55], [-18,2,0.7], [-16,8,0.5], [-19,-12,0.65], [-15,-16,0.6],
        [-17,14,0.7], [-20,-18,0.55], [-13,-19,0.5], [-14,18,0.65],
      ];
      rockData.forEach(([rx, rz, rs]) => {
        const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rs), matDark);
        r.position.set(rx, rs * 0.5, rz);
        r.rotation.set(0.4, 1.1, 0.7);
        r.castShadow = true;
        scene.add(r);
      });
    }

    // ============================================================
    // OBSTACLE MESH SYSTEM
    // ============================================================
    function buildObstacleMesh(obs) {
      const group = new THREE.Group();
      const obsDef = OBSTACLES.find(o => o.id === obs.id);
      if (!obsDef) return group;

      if (obsDef.shape === 'pine') {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.13, 0.6, 5),
          new THREE.MeshLambertMaterial({ color: 0x3a2010 })
        );
        trunk.position.y = 0.3;
        trunk.castShadow = true;
        group.add(trunk);
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(0.55, 2.0, 6),
          new THREE.MeshLambertMaterial({ color: 0x3a5220 })
        );
        cone.position.y = 1.6;
        cone.castShadow = true;
        group.add(cone);
        const coneTop = new THREE.Mesh(
          new THREE.ConeGeometry(0.35, 1.2, 6),
          new THREE.MeshLambertMaterial({ color: 0x2a4a10 })
        );
        coneTop.position.y = 2.45;
        coneTop.castShadow = true;
        group.add(coneTop);

      } else if (obsDef.shape === 'rock') {
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.78),
          new THREE.MeshLambertMaterial({ color: 0x708090 })
        );
        rock.position.y = 0.5;
        rock.rotation.set(0.3, 0.7, 0.2);
        rock.castShadow = true;
        group.add(rock);
        const small = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.45),
          new THREE.MeshLambertMaterial({ color: 0x5a6a7a })
        );
        small.position.set(0.52, 0.3, 0.32);
        small.rotation.set(0.7, 0.3, 0.5);
        group.add(small);
      }

      group.traverse(c => {
        if (c.isMesh) {
          c.userData.isObstacle = true;
          c.userData.obstacleKey = obs.x + ',' + obs.z;
          c.userData.obstacleX = obs.x;
          c.userData.obstacleZ = obs.z;
          c.userData.obstacleId = obs.id;
          c.userData.group = group;
        }
      });

      group.position.set(obs.x * CELL, 0, obs.z * CELL);
      group.userData.isObstacleGroup = true;
      return group;
    }

    function clearObstacles() {
      _obstacleGroups.forEach(g => { disposeObject3D(g); scene.remove(g); });
      _obstacleGroups = [];
      _obstacleRaycastTargets = [];
      _obstacleMeshes = {};
    }

    function renderObstacles() {
      clearObstacles();
      if (!S.obstacles || !S.obstacles.length) return;
      // Remove obstacles that conflict with already-placed buildings
      S.obstacles = S.obstacles.filter(obs => !gridOccupied[obs.x + ',' + obs.z]);
      S.obstacles.forEach(obs => {
        const key = obs.x + ',' + obs.z;
        gridOccupied[key] = '__obstacle__';
        const group = buildObstacleMesh(obs);
        scene.add(group);
        _obstacleGroups.push(group);
        _obstacleMeshes[key] = group;
        group.traverse(c => {
          if (c.isMesh && c.userData.isObstacle) {
            _obstacleRaycastTargets.push(c);
          }
        });
      });
    }

    function showObstacleHoverRing(x, z) {
      if (!_obstacleHoverRing) {
        _obstacleHoverRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.72, 0.065, 8, 24),
          new THREE.MeshLambertMaterial({ color: 0xffba20, emissive: 0xffba20, emissiveIntensity: 0.5 })
        );
        _obstacleHoverRing.rotation.x = Math.PI / 2;
        _obstacleHoverRing.position.y = 0.1;
        scene.add(_obstacleHoverRing);
      }
      _obstacleHoverRing.position.set(x * CELL, 0.1, z * CELL);
      _obstacleHoverRing.visible = true;
    }

    function hideObstacleHoverRing() {
      if (_obstacleHoverRing) _obstacleHoverRing.visible = false;
    }

    function triggerObstacleRemovalAnim(x, z, type) {
      const key = x + ',' + z;
      const group = window._obstacleMeshes && window._obstacleMeshes[key];

      if (type === 'tree' && group) {
        let t = 0;
        const anim = () => {
          t += 0.065;
          group.rotation.x = Math.min(t * 2.4, Math.PI / 2);
          group.scale.setScalar(Math.max(0, 1 - Math.max(0, t - 0.55) * 2.8));
          if (t < 1.1) {
            requestAnimationFrame(anim);
          } else {
            scene.remove(group);
            const smokeG = new THREE.Group();
            smokeG.position.set(x * CELL, 0, z * CELL);
            scene.add(smokeG);
            createSmokeEmitter(smokeG, 0, 0.6, 0);
            setTimeout(() => scene.remove(smokeG), 3200);
          }
        };
        requestAnimationFrame(anim);
      } else {
        // Boulder shatter
        if (group) scene.remove(group);
        const fragMat = new THREE.MeshLambertMaterial({ color: 0x708090, transparent: true });
        const frags = [];
        for (let i = 0; i < 8; i++) {
          const frag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), fragMat.clone());
          frag.position.set(x * CELL, 0.5, z * CELL);
          const angle = (i / 8) * Math.PI * 2;
          frag._vx = Math.cos(angle) * 0.13;
          frag._vy = 0.14 + (i % 3) * 0.04;
          frag._vz = Math.sin(angle) * 0.13;
          scene.add(frag);
          frags.push(frag);
        }
        let t = 0;
        const anim = () => {
          t += 0.065;
          frags.forEach(f => {
            f.position.x += f._vx;
            f.position.y += f._vy;
            f.position.z += f._vz;
            f._vy -= 0.022;
            f.rotation.x += 0.18;
            f.material.opacity = Math.max(0, 1 - t * 2.2);
          });
          if (t < 0.5) requestAnimationFrame(anim);
          else frags.forEach(f => scene.remove(f));
        };
        requestAnimationFrame(anim);
      }

      // Clean from tracking
      delete _obstacleMeshes[key];
      _obstacleGroups = _obstacleGroups.filter(g => g !== group);
      _obstacleRaycastTargets = _obstacleRaycastTargets.filter(m =>
        m.userData.obstacleKey !== key
      );
    }

    // ============================================================
    // TIER-BASED MAP STAGE (entry zone, south side)
    // ============================================================
    function updateMapStage(tier) {
      if (_stageGroup) { scene.remove(_stageGroup); _stageGroup = null; }
      const g = new THREE.Group();
      const southZ = GRID * CELL / 2 + 1;

      // Base path — always present
      const pathMat = new THREE.MeshLambertMaterial({ color: tier >= 1 ? 0x706050 : 0x5a3a20 });
      const path = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 9), pathMat);
      path.position.set(0, 0.03, southZ + 4.5);
      g.add(path);

      if (tier === 0) {
        // Signpost
        const postMat = new THREE.MeshLambertMaterial({ color: 0x5a3a18 });
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.9, 6), postMat);
        post.position.set(2.0, 0.95, southZ + 5.5);
        g.add(post);
        const sign = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.42, 0.09),
          new THREE.MeshLambertMaterial({ color: 0xa08060 }));
        sign.position.set(2.48, 1.78, southZ + 5.5);
        g.add(sign);
      }

      if (tier >= 1) {
        // Cobblestone tile accents on path
        const cobMat = new THREE.MeshLambertMaterial({ color: 0x656055 });
        for (let i = 0; i < 6; i++) {
          const tile = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 1.35), cobMat);
          tile.position.set((i % 2 === 0 ? -0.62 : 0.62), 0.05, southZ + 1.5 + Math.floor(i / 2) * 1.5);
          g.add(tile);
        }
      }

      if (tier >= 2) {
        // Stone gate
        const stoneMat = new THREE.MeshLambertMaterial({ color: 0x808070 });
        const towerGeo = new THREE.BoxGeometry(1.3, 4.2, 1.3);
        [-2.5, 2.5].forEach(ox => {
          const tower = new THREE.Mesh(towerGeo, stoneMat);
          tower.position.set(ox, 2.1, southZ + 0.5);
          tower.castShadow = true;
          g.add(tower);
        });
        const beam = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.65, 0.65), stoneMat);
        beam.position.set(0, 3.85, southZ + 0.5);
        g.add(beam);
        // Lanterns on gate towers
        const lMat = new THREE.MeshLambertMaterial({ color: 0xffd080, emissive: 0xffa020, emissiveIntensity: 0.9 });
        [-2.1, 2.1].forEach(ox => {
          const lant = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.22), lMat);
          lant.position.set(ox, 4.55, southZ + 0.5);
          g.add(lant);
          const lLight = new THREE.PointLight(0xffb040, 0, 9.0);
          lLight.position.set(ox, 4.6, southZ + 0.5);
          lLight.userData._isWindowLight = true;
          lLight.userData._nightInt = 3.0;
          g.add(lLight);
        });
      }

      scene.add(g);
      _stageGroup = g;
    }

    // Initial ground texture — solid grass, immediately replaced by updateGroundTexture after init
    function createGroundTexture() {
      const cv = document.createElement('canvas');
      cv.width = 64; cv.height = 64;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#4a6830';
      ctx.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(cv);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 1);
      return tex;
    }

    const TERRAIN_COLORS = {
      default:  { base: '#4a6830', hi: 'rgba(80,115,45,0.5)',  lo: 'rgba(28,44,14,0.4)' },
      farm:     { base: '#7a8818', hi: 'rgba(130,148,24,0.55)', lo: 'rgba(44,52,8,0.4)'  },
      forest:   { base: '#1c3a0a', hi: 'rgba(32,62,14,0.6)',   lo: 'rgba(8,18,2,0.55)'  },
      quarry:   { base: '#9a8462', hi: 'rgba(148,130,98,0.5)', lo: 'rgba(55,42,24,0.5)' },
      mine:     { base: '#3c3028', hi: 'rgba(58,48,38,0.4)',   lo: 'rgba(14,10,6,0.65)' },
      forge:    { base: '#28180a', hi: 'rgba(52,28,8,0.4)',    lo: 'rgba(8,4,0,0.7)'    },
      cobble:   { base: '#7a7260', hi: 'rgba(118,110,90,0.4)', lo: 'rgba(38,34,24,0.4)' },
      church:   { base: '#9a8852', hi: 'rgba(148,135,84,0.45)',lo: 'rgba(48,36,18,0.4)' },
    };

    function getTerrainType(b) {
      const id = b.id;
      if (id === 'feld') return 'farm';
      if (id === 'waldarbeiter') return 'forest';
      if (id === 'steinbruch') return 'quarry';
      if (id === 'bergwerk') return 'mine';
      if (id === 'schmiede' || id === 'schmelze' || id === 'koehlerei') return 'forge';
      if (id === 'markt' || id === 'rathaus') return 'cobble';
      if (id === 'kirche' || id === 'kathedrale') return 'church';
      return 'default';
    }

    function buildTerrainMap() {
      const size = GRID;
      const map = [];
      for (let i = 0; i < size; i++) map.push(new Array(size).fill('default'));
      if (!S || !S.buildings) return map;
      const half = Math.floor(size / 2);
      for (const [id, instances] of Object.entries(S.buildings)) {
        if (!Array.isArray(instances)) continue;
        const b = BUILDINGS.find(x => x.id === id);
        if (!b) continue;
        const type = getTerrainType(b);
        for (const inst of instances) {
          if (inst.x === null || inst.x === undefined) continue;
          const cx = inst.x + half, cz = inst.z + half;
          const radius = type === 'cobble' ? 2 : 1;
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
              const mx = cx + dx, mz = cz + dz;
              if (mx >= 0 && mx < size && mz >= 0 && mz < size) {
                if (map[mx][mz] === 'default' || type === 'cobble') {
                  map[mx][mz] = type;
                }
              }
            }
          }
        }
      }
      return map;
    }

    function buildGroundCanvas(terrainMap) {
      const TEX = 1024;
      const cv = document.createElement('canvas');
      cv.width = TEX; cv.height = TEX;
      const ctx = cv.getContext('2d');
      const cellPx = TEX / GRID; // ~73px per cell

      // 1. Fill each cell with its base terrain color
      for (let gx = 0; gx < GRID; gx++) {
        for (let gz = 0; gz < GRID; gz++) {
          const type = (terrainMap && terrainMap[gx][gz]) || 'default';
          const tc = TERRAIN_COLORS[type] || TERRAIN_COLORS.default;
          const px = gx * cellPx, py = gz * cellPx;
          ctx.fillStyle = tc.base;
          ctx.fillRect(px, py, cellPx, cellPx);

          // Cobblestone: visible tile grid
          if (type === 'cobble') {
            const cols = 3, rows = 3;
            const tw = cellPx / cols, th = cellPx / rows;
            for (let tx = 0; tx < cols; tx++) {
              for (let ty = 0; ty < rows; ty++) {
                const sh = 100 + ((gx * 7 + gz * 11 + tx * 4 + ty * 6) % 32);
                ctx.fillStyle = `rgb(${sh + 18},${sh + 10},${sh - 4})`;
                ctx.fillRect(px + tx * tw + 1.5, py + ty * th + 1.5, tw - 3, th - 3);
              }
            }
            ctx.strokeStyle = 'rgba(30,24,14,0.55)'; ctx.lineWidth = 1.5;
            for (let tx = 1; tx < cols; tx++) {
              ctx.beginPath(); ctx.moveTo(px + tx * tw, py); ctx.lineTo(px + tx * tw, py + cellPx); ctx.stroke();
            }
            for (let ty = 1; ty < rows; ty++) {
              ctx.beginPath(); ctx.moveTo(px, py + ty * th); ctx.lineTo(px + cellPx, py + ty * th); ctx.stroke();
            }
          }

          // Farm: bold furrow lines with soil variation
          if (type === 'farm') {
            const rows = 6;
            const rh = cellPx / rows;
            for (let fi = 0; fi < rows; fi++) {
              const even = fi % 2 === 0;
              ctx.fillStyle = even ? 'rgba(120,138,20,0.45)' : 'rgba(55,44,10,0.35)';
              ctx.fillRect(px + 2, py + fi * rh + 1, cellPx - 4, rh - 2);
            }
          }

          // Forge/mine: ash and ember spots
          if (type === 'forge') {
            for (let s = 0; s < 6; s++) {
              const sx = px + ((gx * 31 + gz * 17 + s * 13) % Math.floor(cellPx - 8)) + 4;
              const sy = py + ((gx * 19 + gz * 37 + s * 7) % Math.floor(cellPx - 8)) + 4;
              ctx.fillStyle = s < 2 ? 'rgba(220,80,10,0.6)' : 'rgba(60,50,40,0.7)';
              ctx.beginPath(); ctx.arc(sx, sy, 2 + s % 3, 0, Math.PI * 2); ctx.fill();
            }
          }

          // Forest: dark moss patches
          if (type === 'forest') {
            for (let s = 0; s < 5; s++) {
              const sx = px + ((gx * 23 + gz * 41 + s * 17) % Math.floor(cellPx - 12)) + 6;
              const sy = py + ((gx * 37 + gz * 29 + s * 11) % Math.floor(cellPx - 12)) + 6;
              const sr = 3 + ((gx + gz + s) % 5);
              ctx.fillStyle = 'rgba(15,40,5,0.5)';
              ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
            }
          }

          // Quarry: angular rock lines
          if (type === 'quarry') {
            ctx.strokeStyle = 'rgba(80,60,35,0.45)'; ctx.lineWidth = 1;
            for (let s = 0; s < 4; s++) {
              const ly = py + ((gx * 13 + gz * 23 + s * 19) % Math.floor(cellPx - 8)) + 4;
              ctx.beginPath();
              ctx.moveTo(px + 2, ly);
              ctx.lineTo(px + cellPx * 0.6, ly + ((s * 7) % 8) - 4);
              ctx.stroke();
            }
          }
        }
      }

      // 2. Organic highlight blobs per cell (seeded for determinism)
      for (let gx = 0; gx < GRID; gx++) {
        for (let gz = 0; gz < GRID; gz++) {
          const type = (terrainMap && terrainMap[gx][gz]) || 'default';
          const tc = TERRAIN_COLORS[type] || TERRAIN_COLORS.default;
          const px = gx * cellPx, py = gz * cellPx;
          for (let s = 0; s < 3; s++) {
            const bx = px + ((gx * 17 + gz * 31 + s * 13) % Math.floor(cellPx - 16)) + 8;
            const by = py + ((gx * 29 + gz * 13 + s * 23) % Math.floor(cellPx - 16)) + 8;
            const br = 6 + ((gx * 7 + gz * 11 + s * 5) % 18);
            const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
            grad.addColorStop(0, tc.hi); grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
            ctx.fillStyle = grad; ctx.fill();
          }
          // Dark shadow spots
          for (let s = 0; s < 2; s++) {
            const bx = px + ((gx * 41 + gz * 19 + s * 37) % Math.floor(cellPx - 12)) + 6;
            const by = py + ((gx * 11 + gz * 43 + s * 29) % Math.floor(cellPx - 12)) + 6;
            const br = 4 + ((gx * 5 + gz * 9 + s * 7) % 10);
            ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
            ctx.fillStyle = tc.lo; ctx.fill();
          }
        }
      }

      // 3. Soft cell-edge darkening (replaces grid lines — looks like natural soil edges)
      for (let gx = 0; gx < GRID; gx++) {
        for (let gz = 0; gz < GRID; gz++) {
          const typeHere = (terrainMap && terrainMap[gx][gz]) || 'default';
          const px = gx * cellPx, py = gz * cellPx;
          const checkNeighbors = [
            { nx: gx + 1, nz: gz, side: 'right',  x1: px + cellPx - 4, y1: py, w: 4, h: cellPx },
            { nx: gx,     nz: gz + 1, side: 'bottom', x1: px, y1: py + cellPx - 4, w: cellPx, h: 4 },
          ];
          checkNeighbors.forEach(({ nx, nz, x1, y1, w, h }) => {
            if (nx < 0 || nx >= GRID || nz < 0 || nz >= GRID) return;
            const typeNext = (terrainMap && terrainMap[nx][nz]) || 'default';
            if (typeHere !== typeNext) {
              // Different terrain type → visible dark edge
              ctx.fillStyle = 'rgba(0,0,0,0.28)';
              ctx.fillRect(x1, y1, w, h);
            } else {
              // Same terrain → very subtle
              ctx.fillStyle = 'rgba(0,0,0,0.07)';
              ctx.fillRect(x1, y1, w, h);
            }
          });
        }
      }

      const tex = new THREE.CanvasTexture(cv);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 1);
      return tex;
    }

    function updateGroundTexture() {
      const tmap = buildTerrainMap();
      const newTex = buildGroundCanvas(tmap);
      groundMat.map?.dispose();
      groundMat.map = newTex;
      groundMat.map.needsUpdate = true;
      groundMat.needsUpdate = true;
    }

    // Stone plaza around town hall
    function createStonePlaza() {
      const S_size = 4 * CELL;
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 256;
      const ctx = canvas.getContext('2d');
      const tile = 64;
      for (let tx = 0; tx < 4; tx++) {
        for (let tz = 0; tz < 4; tz++) {
          const shade = 85 + Math.floor(Math.random() * 28);
          ctx.fillStyle = `rgb(${shade},${shade - 8},${shade - 18})`;
          ctx.fillRect(tx * tile + 1, tz * tile + 1, tile - 2, tile - 2);
        }
      }
      ctx.strokeStyle = '#2e2520'; ctx.lineWidth = 2;
      [1, 2, 3].forEach(i => {
        ctx.beginPath(); ctx.moveTo(i * tile, 0); ctx.lineTo(i * tile, 256); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * tile); ctx.lineTo(256, i * tile); ctx.stroke();
      });
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(S_size, S_size),
        new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(canvas) })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, 0.015, 0);
      scene.add(mesh);
    }

    // Level indicator rings on buildings
    const LEVEL_RING_COLORS = [null, null, 0xaa8833, 0xd4a840, 0xe06020, 0x8844cc];

    function updateLevelRing(group, level) {
      const old = group.getObjectByName('levelRing');
      if (old) group.remove(old);
      const color = LEVEL_RING_COLORS[level];
      if (!color) return;
      const r = group.userData.cellRadius || 0.65;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.055, 6, 28),
        new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.25 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.09;
      ring.name = 'levelRing';
      group.add(ring);
    }

    // Cosmetic details added per upgrade level
    function addLevelDetail(group, b, h, level) {
      if (!level || level < 2) return;
      const shape = b.shape;
      const mat = c => new THREE.MeshLambertMaterial({ color: c });
      const emMat = (c, e, ei) => new THREE.MeshLambertMaterial({ color: c, emissive: e, emissiveIntensity: ei });

      if (level >= 2) {
        if (shape === 'house') {
          const win2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.05),
            emMat(0xffe890, 0x806020, 0.5));
          win2.position.set(-CELL * 0.45 - 0.01, h * 0.35, 0);
          group.add(win2);
        } else if (shape === 'hut') {
          const logMat = mat(0x5a3a18);
          for (let li = 0; li < 2; li++) {
            const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.45, 6), logMat);
            lg.rotation.z = Math.PI / 2;
            lg.position.set(CELL * 0.35, 0.16 + li * 0.14, (li - 0.5) * 0.22);
            group.add(lg);
          }
        } else if (shape === 'farm') {
          const fenceMat = mat(0x6a4a20);
          [[-CELL * 0.44, 0, CELL * 0.88, 0.06], [CELL * 0.44, 0, CELL * 0.88, 0.06],
           [0, -CELL * 0.44, 0.06, CELL * 0.88], [0, CELL * 0.44, 0.06, CELL * 0.88]
          ].forEach(([fx, fz, fw, fd]) => {
            const f = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.22, fd), fenceMat);
            f.position.set(fx, 0.23, fz); group.add(f);
          });
        } else if (shape === 'quarry' || shape === 'mine') {
          const beam = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), mat(0x3a2a10));
          beam.position.set(-CELL * 0.3, 0.2 + 0.5, -CELL * 0.3);
          beam.castShadow = true; group.add(beam);
        } else if (shape === 'forge' || shape === 'smelter' || shape === 'armory') {
          const chim2 = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, h * 0.5, 6),
            mat(0x3a2820));
          chim2.position.set(-0.3, h * 0.45 + 0.12, 0.3);
          chim2.castShadow = true; group.add(chim2);
        } else if (shape === 'tower' || shape === 'watchtower') {
          const slitMat = mat(0x1a1208);
          for (const sz of [-0.2, 0.2]) {
            const slit = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, CELL * 0.52 + 0.01), slitMat);
            slit.position.set(0, h * 0.4, sz); group.add(slit);
          }
        } else if (shape === 'church' || shape === 'cathedral') {
          const glassColors = [0x8040ff, 0xff6020, 0x20c060];
          glassColors.forEach((c, i) => {
            const glass = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.04), emMat(c, c, 0.6));
            glass.position.set((i - 1) * 0.2, h * 0.3, CELL * 0.43 + 0.01); group.add(glass);
          });
        } else if (shape === 'market') {
          for (let i = 0; i < 4; i++) {
            const angle = i * Math.PI / 2;
            const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.4),
              mat([0xe83030, 0x20b020, 0xf0a010, 0x2070d0][i]));
            canopy.position.set(Math.sin(angle) * 0.6, 0.9, Math.cos(angle) * 0.6);
            group.add(canopy);
          }
        } else if (shape === 'hall') {
          const step = new THREE.Mesh(new THREE.BoxGeometry(CELL * 1.1, 0.07, CELL * 1.1),
            mat(0x5a4828));
          step.position.y = 0.035; group.add(step);
        } else {
          const arch = new THREE.Mesh(new THREE.BoxGeometry(0.48, h * 0.32, 0.06),
            mat(new THREE.Color(b.color3d).multiplyScalar(1.25).getHex()));
          arch.position.set(0, h * 0.16 + 0.12, CELL * 0.44); group.add(arch);
        }
      }

      if (level >= 3) {
        if (shape === 'house') {
          const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, h * 0.38, 6),
            mat(0x5a4a38));
          chim.position.set(-0.22, h * 0.6 + h * 0.19 + 0.12, 0.18);
          chim.castShadow = true; group.add(chim);
        } else if (shape === 'hut') {
          const axeMat = mat(0x7a5a30);
          for (const s of [-1, 1]) {
            const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), axeMat);
            handle.rotation.z = s * 0.5;
            handle.position.set(CELL * 0.5 + 0.01, h * 0.45, 0.1 * s); group.add(handle);
          }
        } else if (shape === 'farm') {
          const row4 = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.42, 0.1, 0.22),
            mat(0xe8c020));
          row4.position.set(-CELL * 0.26, 0.26, -0.53); group.add(row4);
        } else if (shape === 'quarry') {
          [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]].forEach(([bx, bz]) => {
            const beam = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.55, 0.09), mat(0x3a2a10));
            beam.position.set(bx, 0.8, bz); group.add(beam);
          });
        } else if (shape === 'mine') {
          const cartMat = mat(0xa09070);
          const cart = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.2), cartMat);
          cart.position.set(0, 0.22, 0.2); group.add(cart);
          for (const wx of [-0.09, 0.09]) {
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8), mat(0x505040));
            wheel.rotation.z = Math.PI / 2; wheel.position.set(wx, 0.16, 0.2); group.add(wheel);
          }
        } else if (shape === 'forge' || shape === 'smelter' || shape === 'armory') {
          const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.055, 8), mat(0x707060));
          gear.rotation.x = Math.PI / 2; gear.position.set(-0.1, h * 0.44 + 0.12, CELL * 0.44);
          group.add(gear);
        } else if (shape === 'tower' || shape === 'watchtower') {
          const pole = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.65, 0.05), mat(0xd4c090));
          pole.position.set(0.12, h + 0.58, 0); group.add(pole);
          const flag3 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.03),
            emMat(0xd43030, 0x881010, 0.3));
          flag3.position.set(0.25, h + 0.83, 0); group.add(flag3);
        } else if (shape === 'church' || shape === 'cathedral') {
          const bell = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.26), mat(b.color3d));
          bell.position.set(0, h * 0.5 + h * 0.42 + 0.04, 0); group.add(bell);
        } else if (shape === 'market') {
          for (const [lx, lz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.75, 0.05), mat(0x5a4020));
            post.position.set(lx, 0.5, lz); group.add(post);
            const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1),
              emMat(0xffd080, 0xffa020, 0.8));
            lantern.position.set(lx, 0.96, lz); group.add(lantern);
          }
        } else if (shape === 'hall') {
          const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.38, 0.05), mat(0xd4a840));
          p2.position.set(-0.22, h * 0.85 + h * 0.4 + 0.55 + 0.12, 0); group.add(p2);
          const f2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.03),
            emMat(0xf0c000, 0xd4a000, 0.3));
          f2.position.set(-0.32, h * 0.85 + h * 0.4 + 0.66 + 0.12, 0); group.add(f2);
        } else {
          const orn = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.78, 0.055, CELL * 0.78),
            mat(new THREE.Color(b.color3d).multiplyScalar(0.72).getHex()));
          orn.position.y = h + 0.13; group.add(orn);
        }
      }

      if (level >= 4) {
        if (shape === 'house') {
          const fb = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.09), mat(0x306010));
          fb.position.set(CELL * 0.45 + 0.01, h * 0.27, 0); group.add(fb);
        } else if (shape === 'hut') {
          const eArch = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.1, 0.06), mat(0x4a3a20));
          eArch.position.set(0, h * 0.44 + 0.12, CELL * 0.36 + 0.01); group.add(eArch);
        } else if (shape === 'farm') {
          const barn = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.36, h * 0.48, CELL * 0.33),
            mat(0x9a2010));
          barn.position.set(-CELL * 0.3, h * 0.24 + 0.12, -CELL * 0.31);
          barn.castShadow = true; group.add(barn);
          const barnRoof = new THREE.Mesh(new THREE.ConeGeometry(CELL * 0.27, 0.33, 4),
            mat(0x6a1808));
          barnRoof.position.set(-CELL * 0.3, h * 0.48 + 0.28, -CELL * 0.31);
          barnRoof.rotation.y = Math.PI / 4; group.add(barnRoof);
        } else if (shape === 'quarry') {
          const crane = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.15, 0.09), mat(0x4a3820));
          crane.position.set(0.54, 0.87 + 0.575, -0.28); group.add(crane);
          const craneArm = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.09, 0.09), mat(0x4a3820));
          craneArm.position.set(0.54 - 0.36, 0.87 + 1.25, -0.28); group.add(craneArm);
        } else if (shape === 'mine') {
          const a1 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.75, 0.09), mat(0x3a2a10));
          const a2 = a1.clone();
          a1.position.set(-0.38, 0.38, CELL * 0.35); a2.position.set(0.38, 0.38, CELL * 0.35);
          const at = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.09, 0.09), mat(0x3a2a10));
          at.position.set(0, 0.82, CELL * 0.35);
          group.add(a1); group.add(a2); group.add(at);
        } else if (shape === 'forge' || shape === 'smelter' || shape === 'armory') {
          const glow = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.04),
            emMat(0xff6020, 0xff3000, 0.9));
          glow.position.set(0, h * 0.34 + 0.12, CELL * 0.41); group.add(glow);
        } else if (shape === 'tower' || shape === 'watchtower') {
          const tw = shape === 'watchtower' ? 0.55 : 0.5;
          const cC = new THREE.Color(b.color3d).multiplyScalar(0.72).getHex();
          for (let i = -1; i <= 1; i++) {
            const cr = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, CELL * tw + 0.01), mat(cC));
            cr.position.set(i * 0.4, h + 0.21 + 0.17, 0); group.add(cr);
            const cr2 = new THREE.Mesh(new THREE.BoxGeometry(CELL * tw + 0.01, 0.26, 0.2), mat(cC));
            cr2.position.set(0, h + 0.21 + 0.17, i * 0.4); group.add(cr2);
          }
        } else if (shape === 'church' || shape === 'cathedral') {
          // Golden stone arch at entrance
          const archMat = emMat(0xd4c080, 0x8a7830, 0.2);
          const archL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), archMat);
          archL.position.set(-0.22, h * 0.25 + 0.12, CELL * 0.43); group.add(archL);
          const archR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), archMat);
          archR.position.set(0.22, h * 0.25 + 0.12, CELL * 0.43); group.add(archR);
          const archTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.07), archMat);
          archTop.position.set(0, h * 0.25 + 0.37, CELL * 0.43); group.add(archTop);
        } else if (shape === 'market') {
          const extra = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.26),
            mat(0x8030c0));
          extra.position.set(0, 0.52, 0); group.add(extra);
        } else if (shape === 'hall') {
          const sculp = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.38, 0.17), mat(0xa09050));
          sculp.position.set(0, 0.31, CELL * 0.52); group.add(sculp);
        } else {
          const wh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.04),
            emMat(0xffe880, 0x806010, 0.65));
          wh.position.set(0, h * 0.5, CELL * 0.44); group.add(wh);
        }
      }

      if (level >= 5) {
        if (shape === 'house') {
          const vV = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.04),
            emMat(0xd4a840, 0xaa7820, 0.4));
          const topY = h * 0.6 + h * 0.5 + h * 0.25 + 0.12;
          vV.position.set(0, topY, 0); group.add(vV);
          const vH = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.04),
            emMat(0xd4a840, 0xaa7820, 0.4));
          vH.position.set(0, topY + 0.13, 0); group.add(vH);
        } else if (shape === 'forge' || shape === 'smelter' || shape === 'armory') {
          const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.62, 6), mat(0x5a5040));
          pipe.rotation.z = Math.PI / 2; pipe.position.set(0, h * 0.51 + 0.12, 0.3);
          group.add(pipe);
        } else if (shape === 'tower' || shape === 'watchtower') {
          for (const [tx, tz] of [[-0.6, 0], [0.6, 0], [0, -0.6], [0, 0.6]]) {
            const brk = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.22, 0.055), mat(0x5a4020));
            brk.position.set(tx, h + 0.04, tz); group.add(brk);
            const torch = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 6),
              emMat(0xff8020, 0xff4000, 1.0));
            torch.position.set(tx, h + 0.18, tz); group.add(torch);
          }
        } else if (shape === 'church' || shape === 'cathedral') {
          const roseGeo = new THREE.TorusGeometry(0.17, 0.038, 6, 16);
          const rose = new THREE.Mesh(roseGeo, emMat(0x8060ff, 0x4020ff, 0.85));
          rose.position.set(0, h * 0.44, CELL * 0.43); group.add(rose);
        } else if (shape === 'market') {
          const fRim = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.055, 8, 16), mat(0x909070));
          fRim.rotation.x = Math.PI / 2; fRim.position.y = 0.42; group.add(fRim);
        } else if (shape === 'hall') {
          for (let i = -1; i <= 1; i++) {
            const cr = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, CELL * 1.0 + 0.01),
              emMat(0xd4a840, 0x9a7820, 0.25));
            cr.position.set(i * 0.5, h * 0.5 + 0.21, 0); group.add(cr);
          }
        }
      }
    }

    // Smoke particle emitter attached to a building group
    function createSmokeEmitter(group, offX, offY, offZ) {
      const smokeGeo = new THREE.SphereGeometry(0.055, 4, 4);
      for (let i = 0; i < 8; i++) {
        const m = new THREE.Mesh(smokeGeo, new THREE.MeshBasicMaterial({
          color: 0x909090, transparent: true, opacity: 0
        }));
        m._smokeParticle = true;
        m._phase = i / 8;
        m._wobble = Math.random() * Math.PI * 2;
        m._baseX = offX; m._baseY = offY; m._baseZ = offZ;
        group.add(m);
        _smokeParticles.push(m);
      }
    }

    // Emissive flash animation for raid hits
    function flashBuilding(id, idx, color, duration) {
      color = color !== undefined ? color : 0xff2020;
      duration = duration !== undefined ? duration : 800;
      scene.traverse(function(obj) {
        if (obj.userData.buildingId === id && obj.userData.instIndex === idx) {
          obj.traverse(function(child) {
            if (child.isMesh && child.material && child.material.emissive) {
              const orig = child.material.emissive.clone();
              const origInt = child.material.emissiveIntensity || 0;
              child.material.emissive.setHex(color);
              child.material.emissiveIntensity = 0.8;
              setTimeout(function() {
                child.material.emissive.copy(orig);
                child.material.emissiveIntensity = origInt;
              }, duration);
            }
          });
        }
      });
    }

    // Building info panel (5D.1 — stays open after upgrade)
    window.showBuildingInfo = function(bid, instIdx, grp) {
      if (!grp) grp = buildingMeshes[bid] && buildingMeshes[bid][instIdx];
      if (!grp) return;
      const b = BUILDINGS.find(x => x.id === bid);
      if (!b) return;
      const gx = grp.userData.gridX;
      const gz = grp.userData.gridZ;
      const inst = (S.buildings[bid] || [])[instIdx];
      const lvl = inst ? (inst.level || 1) : 1;

      updateLevelRing(grp, lvl);

      const sel = document.getElementById('sel-info');
      sel.style.display = 'block';
      clearTimeout(_selTimeout);

      const icons = { holz: '🪵', stein: '🪨', nahrung: '🌾', gold: '🪙', eisen: '⚙️', kohle: '🪨' };
      const LM = [1.0, 1.3, 1.7, 2.2, 3.0];

      // Level pip bar
      const pips = Array.from({ length: 5 }, (_, i) =>
        `<div class="level-pip${i < lvl ? ' filled' : ''}"></div>`
      ).join('');
      const levelBar = `<div class="level-bar">${pips}</div>`;

      // Upgrade section
      let upgradeSection = '';
      if (bid !== 'rathaus' && lvl < 5) {
        const cost = _gameCbs?.upgradeCost(b, lvl) ?? {};
        const costStr = Object.entries(cost).filter(([, v]) => v > 0)
          .map(([res, val]) => `<span>${icons[res]} ${val}</span>`).join(' ');
        const canAffordUpg = Object.entries(cost).every(([res, val]) => (S.res[res] || 0) >= val);
        const delta = LM[lvl] - LM[lvl - 1];
        let buffHtml = '';
        const hasProd = b.prod && Object.values(b.prod).some(v => v !== 0);
        if (hasProd) {
          buffHtml = Object.entries(b.prod).filter(([, v]) => v !== 0).map(([res, rate]) => {
            const gain = rate * delta;
            const sign = gain >= 0 ? '+' : '−';
            const abs = Math.abs(gain);
            const formatted = abs < 0.1 ? abs.toFixed(3) : abs < 1 ? abs.toFixed(2) : abs.toFixed(1);
            const cls = gain >= 0 ? 'sel-buff-pos' : 'sel-buff-neg';
            return `<span class="${cls}">${sign}${formatted} ${icons[res]}/s</span>`;
          }).join('');
        } else if (b.special === 'defense' || b.special === 'defense2') {
          buffHtml = `<span class="sel-buff-pos">+ Verteidigung</span>`;
        } else if (b.special === 'lager') {
          buffHtml = `<span class="sel-buff-pos">+ Lagerkapazität</span>`;
        } else if (b.special === 'moralBoost') {
          buffHtml = `<span class="sel-buff-pos">+ Moral</span>`;
        } else if (b.special === 'brauerei') {
          buffHtml = `<span class="sel-buff-pos">+ Moral & Gold</span>`;
        } else if (b.special === 'holzBoost') {
          buffHtml = `<span class="sel-buff-pos">+ Globaler Holzbonus</span>`;
        } else if (b.special === 'popBoost') {
          buffHtml = `<span class="sel-buff-pos">+ Bevölkerungswachstum</span>`;
        } else if (b.special === 'prestige') {
          buffHtml = `<span class="sel-buff-pos">+ Gold & Prestige</span>`;
        }
        upgradeSection = `<div class="sel-upgrade-block">
          <div class="sel-upgrade-title">⬆ Lv. ${lvl} → ${lvl + 1}</div>
          ${levelBar}
          <div class="sel-buff-row">${buffHtml}</div>
          <div class="sel-cost-row">Kosten: ${costStr}</div>
          <button class="sel-btn sel-btn-upgrade${canAffordUpg ? '' : ' disabled'}"
            onclick="${canAffordUpg ? `if(upgradeBuilding('${bid}',${instIdx})) showBuildingInfo('${bid}',${instIdx})` : ''}">
            Upgraden</button>
        </div>`;
      } else if (lvl >= 5) {
        upgradeSection = `<div class="sel-max">✦ Maximales Level erreicht</div>${levelBar}`;
      }

      // HP / repair for walls
      let hpSection = '';
      let repairBtn = '';
      if (bid === 'mauer' && inst && inst.hp !== undefined) {
        const hpCol = inst.hp <= 1 ? 'var(--red2)' : inst.hp <= 2 ? 'var(--amber2)' : 'var(--green2)';
        hpSection = `<div class="sel-hp-row">Zustand: <span style="color:${hpCol}">❤ ${inst.hp}/3</span></div>`;
        if (inst.hp < 3) {
          const repCost = (3 - inst.hp) * 5;
          const canRep = (S.res.stein || 0) >= repCost;
          repairBtn = `<button class="sel-btn sel-btn-repair${canRep ? '' : ' disabled'}"
            onclick="${canRep ? `repairMauer(${instIdx});document.getElementById('sel-info').style.display='none';` : ''}">
            🔧 Reparieren (${repCost}🪨)</button>`;
        }
      }

      sel.innerHTML = `
        <div class="sel-header">
          <span class="sel-name">${b.name}</span>
          <span class="sel-level-badge">Lv. ${lvl}</span>
        </div>
        <div class="sel-body">
          <div class="sel-workers">👷 ${b.workers} Arbeiter</div>
          ${hpSection}
          ${upgradeSection}
          <div class="sel-actions">
            ${repairBtn}
            <button class="sel-btn sel-btn-move"
              onclick="enterMoveMode(window._selGrp,'${bid}',${gx},${gz});document.getElementById('sel-info').style.display='none';">
              ↔ Verschieben</button>
          </div>
        </div>`;
      window._selGrp = grp; // kept on window for inline onclick HTML
      _selTimeout = setTimeout(() => { sel.style.display = 'none'; }, 7000);
    };

    // Linearly interpolate between two hex colors
    function lerpHex(a, b, t) {
      const ca = new THREE.Color(a), cb = new THREE.Color(b);
      ca.lerp(cb, t);
      return ca;
    }

    // ANIMATE
    let time = 0;
    function animate() {
      requestAnimationFrame(animate);
      time += 0.01;
      animateCamera();

      // Day/night cycle
      const elapsed = (Date.now() - _dayStartMs) % DAY_LENGTH_MS;
      const dayT = elapsed / DAY_LENGTH_MS; // 0..1 over full day
      // Find surrounding time states
      let s0 = TIME_STATES[TIME_STATES.length - 1], s1 = TIME_STATES[0];
      for (let i = 0; i < TIME_STATES.length - 1; i++) {
        if (dayT >= TIME_STATES[i].t && dayT < TIME_STATES[i + 1].t) {
          s0 = TIME_STATES[i]; s1 = TIME_STATES[i + 1]; break;
        }
      }
      const range = s1.t > s0.t ? s1.t - s0.t : 1 - s0.t + s1.t;
      const lt = range > 0 ? Math.min(1, (dayT >= s0.t ? dayT - s0.t : dayT + 1 - s0.t) / range) : 0;
      // Apply interpolated lighting
      ambient.color.copy(lerpHex(s0.amb, s1.amb, lt));
      ambient.intensity = s0.ambI + (s1.ambI - s0.ambI) * lt;
      sun.color.copy(lerpHex(s0.sun, s1.sun, lt));
      sun.intensity = s0.sunI + (s1.sunI - s0.sunI) * lt;
      const fogC = lerpHex(s0.fog, s1.fog, lt);
      scene.fog.color.copy(fogC);
      renderer.setClearColor(lerpHex(s0.bg, s1.bg, lt), 1);
      // Orbit sun (+ Math.PI so sun is above horizon at dayT=0.5, below at dayT=0/1)
      const sunAngle = dayT * Math.PI * 2 + Math.PI;
      sun.position.set(Math.sin(sunAngle) * 18, Math.cos(sunAngle) * 24 + 4, 10);
      sun.shadow.camera.updateProjectionMatrix();
      // Window/torch/lantern glow — smooth fade based on ambient darkness
      // nightFactor: 0 = full day, 1 = full night
      const nightFactor = Math.max(0, Math.min(1, 1 - (ambient.intensity - 0.06) / (0.55 - 0.06)));
      if (_forceNightUpdate || Math.abs(nightFactor - _prevNightFactor) > 0.004) {
        _prevNightFactor = nightFactor;
        _forceNightUpdate = false;
        scene.traverse(obj => {
          if (obj.isMesh && obj.material && obj.material.emissive) {
            const e = obj.material.emissive;
            // warm-colored emissives: windows, torches, lanterns, fire (not green HP or blue)
            if (e.r > 0.3 && e.r >= e.g && e.r > e.b * 2) {
              if (obj.material._origEI === undefined) {
                obj.material._origEI = obj.material.emissiveIntensity;
              }
              obj.material.emissiveIntensity = obj.material._origEI * (1 + nightFactor * 3.5);
            }
          } else if (obj.isPointLight && obj.userData._isWindowLight) {
            obj.intensity = nightFactor * obj.userData._nightInt;
          }
        });
        // Dynamic bloom: subtler at day, more glow at night
        bloomPass.strength = 0.22 + nightFactor * 0.70;
      }
      // Update time badge
      const hourEq = Math.round(dayT * 24);
      const badgeEl = document.getElementById('time-badge');
      if (badgeEl) {
        const icons = ['🌙','🌙','🌙','🌙','🌙','🌄','🌄','🌅','☀','☀','☀','☀',
                       '☀','☀','☀','☀','☀','🌇','🌇','🌆','🌆','🌃','🌙','🌙'];
        badgeEl.textContent = `${icons[hourEq % 24]} ${String(hourEq % 24).padStart(2,'0')}:00`;
      }

      // Gentle sway for mills
      if (buildingMeshes['saegemuehle']) {
        buildingMeshes['saegemuehle'].forEach(g => {
          g.rotation.y = Math.sin(time * 0.5) * 0.05;
        });
      }

      // Smoke particles
      for (const p of _smokeParticles) {
        p._phase = (p._phase + 0.0028) % 1.0;
        p.position.x = p._baseX + Math.sin(p._phase * 5.5 + p._wobble) * 0.07;
        p.position.y = p._baseY + p._phase * 2.2;
        p.position.z = p._baseZ + Math.cos(p._phase * 4.8 + p._wobble) * 0.07;
        p.material.opacity = Math.max(0, 0.42 - p._phase * 0.5);
        const s = 1 + p._phase * 1.8;
        p.scale.set(s, s, s);
      }

      // Float animation for building in move mode
      if (moveMode && moveGroup) {
        if (moveGroup._moveFloatT === undefined) moveGroup._moveFloatT = 0;
        moveGroup._moveFloatT += 0.04;
        const floatY = 0.45 + Math.sin(moveGroup._moveFloatT * 2.5) * 0.12;
        moveGroup._moveFloatY = floatY;
        moveGroup.position.y = floatY;
        moveGroup.rotation.y = Math.sin(moveGroup._moveFloatT * 0.8) * 0.06;
      }

      composer.render();
    }
    animate();

    window.addEventListener('resize', () => {
      W = wrap.clientWidth; H = wrap.clientHeight;
      renderer.setSize(W, H);
      composer.setSize(W, H);
      bloomPass.resolution.set(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    });

// ============================================================
// EXPORTS
// ============================================================
export { rebuild3D, addBuilding3D, addRoadMesh, removeRoadMesh,
         flashBuilding, triggerObstacleRemovalAnim, updateMapStage, findFreeCell,
         rotateCam, zoomCam, tiltCam, zoomClick, toggleRoadMode, enterMoveMode };

export function freeCell(x, z) { delete gridOccupied[gridKey(x, z)]; }
