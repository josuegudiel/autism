/* Brújula TEA — PWA estática. Vanilla JS, sin dependencias. */
"use strict";

const view = document.getElementById("view");
const TABS = ["inicio", "evidencia", "detector", "rastreador", "asistente", "fuentes"];

/* ---------- helpers ---------- */
const esc = (s) => String(s == null ? "" : s)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

const _cache = {};
async function getJSON(path) {
  if (_cache[path]) return _cache[path];
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error("No se pudo cargar " + path);
  const data = await res.json();
  _cache[path] = data;
  return data;
}

function sourcesHTML(fuentes) {
  if (!fuentes || !fuentes.length) return "";
  return `<div class="sources">${fuentes.map(
    (f) => `<a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.label)}</a>`
  ).join("")}</div>`;
}

function setActiveTab(tab) {
  document.querySelectorAll(".tabbar a").forEach((a) =>
    a.classList.toggle("active", a.dataset.tab === tab));
}

function loading() { view.innerHTML = `<div class="empty">Cargando…</div>`; }
function errorBox(msg) { view.innerHTML = `<div class="callout warn">${esc(msg)}</div>`; }

/* ---------- router ---------- */
async function route() {
  const hash = (location.hash.replace("#", "") || "inicio").toLowerCase();
  const tab = TABS.includes(hash) ? hash : "inicio";
  setActiveTab(tab === "fuentes" ? "inicio" : tab);
  view.scrollIntoView({ block: "start" });
  try {
    if (tab === "inicio") return renderInicio();
    if (tab === "evidencia") return await renderEvidencia();
    if (tab === "detector") return await renderDetector();
    if (tab === "rastreador") return await renderRastreador();
    if (tab === "asistente") return await renderAsistente();
    if (tab === "fuentes") return await renderFuentes();
  } catch (e) {
    errorBox("Ocurrió un error: " + e.message);
  }
  view.focus({ preventScroll: true });
}
window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", route);

/* ---------- Inicio ---------- */
function renderInicio() {
  view.innerHTML = `
    <div class="hero">
      <h1>Información en la que puedes confiar</h1>
      <p>Una guía en español para acompañar a tu hijo: lo que la ciencia respalda, lo que conviene evitar,
      y un espacio para registrar qué le funciona <em>a tu niño</em>.</p>
      <a class="btn" href="#evidencia">Empezar por lo esencial</a>
    </div>
    <div class="tiles">
      <a class="tile" href="#evidencia"><div class="ico">📚</div><h4>Centro de evidencia</h4><p>Qué es el TEA, cómo se diagnostica y qué intervenciones funcionan — con su nivel de evidencia y fuentes.</p></a>
      <a class="tile" href="#detector"><div class="ico">🚩</div><h4>Detector de pseudociencia</h4><p>Consulta si una terapia o producto es confiable, dudoso o peligroso.</p></a>
      <a class="tile" href="#rastreador"><div class="ico">📈</div><h4>Seguimiento de mi hijo</h4><p>Registra intervenciones y avances. Los datos se quedan en tu dispositivo.</p></a>
      <a class="tile" href="#asistente"><div class="ico">💬</div><h4>Asistente</h4><p>Pregunta y recibe respuestas con fuentes. Nunca recomienda algo peligroso.</p></a>
    </div>
    <div class="spacer"></div>
    <div class="callout">
      ¿Sospechas autismo en tu hijo? Lo más valioso a edades tempranas es una <strong>evaluación formal</strong> y
      empezar pronto la <strong>intervención</strong>. <a href="#evidencia">Aquí te explicamos cómo es el proceso real.</a>
    </div>
    <p style="text-align:center;margin-top:18px"><a class="btn ghost" href="#fuentes">Ver todas las fuentes</a></p>
  `;
}

