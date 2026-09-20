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

await nav.close();
console.log('\n' + (errores.length
  ? '❌ ' + errores.length + ' problema(s):\n' + errores.join('\n')
  : '🎉 TODO CORRECTO'));
process.exit(errores.length ? 1 : 0);
