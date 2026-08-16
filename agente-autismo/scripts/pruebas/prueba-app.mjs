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

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  const global = execSync('npm root -g', { encoding: 'utf8' }).trim();
  ({ chromium } = require(global + '/playwright'));
}

const B = process.env.BASE || 'http://localhost:8098/web/index.html';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const errores = [];
const nav = await chromium.launch({ executablePath: CHROME });
const pag = await nav.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
pag.on('console', (m) => { if (m.type() === 'error') errores.push('CONSOLA: ' + m.text()); });
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

await nav.close();
console.log('\n' + (errores.length
  ? '❌ ' + errores.length + ' problema(s):\n' + errores.join('\n')
  : '🎉 TODO CORRECTO'));
process.exit(errores.length ? 1 : 0);