/* ---------- Evidencia ---------- */
async function renderEvidencia() {
  loading();
  const data = await getJSON("content/evidencia.json");
  const lg = data.leyenda;
  const legend = ["alta", "media", "evitar"].map(
    (k) => `<span class="lvl ${k}">${lg[k].icono} ${esc(lg[k].texto)}</span>`
  ).join(" ");
  const secciones = data.secciones.map((s) => `
    <section id="${esc(s.id)}">
      <h3 class="sec">${esc(s.titulo)}</h3>
      <p class="sec-intro">${esc(s.intro)}</p>
      ${s.items.map((it) => card(it)).join("")}
    </section>
  `).join("");
  view.innerHTML = `
    <h1 class="page">Centro de evidencia</h1>
    <h2 class="page-sub">Cada afirmación está anclada a una fuente que puedes abrir y comprobar.</h2>
    <div class="card" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">${legend}</div>
    <div class="spacer"></div>
    ${secciones}
  `;
}

function card(it) {
  const lvl = it.nivel;
  const dot = lvl === "evitar" ? "🔴" : lvl === "media" ? "🟡" : "🟢";
  return `
    <article class="card ${lvl === "evitar" ? "evitar" : ""}">
      <h4><span class="dot" aria-hidden="true">${dot}</span><span>${esc(it.titulo)}</span>
        <span class="lvl ${esc(lvl)}" style="margin-left:auto">${lvlLabel(lvl)}</span></h4>
      <p>${esc(it.texto)}</p>
      ${sourcesHTML(it.fuentes)}
    </article>`;
}
function lvlLabel(l) {
  return l === "alta" ? "Evidencia alta" : l === "media" ? "Evidencia limitada"
    : l === "evitar" ? "Evitar" : l === "ok" ? "Sí tiene evidencia" : l;
}

/* ---------- Detector ---------- */
let _detector = null;
async function renderDetector() {
  loading();
  _detector = _detector || await getJSON("content/banderas-rojas.json");
  const chips = _detector.casos.map(
    (c) => `<button type="button" data-id="${esc(c.id)}">${esc(c.nombre)}</button>`
  ).join("");
  view.innerHTML = `
    <h1 class="page">Detector de pseudociencia</h1>
    <h2 class="page-sub">${esc(_detector.intro)}</h2>
    <div class="card">
      <label for="q">Escribe una terapia, producto o afirmación</label>
      <div class="chat-form">
        <input id="q" type="text" placeholder="p. ej. quelación, test de cabello, dieta…" autocomplete="off" />
        <button class="btn" id="go">Revisar</button>
      </div>
      <div class="suggest">${chips}</div>
    </div>
    <div id="result"></div>
  `;
  const input = document.getElementById("q");
  const result = document.getElementById("result");
  const run = (text) => { result.innerHTML = detectorResult(text); result.scrollIntoView({ block: "nearest" }); };
  document.getElementById("go").onclick = () => run(input.value);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") run(input.value); });
  view.querySelectorAll(".suggest button").forEach((b) =>
    b.onclick = () => { const c = _detector.casos.find((x) => x.id === b.dataset.id); input.value = c.nombre; run(c.nombre); });
}

