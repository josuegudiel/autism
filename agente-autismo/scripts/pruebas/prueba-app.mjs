// Pruebas de la app en un navegador real, a tamaño de iPhone.
//
// Uso:
//   cd agente-autismo && python3 -m http.server 8098 --bind 127.0.0.1 &
//   node scripts/pruebas/prueba-app.mjs
//
// Comprueba que la biblioteca se busca con lenguaje de padre, que los temas
// abren con sus fuentes, que el Detector no inventa veredictos y que las
// líneas de ayuda urgente siguen ahí. Sale con código 1 si algo falla.

// Playwright suele estar instalado de forma global, y los módulos ESM no leen
// NODE_PATH. Lo resolvemos a mano para no depender de un node_modules local.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  const global = execSync('npm root -g', { encoding: 'utf8' }).trim();
  ({ chromium } = require(global + '/playwright'));
}

const B = process.env.BASE || 'http://localhost:8098/web/index.html';
// En este entorno el Chromium vive fuera de donde Playwright lo busca, así que
// hay que señalárselo. En un runner de CI, en cambio, Playwright ya sabe dónde
// está el suyo: si la ruta no existe, es mejor dejar que la resuelva él que
// fallar al arrancar con una ruta que sólo vale en una máquina.
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const errores = [];
const nav = await chromium.launch(existsSync(CHROME) ? { executablePath: CHROME } : {});
const pag = await nav.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
// Se guarda la referencia del anotador para poder desengancharlo un momento:
// hay comprobaciones que piden a propósito un fichero que no existe, y ese 404
// no es un fallo de la app.
const anotaConsola = (m) => { if (m.type() === 'error') errores.push('CONSOLA: ' + m.text()); };
pag.on('console', anotaConsola);
pag.on('pageerror', (e) => errores.push('JS: ' + e.message));

const ir = async (hash) => {
  await pag.goto(B + hash, { waitUntil: 'load' });
  await pag.waitForTimeout(700);
};
const texto = async () => (await pag.textContent('#view')) || '';

const check = (nombre, cond, extra = '') => {
  console.log(`${cond ? '✅' : '❌'} ${nombre}${cond ? '' : '  << ' + extra}`);
  if (!cond) errores.push('FALLO: ' + nombre + ' ' + extra);
};

// 1. Inicio
await ir('#inicio');
let t = await texto();
check('Inicio muestra el buscador y el nº de temas', /\b\d{3} temas\b/.test(t), t.slice(0, 120));
check('Inicio enlaza a ayuda urgente', /[Aa]yuda urgente/.test(t));

// 2. Búsqueda en lenguaje natural
const buscar = async (q) => {
  await ir('#biblioteca');
  await pag.fill('#q-bib', q);
  await pag.click('#f-bib button[type=submit]');
  await pag.waitForTimeout(500);
  return await pag.textContent('#res-bib');
};

const casos = [
  // Frase hecha solo de palabras vacías: sin el rescate por sinónimo, el
  // buscador se quedaba sin tokens y no devolvía nada. Es lo que escribe
  // un padre de verdad.
  ['es por el autismo', /causa médica/i, 'encuentra la ficha del sesgo médico'],
  ['no come nada', /ARFID|selectividad|come/i, 'encuentra alimentación'],
  ['mi hijo no duerme', /Sueño/i, 'encuentra Sueño'],
  ['no habla', /Comunicaci|CAA|logopedia/i, 'encuentra Comunicación/CAA'],
  ['se pega', /Conductas|Agresi|Salud mental|autolesi/i, 'encuentra conductas/autolesión'],
  ['en la escuela', /[Ee]scuela|aula/, 'encuentra escuela'],
  ['las vacunas causan autismo', /[Vv]acunas/, 'encuentra el tema de vacunas'],
  ['en mexico', /México/, 'encuentra México'],
  ['se atraganta', /atragant/i, 'encuentra atragantamiento'],
  ['no oye bien', /audici|oye|otitis/i, 'encuentra audición'],
];
for (const [q, re, desc] of casos) {
  const r = await buscar(q);
  // La app repite la consulta en el mensaje de "sin resultados", así que hay
  // que exigir además que haya resultados: si no, una prueba puede pasar
  // reconociendo su propia pregunta.
  const hay = !/Sin resultados|No encontré nada/i.test(r);
  check(`"${q}" → ${desc}`, hay && re.test(r), r.slice(0, 160));
}

let r = await buscar('asdfghjkl');
check('consulta sin sentido → dice que no hay resultados', /Sin resultados/i.test(r), r.slice(0, 160));

// 2bis. El buscador solo miraba título, mensaje y claves, así que un nombre que
// vive dentro del texto no lo encontraba nadie: a una familia a la que le
// ofrecen ozonoterapia, escribir «ozono» le devolvía cero resultados.
const buscarHondo = async (q) => {
  await ir('#biblioteca');
  await pag.fill('#q-bib', q);
  await pag.click('#f-bib button[type=submit]');
  // Las palabras del cuerpo se bajan al buscar, no al entrar: hay que darle
  // tiempo a esa petición y al repintado que viene detrás.
  await pag.waitForTimeout(1800);
  return await pag.textContent('#res-bib');
};
for (const q of ['ozono', 'secretina', 'mercurio']) {
  const rr = await buscarHondo(q);
  check(`«${q}» encuentra su tema, que solo aparece dentro del cuerpo`,
    !/Sin resultados/i.test(rr), rr.slice(0, 160));
}

