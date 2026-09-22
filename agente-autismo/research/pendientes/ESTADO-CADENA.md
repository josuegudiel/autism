# Estado de la cadena de rondas

Este archivo es la memoria de la cadena de investigación. El vigía horario
(cron) no repite el procedimiento: dice que se lea esto. **Actualízalo al
final de cada ronda, antes del commit**, y así el vigía nunca queda obsoleto.

El usuario pidió encadenar rondas hasta agotar los créditos. Si nada necesita
acción, no escribas nada al usuario y termina el turno.

## Ronda en curso

**Ronda 47** — runId `wf_35f0b071-1e7` (tarea wnu9ivk56), lanzada el 22/09 a las
19:55. Códigos **QX, QY, QZ, RA**, acotados por escrito entre sí:

- **QX** — suplementos, plantas y jarabes que chocan con su medicación (lo suyo
  es si CHOCAN, no si sirven: eso es BL, B y CS; la melatonina en sí es de QY).
- **QY** — lleva dos años con melatonina: el uso prolongado, no «probar
  melatonina» (W, EN, IF, QK y PQ ya están y no se reescriben).
- **QZ** — pubertad precoz y tiroides (la regla es DA, el peso por antipsicóticos
  NS, la curva plana QW).
- **RA** — salud genital y urológica del chico, con la torsión testicular arriba
  y su reloj de horas (la educación sexual es S, la enuresis EQ).

La ronda 46 está entera publicada (QT, QU, QV, QW).

**Lección de la 46, y va al procedimiento:** cuando el editor final (`corregir`)
muere, el script se queda con la versión **verificada pero sin corregir** y deja
**`publicable=true`**. No avisa. QV y QW volvieron así, con 37 y 35 críticas sin
aplicar. **Antes de publicar, lee `criticas_aplicadas`, no `publicable`:** si
dice «el editor final fallo», reanuda y espera. Al reanudar tras el reset, los
cuatro editores volvieron a correr y **QT y QU salieron mejor que la primera
vez** (QU ganó cuatro bloques 🚨 de riesgo que antes solo estaban en prosa), así
que las dos se reemplazaron por la segunda pasada.

## Ya publicado

Rondas 29 a 46.
Biblioteca en **433 temas / 226 verificados / 207 síntesis / 4.169 fuentes**.
Suite **489/489**. Reserva: **23 entradas**.

Ronda 47: códigos **QX, QY, QZ** y luego **RA** (QO sigue libre a propósito, como
PO; confírmalo con grep). Candidatas por orden de la reserva: **los suplementos y
plantas que chocan con su medicación** (9), **la melatonina a los dos años** (10,
con el aviso viejo), **la pubertad precoz y el tiroides** (11) y **la salud
genital y urológica del chico** (12). **Cuando queden menos de 4 investigables,
lanza antes `scripts/workflows/detectar-huecos.mjs`.**

**NO investigues** "de cinco a ocho pide la tablet" (rechazada como NG por
solaparse con IS) ni "dice que se quiere morir" (terminada, esperando decisión).

**Antes de correr la suite, levanta el servidor** (se cae entre sesiones):
`(setsid nohup python3 -m http.server 8098 --bind 127.0.0.1 >/dev/null 2>&1 &)`
desde `agente-autismo/`. Si no, muere con `ERR_CONNECTION_REFUSED` antes de la
primera comprobación y parece un fallo del código.

## NI está bloqueada a propósito

Terminada y verificada en `research/pendientes/NI.md`. Seis fichas publicadas
(MT, NC, MS, LM, IC, MH) mandan a urgencias ante la sola mención de querer
morirse; NI escalona según plan, método y acceso. El usuario elige entre
unificar en urgencias (A) o hacer NI canónica y reescribir los seis avisos (B).
**No la publiques ni elijas tú.**

## ¿Sigue viva la ronda?

```
D=/root/.claude/projects/-home-user-autism/8095f1f6-d7c0-5388-99b3-464bfb1e7510/subagents/workflows/<runId>
date -u; ls -lat --time-style=full-iso $D | head -5
```

- `agent-*.jsonl` escrito en los últimos ~10 minutos: viva, no toques nada. Con
  `conAguante()` puede pasar hasta 5 minutos esperando entre reintentos sin escribir.
- Nada en ~25 minutos y sin notificación de fin: reanuda con
  `Workflow({scriptPath, resumeFromRunId, args})` y los MISMOS args; lo completado
  replica desde caché.
- Terminó y no se publicó: publícala y lanza la siguiente.