function normalize(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function detectorResult(text) {
  const q = normalize(text || "").trim();
  if (!q) return "";
  const hit = _detector.casos.find((c) =>
    (c.alias || []).some((a) => { const na = normalize(a); return q.includes(na) || na.includes(q); }) ||
    normalize(c.nombre).includes(q)
  );
  if (!hit) {
    return `<div class="card"><h4><span aria-hidden="true">🔎</span> Sin coincidencia exacta</h4>
      <p>No tengo una ficha para «${esc(text)}». Regla general: si una prueba o terapia no aparece en estudios
      independientes, promete una 'cura', o pide dinero por desintoxicar/quelación/MMS, trátala como bandera roja
      y consulta a un profesional.</p>
      <a class="btn ghost" href="#fuentes">Cómo verificarlo tú mismo</a></div>`;
  }
  const v = hit.veredicto;
  const head = v === "ok"
    ? `🟢 <span style="color:#1c6c47">Tiene evidencia</span>`
    : v === "media"
      ? `🟡 <span style="color:#8a5d10">Cautela / incertidumbre</span>`
      : `🔴 <span style="color:#9b2f22">Evítalo</span>`;
  return `
    <article class="card ${v === "evitar" ? "evitar" : ""}">
      <div class="verdict">${head}</div>
      <h4 style="margin-top:8px"><span>${esc(hit.nombre)}</span></h4>
      <p><strong>${esc(hit.resumen)}</strong></p>
      <p>${esc(hit.porque)}</p>
      ${sourcesHTML(hit.fuentes)}
    </article>`;
}

/* ---------- Rastreador (IndexedDB local) ---------- */
const DB_NAME = "brujula-tea";
const STORE = "registros";
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    tx.onsuccess = () => resolve(tx.result.sort((a, b) => (a.fecha < b.fecha ? 1 : -1)));
    tx.onerror = () => reject(tx.error);
  });
}
async function dbAdd(entry) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite").objectStore(STORE).add(entry);
    tx.onsuccess = () => resolve(tx.result);
    tx.onerror = () => reject(tx.error);
  });
}
async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite").objectStore(STORE).delete(id);
    tx.onsuccess = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const MOODS = ["😟", "😐", "🙂", "😀", "🤩"];
async function renderRastreador() {
  loading();
  let entries = [];
  try { entries = await dbAll(); } catch (_) {}
  const today = new Date().toISOString().slice(0, 10);
  view.innerHTML = `
    <h1 class="page">Seguimiento de mi hijo</h1>
    <h2 class="page-sub">Registra qué intervención hiciste y cómo estuvo el día. <strong>Todo se guarda solo en este dispositivo.</strong></h2>

    <div class="card">
      <form id="f-track">
        <div class="row">
          <div><label for="fecha">Fecha</label><input id="fecha" type="date" value="${today}" max="${today}" required></div>
          <div><label for="animo">Ánimo / día (1 a 5)</label>
            <select id="animo">${MOODS.map((m, i) => `<option value="${i + 1}">${m} ${i + 1}</option>`).join("")}</select></div>
        </div>
        <label for="interv">Intervención o actividad</label>
        <input id="interv" type="text" placeholder="p. ej. terapia de lenguaje, juego compartido…" autocomplete="off">
        <label for="nota">Observación (opcional)</label>
        <textarea id="nota" rows="2" placeholder="¿Qué notaste? avances, dificultades…"></textarea>
        <div class="spacer"></div>
        <button class="btn block" type="submit">Guardar registro</button>
      </form>
    </div>

    <section>
      <h3 class="sec">Tu progreso</h3>
      <p class="sec-intro">Ánimo de los últimos registros (de izquierda = más antiguo a derecha = más reciente).</p>
      <div class="card" id="chart"></div>
    </section>

    <section>
      <h3 class="sec">Historial</h3>
      <div id="list"></div>
      <div class="spacer"></div>
      <button class="btn danger" id="wipe" ${entries.length ? "" : "hidden"}>Borrar todos mis datos</button>
    </section>
  `;
  document.getElementById("f-track").addEventListener("submit", async (e) => {
    e.preventDefault();
    const entry = {
      fecha: document.getElementById("fecha").value,
      animo: Number(document.getElementById("animo").value),
      interv: document.getElementById("interv").value.trim(),
      nota: document.getElementById("nota").value.trim(),
      creado: Date.now()
    };
    if (!entry.fecha) return;
    await dbAdd(entry);
    renderRastreador();
  });
  const wipe = document.getElementById("wipe");
  if (wipe) wipe.onclick = async () => {
    if (!confirm("¿Borrar TODOS los registros de este dispositivo? No se puede deshacer.")) return;
    for (const en of entries) await dbDelete(en.id);
    renderRastreador();
  };
  paintChart(entries);
  paintList(entries);
}