// Las palabras del cuerpo se consultan por la palabra que escribe la familia, y
// «constructor» es una palabra española corriente que todo objeto de JavaScript
// trae ya puesta. Tiene que decir que no hay nada, no tirar la biblioteca.
const rc = await buscarHondo('constructor');
check('«constructor» no rompe la biblioteca', /Sin resultados/i.test(rc), rc.slice(0, 160));

// El cuerpo sirve para APARECER, nunca para adelantar: un tema que menciona una
// palabra de pasada no puede ponerse por delante del que se llama así.
await buscarHondo('sueño');
const primeros = await pag.$$eval('#res-bib .tema-card h4', (el) => el.slice(0, 3).map((x) => x.textContent));
check('Un acierto en el título sigue mandando sobre una mención en el cuerpo',
  /Sueño/i.test(primeros[0] || ''), JSON.stringify(primeros));

// 3. Abrir un tema
await ir('#tema/W');
t = await texto();
check('Tema W (Sueño) se abre con contenido', t.includes('Sueño') && t.length > 600, 'len=' + t.length);
check('Tema W muestra sus fuentes', /Fuentes · \d+/.test(t));
const enlaces = await pag.$$eval('.tema-cuerpo a', (a) => a.length);
check('Tema W tiene enlaces clicables en el cuerpo', enlaces > 0, 'enlaces=' + enlaces);

await ir('#tema/BC');
t = await texto();
check('Tema BC (vacunas) se abre', /[Vv]acunas/.test(t) && t.length > 600);

// 4. Detector: no debe inventar veredictos
const detectar = async (q) => {
  await ir('#detector');
  await pag.fill('#q', q);
  await pag.click('#go');
  await pag.waitForTimeout(400);
  return await pag.textContent('#result');
};

let d = await detectar('a');
check('Detector: "a" NO da veredicto rojo', !/Evítalo/.test(d), d.slice(0, 140));
d = await detectar('e');
check('Detector: "e" NO da veredicto rojo', !/Evítalo/.test(d), d.slice(0, 140));
d = await detectar('terapia');
check('Detector: "terapia" NO da un rojo directo', !/Evítalo/.test(d), d.slice(0, 140));
check('Detector: "terapia" pregunta a cuál se refiere', /A cuál te refieres|cuál/i.test(d), d.slice(0, 140));
d = await detectar('quelacion');
check('Detector: "quelación" SÍ da su veredicto', /Quelaci/i.test(d) && /Evítalo/.test(d), d.slice(0, 140));
d = await detectar('vitamina c');
check('Detector: algo sin ficha no inventa veredicto',
  !/Evítalo/.test(d) && /No tengo una ficha/.test(d), d.slice(0, 140));

// 4bis. Nadie escribe fichas: escribe frases. El detector tiene que reconocer
// el nombre del producto dentro de la frase, con signos y con alias cortos.
for (const frase of ['quieren darle MMS a mi hijo', 'gotas de mms',
                     '¿mms?', 'me ofrecen enemas de cds', 'protocolo de dióxido de cloro']) {
  d = await detectar(frase);
  check(`Detector: «${frase}» reconoce el MMS`,
    /Evítalo/.test(d) && /lej[ií]a|MMS/i.test(d), d.slice(0, 140));
}
d = await detectar('sistema');
check('Detector: "sistema" NO dispara "stem" (células madre)',
  !/Evítalo/.test(d) && !/c[ée]lulas madre/i.test(d), d.slice(0, 140));
d = await detectar('terapia');
check('Detector: en una coincidencia ambigua sí avisa de lo que hay que evitar',
  /conviene evitar/i.test(d), d.slice(0, 200));

// 4ter. Asistente en modo demostración: el orden de las respuestas es la
// política de seguridad. Lo peligroso y la crisis van antes que lo general.
const preguntar = async (q) => {
  await ir('#asistente');
  await pag.fill('#chati', q);
  await pag.press('#chati', 'Enter');
  await pag.waitForTimeout(600);
  return await pag.textContent('#log');
};
let a = await preguntar('¿funciona la quelación?');
check('Asistente: "¿funciona la quelación?" advierte, no lista terapias',
  /NO funcionan|peligros/i.test(a) && !/intervención temprana/i.test(a), a.slice(-200));
a = await preguntar('no puedo más, estoy desbordada');
check('Asistente: la angustia del cuidador saca los teléfonos de ayuda',
  /024/.test(a) && /Ayuda urgente/i.test(a), a.slice(-200));
a = await preguntar('¿qué terapias funcionan?');
check('Asistente: la pregunta general sigue respondiendo lo que funciona',
  /intervención temprana/i.test(a), a.slice(-200));

// 5. Ayuda urgente
await ir('#ayuda');
t = await texto();
check('Ayuda muestra España 024', t.includes('024') && t.includes('España'));
check('Ayuda muestra México 800 911 2000', t.includes('800 911 2000'));
check('Ayuda muestra señales de alarma', /Señales de alarma/.test(t));

