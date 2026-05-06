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

    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 200);
    camera.position.set(18, 22, 18);
    camera.lookAt(0, 0, 0);

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
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x8090c0, 0.35);
    fill.position.set(-10, 8, -5);
    scene.add(fill);

    // GROUND
    const GRID = 12; // 12x12 grid
    const CELL = 2.0;
    const groundGeo = new THREE.PlaneGeometry(GRID * CELL + 2, GRID * CELL + 2, GRID, GRID);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x2a2018 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid lines
    const gridHelper = new THREE.GridHelper(GRID * CELL, GRID, 0x3a2a18, 0x2a1e10);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

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

    updateCamera();
    updateZoomBar();

    // RAYCASTER for clicking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // ============================================================
    // 3D BUILDING MESHES
    // ============================================================
    const buildingMeshes = {}; // id -> [{mesh, gridX, gridZ}]
    const gridOccupied = {}; // "x,z" -> buildingId
    const buildingGroups = []; // all placed groups for raycasting

    function gridKey(x, z) { return x + ',' + z; }

    function findFreeCell() {
      // Spiral outward from center
      const cx = 0, cz = 0;
      for (let r = 0; r <= GRID / 2; r++) {
        for (let dx = -r; dx <= r; dx++) {
          for (let dz = -r; dz <= r; dz++) {
            if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
            const x = cx + dx, z = cz + dz;
            if (Math.abs(x) > GRID / 2 - 1 || Math.abs(z) > GRID / 2 - 1) continue;
            const key = gridKey(x, z);
            if (!gridOccupied[key]) return { x, z };
          }
        }
      }
      return { x: Math.floor(Math.random() * GRID) - GRID / 2, z: Math.floor(Math.random() * GRID) - GRID / 2 };
    }

    function makeBuildingMesh(b, x, z, index) {
      const group = new THREE.Group();
      const c = b.color3d;
      const darkerC = new THREE.Color(c).multiplyScalar(0.6).getHex();
      const h = b.height;

      const mat = new THREE.MeshLambertMaterial({ color: c });
      const darkMat = new THREE.MeshLambertMaterial({ color: darkerC });

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
          // Window
          const wGeo = new THREE.BoxGeometry(0.18, 0.18, 0.05);
          const wMat = new THREE.MeshLambertMaterial({ color: 0xffe890, emissive: 0x806020, emissiveIntensity: 0.5 });
          const win = new THREE.Mesh(wGeo, wMat);
          win.position.set(CELL * w * 0.5 + 0.01, h * 0.35, 0);
          group.add(win);
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
      } else if (b.shape === 'farm') {
        const fGeo = new THREE.BoxGeometry(CELL * 0.9, 0.12, CELL * 0.9);
        const farm = new THREE.Mesh(fGeo, new THREE.MeshLambertMaterial({ color: 0x5a8820 }));
        farm.position.y = 0.18;
        farm.castShadow = true; group.add(farm);
        const hGeo = new THREE.BoxGeometry(CELL * 0.5, 0.7, CELL * 0.5);
        const hm = new THREE.Mesh(hGeo, mat);
        hm.position.set(CELL * 0.2, 0.47, CELL * 0.2);
        hm.castShadow = true; group.add(hm);
        const rGeo = new THREE.ConeGeometry(CELL * 0.38, 0.4, 4);
        const rm = new THREE.Mesh(rGeo, darkMat);
        rm.position.set(CELL * 0.2, 1.07, CELL * 0.2);
        rm.rotation.y = Math.PI / 4;
        group.add(rm);
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
      } else if (b.shape === 'barracks' || b.shape === 'wall') {
        const bGeo = new THREE.BoxGeometry(CELL * 0.88, h * 0.55, CELL * 0.88);
        const body = new THREE.Mesh(bGeo, mat);
        body.position.y = h * 0.275 + 0.12;
        body.castShadow = true; body.receiveShadow = true; group.add(body);
        if (b.shape === 'wall') {
          // Crenellations
          for (let i = -1; i <= 1; i++) {
            const cGeo = new THREE.BoxGeometry(0.3, 0.3, CELL * 0.88);
            const cr = new THREE.Mesh(cGeo, mat);
            cr.position.set(i * 0.55, h * 0.55 + 0.27, 0);
            group.add(cr);
            const cGeo2 = new THREE.BoxGeometry(CELL * 0.88, 0.3, 0.3);
            const cr2 = new THREE.Mesh(cGeo2, mat);
            cr2.position.set(0, h * 0.55 + 0.27, i * 0.55);
            group.add(cr2);
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
      } else if (b.shape === 'warehouse' || b.shape === 'library') {
        const bGeo = new THREE.BoxGeometry(CELL * 0.88, h, CELL * 0.88);
        const body = new THREE.Mesh(bGeo, mat);
        body.position.y = h * 0.5 + 0.12;
        body.castShadow = true; body.receiveShadow = true; group.add(body);
        const rGeo = new THREE.BoxGeometry(CELL * 0.95, 0.12, CELL * 0.95);
        const roof = new THREE.Mesh(rGeo, darkMat);
        roof.position.y = h + 0.18;
        roof.castShadow = true; group.add(roof);
        if (b.shape === 'library') {
          const colMat = new THREE.MeshLambertMaterial({ color: 0xd4c090 });
          for (const [cx2, cz2] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) {
            const colGeo = new THREE.CylinderGeometry(0.1, 0.12, h, 6);
            const col = new THREE.Mesh(colGeo, colMat);
            col.position.set(cx2, h * 0.5 + 0.12, cz2);
            group.add(col);
          }
        }
      } else {
        // Default box
        const bGeo = new THREE.BoxGeometry(CELL * 0.75, h, CELL * 0.75);
        const body = new THREE.Mesh(bGeo, mat);
        body.position.y = h * 0.5 + 0.12;
        body.castShadow = true; group.add(body);
      }

      // Index label (small sphere on top for identification)
      if (index > 0) {
        const lGeo = new THREE.SphereGeometry(0.12, 6, 6);
        const lMat = new THREE.MeshLambertMaterial({ color: 0xf0c060, emissive: 0xd4a840, emissiveIntensity: 0.4 });
        const label = new THREE.Mesh(lGeo, lMat);
        label.position.y = h + 0.6;
        group.add(label);
      }

      group.position.set(x * CELL, 0, z * CELL);
      group.userData = { buildingId: b.id, gridX: x, gridZ: z };
      scene.add(group);

      // Add all child meshes to buildingGroups for raycasting
      group.traverse(child => {
        if (child.isMesh) {
          child.userData.buildingId = b.id;
          child.userData.group = group;
          buildingGroups.push(child);
        }
      });

      return group;
    }

    function rebuild3D() {
      buildingGroups.length = 0;
      for (const key in buildingMeshes) {
        buildingMeshes[key].forEach(g => scene.remove(g));
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
          const group = makeBuildingMesh(b, x, z, i);
          buildingMeshes[id].push(group);
        });
      }
    }

    function addBuilding3D(id) {
      const b = BUILDINGS.find(x => x.id === id);
      if (!b) return;
      if (!buildingMeshes[id]) buildingMeshes[id] = [];
      const { x, z } = findFreeCell();
      gridOccupied[gridKey(x, z)] = id;
      const idx = buildingMeshes[id].length;
      const group = makeBuildingMesh(b, x, z, idx);
      buildingMeshes[id].push(group);

      // Persist position in state (buyBuilding already pushed the entry with null x/z)
      if (S.buildings[id] && S.buildings[id].length > idx) {
        S.buildings[id][idx].x = x;
        S.buildings[id][idx].z = z;
      }

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
      clearTimeout(window._selTimeout);

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
      save();

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
      notify('Gebäude verschoben');
    }

    // MOUSEMOVE: update hover highlight in move mode
    canvas.addEventListener('mousemove', e => {
      if (!moveMode) return;
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

      // Position floating preview above hovered cell
      const worldX = x * CELL;
      const worldZ = z * CELL;

      if (isOccupied) {
        cellHighlight.visible = false;
        cellBlocked.visible = true;
        cellBlocked.position.set(worldX, 0.04, worldZ);
      } else {
        cellBlocked.visible = false;
        cellHighlight.visible = true;
        cellHighlight.position.set(worldX, 0.04, worldZ);
      }

      // Move the ghost building to hover position
      moveGroup.position.set(worldX, moveGroup._moveFloatY || 0.5, worldZ);

      moveHoverCell = { x, z, occupied: isOccupied };
    });

    // CLICK handler
    canvas.addEventListener('click', e => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      if (moveMode) {
        // Klick 2: place building
        if (moveHoverCell.x === null) return;
        if (moveHoverCell.occupied) {
          notify('Feld besetzt!');
          return;
        }
        commitMove(moveHoverCell.x, moveHoverCell.z);
        return;
      }

      // Klick 1: select building
      const intersects = raycaster.intersectObjects(buildingGroups, false);
      if (intersects.length > 0) {
        const obj = intersects[0].object;
        const bid = obj.userData.buildingId;
        const grp = obj.userData.group;

        const b = BUILDINGS.find(x => x.id === bid);
        const gx = grp.userData.gridX;
        const gz = grp.userData.gridZ;

        // Show info briefly, then enter move mode
        const sel = document.getElementById('sel-info');
        sel.style.display = 'block';
        sel.innerHTML = `<b style="font-size:14px">${b.name}</b><br><span style="color:var(--muted);font-family:'Crimson Text',serif;font-size:11px">👷 ${b.workers} Arbeiter · Klicke Zielfeld zum Verschieben · ESC abbrechen</span>`;
        clearTimeout(window._selTimeout);
        window._selTimeout = setTimeout(() => { sel.style.display = 'none'; }, 4000);

        enterMoveMode(grp, bid, gx, gz);
      } else {
        // Click on empty space — cancel move or deselect
        if (!moveMode) {
          document.getElementById('sel-info').style.display = 'none';
        }
      }
    });

    // Right-click → cancel move
    canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (moveMode) exitMoveMode(true);
    });

    // ESC → cancel move
    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') { exitMoveMode(true); return; }
      if (e.key === 'ArrowLeft') rotateCam(-1);
      else if (e.key === 'ArrowRight') rotateCam(1);
      else if (e.key === '+' || e.key === '=') zoomCam(-1);
      else if (e.key === '-') zoomCam(1);
      else if (e.key === 'ArrowUp') tiltCam(-1);
      else if (e.key === 'ArrowDown') tiltCam(1);
    });

    // ANIMATE
    let time = 0;
    function animate() {
      requestAnimationFrame(animate);
      time += 0.01;
      animateCamera();
      // Gentle sway for mills
      if (buildingMeshes['saegemuehle']) {
        buildingMeshes['saegemuehle'].forEach(g => {
          g.rotation.y = Math.sin(time * 0.5) * 0.05;
        });
      }
      // Float animation for building in move mode
      if (moveMode && moveGroup) {
        if (moveGroup._moveFloatT === undefined) moveGroup._moveFloatT = 0;
        moveGroup._moveFloatT += 0.04;
        const floatY = 0.45 + Math.sin(moveGroup._moveFloatT * 2.5) * 0.12;
        moveGroup._moveFloatY = floatY;
        moveGroup.position.y = floatY;
        // Gentle rotation while held
        moveGroup.rotation.y = Math.sin(moveGroup._moveFloatT * 0.8) * 0.06;
      }
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      W = wrap.clientWidth; H = wrap.clientHeight;
      renderer.setSize(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    });