**Cómo se muere una ronda:** límite de sesión (rondas 34 y 37) o 529/500 del
servidor en cadena (ronda 38, cuatro intentos). En `pipeline()`, una etapa que
devuelve null tira el item entero. Desde el 22/09 el script aguanta solo:
`conAguante()` reintenta a los 60 s, 150 s y 300 s. Si aun así vuelve
`fichas:[]`, mira el error: 529/500 → espera 10-15 min y reanuda; límite de
sesión → espera al reset que dice el error. Los args aceptan `modelo_respaldo`;
no lo uses salvo que el modelo esté caído de verdad, y dilo en el commit.

**No publiques nada a medias.** Sin verificador no está verificada; sin las
cuatro lentes no está criticada. El script marca `publicable=false` si muere
alguna lente.

**Al leer el journal:** no emparejes `started` con el `result` siguiente; con
concurrencia la atribución sale CRUZADA. Fíate del campo `codigo` dentro del
propio resultado.

## Procedimiento de publicación

0. El servidor de pruebas se cae entre sesiones:
   `(nohup python3 -m http.server 8098 --bind 127.0.0.1 >/dev/null 2>&1 &)`
   desde `agente-autismo/`; confirma 200 en `/web/index.html`.
1. Cada ficha `publicable=true`: markdown al final de
   `research/biblioteca-autismo.md` y línea "CODIGO. Titulo" en
   `research/indice-temas.txt`. Los scripts de la última ronda quedan en el
   scratchpad (`publicarNN.py`, `enlacesNN.py`): cópialos y cambia ronda y códigos.
   **Dos arreglos obligatorios en la cabecera:**
   - (a) **fuerza el código** al del pipeline. OCHO veces ya un editor ha
     encabezado su ficha con el código de otra: NB→NA, NN→NM, PB→NZ, PF→PD,
     PK→PH, PP→PL, PR→PQ, QA→PY, QD→QC, QI→QG.
   - (b) **reconstruye la cabecera** descartando los trozos que hablen del
     bloqueo, y **comprueba la cabecera entera al final**: en la ronda 38 se
     tiró el trozo bueno ("fuentes depuradas") y se conservó el malo
     ("pendiente: repartir el solapamiento"). Si no queda nada limpio, pon
     "(Ronda N, fuentes verificadas)". La prueba busca
     `[⏳⏸]|EN ESPERA|retenida|NO PUBLICABLE|no publicar hasta|pendiente de |pendiente:|bloquea la publicaci|bloquead|ve \*Pendiente editorial\*`.
     **No busques "pendiente" a secas:** lo lleva dentro "vida independiente",
     el título de CM. Mira también la nota "Para la app" del final: ahí es donde
     el editor deja escrito el bloqueo (le pasó a PV en la 40 y a PZ en la 41).
2. **Rechazadas: antes del cajón, mira si el bloqueo lo puedes cerrar tú.** El
   editor solo toca su propia ficha, así que marca como bloqueo cosas que tú sí
   resuelves. Ronda 38: PP venía bloqueada por el reparto con MC, el código y una
   frase a igualar en dos fichas. Ronda 40: PV pedía ELEGIR entre publicarla o
   disolverla dentro de PB (se eligió ficha propia; faltaban los enlaces de vuelta).
   Ronda 41: PZ venía retenida por dos frases sobre caries en EO y KF y una cita
   mal enlazada en AG. Si el editor pide elegir, elige y explica por qué.
   - **Patrón firme:** cuando una ficha nueva contradice a una publicada, la
     equivocada suele ser LA PUBLICADA. Ya han caído GL, DH, LP, S, MO, FU, R, AE,
     MR, PC, EO, KF, AG, CL, EN, FL y MZ. La ronda 44 no corrigió ninguna: salió limpia. Pero no siempre: en la 39 la equivocada era la nueva
     (PT decía al revés lo de "audífono" y MT lo tenía bien). Comprueba con una o
     dos búsquedas antes de corregir.
   - Bloqueos falsos habituales: "el código no está en indice-temas.txt" (eso lo
     hace publicarla) y "no tiene entradas en sinonimos.json" (añádeselas).
2b. **Cuando un editor diga que una ficha publicada dice X, compruébalo tú antes
   de darlo por bueno y antes de descartarlo.** En la ronda 43 casi descarto una
   corrección buena a MZ porque mi propio grep no encontró la frase que el editor
   citaba: estaba. Y en otras rondas los editores han señalado cosas que no
   estaban. Se mira el archivo, no la memoria de ninguno de los dos.
3. Quitar de la reserva los temas publicados, y **añadir los huecos nuevos que
   detecten las lentes** (así entró el traumatismo dental). Todo JSON del repo se
   reescribe con `indent=1` y salto final.
