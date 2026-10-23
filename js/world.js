/*
  PALAZZO DELLA MEMORIA - il mondo 3D (percorso, terreno, cieli, scenografia, stazioni)
  Libreria 3D: A-Frame 1.6.0 (MIT), che include three.js.
  Modelli: Kenney (CC0) e un oggetto Poly Haven (CC0). Vedi CREDITS.txt.

  Il percorso e' una linea spezzata: tutto (terreno, camminata, tappe, oggetti) si calcola da li'.
  Convenzioni: x verso destra, z verso chi guarda all'inizio (si cammina verso -z), y verso l'alto.
*/
(function () {
  "use strict";
  var THREE = AFRAME.THREE;
  var PW = (window.PW = {});

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, v) { var t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); }
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- il percorso ---------------- */
  // [x, z, altezza del suolo]
  var PATH = [
    [0, 8, 0.5],     // molo (inizio)
    [0, -8, 0.5],
    [3, -26, 0.3],   // spiaggia
    [18, -34, 5.0],  // collina
    [34, -28, 2.0],
    [40, -12, 0.5],  // secondo molo
    [40, 14.5, 0.5]  // grotta
  ];
  var segs = [], LEN = 0;
  PATH.forEach(function (p, i) {
    if (i === PATH.length - 1) return;
    var q = PATH[i + 1], dx = q[0] - p[0], dz = q[1] - p[1], len = Math.sqrt(dx * dx + dz * dz);
    segs.push({ x0: p[0], z0: p[1], dx: dx, dz: dz, h0: p[2], h1: q[2], len: len, s0: LEN, tx: dx / len, tz: dz / len });
    LEN += len;
  });
  PW.length = LEN;

  var S_W5 = segs[5].s0;                 // inizio dell'ultimo tratto: (40, -12)
  var PIER1 = [-50, 17];                 // tratto di mare 1 (molo)
  var PIER2 = [S_W5 - 5, S_W5 + 10.5];   // tratto di mare 2 (secondo molo)
  var DOOR = [S_W5 + 11.4, S_W5 + 14.9]; // passaggio della porta della grotta
  PW.stationS = [11, 27, 49.5, 89, 107.5];
  PW.stationSide = [1, -1, 1, 1, 1];
  PW.stationLat = [3.0, 3.6, 3.6, 3.0, 3.4];   // distanza laterale dell'oggetto dal percorso     // lato dell'oggetto rispetto al percorso (+ destra, - sinistra)

  PW.nearest = function (x, z) {
    var best = null, bd = 1e9;
    for (var i = 0; i < segs.length; i++) {
      var g = segs[i];
      var t = ((x - g.x0) * g.dx + (z - g.z0) * g.dz) / (g.len * g.len);
      t = clamp01(t);
      var px = g.x0 + g.dx * t, pz = g.z0 + g.dz * t;
      var d = Math.sqrt((x - px) * (x - px) + (z - pz) * (z - pz));
      if (d < bd) { bd = d; best = { s: g.s0 + t * g.len, d: d, px: px, pz: pz, tx: g.tx, tz: g.tz, h: lerp(g.h0, g.h1, t) }; }
    }
    return best;
  };

  PW.pointAt = function (s) {
    s = Math.max(0, Math.min(LEN, s));
    var g = segs[segs.length - 1];
    for (var i = 0; i < segs.length; i++) { if (s <= segs[i].s0 + segs[i].len) { g = segs[i]; break; } }
    var t = clamp01((s - g.s0) / g.len);
    return { x: g.x0 + g.dx * t, z: g.z0 + g.dz * t, h: lerp(g.h0, g.h1, t), tx: g.tx, tz: g.tz };
  };

  function band(s, a, b, edge) { return smooth(a - edge, a + edge, s) * (1 - smooth(b - edge, b + edge, s)); }
  function seaWeight(s) { return Math.max(band(s, PIER1[0], PIER1[1], 1.2), band(s, PIER2[0], PIER2[1], 1.2)); }

  // semi-larghezza percorribile attorno alla linea del percorso
  PW.corridor = function (s) {
    // sul molo il passaggio resta stretto (largo come le assi) fino a quando c'e' terra sotto
    var sw = Math.max(band(s, PIER1[0] - 0.3, PIER1[1] + 1.4, 0.3), band(s, PIER2[0] - 0.3, PIER2[1] + 1.4, 0.3));
    var w = lerp(3.4, 1.15, sw);
    w = lerp(w, 1.1, smooth(DOOR[0] - 0.6, DOOR[0] + 0.6, s) * (1 - smooth(DOOR[1] - 0.3, DOOR[1] + 0.3, s)));
    w = lerp(w, 5.4, smooth(DOOR[1] - 0.2, DOOR[1] + 0.8, s));
    return w;
  };

  // limita la posizione al percorso e restituisce quota e distanza lungo il percorso
  PW.constrain = function (x, z) {
    var n = PW.nearest(x, z), w = PW.corridor(n.s);
    if (n.d > w) {
      var k = w / n.d;
      x = n.px + (x - n.px) * k;
      z = n.pz + (z - n.pz) * k;
    }
    return { x: x, z: z, y: n.h, s: n.s, tx: n.tx, tz: n.tz };
  };

  /* ---------------- terreno ---------------- */
  var AMP = [[0, 2], [17, 1.4], [34, 1.6], [44, 3.0], [60, 3.0], [70, 2.4], [S_W5 + 5, 2.6], [S_W5 + 12, 4.8], [LEN, 4.8]];
  function ampAt(s) {
    if (s <= AMP[0][0]) return AMP[0][1];
    for (var i = 1; i < AMP.length; i++) {
      if (s <= AMP[i][0]) return lerp(AMP[i - 1][1], AMP[i][1], (s - AMP[i - 1][0]) / (AMP[i][0] - AMP[i - 1][0]));
    }
    return AMP[AMP.length - 1][1];
  }
  function noise(x, z) { return 0.5 + 0.25 * Math.sin(x * 0.31 + z * 0.17) + 0.25 * Math.sin(z * 0.23 - x * 0.13 + 1.7); }

  var SEABED = -1.3;
  function terrainH(x, z) {
    var n = PW.nearest(x, z), s = n.s;
    var lw = 1 - seaWeight(s);
    var wt = PW.corridor(s) + 0.6;
    var cave = smooth(DOOR[0] - 1, DOOR[1], s);
    var flat = lerp(SEABED, n.h - cave * 0.18, lw);
    var out = lerp(SEABED, n.h + ampAt(s) * (0.35 + 0.65 * noise(x, z)), lw);
    var h = lerp(flat, out, smooth(wt, wt + 5, n.d));
    return lerp(h, -2.2, smooth(14, 24, n.d));
  }
  PW.terrainH = terrainH;

  var C_SAND = new THREE.Color("#ddc896"), C_SAND2 = new THREE.Color("#c9ae74"), C_WET = new THREE.Color("#b49a6a");
  var C_GRASS = new THREE.Color("#6eac5a"), C_GRASS2 = new THREE.Color("#4d8c4a"), C_ROCK = new THREE.Color("#8b8f99"), C_ROCK2 = new THREE.Color("#666a75");
  var C_SEABED = new THREE.Color("#4b8d99"), C_CAVE = new THREE.Color("#585c68");
  function terrainColor(x, z, h, out) {
    var n = PW.nearest(x, z), s = n.s;
    var zs = 1 - smooth(30, 42, s), zr = smooth(62, 74, s), zg = clamp01(1 - zs - zr);
    var nz = noise(x * 1.7 + 4, z * 1.7 - 2);
    var sand = C_SAND.clone().lerp(C_SAND2, nz), grass = C_GRASS.clone().lerp(C_GRASS2, nz), rock = C_ROCK.clone().lerp(C_ROCK2, nz);
    out.setRGB(0, 0, 0);
    out.r = sand.r * zs + grass.r * zg + rock.r * zr;
    out.g = sand.g * zs + grass.g * zg + rock.g * zr;
    out.b = sand.b * zs + grass.b * zg + rock.b * zr;
    if (h > n.h + 1.8 && zg > 0.5) out.lerp(rock, smooth(n.h + 1.8, n.h + 3.6, h));
    if (h < 0.35) out.lerp(C_WET, smooth(0.35, -0.2, h));
    if (h < -0.4) out.lerp(C_SEABED, smooth(-0.4, -1.2, h));
    if (s > DOOR[0] - 4) out.lerp(C_CAVE, smooth(DOOR[0] - 4, DOOR[0], s) * (1 - smooth(wtOf(s), wtOf(s) + 3, n.d)));
    return out;
  }
  function wtOf(s) { return PW.corridor(s) + 0.6; }

  function buildTerrain(scene) {
    var x0 = -34, x1 = 76, z0 = -64, z1 = 42, cell = 1.5;
    var nx = Math.round((x1 - x0) / cell), nz = Math.round((z1 - z0) / cell);
    var geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
    geo.rotateX(-Math.PI / 2);
    geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    var pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i), h = terrainH(x, z);
      pos.setY(i, h);
      terrainColor(x, z, h, c);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }));
    scene.add(mesh);
    return mesh;
  }

  /* ---------------- cielo, luce, mare ---------------- */
  function pal(top, hor, sun, sunI, amb, sea, fogN, fogF, sx, sy, sz) {
    return { top: new THREE.Color(top), hor: new THREE.Color(hor), sun: new THREE.Color(sun), sunI: sunI, amb: new THREE.Color(amb), sea: new THREE.Color(sea), fogN: fogN, fogF: fogF, dir: new THREE.Vector3(sx, sy, sz) };
  }
  // chiavi: [distanza lungo il percorso, palette]
  var KEYS = [
    [11, pal("#5f78c4", "#ffb199", "#ffd2b0", 0.85, "#c8b6d8", "#3b7fb0", 80, 330, -0.6, 0.35, 0.6)],   // alba
    [27, pal("#3f95de", "#c4e8ff", "#ffffff", 1.15, "#d2e4ff", "#2d9bd1", 90, 380, 0.3, 0.9, 0.3)],     // mattina
    [49.5, pal("#5a98cf", "#ffe3a4", "#ffd47c", 1.05, "#ffecd0", "#3a98b8", 90, 360, 0.8, 0.55, 0.2)],  // pomeriggio dorato
    [89, pal("#3a3478", "#ff7a52", "#ff8a4c", 0.85, "#c28aa8", "#7a4f86", 70, 320, 0.9, 0.18, -0.2)],   // tramonto
    [100.5, pal("#090c18", "#141a2e", "#6a7ab0", 0.08, "#59607e", "#18203a", 4, 36, 0.2, 0.9, 0.2)]     // grotta
  ];
  var cur = pal("#000", "#000", "#fff", 1, "#fff", "#000", 40, 150, 0, 1, 0);

  function mixPal(s) {
    var a, b, t;
    if (s <= KEYS[0][0]) { a = b = KEYS[0][1]; t = 0; }
    else if (s >= KEYS[KEYS.length - 1][0]) { a = b = KEYS[KEYS.length - 1][1]; t = 0; }
    else {
      for (var i = 1; i < KEYS.length; i++) {
        if (s <= KEYS[i][0]) { a = KEYS[i - 1][1]; b = KEYS[i][1]; t = (s - KEYS[i - 1][0]) / (KEYS[i][0] - KEYS[i - 1][0]); break; }
      }
      t = t * t * (3 - 2 * t);
    }
    cur.top.copy(a.top).lerp(b.top, t); cur.hor.copy(a.hor).lerp(b.hor, t);
    cur.sun.copy(a.sun).lerp(b.sun, t); cur.amb.copy(a.amb).lerp(b.amb, t); cur.sea.copy(a.sea).lerp(b.sea, t);
    cur.sunI = lerp(a.sunI, b.sunI, t); cur.fogN = lerp(a.fogN, b.fogN, t); cur.fogF = lerp(a.fogF, b.fogF, t);
    cur.dir.copy(a.dir).lerp(b.dir, t);
    return cur;
  }

  var env = {};
  function buildEnvironment(scene, camera) {
    var skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
      vertexShader: "varying float vH; void main(){ vH = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 top; uniform vec3 bottom; varying float vH; void main(){ float k = smoothstep(-0.05, 0.55, vH); gl_FragColor = vec4(mix(bottom, top, k), 1.0); }"
    });
    env.sky = new THREE.Mesh(new THREE.SphereGeometry(480, 24, 14), skyMat);
    env.sky.renderOrder = -100;
    env.sky.frustumCulled = false;
    scene.add(env.sky);

    env.hemi = new THREE.HemisphereLight(0xffffff, 0x6b6050, 0.7);
    env.sun = new THREE.DirectionalLight(0xffffff, 1);
    scene.add(env.hemi, env.sun, env.sun.target);

    scene.fog = new THREE.Fog(0xffffff, 40, 160);

    env.sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ color: 0x2d9bd1, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.88 }));
    env.sea.rotation.x = -Math.PI / 2;
    env.sea.position.y = 0.02;
    scene.add(env.sea);
    env.camera = camera;
  }

  PW.updateEnvironment = function (s, camWorld) {
    var p = mixPal(s);
    env.sky.material.uniforms.top.value.copy(p.top);
    env.sky.material.uniforms.bottom.value.copy(p.hor);
    env.sky.position.copy(camWorld);
    env.hemi.color.copy(p.amb);
    env.hemi.groundColor.copy(p.amb).multiplyScalar(0.55);
    env.hemi.intensity = 0.3 + 0.3 * clamp01(p.sunI);
    env.sun.color.copy(p.sun);
    env.sun.intensity = p.sunI * 0.85;
    env.sun.position.set(camWorld.x + p.dir.x * 60, p.dir.y * 60, camWorld.z + p.dir.z * 60);
    env.sun.target.position.set(camWorld.x, 0, camWorld.z);
    env.sea.material.color.copy(p.sea);
    env.sea.position.x = camWorld.x; env.sea.position.z = camWorld.z;
    var f = env.sea.parent.fog;
    f.color.copy(p.hor); f.near = p.fogN; f.far = p.fogF;
  };

  /* ---------------- modelli ---------------- */
  var models = {};
  var PIRATE = ["barrel", "boat-row-large", "boat-row-small", "cannon-ball", "cannon-mobile", "castle-gate", "castle-wall", "chest", "crate", "crate-bottles", "flag-pirate-high", "grass", "grass-plant", "palm-bend", "palm-detailed-bend", "palm-detailed-straight", "palm-straight", "patch-grass", "patch-grass-foliage", "patch-sand-foliage", "rocks-a", "rocks-b", "rocks-sand-a", "rocks-sand-b", "rocks-sand-c", "ship-pirate-large", "ship-small", "ship-wreck", "structure", "structure-platform-dock", "tool-shovel", "tower-complete-large", "tower-complete-small"];
  PIRATE.push("bottle");
  var DUNGEON = ["banner", "barrel", "chest", "coin", "column", "floor", "key", "pot", "potion", "rocks", "stones", "table", "wall", "wall-opening"];

  function loadAll(onProgress) {
    var GL = THREE.GLTFLoader || (AFRAME.THREE.GLTFLoader);
    if (!GL) return Promise.reject(new Error("GLTFLoader non disponibile"));
    var loader = new GL();
    var jobs = [];
    PIRATE.forEach(function (n) { jobs.push(["p:" + n, "assets/pirate/" + n + ".glb", true]); });
    DUNGEON.forEach(function (n) { jobs.push(["d:" + n, "assets/dungeon/" + n + ".glb", true]); });
    jobs.push(["lantern", "assets/lantern/wooden_lantern_01_1k.gltf", false]);
    jobs.push(["compass", "assets/compass/seadogs_compass_1k.gltf", false]);
    var done = 0;
    return Promise.all(jobs.map(function (j) {
      return new Promise(function (resolve, reject) {
        loader.load(j[1], function (g) {
          if (j[2]) {
            g.scene.traverse(function (o) {
              if (o.isMesh && o.material && o.material.map) {
                var m = o.material.map;
                m.magFilter = THREE.NearestFilter; m.minFilter = THREE.NearestFilter; m.generateMipmaps = false; m.needsUpdate = true;
              }
            });
          }
          models[j[0]] = g.scene;
          done++; if (onProgress) onProgress(done, jobs.length);
          resolve();
        }, undefined, function (e) { reject(new Error("Non riesco a caricare " + j[1])); });
      });
    }));
  }

  /* ---------------- scenografia ---------------- */
  var world;           // gruppo con tutto
  var flickers = [];   // luci delle torce

  function heading(pt) { return Math.atan2(pt.tx, pt.tz); }

  function put(key, s, lat, fwd, o) {
    o = o || {};
    var pt = PW.pointAt(s), rx = -pt.tz, rz = pt.tx;
    var x = pt.x + rx * lat + pt.tx * fwd, z = pt.z + rz * lat + pt.tz * fwd;
    return putXZ(key, x, z, heading(pt), o);
  }
  var bboxes = {};
  function bboxOf(key) {
    if (!bboxes[key]) {
      var b = new THREE.Box3().setFromObject(models[key]);
      bboxes[key] = b.getSize(new THREE.Vector3());
    }
    return bboxes[key];
  }
  var placed = { ok: 0, skipped: 0 };
  function putXZ(key, x, z, baseRot, o) {
    o = o || {};
    var src = models[key];
    if (!src) { console.warn("modello mancante", key); return null; }
    var sc = o.scale || 1, y, rad = 0;
    if (o.y === undefined) {
      // oggetto appoggiato al terreno: si posa sul punto piu' basso sotto la sua impronta
      var size = bboxOf(key);
      rad = 0.35 * Math.max(size.x, size.z) * sc;
      var mn = terrainH(x, z), mx = mn;
      for (var k = 0; k < 8; k++) {
        var a = k * Math.PI / 4, h = terrainH(x + Math.cos(a) * rad, z + Math.sin(a) * rad);
        if (h < mn) mn = h; if (h > mx) mx = h;
      }
      var flatPiece = key.indexOf("patch-") >= 0;
      var maxRange = o.maxRange !== undefined ? o.maxRange : (flatPiece ? 0.3 : 2.2);
      if (mx - mn > maxRange || (mn < 0.08 && !o.allowSea)) { placed.skipped++; return null; }
      y = mn - (o.sink !== undefined ? o.sink : flatPiece ? 0.02 : 0.12);
    } else {
      y = o.y === "sea" ? 0.0 : o.y;
    }
    var m = src.clone(true);
    m.scale.setScalar(sc);
    m.position.set(x, y + (o.dy || 0), z);
    m.rotation.y = baseRot + (o.rot || 0) * Math.PI / 180;
    if (rad) {
      // corregge i modelli con l'origine non alla base: il punto piu' basso va esattamente a "y"
      m.updateMatrixWorld(true);
      var bb = new THREE.Box3().setFromObject(m);
      m.position.y += (y + (o.dy || 0)) - bb.min.y;
    }
    if (rad) { m.userData.rad = rad; m.userData.sunk = o.sink !== undefined ? o.sink : 0.12; }
    world.add(m);
    placed.ok++;
    if (key.indexOf("platform-dock") >= 0) { m.updateMatrixWorld(true); decks.push(new THREE.Box3().setFromObject(m)); }
    return m;
  }
  var decks = [];
  // si puo' camminare qui? terra sopra il livello del mare, oppure assi del molo
  function walkable(x, z) {
    if (terrainH(x, z) >= -0.02) return true;
    for (var i = 0; i < decks.length; i++) { var b = decks[i]; if (x >= b.min.x - 0.05 && x <= b.max.x + 0.05 && z >= b.min.z - 0.05 && z <= b.max.z + 0.05) return true; }
    return false;
  }
  // controllo: tutti i punti raggiungibili a piedi devono avere terra o assi sotto
  PW.scanWalk = function () {
    var holes = [];
    for (var s = 0; s <= LEN; s += 0.1) {
      var pt = PW.pointAt(s), w = PW.corridor(s), rx = -pt.tz, rz = pt.tx;
      [-1, -0.5, 0, 0.5, 1].forEach(function (f) {
        var x = pt.x + rx * w * f, z = pt.z + rz * w * f, c = PW.constrain(x, z);
        if (!walkable(c.x, c.z)) holes.push({ s: +s.toFixed(1), f: f, x: +c.x.toFixed(1), z: +c.z.toFixed(1) });
      });
    }
    var ranges = [];
    holes.forEach(function (h) { var l = ranges[ranges.length - 1]; if (l && h.s - l.to <= 0.31) { l.to = h.s; l.n++; } else ranges.push({ from: h.s, to: h.s, n: 1 }); });
    return { holes: holes.length, ranges: ranges, sample: holes.filter(function (h) { return h.s > 16 && h.s < 17.4 || h.s < 81; }).slice(0, 8), decks: decks.slice(0, 3).map(function (b) { return [b.min.x, b.max.x, b.min.z, b.max.z].map(function (v) { return +v.toFixed(2); }); }) };
  };
  // controllo: elenca gli oggetti appoggiati a terra che restano sospesi o sprofondati
  PW.audit = function () {
    var bad = [], n = 0;
    world.children.forEach(function (m) {
      if (!m.userData.rad) return;
      n++;
      var box = new THREE.Box3().setFromObject(m), r = m.userData.rad, x = m.position.x, z = m.position.z;
      var mn = terrainH(x, z);
      for (var k = 0; k < 8; k++) { var a = k * Math.PI / 4; mn = Math.min(mn, terrainH(x + Math.cos(a) * r, z + Math.sin(a) * r)); }
      var gap = box.min.y - mn;
      if (gap > 0.15) bad.push({ x: +x.toFixed(1), z: +z.toFixed(1), gap: +gap.toFixed(2) });
    });
    return { checked: n, floating: bad, skipped: placed.skipped };
  };
  function scatter(keys, count, s0, s1, lmin, lmax, seed, o) {
    var rnd = mulberry(seed);
    for (var i = 0; i < count; i++) {
      var s = lerp(s0, s1, rnd()), side = rnd() < 0.5 ? -1 : 1, lat = side * lerp(lmin, lmax, rnd());
      var key = keys[Math.floor(rnd() * keys.length)];
      var oo = {}; for (var k in (o || {})) oo[k] = o[k];
      oo.rot = rnd() * 360; oo.scale = (o && o.scale ? o.scale : 1) * (0.8 + rnd() * 0.5);
      if (o && o.minSea !== undefined && seaWeight(s) > 0.3) continue;
      put(key, s, lat, 0, oo);
    }
  }

  function pier(sA, sB, deckKey) {
    // le assi arrivano fino a terra: l'ultima in ogni estremita' e' appena piu' bassa per non sfarfallare sulla sabbia
    var n = Math.round((sB - sA) / 2.5);
    for (var i = 0; i <= n; i++) put(deckKey, sA + i * 2.5, 0, 0, { y: "sea", dy: (i === 0 || i === n) ? -0.04 : 0 });
  }

  function buildScenery(scene) {
    world = new THREE.Group();
    scene.add(world);
    var P = function (n) { return "p:" + n; }, D = function (n) { return "d:" + n; };

    /* tappa 1: il molo all'alba */
    pier(1.25, 16.25, P("structure-platform-dock"));
    put(P("structure-platform-dock"), 11, 2.5, 0.6, { y: "sea" });         // piattaforma laterale della tappa
    put(P("structure-platform-dock"), 11, 2.5, -1.9, { y: "sea" });
    put(P("structure-platform-dock"), 11, 5.0, 0.6, { y: "sea" });
    put(P("flag-pirate-high"), 0.5, 1.5, 0, { y: 0.5 });
    put(P("flag-pirate-high"), 0.5, -1.5, 0, { y: 0.5, rot: 180 });
    put(P("barrel"), 7, -1.45, 0, { y: 0.5 }); put(P("crate"), 7, -1.55, 1.3, { y: 0.5 }); put(P("crate-bottles"), 14, -1.45, 0, { y: 0.5, rot: 30 });
    put(P("boat-row-large"), 6, -5, 0, { y: "sea", rot: 90 });
    put(P("boat-row-small"), 14, 5.2, 0, { y: "sea", rot: 70 });
    put(P("ship-small"), 3, -26, 0, { y: "sea", rot: 15 });
    put(P("rocks-a"), 4, 12, 0, { y: -0.3, scale: 1.4 }); put(P("rocks-b"), 13, -11, 0, { y: -0.3, scale: 1.2 });

    /* tappa 2: la spiaggia di mattina */
    var palms = [P("palm-bend"), P("palm-straight"), P("palm-detailed-straight"), P("palm-detailed-bend")];
    put(palms[2], 27, 5.2, 0.8, { rot: 20 }); put(palms[0], 27, 7.6, -2.5, { rot: 200 }); put(palms[3], 27, -6.6, 2.2, { rot: 90 });
    put(P("rocks-sand-a"), 27, -2.4 * -1 + 6.8, 5, { rot: 40 }); put(P("rocks-sand-b"), 27, -7.5, -4, { rot: 150 });
    put(P("chest"), 27, 2.4, -2.1, { rot: 20, dy: -0.05 }); put(P("tool-shovel"), 27, 3.4, -2.6, { rot: 100, sink: 0.3 });
    scatter(palms, 9, 19, 44, 6, 14, 11);
    scatter([P("rocks-sand-a"), P("rocks-sand-b"), P("rocks-sand-c")], 7, 18, 40, 5.5, 11, 23);
    scatter([P("patch-sand-foliage")], 9, 18, 46, 3.9, 7.5, 31, { scale: 0.45 });
    scatter([P("grass-plant"), P("grass")], 12, 18, 46, 3.9, 7.5, 32);
    put(P("ship-wreck"), 36, -15, 0, { rot: 75, dy: -0.4 });

    /* tappa 3: la collina al pomeriggio */
    put(P("tower-complete-large"), 49.5, 8.5, 3, { rot: 20 });
    put(P("flag-pirate-high"), 49.5, 5.6, -1, { rot: -30 });
    for (var k = 0; k < 9; k++) put(P("castle-wall"), 41 + k * 2, -4.6, 0, { rot: 90 });
    put(P("castle-gate"), 61, -6.2, 0, { rot: 90 });
    put(P("tower-complete-small"), 37, -8, 0, { rot: 40 });
    put(P("structure"), 54, 6, 0, { rot: 0 });
    scatter([P("patch-grass-foliage"), P("patch-grass")], 10, 36, 68, 3.9, 8, 41, { scale: 0.45 });
    scatter([P("grass-plant")], 12, 36, 68, 3.9, 8, 42);
    scatter([P("rocks-a"), P("rocks-b")], 8, 38, 70, 7, 13, 53, { scale: 1.2 });
    scatter([P("palm-straight")], 3, 56, 68, 8, 12, 63);

    /* tappa 4: il porto al tramonto */
    pier(78.75, 96.25, P("structure-platform-dock"));
    put(P("structure-platform-dock"), 89, 2.5, 0.6, { y: "sea" });
    put(P("structure-platform-dock"), 89, 2.5, -1.9, { y: "sea" });
    put(P("structure-platform-dock"), 89, 5.0, 0.6, { y: "sea" });
    [3.1, 5.6, -4.4, -6.9].forEach(function (f) { put(P("structure-platform-dock"), 89, 2.5, f, { y: "sea" }); });   // appoggio per cannone, barili e casse
    put(P("ship-pirate-large"), 89, -8.2, 0, { y: "sea", rot: 0 });
    put(P("cannon-mobile"), 89, 2.6, 5, { y: 0.5, rot: 200 }); put(P("barrel"), 89, 2.6, -4.6, { y: 0.5 }); put(P("crate"), 89, 3.4, -5.2, { y: 0.5, rot: 20 });
    put(P("cannon-ball"), 89, 3.1, 3.3, { y: 0.5 });
    put(P("flag-pirate-high"), 81.5, 1.5, 0, { y: 0.5 }); put(P("flag-pirate-high"), 81.5, -1.5, 0, { y: 0.5, rot: 180 });
    put(P("boat-row-large"), 84, 5, 0, { y: "sea", rot: 80 });
    put(P("rocks-a"), 93, 9, 0, { y: -0.3, scale: 1.5 }); put(P("rocks-b"), 85, -14, 0, { y: -0.3, scale: 1.4 });
    put(P("ship-small"), 83, 28, 0, { y: "sea", rot: 190 });

    /* tappa 5: la grotta */
    var hp = 0.5, FL = 2.5;
    for (var i = 0; i < 5; i++) for (var j = 0; j < 5; j++) putXZ(D("floor"), 35 + FL * i, 4 + FL * j, 0, { scale: FL, y: hp });
    for (var a = 0; a < 7; a++) {                                  // pareti nord e sud
      var wx = 32.5 + FL * a;
      putXZ(a === 3 ? D("wall-opening") : D("wall"), wx, 1.5, 0, { scale: FL, y: hp });
      putXZ(D("wall"), wx, 16.5, 0, { scale: FL, y: hp });
    }
    for (var b = 0; b < 5; b++) {                                  // pareti ovest ed est
      putXZ(D("wall"), 32.5, 4 + FL * b, 0, { scale: FL, y: hp, rot: 90 });
      putXZ(D("wall"), 47.5, 4 + FL * b, 0, { scale: FL, y: hp, rot: 90 });
    }
    // tetto di roccia
    var roof = new THREE.Mesh(new THREE.BoxGeometry(18.5, 0.6, 18.5), new THREE.MeshStandardMaterial({ color: 0x4d515c, roughness: 1, flatShading: true }));
    roof.position.set(40, hp + 2.75 + 0.3, 9);
    world.add(roof);
    // colonne agli angoli, stendardi, botti, tavolo, torce
    [[34.4, 3.4], [45.6, 3.4], [34.4, 14.6], [45.6, 14.6]].forEach(function (p) { putXZ(D("column"), p[0], p[1], 0, { scale: FL, y: hp }); });
    [[32.5, 7, -90], [32.5, 12, -90], [47.5, 7, 90], [47.5, 12, 90]].forEach(function (p) { putXZ(D("banner"), p[0] + (p[2] < 0 ? 0.22 : -0.22), p[1], 0, { scale: FL, y: hp, rot: p[2] }); });
    putXZ(D("barrel"), 35.2, 13.6, 0, { scale: FL, y: hp }); putXZ(D("barrel"), 36.4, 14.4, 0, { scale: FL, y: hp, rot: 40 }); putXZ(D("pot"), 44.4, 14.3, 0, { scale: FL, y: hp, rot: 20 });
    putXZ(D("table"), 44.5, 5, 0, { scale: FL, y: hp, rot: 90 });
    putXZ(D("potion"), 44.5, 5.2, 0, { scale: FL, y: hp + 0.78, rot: 0 });
    putXZ(D("chest"), 34.8, 8.6, 0, { scale: FL, y: hp, rot: 90 }); putXZ(D("key"), 36.2, 8.4, 0, { scale: FL * 0.8, y: hp, rot: 20 }); putXZ(D("coin"), 36.3, 9.6, 0, { scale: FL, y: hp, rot: 50 });
    putXZ(D("stones"), 45, 11.6, 0, { scale: FL, y: hp });
    // piedistalli con lanterne e luci calde
    [[35.6, 5.4], [44.4, 8.4], [35.6, 11.8], [40, 14.8]].forEach(function (p, idx) {
      var lan = models.lantern.clone(true);
      lan.scale.setScalar(2.2);
      lan.position.set(p[0], hp + 1.0, p[1]);
      var stand = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.0, 10), new THREE.MeshStandardMaterial({ color: 0x5f5a52, roughness: 1, flatShading: true }));
      stand.position.set(p[0], hp + 0.5, p[1]);
      world.add(stand, lan);
      var light = new THREE.PointLight(0xffa94d, 1.0, 14, 1.5);
      light.position.set(p[0], hp + 1.5, p[1]);
      world.add(light);
      flickers.push({ light: light, base: 1.0, ph: idx * 1.7 });
    });
    // fuori dalla grotta: rocce ai lati dell'ingresso
    putXZ(D("rocks"), 36.2, -0.6, 0, { scale: 4, y: terrainH(36.2, -0.6) - 0.2, rot: 20 });
    putXZ(D("rocks"), 43.8, -0.6, 0, { scale: 4, y: terrainH(43.8, -0.6) - 0.2, rot: 140 });
  }

  /* ---------------- stazioni (oggetti della memoria) ---------------- */
  var stations = [];
  PW.stations = stations;

  function makeGeometry(shape) {
    switch (shape) {
      case "cone": return new THREE.ConeGeometry(0.36, 0.85, 24);
      case "torus": return new THREE.TorusGeometry(0.34, 0.09, 16, 40);
      case "torusknot": return new THREE.TorusKnotGeometry(0.28, 0.07, 100, 12);
      case "octahedron": return new THREE.OctahedronGeometry(0.45);
      case "sphere": return new THREE.SphereGeometry(0.4, 24, 16);
      case "cylinder": return new THREE.CylinderGeometry(0.3, 0.3, 0.8, 24);
      default: return new THREE.BoxGeometry(0.7, 0.7, 0.7);
    }
  }

  // catalogo degli oggetti sceglibili nell'editor, raggruppati per ambiente
  PW.SHAPE_GROUPS = [
    { name: "Forme semplici", items: [["box", "Cubo"], ["cone", "Cono"], ["torus", "Anello"], ["torusknot", "Nodo"], ["octahedron", "Cristallo"], ["sphere", "Sfera"], ["cylinder", "Cilindro"]] },
    { name: "Isola dei pirati", items: [["m:cannonball", "Palla di cannone"], ["m:chest", "Forziere"], ["m:compass", "Bussola"], ["m:bottle", "Bottiglia"], ["m:flag", "Bandiera pirata"], ["m:cannon", "Cannone"], ["m:barrel", "Barile"]] },
    { name: "Grotta", items: [["m:lantern", "Lanterna"], ["m:flame", "Fiamma"], ["m:key", "Chiave"], ["m:coin", "Moneta"], ["m:potion", "Pozione"], ["m:pot", "Vaso"]] }
  ];
  PW.shapeIds = function () {
    var ids = [];
    PW.SHAPE_GROUPS.forEach(function (g) { g.items.forEach(function (it) { ids.push(it[0]); }); });
    return ids;
  };
  // id --> [modello, dimensione massima in metri]
  var MODEL_SHAPES = {
    "m:cannonball": ["p:cannon-ball", 0.55], "m:chest": ["p:chest", 0.85], "m:compass": ["compass", 0.7], "m:bottle": ["p:bottle", 0.8],
    "m:flag": ["p:flag-pirate-high", 1.3], "m:cannon": ["p:cannon-mobile", 1.05], "m:barrel": ["p:barrel", 0.8],
    "m:lantern": ["lantern", 0.85], "m:key": ["d:key", 0.8], "m:coin": ["d:coin", 0.7], "m:potion": ["d:potion", 0.8], "m:pot": ["d:pot", 0.75]
  };

  // costruisce l'aspetto dell'oggetto: forma semplice, modello 3D o fiamma
  function makeVisual(shape, color) {
    var g = new THREE.Group(), info = MODEL_SHAPES[shape];
    if (info && models[info[0]]) {
      var m = models[info[0]].clone(true);
      var box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
      var sc = info[1] / Math.max(size.x, size.y, size.z);
      m.scale.multiplyScalar(sc);
      box.setFromObject(m);
      m.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
      g.add(m);
      g.userData.kind = "model";
    } else if (shape === "m:flame") {
      var outer = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.62, 14), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.92 }));
      outer.position.y = 0.36;
      var inner = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.38, 12), new THREE.MeshBasicMaterial({ color: 0xffe27a }));
      inner.position.y = 0.26;
      var lamp = new THREE.PointLight(0xff9a3c, 1.1, 6, 1.6);
      lamp.position.y = 0.4;
      g.add(outer, inner, lamp);
      g.userData.kind = "flame";
    } else {
      var mesh = new THREE.Mesh(makeGeometry(shape), new THREE.MeshStandardMaterial({ color: color, roughness: 0.45, metalness: 0.2, emissive: color, emissiveIntensity: 0.12 }));
      mesh.position.y = 0.6;
      if (shape === "torus") mesh.rotation.x = Math.PI * 0.4;
      g.add(mesh);
      g.userData.kind = "shape";
      g.userData.mesh = mesh;
    }
    return g;
  }

  function disposeVisual(v) {
    v.traverse(function (o) {
      if (o.isMesh && o.userData && o.parent === v && o.geometry) o.geometry.dispose();
    });
  }

  function textSprite(draw, w, h, scaleX, scaleY) {
    var cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    draw(cv.getContext("2d"), w, h);
    var tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    sp.scale.set(scaleX, scaleY, 1);
    sp.renderOrder = 20;
    sp.userData.canvas = cv; sp.userData.tex = tex;
    return sp;
  }
  var FONT = 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  function drawBadge(ctx, W, H, n, color, active) {
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 8, 0, Math.PI * 2);
    ctx.fillStyle = active ? color : "#1d2a47"; ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = color; ctx.stroke();
    ctx.fillStyle = active ? "#0b1220" : "#ffffff";
    ctx.font = "700 130px " + FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(n), W / 2, H / 2 + 6);
  }
  function drawLabel(ctx, W, H, text, color) {
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    var r = 46, x = 6, y = 6, w = W - 12, h = H - 12;
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    ctx.fillStyle = "rgba(11,18,32,0.9)"; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = color; ctx.stroke();
    ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    var px = 84; ctx.font = "700 " + px + "px " + FONT;
    while (px > 36 && ctx.measureText(text).width > W - 90) { px -= 4; ctx.font = "700 " + px + "px " + FONT; }
    ctx.fillText(text, W / 2, H / 2 + 4);
  }

  PW.buildStations = function (items) {
    items.forEach(function (item, i) {
      var s = PW.stationS[i], side = PW.stationSide[i];
      var pt = PW.pointAt(s), rx = -pt.tz, rz = pt.tx;
      var lat = side * PW.stationLat[i], fwd = 0.6;
      var x = pt.x + rx * lat + pt.tx * fwd, z = pt.z + rz * lat + pt.tz * fwd;
      var g = new THREE.Group();
      g.position.set(x, pt.h, z);
      var base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 28), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, roughness: 1 }));
      base.position.y = 0.04; g.add(base);
      var ped = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.0, 20), new THREE.MeshStandardMaterial({ color: 0x8a6b4a, roughness: 0.9, flatShading: true }));
      ped.position.y = 0.5; g.add(ped);
      var hit = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.4, 12), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 1.2; g.add(hit);
      var holder = new THREE.Group();
      holder.position.y = 1.05; g.add(holder);
      var light = new THREE.PointLight(0xffffff, 0.7, 6, 1.5);
      light.position.set(0, 2.3, 0); g.add(light);
      var badge = textSprite(function (c, W, H) { drawBadge(c, W, H, i + 1, item.color, false); }, 256, 256, 0.55, 0.55);
      badge.position.y = 2.7; g.add(badge);
      var label = textSprite(function (c, W, H) { drawLabel(c, W, H, item.title, item.color); }, 1024, 256, 1.9, 0.475);
      label.position.y = 3.3; label.visible = false; g.add(label);
      world.add(g);
      var st = { group: g, ped: ped, hit: hit, base: base, holder: holder, visual: null, shape: null, light: light, badge: badge, label: label, item: item, index: i, lookX: x, lookZ: z, lookY: pt.h + 1.3 };
      stations.push(st);
      PW.restyleStation(i, item, false, false);
    });
    return stations;
  };

  PW.restyleStation = function (i, item, active, showLabel) {
    var st = stations[i];
    st.item = item;
    if (st.shape !== item.shape || (st.visual && st.visual.userData.kind === "shape" && st.color !== item.color)) {
      if (st.visual) { st.holder.remove(st.visual); disposeVisual(st.visual); }
      st.visual = makeVisual(item.shape, item.color);
      st.holder.add(st.visual);
      st.shape = item.shape; st.color = item.color;
    }
    st.base.material.color.set(item.color); st.base.material.opacity = active ? 0.95 : 0.45;
    st.light.color.set(item.color);
    var b = st.badge;
    drawBadge(b.userData.canvas.getContext("2d"), 256, 256, i + 1, item.color, active); b.userData.tex.needsUpdate = true;
    var l = st.label;
    drawLabel(l.userData.canvas.getContext("2d"), 1024, 256, item.title, item.color); l.userData.tex.needsUpdate = true;
    l.visible = !!showLabel;
  };

  /* ---------------- avvio e animazione ---------------- */
  PW.init = function (sceneEl, camera, items, onProgress) {
    var scene = sceneEl.object3D;
    buildEnvironment(scene, camera);
    buildTerrain(scene);
    return loadAll(onProgress).then(function () {
      buildScenery(scene);
      PW.buildStations(items);
      PW.updateEnvironment(0, new THREE.Vector3(0, 1.6, 8));
    });
  };

  PW.animate = function (time) {
    var t = time / 1000;
    stations.forEach(function (st) {
      var kind = st.visual && st.visual.userData.kind;
      if (kind !== "flame") st.holder.rotation.y = t * 0.5;
      st.holder.position.y = 1.05 + Math.sin(t * 1.4 + st.index) * 0.04;
      if (kind === "flame") {
        var f = 1 + 0.07 * Math.sin(t * 9 + st.index) + 0.05 * Math.sin(t * 15.3);
        st.visual.scale.set(1 / Math.sqrt(f), f, 1 / Math.sqrt(f));
      }
    });
    flickers.forEach(function (f) {
      f.light.intensity = f.base * (0.85 + 0.12 * Math.sin(t * 7.3 + f.ph) + 0.06 * Math.sin(t * 13.1 + f.ph * 2));
    });
  };
})();
