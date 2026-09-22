# Estado de la cadena de rondas

Este archivo es la memoria de la cadena de investigación. El vigía horario
(cron) no repite el procedimiento: dice que se lea esto. **Actualízalo al
final de cada ronda, antes del commit**, y así el vigía nunca queda obsoleto.

El usuario pidió encadenar rondas hasta agotar los créditos. Si nada necesita
acción, no escribas nada al usuario y termina el turno.

## Ronda en curso

**Ronda 42** — runId `wf_d8de7468-ea9`, reanudada el 22/09 a las 09:10
(tarea w9w6qq87z; el primer intento, wycpjtl1o, murió con el límite de sesión
que resetea a las 9:00 UTC: se llevó doce críticos y dos editores, y conAguante()
gastó sus cuatro intentos contra un límite que no se pasa esperando cinco minutos).
Los cuatro investigadores y los cuatro verificadores estaban en caché.

- **QC** — se ha roto un diente o se le ha salido de un golpe (traumatismo dental).
- **QD** — mayor de edad y no puedo ni moverle la cuenta del banco, sin llegar a la tutela.
- **QE** — cuido a mi hijo y ahora también a mis padres.
- **QF** — no deja tirar nada: colecciones, cajas vacías y acumulación.

Los cuatro temas son las entradas 15, 6, 10 y 12 (en ese orden) de
`research/pendientes/ronda-19-borradores.json`, todas acotadas por escrito
antes de lanzarlas.

## Ya publicado

Rondas 29 a 41. Última: ronda 41 (PY, PZ, QA, QB) en `861a83b`, CI verde.
Biblioteca en **413 temas / 226 verificados / 187 síntesis / 3.718 fuentes**.
Suite **264/264**. Reserva: 16 entradas.

Ronda 43: códigos **QG, QH, QI, QJ** (confirma con grep; PO sigue libre y se
evita). Candidatas que no compiten entre sí: las apneas y las amígdalas, nació
muy prematuro, quiero que trabaje este verano, tengo pareja nueva. Cuando
queden menos de 4 investigables, lanza antes `scripts/workflows/detectar-huecos.mjs`.

**NO investigues** "de cinco a ocho pide la tablet" (ya se investigó y se
rechazó como NG por solaparse con IS; solo vale rehecho como cadencia semanal)
ni "dice que se quiere morir" (terminada y esperando decisión humana).

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
     PK→PH, PP→PL, PR→PQ, QA→PY.
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
     MR, PC, EO, KF y AG. Pero no siempre: en la 39 la equivocada era la nueva
     (PT decía al revés lo de "audífono" y MT lo tenía bien). Comprueba con una o
     dos búsquedas antes de corregir.
   - Bloqueos falsos habituales: "el código no está en indice-temas.txt" (eso lo
     hace publicarla) y "no tiene entradas en sinonimos.json" (añádeselas).
3. Quitar de la reserva los temas publicados, y **añadir los huecos nuevos que
   detecten las lentes** (así entró el traumatismo dental). Todo JSON del repo se
   reescribe con `indent=1` y salto final.
4. `python3 scripts/construir-contenido.py`.
5. Cifras en `README.md` (2 sitios), `ESTADO.md` (varios, incluido el cálculo
   "413 − 226 = 187") e `ios/README-iOS.md`.
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
