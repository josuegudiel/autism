// Comprueba consultas de búsqueda contra la APP de verdad, no contra el simulador.
//
// El simulador no es la app. Dicho entero, porque es la frase que hacía falta:
//
// Por qué existe: `simular-busqueda.py` reimplementa `buscarTemas()`, que puntúa
// sobre el índice (título, claves, mensaje clave), pero la app hace ADEMÁS una
// búsqueda dentro del cuerpo de las fichas, y eso cambia el orden. El 23/09, tres
// de setenta y siete consultas asertadas daban primeras respuestas distintas en
// uno y en otro —y en las tres la de la app era mejor—, así que la suite se puso
// en rojo por tres expectativas mal escritas, no por un fallo de contenido.
//
// Regla de la casa: itera con el simulador, que es instantáneo y no necesita
// navegador, pero **comprueba contra la app antes de asertar una consulta**.
//
// Uso:
//   cd agente-autismo && python3 -m http.server 8098 --bind 127.0.0.1 &
//   # un fichero con "consulta<TAB>trozo del título que debe abrir" por línea
//   node scripts/pruebas/comprobar-consultas.mjs consultas.tsv
//   # o sueltas, y entonces solo imprime qué abre cada una
//   node scripts/pruebas/comprobar-consultas.mjs "quiere morirse" "se escapa de casa"
//
// Sale con código 1 si alguna consulta no abre lo que se esperaba. Cuando falla
// dice en qué puesto quedó lo que esperabas, que es el dato que hace falta para
// saber si el sinónimo está mal o solo le falta empuje.

import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  const { execSync } = await import('node:child_process');
  ({ chromium } = require(execSync('npm root -g', { encoding: 'utf8' }).trim() + '/playwright'));
}

const B = process.env.BASE || 'http://localhost:8098/web/index.html';
// Igual que en prueba-app.mjs: aquí el Chromium vive fuera de donde Playwright
// lo busca, pero en un runner de CI él sabe dónde está el suyo.
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const args = process.argv.slice(2);
if (!args.length) {
  console.error('uso: node scripts/pruebas/comprobar-consultas.mjs <fichero.tsv | "consulta" ...>');
  process.exit(2);
}

// Un solo argumento que es un fichero existente = lista de pares consulta/título.
// Se saltan las líneas en blanco y las que empiezan por # para poder anotar el
// fichero con el porqué de cada consulta.
const pares = args.length === 1 && existsSync(args[0])
  ? readFileSync(args[0], 'utf8').split('\n')
      .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
      .map((l) => l.split('\t').map((c) => c.trim()))
  : args.map((q) => [q, null]);

const hayExpectativas = pares.some(([, t]) => t);

const nav = await chromium.launch(existsSync(CHROME) ? { executablePath: CHROME } : {});
const pag = await nav.newPage({ viewport: { width: 393, height: 852 } });
let malos = 0;

for (const [q, titulo] of pares) {
  await pag.goto(B + '#biblioteca', { waitUntil: 'load' });
  await pag.waitForTimeout(500);
  await pag.fill('#q-bib', q);
  await pag.click('#f-bib button[type=submit]');
  // Las palabras del cuerpo se bajan al buscar, no al entrar: hay que darle
  // tiempo a esa petición y al repintado que viene detrás.
  await pag.waitForTimeout(1600);
  // Los títulos, no los primeros 220 caracteres de la caja: así «abre con» es
  // de verdad el título de la primera tarjeta y no una palabra que caía cerca.
  const titulos = await pag.$$eval('#res-bib .tema-card h4',
    (el) => el.slice(0, 25).map((x) => x.textContent.trim()));

  if (!titulo) {
    console.log('« ' + q + ' »  ->  ' + (titulos[0] || 'SIN RESULTADOS') +
      (titulos[1] ? '   |   2º: ' + titulos[1] : ''));
    continue;
  }
  if (titulos[0] && titulos[0].includes(titulo)) continue;

  malos++;
  const puesto = titulos.findIndex((t) => t.includes(titulo));
  console.log('MISMATCH « ' + q +' » esperaba « ' + titulo + ' » y abrió « ' +
    (titulos[0] || 'SIN RESULTADOS') + ' »' +
    (puesto > 0 ? '  (lo esperado quedó ' + (puesto + 1) + 'º de ' + titulos.length + ')'
                : '  (lo esperado no sale entre los ' + titulos.length + ' mostrados)'));
}

console.log('\n' + pares.length + ' consulta(s) contra la app · ' +
  (hayExpectativas ? malos + ' discrepancia(s)' : 'sin expectativas que comprobar'));
await nav.close();
process.exit(malos ? 1 : 0);
