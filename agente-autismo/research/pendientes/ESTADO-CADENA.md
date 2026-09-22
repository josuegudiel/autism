# Estado de la cadena de rondas

Este archivo es la memoria de la cadena de investigación. El vigía horario
(cron) no repite el procedimiento: dice que se lea esto. **Actualízalo al
final de cada ronda, antes del commit**, y así el vigía nunca queda obsoleto.

El usuario pidió encadenar rondas hasta agotar los créditos. Si nada necesita
acción, no escribas nada al usuario y termina el turno.

## Ronda en curso

**Ronda 46** — runId `wf_98f8554f-4cc` (tarea wvn47wrl7), lanzada el 22/09 hacia
las 15:45. Códigos **QT, QU, QV, QW**. Las cuatro van acotadas por escrito,
porque los investigadores no se ven unos a otros:

- **QT** — camas de seguridad, sillas de paseo grandes y arneses en casa (el
  casco es de QS, el colegio de QR, los centros de PP, la doctrina de FQ).
- **QU** — lleva meses sin salir de su cuarto (el burnout es de AN, la depresión
  de IC, el rechazo escolar de LO, la catatonía de DO).
- **QV** — ya tiene la regla y toma valproato: el lado farmacológico (la primera
  cita de ginecología y la anticoncepción decidida con ella son de NW).
- **QW** — no gana peso ni crece (el ARFID es de LU y P; NS es el caso contrario).

Las **fichas mudas ya no existen**: las 429 tienen al menos una entrada en
`scripts/sinonimos.json` (1.211 claves). El workflow que lo iba a hacer
(`wf_647bd355-5e7`) **no sirve y no hay que relanzarlo**: en dos ejecuciones
seguidas murieron 13 de 16 y luego 15 de 17 agentes con el mismo error de
servidor —`safeguards flagged this message … [reasoning_extraction]`—, un falso
positivo que no depende del contenido (los lotes que pasaron llevaban el prompt
idéntico). Y al reanudar **no replicó de caché**: la segunda vuelta devolvió
menos lotes que la primera. Las 120 entradas que sí volvieron están fusionadas;
las otras 370 las escribí a mano en cuatro tandas, comprobando cada frase con el
simulador nuevo.

**`scripts/pruebas/simular-busqueda.py`** reimplementa `buscarTemas()` de
`web/app.js` para probar en seco una entrada ANTES de añadirla. Úsalo siempre.
Dos cosas que enseñó y que no están escritas en ningún otro sitio:

- **El orden de los códigos dentro de una clave no lo lee nadie.** `app.js` hace
  `impulso[c] = max(...)` para todos por igual, y si dos fichas empatan gana la
  de título alfabéticamente menor. Poner una ficha "la primera" en la lista no
  hace nada: si quieres que mande, déjala sola.
- **`nf.includes(q)` da 30 puntos a cualquier consulta que sea SUBCADENA de la
  frase**, incluida una palabra suelta. Eso es lo que hace que "tdah" encuentre a
  U, y también lo que haría que "tiene tdah y autismo" → A le robase puntos: esa
  entrada se descartó por eso. No cambies la regla sin simular antes: bajarla a
  dos palabras rompe "tdah".

## Ya publicado

Rondas 29 a 45. Última: ronda 45 (QP, QQ, QR, QS).
Biblioteca en **429 temas / 226 verificados / 203 síntesis / 4.084 fuentes**.
Suite **398/398**. Reserva: **27 entradas** (quinto análisis de huecos; quedan 26 investigables,
porque la 0 —NI— espera decisión humana y la 28 está rechazada).

Ronda 47: códigos **QX, QY, QZ** y luego **RA** (QO sigue libre a propósito, como
PO; confírmalo con grep antes de usar nada). Candidatas por orden de la reserva:
el chico que no crece ya está en QW, así que siguen **los suplementos y plantas
que chocan con su medicación** (9), **la melatonina a los dos años** (10, con el
aviso viejo), **la pubertad precoz y el tiroides** (11) y **la salud genital y
urológica del chico** (12). **Cuando queden menos de 4 investigables, lanza antes
`scripts/workflows/detectar-huecos.mjs`.**

**NO investigues** "de cinco a ocho pide la tablet" (ya se investigó y se
rechazó como NG por solaparse con IS) ni "dice que se quiere morir" (terminada y
esperando decisión humana).

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

- **Las notas "Antes de publicar"**: auditadas las seis que pedían trabajo en
  OTRA ficha (MT, PJ→DM, PQ→N y EE, PX→cinco fichas, QE→AV, PV). Cuatro seguían
  sin hacer y **ninguna era cosmética**: en los cuatro casos la biblioteca se
  contradecía a sí misma. Arregladas. Quedan las notas cuyo encargo era de índice
  o de sinónimos, que sí estaban hechas; conviene reescribirlas cuando se toque
  cada ficha, pero no bloquean nada.
  **Lección del método:** un auditor dio HECHO donde el escéptico encontró que la
  marca de bloqueo seguía viva, y otro citó como prueba "la ficha QO (línea
  8617)", que **no existe**. La fase escéptica no es opcional.
- **113 fichas en "Comprender el autismo"**, que es el cajón por defecto del
  conversor. Algunas están bien ahí; otras no. Desde la ronda 45 hay un
  mecanismo para sacarlas una a una sin romper el orden: la lista `EXCEPCIONES`
  de `scripts/construir-contenido.py`, que solo admite **frases largas del
  título**, nunca palabras sueltas, y que hay que **probar en seco** (a quién
  mueve) antes de añadir nada.
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