// 6. El resto de secciones sigue viva
await ir('#evidencia');
t = await texto();
check('Centro de evidencia sigue funcionando', t.includes('Centro de evidencia') && t.length > 500);
await ir('#rastreador');
t = await texto();
check('Rastreador sigue funcionando', t.includes('Seguimiento de mi hijo'));
await ir('#fuentes');
t = await texto();
check('Fuentes sigue funcionando', t.length > 300);

// 6bis. Evidencia y Asistente estaban declarados en TABS y los pintaba el
// router, pero sin ninguna puerta desde Inicio: en la práctica no existían, y
// con ellos las cinco tarjetas de «Tratamientos a EVITAR». Se lee TABS de la
// propia app para que esto valga también para la sección que venga mañana.
await ir('#inicio');
const tabs = await pag.evaluate(() => TABS);
const rutas = await pag.$$eval('#view a[href^="#"]', (el) => el.map((x) => x.getAttribute('href')));
const huerfanas = tabs.filter((s) => s !== 'inicio' &&
  !rutas.some((h) => h === '#' + s || h.startsWith('#' + s + '/')));
check('Desde Inicio se llega a todas las secciones de TABS', huerfanas.length === 0,
  'sin puerta desde Inicio: ' + huerfanas.join(', '));

// Las secciones que cuelgan de Inicio dejan Inicio encendido: una barra entera
// apagada le dice al padre que se ha salido de la app.
for (const h of ['#evidencia', '#asistente', '#fuentes']) {
  await ir(h);
  const activas = await pag.$$eval('.tabbar a.active', (el) => el.map((x) => x.dataset.tab));
  check(`En ${h} la barra de abajo marca Inicio`,
    activas.length === 1 && activas[0] === 'inicio', 'activas=' + JSON.stringify(activas));
}

// 7. Service worker: lo publicado tiene que llegar a quien ya abrió la app.
// Va al final a propósito: en cuanto el service worker toma el control, sirve
// desde su caché, y eso enturbiaría cualquier comprobación posterior.
const fs = require('node:fs');
const swSrc = await (await fetch(new URL('sw.js', B))).text();
check('sw.js declara la versión en la línea exacta que sustituye el despliegue',
  /^const VERSION = "[^"]+";$/m.test(swSrc), swSrc.slice(0, 200));
check('el nombre de la caché sale de esa versión, no de un número a mano',
  /^const CACHE = "brujula-tea-" \+ VERSION;$/m.test(swSrc) && !/brujula-tea-v\d/.test(swSrc),
  swSrc.slice(0, 400));

const rutaWf = new URL('../../../.github/workflows/publicar.yml', import.meta.url);
const wf = fs.existsSync(rutaWf) ? fs.readFileSync(rutaWf, 'utf8') : '';
check('el despliegue estampa el SHA en la copia publicada de sw.js',
  /sed -i .*VERSION.*GITHUB_SHA.*sitio\/sw\.js/.test(wf), 'publicar.yml');
check('el despliegue falla si no encuentra esa línea, en vez de publicar sin versionar',
  /grep -q .*GITHUB_SHA.*sitio\/sw\.js/.test(wf) && /exit 1/.test(wf), 'publicar.yml');
check('el despliegue no publica sin haber pasado antes la suite',
  /needs:\s*pruebas/.test(wf) && /prueba-app\.mjs/.test(wf), 'publicar.yml');

// El SW lo registra la propia app, pero hasta que no controla la página estas
// comprobaciones no medirían nada.
await ir('#inicio');
const controla = await pag.evaluate(async () => {
  await navigator.serviceWorker.register('sw.js');
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) {
    await new Promise((ok) => {
      navigator.serviceWorker.addEventListener('controllerchange', ok, { once: true });
      setTimeout(ok, 3000);
    });
  }
  return !!navigator.serviceWorker.controller;
});
check('el service worker controla la página', controla);

// Un 404 del hosting en mitad de un despliegue no puede quedarse guardado. El
// 404 de aquí es a propósito, así que se desengancha un momento el anotador de
// la consola para que no cuente como error de la app.
pag.off('console', anotaConsola);
const basura = await pag.evaluate(async () => {
  const url = new URL('content/no-existe-en-el-repo.json', location.href).href;
  const res = await fetch(url);
  await new Promise((ok) => setTimeout(ok, 600));
  return { estado: res.status, guardado: !!(await caches.match(url)) };
});
pag.on('console', anotaConsola);
check('el service worker no guarda en caché un 404 del hosting',
  basura.estado === 404 && basura.guardado === false, JSON.stringify(basura));

// Copia vieja fabricada a mano: es lo que tiene una familia que abrió la app
// antes de que se corrigiera el contenido. Tiene que reemplazarse sola.
const swr = await pag.evaluate(async () => {
  const url = new URL('content/fuentes.json', location.href).href;
  const nombre = (await caches.keys()).find((k) => k.startsWith('brujula-tea-'));
  if (!nombre) return { primera: '', segunda: '', error: 'no hay caché de la app' };
  await (await caches.open(nombre)).put(url, new Response('{"intro":"COPIA VIEJA"}'));
  const primera = (await (await fetch(url)).text()).slice(0, 40);
  await new Promise((ok) => setTimeout(ok, 1000));
  const segunda = (await (await fetch(url)).text()).slice(0, 40);
  return { nombre, primera, segunda };
});
check('el service worker revalida por detrás: la copia vieja se reemplaza sola',
  swr.primera.includes('COPIA VIEJA') && !swr.segunda.includes('COPIA VIEJA'), JSON.stringify(swr));

