/*
  PALAZZO DELLA MEMORIA - interfaccia, movimento e logica dei modi
  Menu, pannello della tappa, conferme ed editor sono normali elementi della pagina (HTML),
  il mondo 3D e' in world.js. Nessun dato lascia il dispositivo: tutto si salva in localStorage.
*/
(function () {
  "use strict";
  var THREE = AFRAME.THREE;
  var PW = window.PW;
  var DEFAULTS = window.PALAZZO_CONTENT.items;
  var N = DEFAULTS.length;
  var KEY = { items: "palazzo.v2.items", nick: "palazzo.v2.nick", settings: "palazzo.v2.settings", last: "palazzo.v2.last" };

  /* ---------- salvataggio locale (mai obbligatorio) ---------- */
  function load(key, fallback) {
    try { var v = window.localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function save(key, value) { try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignora */ } }

  var SHAPES = PW.shapeIds();
  function clean(item, def) {
    function str(v, max, d) { v = typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : ""; return v || d; }
    return {
      title: str(item && item.title, 60, def.title),
      note: str(item && item.note, 160, ""),
      image: str(item && item.image, 120, ""),
      shape: SHAPES.indexOf(item && item.shape) >= 0 ? item.shape : def.shape,
      color: /^#[0-9a-fA-F]{6}$/.test(item && item.color) ? item.color : def.color
    };
  }
  function loadItems() {
    var stored = load(KEY.items, null);
    return DEFAULTS.map(function (d, i) { return clean(stored && stored[i], d); });
  }

  var items = loadItems();
  var settings = load(KEY.settings, {});
  settings = { invX: !!settings.invX, invY: !!settings.invY, sens: (typeof settings.sens === "number" && settings.sens >= 0.3 && settings.sens <= 3) ? settings.sens : 1, lock: settings.lock !== false };
  var nick = load(KEY.nick, "");
  var last = load(KEY.last, null);

  /* ---------- elementi della pagina ---------- */
  function $(id) { return document.getElementById(id); }
  var el = {
    loader: $("loader"), loaderText: $("loaderText"), menu: $("menu"), greet: $("greet"), lastResult: $("lastResult"), nick: $("nick"),
    hud: $("hud"), hint: $("hint"), panel: $("panel"), pKicker: $("pKicker"), pTitle: $("pTitle"), pText: $("pText"), pBtns: $("pBtns"),
    toast: $("toast"), joy: $("joy"), joyKnob: $("joyKnob"), confirm: $("confirm"), cText: $("cText"), editor: $("editor"), editorList: $("editorList"),
    invX: $("invX"), invY: $("invY"), sens: $("sens"), sensVal: $("sensVal"), lock: $("lock"), lockRow: $("lockRow"), quick: $("quick"), cross: $("cross"), qSens: $("qSens"), qSensVal: $("qSensVal"), qInvX: $("qInvX"), qInvY: $("qInvY"), qLock: $("qLock"), qLockRow: $("qLockRow"), btnQuick: $("btnQuick")
  };

  var sceneEl = $("scene"), rig = $("rig"), cam = $("cam");
  var state = { screen: "menu", i: 0, shown: false, ok: 0, answers: [], near: false, walking: false, modalOpen: true };
  var view = { yaw: 0, pitch: 0, x: 0, z: 8, y: 0.5, s: 0 };
  var START = { x: 0, z: 8, yaw: 0 };
  var auto = null;
  var keys = {};
  var lastLook = -1e9, lookAccX = 0, lookAccY = 0;
  var joyVec = { x: 0, y: 0 };
  var IS_TOUCH = (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || "ontouchstart" in window || /[?&]joy=1/.test(location.search);

  /* ---------- toast e pannello ---------- */
  var toastTimer = null;
  function toast(text, ms) {
    el.toast.textContent = text;
    el.toast.classList.remove("hidden");
    el.toast.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.toast.style.opacity = "0";
      setTimeout(function () { el.toast.classList.add("hidden"); }, 400);
    }, ms || 2600);
  }

  function setPanel(kicker, title, text, buttons) {
    el.pKicker.textContent = kicker;
    el.pTitle.textContent = title;
    el.pText.textContent = text;
    el.pText.classList.toggle("hidden", !text);
    el.pBtns.textContent = "";
    buttons.forEach(function (b) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = b.label;
      btn.className = b.kind || "";
      if (b.disabled) btn.disabled = true;
      btn.addEventListener("click", b.run);
      el.pBtns.appendChild(btn);
    });
    el.panel.classList.remove("hidden");
    layoutJoystick();
  }

  function layoutJoystick() {
    el.joy.style.bottom = (el.panel.classList.contains("hidden") ? 28 : el.panel.offsetHeight + 34) + "px";
  }

  /* ---------- logica dei modi ---------- */
  function stationInfo(i) { return items[i]; }
  function dist2station(i) {
    var st = PW.stations[i];
    var dx = st.lookX - view.x, dz = st.lookZ - view.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function refreshStations() {
    items.forEach(function (it, i) {
      var active = state.screen !== "menu" && i === state.i;
      var showLabel = active && state.near && !state.walking && (state.screen === "percorso" || (state.screen === "richiamo" && state.shown));
      PW.restyleStation(i, it, active, showLabel);
    });
  }

  function render() {
    refreshStations();
    if (state.screen === "menu") { el.panel.classList.add("hidden"); return; }
    var it = stationInfo(state.i), where = "tappa " + (state.i + 1) + " di " + N;
    var kicker = (state.screen === "percorso" ? "Percorso" : "Richiamo") + " · " + where;
    var prevBtn = state.screen === "percorso"
      ? { label: "Indietro", run: function () { if (state.i > 0) { state.i--; gotoStation(); } }, disabled: state.i === 0 }
      : null;

    if (state.walking) {
      setPanel(kicker, "Cammino verso la tappa " + (state.i + 1) + "…", "Puoi anche camminare da solo: trascina per guardare, usa i tasti o il cerchio per muoverti.", []);
      return;
    }
    if (!state.near) {
      setPanel(kicker, "Raggiungi la tappa " + (state.i + 1), "Cerca l'oggetto numero " + (state.i + 1) + " lungo il percorso, oppure fatti accompagnare.", [
        { label: "Portami lì", kind: "primary", run: function () { gotoStation(); } }
      ]);
      return;
    }
    if (state.screen === "percorso") {
      var txt = it.note ? it.note : "";
      if (it.image) txt += (txt ? " " : "") + "Immagine da collegare: " + it.image + ".";
      setPanel(kicker, (state.i + 1) + ". " + it.title, txt, [
        prevBtn,
        { label: state.i === N - 1 ? "Fine" : "Avanti", kind: "primary", run: function () { if (state.i === N - 1) { finishPercorso(); } else { state.i++; gotoStation(); } } }
      ]);
      return;
    }
    // richiamo
    if (!state.shown) {
      setPanel(kicker, "Cosa avevi collegato qui?", "Guarda l'oggetto e prova a ricordare il concetto e l'immagine. Poi controlla.", [
        { label: "Mostra", kind: "primary", run: function () { state.shown = true; render(); } }
      ]);
      return;
    }
    setPanel(kicker, it.title, (it.image ? "Immagine: " + it.image + ". " : "") + "Lo avevi ricordato?", [
      { label: "Non ricordato", kind: "no", run: function () { answer(false); } },
      { label: "Ricordato", kind: "ok", run: function () { answer(true); } }
    ]);
  }

  function gotoStation() {
    state.shown = false;
    state.walking = true;
    state.near = false;
    walkTo(state.i, function () {
      state.walking = false;
      state.near = true;
      render();
    });
    render();
  }

  function startMode(mode) {
    nick = el.nick.value.replace(/\s+/g, " ").trim().slice(0, 20);
    save(KEY.nick, nick);
    state.screen = mode;
    state.i = 0; state.shown = false; state.ok = 0; state.answers = [];
    showPlayUI();
    gotoStation();
  }

  function showPlayUI() {
    closeModals();
    el.menu.classList.add("hidden");
    el.hud.classList.remove("hidden");
    if (IS_TOUCH) el.joy.classList.remove("hidden");
    el.hint.textContent = IS_TOUCH ? "Trascina per guardare · usa il cerchio a sinistra per camminare" : (settings.lock ? "Muovi il mouse per guardare · W A S D o frecce per camminare · clic sull'oggetto per interagire · M menu · T modifica · I impostazioni" : "Trascina il mouse per guardare · W A S D o frecce per camminare · clic sull'oggetto · M menu · T modifica · I impostazioni");
    el.hint.style.opacity = "1";
    el.hint.classList.remove("hidden");
    setTimeout(function () { el.hint.style.opacity = "0"; }, 12000);
    if (!IS_TOUCH) el.cross.classList.remove("hidden");
    state.modalOpen = false;
    tryLock();
  }

  function finishPercorso() {
    toast("Percorso completato. Quando vuoi, prova il Richiamo.", 3200);
    toMenu(null);
  }

  var FEEDBACK_OK = ["Ottimo: tappa richiamata.", "Tappa richiamata correttamente.", "Complimenti, questa tappa è solida."];
  var FEEDBACK_NO = ["Questa tappa va rinforzata: ripassa l'immagine collegata.", "Tappa da rivedere: prova a rendere l'immagine più vivida.", "Non ancora fissata: ripassala nel prossimo giro."];

  function answer(ok) {
    state.answers.push(ok);
    if (ok) state.ok++;
    toast((ok ? FEEDBACK_OK : FEEDBACK_NO)[state.i % 3], 2200);
    if (state.i === N - 1) { finishRichiamo(); return; }
    state.i++;
    gotoStation();
  }

  function resultText(prev) {
    var missed = [];
    state.answers.forEach(function (a, i) { if (!a) missed.push((i + 1) + " (" + items[i].title + ")"); });
    var pre = nick ? nick + ", " : "";
    var line = pre ? pre + "hai richiamato " : "Hai richiamato ";
    line += state.ok + " tappe su " + N + ".";
    if (state.ok === N) line += " Ottimo lavoro: tutte le tappe sono state richiamate.";
    else if (state.ok >= Math.ceil(N * 0.6)) line += " Da rinforzare: tappa " + missed.join(", ") + ".";
    else line += " Rifai il percorso soffermandoti su ogni immagine, poi riprova. Da rinforzare: tappa " + missed.join(", ") + ".";
    if (prev && typeof prev.ok === "number") {
      var diff = state.ok - prev.ok;
      if (diff > 0) line += " Rispetto al tentativo precedente: " + diff + (diff === 1 ? " tappa in più." : " tappe in più.");
      else if (diff === 0) line += " Stesso risultato del tentativo precedente.";
      else line += " Il tentativo precedente era a " + prev.ok + " tappe: ripassa e riprova.";
    }
    line += " Rifare il richiamo a distanza di tempo aiuta a consolidare.";
    return line;
  }

  function finishRichiamo() {
    var text = resultText(last);
    last = { ok: state.ok, total: N, text: text, at: Date.now() };
    save(KEY.last, last);
    toMenu(null);
  }

  function toMenu() {
    auto = null;
    state.screen = "menu"; state.walking = false; state.near = false; state.shown = false;
    el.hud.classList.add("hidden"); el.cross.classList.add("hidden"); el.panel.classList.add("hidden"); el.joy.classList.add("hidden"); el.hint.classList.add("hidden");
    view.x = START.x; view.z = START.z; view.yaw = START.yaw; view.pitch = 0;
    refreshStations();
    showMenu();
  }

  function showMenu() {
    unlock();
    el.greet.textContent = nick
      ? "Ciao, " + nick + ". Prima il Percorso per imparare, poi il Richiamo per verificare."
      : "Un percorso da esplorare in cui lasci ogni concetto in un luogo preciso: poi lo ritrovi camminando di nuovo lungo lo stesso percorso.";
    if (last && last.text) { el.lastResult.textContent = last.text; el.lastResult.classList.remove("hidden"); }
    else el.lastResult.classList.add("hidden");
    el.nick.value = nick;
    syncSettingsUI(); el.lockRow.classList.toggle("hidden", IS_TOUCH);
    el.menu.classList.remove("hidden");
    state.modalOpen = true;
  }

  /* ---------- finestre: conferma ed editor ---------- */
  function closeModals() {
    el.quick.classList.add("hidden");
    el.confirm.classList.add("hidden");
    el.editor.classList.add("hidden");
  }

  function askMenu() {
    if (state.modalOpen || state.screen === "menu") return;
    unlock();
    state.modalOpen = true;
    el.cText.textContent = state.screen === "richiamo"
      ? "Sei sicuro di voler tornare al menu? Il richiamo in corso andrà perso."
      : "Sei sicuro di voler tornare al menu?";
    el.confirm.classList.remove("hidden");
    $("cNo").focus();
  }

  function syncSettingsUI() {
    var t = settings.sens.toFixed(1) + "×";
    el.sens.value = settings.sens; el.sensVal.textContent = t; el.qSens.value = settings.sens; el.qSensVal.textContent = t;
    el.invX.checked = el.qInvX.checked = !!settings.invX; el.invY.checked = el.qInvY.checked = !!settings.invY;
    el.lock.checked = el.qLock.checked = !!settings.lock;
  }
  function setSens(v, announce) {
    settings.sens = Math.max(0.3, Math.min(3, Math.round(v * 10) / 10));
    save(KEY.settings, settings); syncSettingsUI();
    if (announce) toast("Sensibilità del mouse: " + settings.sens.toFixed(1) + "×", 1200);
  }
  function openQuick() {
    if (state.modalOpen || state.screen === "menu") return;
    unlock();
    state.modalOpen = true;
    syncSettingsUI();
    el.qLockRow.classList.toggle("hidden", IS_TOUCH);
    el.quick.classList.remove("hidden");
    $("qClose").focus();
  }
  function closeQuick() {
    el.quick.classList.add("hidden");
    state.modalOpen = false;
    tryLock();
  }
  function stationNearView() {
    var best = state.i, bd = 1e9;
    PW.stations.forEach(function (st, i) { var d = dist2station(i); if (d < bd) { bd = d; best = i; } });
    return bd < 7 ? best : state.i;
  }

  var editorFocus = 0, editorFromPlay = false;
  function openEditor(index, fromPlay) {
    editorFocus = index || 0; editorFromPlay = !!fromPlay;
    unlock();
    state.modalOpen = true;
    el.editorList.textContent = "";
    items.forEach(function (it, i) { el.editorList.appendChild(buildEditorRow(it, i)); });
    el.editor.classList.remove("hidden");
    var row = $("st" + editorFocus);
    if (row) { row.scrollIntoView({ block: "start" }); var inp = row.querySelector("input[type=text]"); if (inp) inp.focus({ preventScroll: true }); }
  }

  function buildEditorRow(it, i) {
    var box = document.createElement("div");
    box.className = "st"; box.id = "st" + i;
    var h = document.createElement("h3"); h.textContent = "Tappa " + (i + 1); box.appendChild(h);
    function field(label, id, value, max) {
      var l = document.createElement("label"); l.htmlFor = id; l.textContent = label;
      var inp = document.createElement("input"); inp.type = "text"; inp.id = id; inp.maxLength = max; inp.value = value;
      box.appendChild(l); box.appendChild(inp);
    }
    field("Concetto da ricordare", "e_title" + i, it.title, 60);
    field("Spiegazione breve (facoltativa)", "e_note" + i, it.note, 160);
    field("Immagine che colleghi all'oggetto", "e_image" + i, it.image, 120);
    var line = document.createElement("div"); line.className = "inline";
    var d1 = document.createElement("div"), d2 = document.createElement("div");
    var l1 = document.createElement("label"); l1.htmlFor = "e_shape" + i; l1.textContent = "Oggetto";
    var sel = document.createElement("select"); sel.id = "e_shape" + i;
    PW.SHAPE_GROUPS.forEach(function (g) {
      var og = document.createElement("optgroup"); og.label = g.name;
      g.items.forEach(function (s) { var o = document.createElement("option"); o.value = s[0]; o.textContent = s[1]; if (s[0] === it.shape) o.selected = true; og.appendChild(o); });
      sel.appendChild(og);
    });
    d1.appendChild(l1); d1.appendChild(sel);
    var l2 = document.createElement("label"); l2.htmlFor = "e_color" + i; l2.textContent = "Colore";
    var col = document.createElement("input"); col.type = "color"; col.id = "e_color" + i; col.value = it.color;
    d2.style.flex = "0 0 auto"; d2.appendChild(l2); d2.appendChild(col);
    line.appendChild(d1); line.appendChild(d2); box.appendChild(line);
    return box;
  }

  function readEditor() {
    return DEFAULTS.map(function (d, i) {
      return clean({
        title: $("e_title" + i).value, note: $("e_note" + i).value, image: $("e_image" + i).value,
        shape: $("e_shape" + i).value, color: $("e_color" + i).value
      }, d);
    });
  }

  function closeEditor() {
    el.editor.classList.add("hidden");
    state.modalOpen = state.screen === "menu";
    if (!state.modalOpen) tryLock();
  }

  /* ---------- movimento ---------- */
  function wrapAngle(a) { return ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; }

  function walkTo(i, done) {
    auto = { s: PW.stationS[i], i: i, phase: "walk", done: done, hold: 0 };
  }

  function applyLook(dt) {
    if (!lookAccX && !lookAccY) return;
    var k = 1 - Math.exp(-dt * 35);
    var dx = lookAccX * k, dy = lookAccY * k;
    lookAccX -= dx; lookAccY -= dy;
    if (Math.abs(lookAccX) < 0.01) lookAccX = 0;
    if (Math.abs(lookAccY) < 0.01) lookAccY = 0;
    view.yaw += dx; view.pitch += dy;
    view.pitch = Math.max(-1.25, Math.min(1.25, view.pitch));
  }

  // dx, dy in pixel; mode "lock": stile gioco (muovi a destra = guardi a destra); "drag": trascinamento (come prima)
  function lookDelta(dx, dy, mode) {
    if (state.modalOpen || state.screen === "menu") return;
    dx = Math.max(-120, Math.min(120, dx)); dy = Math.max(-120, Math.min(120, dy));
    var k = (mode === "lock" ? 0.0022 : 0.0036) * settings.sens;
    var sx = mode === "lock" ? -1 : 1, sy = sx;
    lookAccX += dx * k * sx * (settings.invX ? -1 : 1);
    lookAccY += dy * k * sy * (settings.invY ? -1 : 1);
    lastLook = performance.now();
  }

  /* ---------- mirino e clic sulle tappe ---------- */
  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), aimed = -1;
  function pick(nx, ny) {
    var camera = cam.getObject3D("camera");
    if (!camera) return -1;
    ndc.set(nx, ny);
    ray.setFromCamera(ndc, camera);
    ray.far = 9;
    var best = -1, bd = 1e9;
    PW.stations.forEach(function (st, i) {
      var hits = ray.intersectObject(st.hit, false);
      if (hits.length && hits[0].distance < bd) { bd = hits[0].distance; best = i; }
    });
    return best;
  }
  function updateAim() {
    if (IS_TOUCH || state.modalOpen || state.screen === "menu") { aimed = -1; return; }
    var a = pick(0, 0);
    if (a !== aimed) { aimed = a; el.cross.classList.toggle("ready", a >= 0); }
  }
  function interact(i) {
    if (i < 0 || state.modalOpen || state.screen === "menu") return;
    if (state.screen === "percorso") { openEditor(i, true); return; }
    if (i === state.i && state.near && !state.shown) { state.shown = true; render(); return; }
    toast(i === state.i ? "Hai già visto la risposta di questa tappa." : "Questa non è la tappa attuale del richiamo.", 1800);
  }

  /* ---------- mouse bloccato (guardare senza cliccare) ---------- */
  var canvasEl = null;
  function locked() { return !!canvasEl && document.pointerLockElement === canvasEl; }
  function tryLock() {
    if (IS_TOUCH || !settings.lock || !canvasEl || locked() || state.modalOpen || state.screen === "menu") return;
    try {
      var r = canvasEl.requestPointerLock && canvasEl.requestPointerLock();
      if (r && r.catch) r.catch(function () { /* il browser non lo permette: resta il trascinamento */ });
    } catch (e) { /* ignora */ }
  }
  function unlock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* ignora */ } }

  function applyView(dt) {
    var eased = Math.min(1, dt * 10);
    view.yEased = view.yEased === undefined ? view.y : view.yEased + (view.y - view.yEased) * eased;
    rig.object3D.position.set(view.x, view.yEased, view.z);
    rig.object3D.rotation.y = view.yaw;
    cam.object3D.rotation.x = view.pitch;
    cam.object3D.rotation.order = "YXZ";
  }

  function step(dt) {
    if (state.screen === "menu" || state.modalOpen) {
      // sfondo del menu: il percorso si vede, la telecamera resta ferma
      applyView(dt);
      return;
    }
    applyLook(dt);
    var f = 0, sd = 0, turn = 0;
    if (keys.KeyW || keys.ArrowUp) f += 1;
    if (keys.KeyS || keys.ArrowDown) f -= 1;
    if (keys.KeyA) sd -= 1;
    if (keys.KeyD) sd += 1;
    if (keys.ArrowLeft) turn += 1;
    if (keys.ArrowRight) turn -= 1;
    f += -joyVec.y; sd += joyVec.x;
    var mag = Math.sqrt(f * f + sd * sd);
    if (mag > 1) { f /= mag; sd /= mag; mag = 1; }
    if (turn) view.yaw += turn * 1.8 * dt;

    if ((mag > 0.08 || turn) && auto) { auto = null; state.walking = false; render(); }

    if (auto) {
      autoStep(dt);
    } else if (mag > 0.08) {
      var fx = -Math.sin(view.yaw), fz = -Math.cos(view.yaw), rx = Math.cos(view.yaw), rz = -Math.sin(view.yaw);
      var speed = 3.4;
      var c = PW.constrain(view.x + (fx * f + rx * sd) * speed * dt, view.z + (fz * f + rz * sd) * speed * dt);
      view.x = c.x; view.z = c.z; view.y = c.y; view.s = c.s;
    } else {
      var c0 = PW.constrain(view.x, view.z);
      view.x = c0.x; view.z = c0.z; view.y = c0.y; view.s = c0.s;
    }
    applyView(dt);
    updateAim();

    // "vicino alla tappa"?
    if (state.screen !== "menu" && !state.walking) {
      var near = dist2station(state.i) < 5.2;
      if (near !== state.near) { state.near = near; state.shown = near ? state.shown : false; render(); }
    }
  }

  function autoStep(dt) {
    var a = auto, n = PW.nearest(view.x, view.z);
    var delta = a.s - n.s, dir = delta >= 0 ? 1 : -1, remaining = Math.abs(delta);
    if (a.phase === "walk") {
      var speed = Math.min(4.6, 1.2 + remaining * 1.4);
      var ns = n.s + dir * Math.min(remaining, speed * dt);
      var pt = PW.pointAt(ns), rxx = -n.tz, rzz = n.tx;
      var lat = (view.x - n.px) * rxx + (view.z - n.pz) * rzz;
      lat *= Math.exp(-3 * dt);
      var prx = -pt.tz, prz = pt.tx;
      view.x = pt.x + prx * lat; view.z = pt.z + prz * lat; view.y = pt.h; view.s = ns;
      var yawT = Math.atan2(-pt.tx * dir, -pt.tz * dir);
      if (performance.now() - lastLook > 900) {
        view.yaw += wrapAngle(yawT - view.yaw) * Math.min(1, dt * 6);
        view.pitch += (0 - view.pitch) * Math.min(1, dt * 4);
      }
      if (remaining < 0.08) a.phase = "turn";
    } else {
      var st = PW.stations[a.i];
      var dx = st.lookX - view.x, dz = st.lookZ - view.z, d = Math.sqrt(dx * dx + dz * dz);
      var yawL = Math.atan2(-dx, -dz), pitchL = Math.atan2(st.lookY - (view.y + 1.6), d);
      if (performance.now() - lastLook > 900) {
        view.yaw += wrapAngle(yawL - view.yaw) * Math.min(1, dt * 7);
        view.pitch += (pitchL - view.pitch) * Math.min(1, dt * 7);
      }
      a.hold += dt;
      if (a.hold > 0.55) { var done = a.done; auto = null; if (done) done(); }
    }
  }

  /* ---------- guardare con mouse e dito ---------- */
  function setupLook() {
    var canvas = canvasEl = sceneEl.canvas || sceneEl.querySelector("canvas");
    var drag = null, clickStart = { x: 0, y: 0 };
    canvas.addEventListener("pointerdown", function (e) {
      clickStart.x = e.clientX; clickStart.y = e.clientY;
      if (state.modalOpen || state.screen === "menu") return;
      if (e.pointerType === "mouse" && settings.lock && !IS_TOUCH && !locked()) { tryLock(); }
      if (locked() || drag) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignora */ }
    });
    // clic (o tocco) senza spostamento: interagisce con l'oggetto indicato dal mirino o toccato
    canvas.addEventListener("click", function (e) {
      if (state.modalOpen || state.screen === "menu") return;
      if (Math.abs(e.clientX - (clickStart.x)) + Math.abs(e.clientY - (clickStart.y)) > 10 && !locked()) return;
      if (locked()) { interact(aimed); return; }
      var r = canvas.getBoundingClientRect();
      interact(pick(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)));
    });
    canvas.addEventListener("pointermove", function (e) {
      if (locked() || !drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      lookDelta(dx, dy, "drag");
    });
    function end(e) { if (drag && e.pointerId === drag.id) drag = null; }
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    document.addEventListener("mousemove", function (e) {
      if (!locked()) return;
      lookDelta(e.movementX || 0, e.movementY || 0, "lock");
    });
    document.addEventListener("pointerlockchange", function () {
      if (!locked() && state.screen !== "menu" && !state.modalOpen) toast("Mouse libero. Clicca sulla scena per riprendere.", 2400);
    });
  }

  function setupJoystick() {
    var id = null, R = 42;
    function move(e) {
      var r = el.joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var dx = e.clientX - cx, dy = e.clientY - cy, d = Math.sqrt(dx * dx + dy * dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      joyVec.x = dx / R; joyVec.y = dy / R;
      el.joyKnob.style.transform = "translate(" + dx + "px," + dy + "px)";
    }
    el.joy.addEventListener("pointerdown", function (e) { id = e.pointerId; el.joy.setPointerCapture(id); move(e); e.preventDefault(); });
    el.joy.addEventListener("pointermove", function (e) { if (e.pointerId === id) move(e); });
    function end(e) { if (e.pointerId === id) { id = null; joyVec.x = 0; joyVec.y = 0; el.joyKnob.style.transform = ""; } }
    el.joy.addEventListener("pointerup", end);
    el.joy.addEventListener("pointercancel", end);
  }

  function typing(e) { var t = e.target && e.target.tagName; return t === "INPUT" || t === "TEXTAREA" || t === "SELECT"; }
  window.addEventListener("keydown", function (e) {
    if (typing(e)) return;
    if (/^(KeyW|KeyA|KeyS|KeyD|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/.test(e.code)) { keys[e.code] = true; if (e.code.indexOf("Arrow") === 0 && !state.modalOpen) e.preventDefault(); }
    if (state.screen !== "menu" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.code === "Escape" && !state.modalOpen) askMenu();
      else if (e.code === "KeyM" && !state.modalOpen) askMenu();
      else if (e.code === "KeyT" && !state.modalOpen) openEditor(stationNearView(), true);
      else if (e.code === "KeyI") { if (state.modalOpen && !el.quick.classList.contains("hidden")) closeQuick(); else openQuick(); }
      else if (!state.modalOpen && (e.code === "Equal" || e.code === "NumpadAdd" || e.key === "+")) setSens(settings.sens + 0.1, true);
      else if (!state.modalOpen && (e.code === "Minus" || e.code === "NumpadSubtract" || e.key === "-")) setSens(settings.sens - 0.1, true);
    }
  });
  window.addEventListener("keyup", function (e) { keys[e.code] = false; });
  window.addEventListener("blur", function () { keys = {}; });

  /* ---------- collegamenti dei pulsanti ---------- */
  function wireUI() {
    $("btnPercorso").addEventListener("click", function () { startMode("percorso"); });
    $("btnRichiamo").addEventListener("click", function () { startMode("richiamo"); });
    $("btnEdit").addEventListener("click", function () { openEditor(0, false); });
    $("btnMenu").addEventListener("click", askMenu);
    $("btnEditHere").addEventListener("click", function () { openEditor(stationNearView(), true); });
    $("cNo").addEventListener("click", function () { el.confirm.classList.add("hidden"); state.modalOpen = false; tryLock(); });
    $("cYes").addEventListener("click", function () { el.confirm.classList.add("hidden"); toMenu(); });
    $("eCancel").addEventListener("click", closeEditor);
    $("eReset").addEventListener("click", function () {
      DEFAULTS.forEach(function (d, i) {
        $("e_title" + i).value = d.title; $("e_note" + i).value = d.note; $("e_image" + i).value = d.image;
        $("e_shape" + i).value = d.shape; $("e_color" + i).value = d.color;
      });
    });
    $("eSave").addEventListener("click", function () {
      items = readEditor();
      save(KEY.items, items);
      closeEditor();
      refreshStations();
      if (state.screen !== "menu") render();
      toast("Tappe salvate su questo dispositivo.", 2200);
    });
    el.invX.addEventListener("change", function () { settings.invX = el.invX.checked; save(KEY.settings, settings); });
    el.invY.addEventListener("change", function () { settings.invY = el.invY.checked; save(KEY.settings, settings); });
    el.sens.addEventListener("input", function () { setSens(parseFloat(el.sens.value) || 1); });
    el.qSens.addEventListener("input", function () { setSens(parseFloat(el.qSens.value) || 1); });
    el.lock.addEventListener("change", function () { settings.lock = el.lock.checked; save(KEY.settings, settings); syncSettingsUI(); });
    el.qLock.addEventListener("change", function () { settings.lock = el.qLock.checked; save(KEY.settings, settings); syncSettingsUI(); });
    el.qInvX.addEventListener("change", function () { settings.invX = el.qInvX.checked; save(KEY.settings, settings); syncSettingsUI(); });
    el.qInvY.addEventListener("change", function () { settings.invY = el.qInvY.checked; save(KEY.settings, settings); syncSettingsUI(); });
    el.btnQuick.addEventListener("click", openQuick);
    $("qClose").addEventListener("click", closeQuick);
    el.nick.addEventListener("change", function () { nick = el.nick.value.replace(/\s+/g, " ").trim().slice(0, 20); save(KEY.nick, nick); showMenu(); });
    window.addEventListener("resize", layoutJoystick);
  }

  /* ---------- avvio ---------- */
  function whenReady(fn) { if (sceneEl.hasLoaded) fn(); else sceneEl.addEventListener("loaded", fn, { once: true }); }

  whenReady(function () {
    wireUI();
    setupJoystick();
    setupLook();
    cam.object3D.rotation.order = "YXZ";
    function fitCamera() {
      var c = cam.getObject3D("camera");
      if (!c) return;
      c.fov = window.innerWidth < window.innerHeight ? 96 : 72;
      c.updateProjectionMatrix();
    }
    fitCamera();
    window.addEventListener("resize", fitCamera);
    var t0 = performance.now(), prev = t0;
    sceneEl.object3D.updateMatrixWorld(true);
    var camWorld = new THREE.Vector3();

    PW.init(sceneEl, cam.getObject3D("camera"), items, function (done, total) {
      el.loaderText.textContent = "Carico il percorso… " + Math.round((done / total) * 100) + "%";
    }).then(function () {
      view.x = START.x; view.z = START.z; view.yaw = START.yaw; view.pitch = 0;
      var c = PW.constrain(view.x, view.z); view.y = c.y; view.s = c.s;
      applyView(1);
      el.loader.classList.add("hidden");
      showMenu();
      window.PALAZZO_READY = true;
    }).catch(function (e) {
      el.loaderText.textContent = "Qualcosa è andato storto nel caricamento: " + (e && e.message ? e.message : e) + ". Prova a ricaricare la pagina.";
    });

    var raf = function (now) {
      var dt = Math.min(0.1, (now - prev) / 1000); prev = now;
      if (window.PALAZZO_READY) {
        step(dt);
        PW.animate(now);
        camWorld.set(view.x, (view.yEased || view.y) + 1.6, view.z);
        PW.updateEnvironment(view.s, camWorld);
      }
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  });

  // piccole funzioni per i test automatici
  window.PALAZZO = {
    state: state, view: view,
    startPercorso: function () { startMode("percorso"); },
    startRichiamo: function () { startMode("richiamo"); },
    toMenu: toMenu, render: render,
    setView: function (x, z, yaw, pitch) { var c = PW.constrain(x, z); view.x = c.x; view.z = c.z; view.y = c.y; view.s = c.s; view.yaw = yaw || 0; view.pitch = pitch || 0; view.yEased = view.y; },
    getItems: function () { return items; },
    _lookDelta: lookDelta, settings: settings, _pick: pick, _interact: interact, _aimed: function () { return aimed; }
  };
})();