4. `python3 scripts/construir-contenido.py`.
5. Cifras en `README.md` (2 sitios), `ESTADO.md` (varios, incluido el cálculo
   "425 − 226 = 199") e `ios/README-iOS.md`.
6. Sección de ronda en `scripts/pruebas/prueba-app.mjs`, más una prueba por cada
   corrección a una ficha vieja. **Comprueba que la premisa de cada prueba nueva
   es cierta antes de escribirla** (una vez escribí una sobre una premisa falsa
   y falló al instante).
7. `node scripts/pruebas/prueba-app.mjs` → TODO CORRECTO. Cuenta los ✅ y
   actualiza el número en `AUDITORIA-CODIGO.md`.
8. Enlazar la ficha nueva desde sus hermanas, **en los dos sentidos** (tres
   enlaces inversos por ficha).
9. Actualizar este archivo con la ronda siguiente, commit y push a
   `claude/autism-code-audit-m84mky`.

LÍMITE DURO: 4 temas por ronda.

## Deuda conocida, para una ronda de limpieza

- **`scripts/pruebas/coherencia-cifras.py` (nuevo, 22/09).** Busca cifras que la
  biblioteca publica de dos maneras: agrupa afirmaciones con número por las
  palabras raras que las rodean y saca los pares que no coinciden. Todas las
  contradicciones que han ido apareciendo tenían esa forma (la fiebre de LV y
  QP, el vómito en ocho fichas, el implante de NW, la formación policial de CJ).
  **Pásalo cuando publiques una ronda**, antes del commit. Da falsos positivos
  —dos datos distintos del mismo informe, o una cifra redondeada— así que se
  lee, no se obedece: de los 257 pares que saca hoy, dos eran de verdad.


- **Las notas "Antes de publicar"**: auditadas las seis que pedían trabajo en
  OTRA ficha (MT, PJ→DM, PQ→N y EE, PX→cinco fichas, QE→AV, PV). Cuatro seguían
  sin hacer y **ninguna era cosmética**: en los cuatro casos la biblioteca se
  contradecía a sí misma. Arregladas. Quedan las notas cuyo encargo era de índice
  o de sinónimos, que sí estaban hechas; conviene reescribirlas cuando se toque
  cada ficha, pero no bloquean nada.
  **Lección del método:** un auditor dio HECHO donde el escéptico encontró que la
  marca de bloqueo seguía viva, y otro citó como prueba "la ficha QO (línea
  8617)", que **no existe**. La fase escéptica no es opcional.
- ~~El cajón por defecto~~ **CERRADA el 22/09.** "Comprender el autismo" tenía
  113 de las 429 fichas y ahora tiene **20**, que son las que de verdad son
  conceptuales o de identidad. Las 93 restantes van asignadas a mano en
  `CATEGORIA_POR_CODIGO` (`scripts/construir-contenido.py`), porque los títulos
  de esta biblioteca están escritos como habla una familia —"Se le rompen los
  huesos con poco"— y ningún patrón de palabras los alcanza. **Al publicar una
  ficha nueva: mira en qué categoría cae y, si el patrón no la coloca sola,
  métela en ese diccionario**; hay una prueba que comprueba que cada código del
  mapa acaba donde dice, que el cajón no vuelve a pasar de 25 y que las 12
  categorías siguen teniendo fichas.

- ~~Fichas sin entrada de búsqueda~~ **CERRADA el 22/09.** Eran 155 de 426 y hoy
  son 0 de 429, con 1.211 claves en `scripts/sinonimos.json` y dos pruebas que lo
  vigilan (ninguna ficha muda, ningún código fantasma). Lo que queda de esto es
  mantenimiento: **cada ficha nueva entra con sus frases en el mismo commit**, y
  se comprueban con `scripts/pruebas/simular-busqueda.py` antes de darlas por
  buenas.

## El PR #2

Head `861a83b` (ronda 41). Borrador, sin comentarios ni reviews; todos los runs
en verde.

`mcp__github__pull_request_read` con get_check_runs + get_comments + get_reviews
en una tanda.

- **Cero check runs sobre el head:** no concluyas que el CI no se disparó.
  GitHub tarda minutos. Confirma con `actions_list` (list_workflow_runs, perPage 3).
- **Rojo:** es mío. `get_job_logs`, reproduce en local, arregla y empuja. Un run
  `cancelled` NO es un fallo.
- **Conflicto con main:** `git fetch origin main && git merge origin/main`,
  resolver, pasar la suite, empujar.

Pendiente y sin respuesta del usuario (**no lo empujes por tu cuenta**):
`actions/checkout` y `actions/setup-node` de @v4 a @v5 en `publicar.yml`.