// Y con todo eso, sin conexión la app tiene que seguir abriendo.
await pag.context().setOffline(true);
await pag.reload({ waitUntil: 'load' });
await pag.waitForTimeout(900);
t = await texto();
check('sin conexión la app sigue abriendo desde la caché', /\b\d{3} temas\b/.test(t), t.slice(0, 100));
await pag.context().setOffline(false);

// 8. Un fallo de almacenamiento tiene que VERSE. La familia no puede creer que
// ha guardado el día de su hijo y no haberlo guardado. Se comprueba en una
// pestaña aparte, con IndexedDB anulado: borrar la base de verdad colgaría la
// suite, porque openDB abre una conexión en cada llamada y no cierra ninguna.
const pagSinDB = await nav.newPage({ viewport: { width: 393, height: 852 } });
await pagSinDB.addInitScript(() => {
  Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
});
await pagSinDB.goto(B + '#rastreador', { waitUntil: 'load' });
await pagSinDB.waitForTimeout(900);
let sinDB = (await pagSinDB.textContent('#view')) || '';
check('Sin almacenamiento, el rastreador avisa en vez de fingir una lista vacía',
  /No hemos podido leer tus registros/.test(sinDB), sinDB.slice(0, 220));
check('Y explica la salida en lenguaje llano, no con el nombre del error',
  /ventana privada|incógnito/i.test(sinDB) && !/SecurityError/.test(sinDB), sinDB.slice(0, 220));
check('Y no miente con «Sin registros todavía»', !/Sin registros todav/.test(sinDB), sinDB.slice(0, 220));

await pagSinDB.fill('#interv', 'terapia de lenguaje');
await pagSinDB.click('#f-track button[type="submit"]');
await pagSinDB.waitForTimeout(700);
sinDB = (await pagSinDB.textContent('#view')) || '';
check('Un registro que no se pudo guardar se dice, no se da por bueno',
  /no se ha guardado/i.test(sinDB), sinDB.slice(0, 220));
check('Y lo escrito sigue en el formulario para poder reintentarlo',
  (await pagSinDB.inputValue('#interv')) === 'terapia de lenguaje');
await pagSinDB.close();

// 9. Accesibilidad. Esta app la usa una madre o un padre agotado, de noche, en
// un móvil y a veces con una mano: que el texto se lea no es cumplimiento
// formal, es la diferencia entre servir y no servir.
await ir('#inicio');
const regiones = await pag.evaluate(() => ({
  mainVivo: document.querySelector('main#view')?.hasAttribute('aria-live'),
  anuncio: !!document.querySelector('#anuncio[aria-live]'),
}));
check('El <main> ya no es región viva: no relee la pantalla entera en cada navegación',
  regiones.mainVivo === false, JSON.stringify(regiones));
check('Hay una región viva pequeña donde anunciar solo lo que cambia', regiones.anuncio);

check('La pestaña activa se marca con aria-current, no solo con color',
  (await pag.$$eval('.tabbar a[aria-current="page"]', (el) => el.length)) === 1);

// Se lee con $eval y no con textContent: si la región no existiera, textContent
// se quedaría 30 segundos esperándola y la suite moriría de timeout en vez de
// decir qué falla. Una prueba que cuelga el arnés no informa de nada.
const anuncio = async () => pag.$eval('#anuncio', (el) => el.textContent).catch(() => '');

// Buscar y revisar no cambian de pantalla: si no se anuncian, quien no ve la
// pantalla no se entera de que ha habido respuesta.
await ir('#biblioteca');
await pag.fill('#q-bib', 'no duerme');
await pag.press('#q-bib', 'Enter');
await pag.waitForTimeout(800);
check('Buscar en la biblioteca anuncia cuántos resultados hay',
  /\d+ resultados? para/.test(await anuncio()), await anuncio());

await ir('#detector');
check('El campo del detector tiene nombre accesible',
  !!(await pag.getAttribute('#q', 'aria-label')));
await pag.fill('#q', 'quelación');
await pag.click('#go');
await pag.waitForTimeout(600);
check('El detector dice en voz alta su veredicto, que es a lo que se venía',
  /Evítalo.*Quelaci/i.test(await anuncio()), await anuncio());

await ir('#asistente');
check('El chat del asistente es región viva: ahí está la respuesta de crisis',
  !!(await pag.$('#log[aria-live]')));