function paintChart(entries) {
  const el = document.getElementById("chart");
  if (!entries.length) { el.innerHTML = `<div class="empty">Aún no hay registros. Agrega el primero arriba.</div>`; return; }
  const last = entries.slice(0, 14).reverse();
  el.innerHTML = `<div class="bars">${last.map((e) => {
    const h = (e.animo / 5) * 100;
    return `<div class="bar" style="height:${h}%" title="${esc(e.fecha)}: ${MOODS[e.animo - 1]}"><span>${esc(e.fecha.slice(5))}</span></div>`;
  }).join("")}</div><div class="spacer"></div>`;
}

function paintList(entries) {
  const el = document.getElementById("list");
  if (!entries.length) { el.innerHTML = `<div class="empty">Sin registros todavía.</div>`; return; }
  el.innerHTML = entries.map((e) => `
    <article class="card">
      <div class="tracker-entry">
        <div>
          <strong>${esc(e.fecha)}</strong> <span class="mood">${MOODS[e.animo - 1] || ""}</span>
          ${e.interv ? `<div>${esc(e.interv)}</div>` : ""}
          ${e.nota ? `<small>${esc(e.nota)}</small>` : ""}
        </div>
        <button class="btn ghost" data-del="${e.id}" aria-label="Borrar">✕</button>
      </div>
    </article>`).join("");
  el.querySelectorAll("[data-del]").forEach((b) =>
    b.onclick = async () => { await dbDelete(Number(b.dataset.del)); renderRastreador(); });
}

/* ---------- Asistente (modo demo; listo para conectar Claude) ---------- */
let _demo = null;
async function renderAsistente() {
  loading();
  _demo = _demo || await getJSON("content/asistente-demo.json");
  view.innerHTML = `
    <h1 class="page">Asistente</h1>
    <div class="demo-note">⚙️ <strong>Modo demostración.</strong> Responde a temas frecuentes con fuentes.
      Cuando se conecte la IA (Claude), podrá responder a cualquier pregunta, citando fuentes y sin recomendar nada peligroso. Ver el README.</div>
    <div class="chat-wrap">
      <div class="chat-log" id="log"></div>
      <form class="chat-form" id="chatf" autocomplete="off">
        <input id="chati" type="text" placeholder="Escribe tu pregunta…" aria-label="Tu mensaje" />
        <button class="btn" type="submit">Enviar</button>
      </form>
    </div>
  `;
  const log = document.getElementById("log");
  pushMsg(log, "bot", _demo.bienvenida, []);
  document.getElementById("chatf").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("chati");
    const text = input.value.trim();
    if (!text) return;
    pushMsg(log, "user", text, []);
    input.value = "";
    const reply = demoReply(text);
    setTimeout(() => pushMsg(log, "bot", reply.texto, reply.fuentes), 250);
  });
}

function pushMsg(log, who, text, fuentes) {
  const div = document.createElement("div");
  div.className = "msg " + who;
  div.innerHTML = esc(text) + (who === "bot" ? sourcesHTML(fuentes) : "");
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

/* Coincidencia simple por disparadores. Sustituible por fetch('/api/chat') al activar Claude. */
function demoReply(text) {
  const q = normalize(text);
  for (const r of _demo.respuestas) {
    if ((r.disparadores || []).some((d) => q.includes(normalize(d))))
      return { texto: r.texto, fuentes: r.fuentes || [] };
  }
  return { texto: _demo.fallback, fuentes: [] };
}

/* ---------- Fuentes ---------- */
async function renderFuentes() {
  loading();
  const data = await getJSON("content/fuentes.json");
  const grupos = data.grupos.map((g) => `
    <section>
      <h3 class="sec">${esc(g.titulo)}</h3>
      <div class="card"><div class="sources">${g.fuentes.map(
        (f) => `<a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.label)}</a>`
      ).join("")}</div></div>
    </section>`).join("");
  view.innerHTML = `
    <h1 class="page">Fuentes y cómo verificar</h1>
    <h2 class="page-sub">${esc(data.intro)}</h2>
    ${grupos}
    <section>
      <h3 class="sec">Cómo comprobarlo tú mismo</h3>
      <div class="card"><ul class="checks">${data.comoVerificar.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>
    </section>
  `;
}

/* ---------- Service worker ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