// Contraste medido en el navegador, no deducido de los tokens.
const razon = async () => pag.evaluate(() => {
  const lum = (c) => {
    const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const rgba = (s) => s.match(/[\d.]+/g).map(Number);
  const sobre = (fg, bg) => { const a = fg.length > 3 ? fg[3] : 1; return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const fondo = rgba(getComputedStyle(document.body).backgroundColor).slice(0, 3);
  const mide = (sel, bg) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const base = bg ? rgba(getComputedStyle(el).backgroundColor).slice(0, 3) : fondo;
    return Math.round(ratio(sobre(rgba(getComputedStyle(el).color), base), base) * 100) / 100;
  };
  return { aviso: mide('.disclaimer'), boton: mide('.btn', true) };
});
const claro = await razon();
check('El aviso sanitario se lee en modo claro', claro.aviso >= 4.5, 'razón ' + claro.aviso);
check('El rótulo de los botones se lee en modo claro', claro.boton >= 4.5, 'razón ' + claro.boton);
await pag.emulateMedia({ colorScheme: 'dark' });
await pag.reload({ waitUntil: 'load' });
await pag.waitForTimeout(700);
const oscuro = await razon();
check('El aviso sanitario se lee también de noche', oscuro.aviso >= 4.5, 'razón ' + oscuro.aviso);
check('Y el rótulo de los botones también: era 2,29:1 y no se leía',
  oscuro.boton >= 4.5, 'razón ' + oscuro.boton);
await pag.emulateMedia({ colorScheme: 'light' });

// 10. Exportar. Los registros del niño viven solo en este navegador y el
// navegador puede vaciarlos cuando le falte espacio: meses de seguimiento se
// pierden sin que la familia haya hecho nada mal. Tiene que haber una salida, y
// el dato no puede pasar por ningún servidor para salir.
// Va en una pestaña aparte para no dejar registros en la base que usan las
// otras comprobaciones.
const pagExp = await nav.newPage({ viewport: { width: 393, height: 852 } });
await pagExp.goto(B + '#rastreador', { waitUntil: 'load' });
await pagExp.waitForTimeout(800);
check('Sin registros no hay nada que exportar, y el botón no está', !(await pagExp.$('#export')));
await pagExp.fill('#interv', 'logopedia; con "comillas"');
await pagExp.fill('#nota', 'buen día\nsegunda línea');
await pagExp.click('#f-track button[type="submit"]');
await pagExp.waitForTimeout(900);
check('Con registros guardados aparece el botón de exportar', !!(await pagExp.$('#export')));
const [descarga] = await Promise.all([
  pagExp.waitForEvent('download'),
  pagExp.click('#export'),
]);
const csv = fs.readFileSync(await descarga.path(), 'utf8');
check('El fichero es un CSV que Excel abre sin romper los acentos',
  csv.startsWith('﻿') && /"Fecha";"Ánimo/.test(csv), JSON.stringify(csv.slice(0, 90)));
check('Una nota con comillas, punto y coma y saltos de línea sobrevive entera',
  csv.includes('""comillas""') && /buen día\r?\nsegunda línea/.test(csv), JSON.stringify(csv.slice(-160)));
check('El nombre del fichero no lleva datos del niño',
  /^brujula-tea-registros-\d{4}-\d{2}-\d{2}\.csv$/.test(descarga.suggestedFilename()),
  descarga.suggestedFilename());
await pagExp.close();

// 11. Las cifras escritas a mano en la documentación caducan solas: así fue como
// README-iOS.md acabó prometiendo 308 temas mientras el índice traía 360. Se
// atan aquí al JSON que las genera, para que la próxima vez lo diga una prueba y
// no una auditoría. Se aceptan las tres cifras que el índice sí sostiene —el
// total, los verificados y los que quedan por verificar—; cualquier otra es una
// cifra vieja que alguien copió y nadie volvió a mirar.
const idxJson = JSON.parse(fs.readFileSync(new URL('../../web/content/biblioteca-indice.json', import.meta.url), 'utf8'));
const legitimas = new Set([idxJson.totalTemas, idxJson.verificados, idxJson.totalTemas - idxJson.verificados]);
const viejas = [];
for (const rel of ['../../README.md', '../../ESTADO.md', '../../ios/README-iOS.md', '../../ios/README.md']) {
  const txt = fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
  for (const m of txt.matchAll(/(\d[\d.]*)\s+temas/g)) {
    const n = Number(m[1].replaceAll('.', ''));
    if (!legitimas.has(n)) viejas.push(`${rel.split('/').pop()}: «${m[0].trim()}»`);
  }
}
check(`La documentación no arrastra cifras de temas que el índice ya no sostiene`,
  viejas.length === 0, viejas.join(' · '));

// 12. Ronda 28. Las tres fichas nuevas tienen que abrirse y encontrarse con las
// palabras que escribiría un padre, no con su código.
for (const [codigo, marca] of [['MW', /domiciliaria|hospitalaria/i], ['MX', /pensi[óo]n/i], ['MZ', /planificaci[óo]n/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 28: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['no puede ir a clase', /domiciliaria|hospitalaria|clase/i],
                       ['si trabaja pierde la pensión', /pensi[óo]n/i],
                       ['qué pasa cuando termine el colegio', /planificar|adulta|colegio/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 28: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}
// MY se rechazó por solapamiento con JX, que ya explica el artículo 34.8. No
// puede estar en la app: dos fichas contando lo mismo con números distintos es
// peor que una sola.
const sinMY = JSON.parse(fs.readFileSync(new URL('../../web/content/biblioteca-indice.json', import.meta.url), 'utf8'));
check('Ronda 28: la ficha MY, rechazada por duplicar a JX, NO está publicada',
  !sinMY.temas.some((t) => t.codigo === 'MY'));

// 13. Ronda 29. Los cuatro temas nuevos, y las dos cosas que esta ronda arregló
// y que una prueba tiene que sostener para que no vuelvan a romperse.
for (const [codigo, marca] of [['NA', /discriminaci[óo]n por asociaci[óo]n/i],
                               ['NB', /asistente personal|ayuda a domicilio/i],
                               ['NC', /incertidumbre|imprevisto/i],
                               ['ND', /herman/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 29: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['me quieren echar del trabajo por cuidar a mi hijo', /despido|discriminaci[óo]n|trabajo/i],
                       ['necesito ayuda en casa', /asistente|domicilio|cuidador/i],
                       ['se cancela un plan y se hunde', /imprevisto|incertidumbre|plan/i],
                       ['va a nacer un hermanito', /herman/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 29: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}
// El editor de NB encabezó su ficha como «### NA.»: dos temas con el mismo
// código habrían dejado uno de los dos inalcanzable por URL. Se corrigió a mano,
// pero el fallo es del tipo que no se ve leyendo, así que se vigila para todos.
const ind = JSON.parse(fs.readFileSync(new URL('../../web/content/biblioteca-indice.json', import.meta.url), 'utf8'));
const vistos = new Set(), repes = new Set();
for (const t of ind.temas) { if (vistos.has(t.codigo)) repes.add(t.codigo); vistos.add(t.codigo); }
check('Ningún código de tema está repetido en el índice', repes.size === 0, [...repes].join(' '));
// MY se rechazó en la ronda 28 y se reescribió acotada; se publicó como NA. El
// borrador viejo sigue en research/pendientes/ y no puede colarse en la app.
check('Ronda 29: MY sigue sin publicarse; su reescritura vive como NA',
  !ind.temas.some((t) => t.codigo === 'MY') && ind.temas.some((t) => t.codigo === 'NA'));
// La lente de contradicción paró NA porque chocaba con GL en qué ley rige en
// Ecuador. Se resolvió: la de 2025 derogó la de 2012. Si alguien vuelve a meter
// la ley derogada como marco vigente, esto lo caza.
const cuerpo = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const gl = cuerpo.slice(cuerpo.indexOf('### GL.'), cuerpo.indexOf('### ', cuerpo.indexOf('### GL.') + 6));
check('GL cita la ley ecuatoriana vigente (2025), no la derogada de 2012',
  /Ley Orgánica de las Personas con Discapacidad \(2025\)/.test(gl) && /derog/i.test(gl));


// 14. Ronda 30. Tres publicadas, una rechazada, y una ficha vieja corregida
// porque la lente de contradicción destapó que decía algo que no se sostenía.
for (const [codigo, marca] of [['NE', /residencia|inadmisibilidad|visado|pa[íi]s/i],
                               ['NF', /expediente|historia cl[íi]nica|datos/i],
                               ['NH', /canguro|ni[ñn]era|abuelos|noche fuera/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 30: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['nos mudamos a otro país con mi hijo autista', /residencia|visado|pa[íi]s|mudan/i],
                       ['tengo que dar el informe del diagnóstico al colegio', /informe|expediente|datos|colegio/i],
                       ['dejar al niño a dormir en casa de los abuelos', /abuelos|noche|canguro|ni[ñn]era/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 30: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}
const ind30 = JSON.parse(fs.readFileSync(new URL('../../web/content/biblioteca-indice.json', import.meta.url), 'utf8'));
// NG repetía el mensaje clave de IS con otra franja horaria. Su borrador vive en
// research/pendientes/NG.md; en la app no puede estar.
check('Ronda 30: NG, rechazada por repetir a IS, NO está publicada',
  !ind30.temas.some((t) => t.codigo === 'NG') && ind30.temas.some((t) => t.codigo === 'IS'));
// NG afirmaba que el ejercicio mejora sobre todo lo social; DH, publicada y
// verificada, que es lo que menos mejora. Ninguna lo tenía bien: el metaanálisis
// de 2025 ordena motor > social > ejecutiva > comunicación, y la comunicación ni
// siquiera alcanza significación. DH quedó corregida; esto vigila que siga así.
const lib30 = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const dh = lib30.slice(lib30.indexOf('### DH.'), lib30.indexOf('### ', lib30.indexOf('### DH.') + 6));
check('DH separa habilidades sociales de comunicación y no las da por igual',
  /habilidades sociales/i.test(dh) && /no alcanz/i.test(dh) && !/en menor medida, comunicación\/interacción social/.test(dh));


// 15. Ronda 31. Tres publicadas; NI terminada pero NO publicada, a la espera de
// una decisión editorial sobre el umbral de riesgo suicida.
for (const [codigo, marca] of [['NJ', /acatisia|diston[íi]a|discinesia|risperidona/i],
                               ['NK', /custodia|esta noche|carpeta|quien se quede/i],
                               ['NL', /herman/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 31: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['no para quieto desde que toma la medicación', /acatisia|inquietud|medicaci[óo]n|risperidona/i],
                       ['si me ingresan quién se queda con mi hijo', /noche|custodia|carpeta|quede/i],
                       ['pega a su hermana', /herman/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 31: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}
const ind31 = JSON.parse(fs.readFileSync(new URL('../../web/content/biblioteca-indice.json', import.meta.url), 'utf8'));
// Mientras NI no esté, el tema lo sostienen las fichas que ya mandan a urgencias.
// Si alguien publica NI sin unificar el umbral, esta prueba es el aviso.
check('Ronda 31: NI no está publicada mientras el umbral de urgencia no se unifique',
  !ind31.temas.some((t) => t.codigo === 'NI'));
// NK se publicó recortada porque su entrada es otra; si no enlaza con NH, la
// familia se queda sin la hoja de traspaso justo la noche que la necesita.
const lib31 = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const trozo = (cod) => lib31.slice(lib31.indexOf('### ' + cod + '.'), lib31.indexOf('### ', lib31.indexOf('### ' + cod + '.') + 6));
check('NK y NH se enlazan en los dos sentidos', /NK\./.test(trozo('NH')) && /NH\./.test(trozo('NK')));
// Ninguna ficha publicada puede quedarse con el estado en suspenso que pone el
// editor cuando deja una decisión a un humano: o se resuelve, o no se publica.
check('Ninguna ficha publicada arrastra un estado «pendiente de decisión»',
  !/^### .*⏳/m.test(lib31), (lib31.match(/^### .*⏳.*$/m) || [''])[0].slice(0, 110));


// 16. Ronda 32. Las cuatro publicadas. Y una comprobación que nace de que el
// mismo fallo se ha repetido dos veces: el editor encabeza la ficha con el
// código de otra (NB en la ronda 29, NN en la 32).
for (const [codigo, marca] of [['NM', /rescate|si precisa|calmante/i],
                               ['NN', /levetiracetam|antiepil[ée]ptic/i],
                               ['NP', /espalda|ducharlo|moverlo|lesion/i],
                               ['NQ', /mutismo/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 32: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['me han dado algo para cuando se ponga muy mal', /rescate|calmante|precisa/i],
                       ['está más irritable desde que toma el antiepiléptico', /levetiracetam|antiepil[ée]ptic|irritab/i],
                       ['me duele la espalda de levantarlo', /espalda|lesion|ducharlo|moverlo/i],
                       ['no habla en el colegio pero sí en casa', /mutismo/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 32: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}
// Publicar una ficha son dos escrituras: el markdown en la biblioteca y la línea
// en indice-temas.txt. Si una se hace y la otra no, el tema existe a medias y no
// se nota leyendo. Esto compara los dos ficheros código a código.
const libro = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const idxTxt = fs.readFileSync(new URL('../../research/indice-temas.txt', import.meta.url), 'utf8');
const codsLibro = new Set([...libro.matchAll(/^### ([A-Z]{1,2})\. /gm)].map((m) => m[1]));
const codsIdx = new Set(idxTxt.split('\n').map((l) => (l.match(/^([A-Z]{1,2})\. /) || [])[1]).filter(Boolean));
const soloLibro = [...codsLibro].filter((c) => !codsIdx.has(c));
const soloIdx = [...codsIdx].filter((c) => !codsLibro.has(c));
check('La biblioteca y el índice de temas contienen exactamente los mismos códigos',
  soloLibro.length === 0 && soloIdx.length === 0,
  'solo en la biblioteca: ' + (soloLibro.join(' ') || '-') + ' · solo en el índice: ' + (soloIdx.join(' ') || '-'));
// Y que el índice publicado a la app no pierda ninguno por el camino.
const ind32 = JSON.parse(fs.readFileSync(new URL('../../web/content/biblioteca-indice.json', import.meta.url), 'utf8'));
const enApp = new Set(ind32.temas.map((t) => t.codigo));
const perdidos = [...codsLibro].filter((c) => !enApp.has(c));
check('Ningún tema de la biblioteca se queda fuera de la app al convertir',
  perdidos.length === 0, perdidos.join(' '));

// 17. Ronda 33. Las cuatro publicadas; NU salió bloqueada por tres cosas que el
// editor no podía tocar desde dentro de su ficha, y que se arreglaron aquí.
for (const [codigo, marca] of [['NR', /colegio|rescate|adrenalina|plan de/i],
                               ['NS', /risperidona|aripiprazol|peso|metformina/i],
                               ['NT', /resonancia/i],
                               ['NU', /certificado|dictamen|informe/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 33: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['en el colegio dicen que no pueden medicar', /colegio|medicar|rescate/i],
                       ['ha engordado mucho con la medicación', /peso|engord|risperidona|metformina/i],
                       ['le quieren hacer una resonancia', /resonancia/i],
                       ['no sé qué papel necesito', /certificado|dictamen|informe|papel/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 33: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}
const lib33 = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const bloque = (cod) => lib33.slice(lib33.indexOf('### ' + cod + '.'), lib33.indexOf('### ', lib33.indexOf('### ' + cod + '.') + 6));
// LP mandaba a una familia mexicana o colombiana a buscarse la vida («esta ficha
// no te sirve») cuando la biblioteca sí tiene su ruta, ahora en NU.
check('LP ya no deja sin salida a quien vive en México o Colombia',
  !/Si vives en México, Colombia u otro país, esta ficha \*\*no te sirve\*\*/.test(bloque('LP'))
  && /NU\./.test(bloque('LP')));
// Una ficha sin entradas propias en el buscador no la encuentra nadie: las
// consultas de certificado ya iban todas a LP.
const sin = JSON.parse(fs.readFileSync(new URL('../../scripts/sinonimos.json', import.meta.url), 'utf8'));
const haciaNU = Object.entries(sin).filter(([, v]) => Array.isArray(v) && v.includes('NU'));
check('NU tiene consultas propias en el buscador, no solo las de LP', haciaNU.length >= 5,
  haciaNU.length + ' entradas');


// 18. Ronda 34. Las cuatro publicadas tras resolver cuatro choques con fichas
// que ya estaban en la app. Dos de ellos eran errores de las publicadas.
for (const [codigo, marca] of [['NV', /funcional|epilepsia|tics|desmayo/i],
                               ['NW', /ginec[óo]log|anticoncep/i],
                               ['NX', /atenci[óo]n temprana|colegio/i],
                               ['NY', /pediatra|adultos|seguimiento/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 34: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['me dicen que no es epilepsia', /funcional|epilepsia/i],
                       ['llevarla al ginecólogo', /ginec[óo]log|anticoncep/i],
                       ['se acaba la atención temprana', /temprana|colegio/i],
                       ['ya no le corresponde el pediatra', /pediatra|adultos/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 34: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}
const lib34 = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const bl = (cod) => lib34.slice(lib34.indexOf('### ' + cod + '. '), lib34.indexOf('### ', lib34.indexOf('### ' + cod + '. ') + 6));
// S y NW citaban el MISMO trabajo (Ragaglia 2023) con lecturas opuestas, las dos
// en verde. La revisión dice que ninguna intervención logró ambas cosas a la vez:
// mejorar el conocimiento Y cambiar la conducta. S prometía el salto a la conducta.
check('S ya no promete que enseñar educación sexual cambie la conducta',
  !/añadir práctica produce cambios conductuales/.test(bl('S'))
  && /ninguna intervención demostró a la vez/.test(bl('S')));
// MO citaba la 5.ª edición de los criterios de la OMS; la 6.ª (2025) la sustituyó.
check('MO cita la edición vigente de los criterios de la OMS, no la superada',
  /6\.ª edición, de 2025/.test(bl('MO')));
// MZ repetía casi literalmente lo que ahora desarrolla NY.
check('MZ ya no duplica el traspaso a adultos: remite a NY',
  /NY\./.test(bl('MZ')) && !/averigua a qué edad exacta termina\s+la pediatría/.test(bl('MZ')));
// Tres fichas daban tres edades para empezar a planificar la transición sin decir
// de dónde salían. Ahora cada una nombra su fuente.
check('I y MZ explican de dónde sale su edad para planificar la transición',
  /AAP \(estadounidense\)/.test(bl('I')) && /la AAP\s+estadounidense dice ~12/.test(bl('MZ')));


// 19. Ronda 35. Las cuatro publicadas tras resolver tres choques; dos eran
// errores de fichas publicadas y el tercero, dos papeles que nadie distinguía.
for (const [codigo, marca] of [['NZ', /par[áa]lisis cerebral/i],
                               ['PA', /psic[óo]log|decidir|consentimiento/i],
                               ['PB', /prestaci|beca|deducci|ayuda/i],
                               ['PC', /cupo|reserva|oposici|empleo/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 35: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['tiene parálisis cerebral y autismo', /par[áa]lisis cerebral/i],
                       ['se niega a ir al psicólogo', /psic[óo]log|decidir/i],
                       ['qué ayudas económicas puedo pedir', /prestaci|beca|deducci|ayuda/i],
                       ['manda currículos y no le llaman', /cupo|reserva|empleo|curr[íi]cul/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 35: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}
const lib35 = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const bq = (cod) => lib35.slice(lib35.indexOf('### ' + cod + '. '), lib35.indexOf('### ', lib35.indexOf('### ' + cod + '. ') + 6));
// FU decía "más de 50", que deja fuera a la empresa de exactamente 50 — justo la
// que suele decir que no. El art. 42.1 del RDL 1/2013 dice "50 o más".
check('FU da el umbral correcto de la cuota de reserva (50 o más, no más de 50)',
  /50 o más\*\* trabajadores/.test(bq('FU')) && !/del 2% en empresas de más de 50 trabajadores/.test(bq('FU')));
// R presentaba en verde que la TCC adaptada supera a la estándar. Es un solo
// ensayo; la diferencia que importa está entre hacer terapia y no hacerla.
check('R ya no vende como zanjada la ventaja de la TCC adaptada sobre la estándar',
  /Es \*\*un solo\s+ensayo\*\*/.test(bq('R')) && /quién lo\s+midió/.test(bq('R')));
// CEDis y certificado médico de discapacidad permanente son dos papeles para dos
// ventanillas: tener uno no da el otro, y confundirlos cuesta un viaje.
check('NU distingue el CEDis del certificado que pide la pensión mexicana',
  /CEDis/.test(bq('NU')) && /Pensión para el Bienestar/.test(bq('NU')));
// Ninguna cabecera publicada puede arrastrar la marca de estado que los editores
// se inventan al dejar algo a un humano: ⏳, ⏸ EN ESPERA, retenida, NO PUBLICABLE.
const cabeceras = [...lib35.matchAll(/^### [A-Z]{1,2}\. .*$/gm)].map((m) => m[0]);
const sucias = cabeceras.filter((h) => /[⏳⏸]|EN ESPERA|retenida|NO PUBLICABLE|pendiente de decisi|bloquead/i.test(h));
check('Ninguna ficha publicada arrastra una marca de estado sin resolver',
  sucias.length === 0, sucias.slice(0, 2).join(' | ').slice(0, 150));


await nav.close();
console.log('\n' + (errores.length
  ? '❌ ' + errores.length + ' problema(s):\n' + errores.join('\n')
  : '🎉 TODO CORRECTO'));
process.exit(errores.length ? 1 : 0);
