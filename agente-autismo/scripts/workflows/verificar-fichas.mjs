export const meta = {
  name: 'verificar-fichas-tea',
  description: 'Verifica en fuente fichas nuevas de la biblioteca de autismo y borra lo que no se pueda comprobar',
  whenToUse: 'Antes de publicar cualquier ficha nueva en la biblioteca',
  phases: [{ title: 'Verificar', detail: 'un verificador por ficha, con presupuesto de búsqueda repartido' }],
}

// Uso:
//   Workflow({ scriptPath: "agente-autismo/scripts/workflows/verificar-fichas.mjs",
//              args: { busquedas: 15, fichas: [{codigo:"LI", archivo:"<ruta>/LI.md"}, ...] } })
//
// Como mucho 4 fichas por tanda: el presupuesto de WebSearch de la sesion son
// 200 llamadas COMPARTIDAS entre todos los agentes. Si se agota, los agentes
// siguen trabajando pero a ciegas, que es exactamente lo que hay que evitar.

const E = typeof args === 'string' ? JSON.parse(args) : args
const FICHAS = E.fichas
const BUSQUEDAS = E.busquedas || 15

const ESQUEMA = {
  type: 'object',
  properties: {
    codigo: { type: 'string' },
    publicable: { type: 'boolean', description: 'true solo si TODO lo que queda en la ficha esta verificado' },
    markdown_final: { type: 'string', description: 'la ficha depurada, lista para publicar' },
    fuentes_confirmadas: { type: 'integer' },
    fuentes_eliminadas: { type: 'integer' },
    afirmaciones_eliminadas: { type: 'integer' },
    busquedas_usadas: { type: 'integer' },
    informe: { type: 'string', description: 'que has confirmado, que has borrado y por que' },
  },
  required: ['codigo', 'publicable', 'markdown_final', 'fuentes_confirmadas', 'fuentes_eliminadas', 'informe'],
}

log(`Verificando ${FICHAS.length} fichas · ~${BUSQUEDAS} busquedas cada una`)

const res = await parallel(FICHAS.map((f) => () =>
  agent(`Eres el ultimo filtro antes de publicar. Esta ficha se escribio para una
biblioteca sobre autismo dirigida a padres, pero se redacto SIN presupuesto de
busqueda: sus fuentes NO estan comprobadas. Tu trabajo no es mejorarla, es
DEPURARLA: dejar solo lo que puedas confirmar y borrar todo lo demas.

FICHA A VERIFICAR: ${f.archivo}   (leela entera con Read)

REGLAS INNEGOCIABLES
- WEBFETCH NO FUNCIONA: la red devuelve HTTP 403 para cualquier direccion. No la
  llames. Tu unica herramienta es WebSearch.
- No intentes rodear esa restriccion ni toques proxy, entorno o sistema.
- Tienes un presupuesto de unas ${BUSQUEDAS} busquedas. Es compartido con otros
  agentes: si lo agotas, los dejas ciegos. Gastalo en este orden:
    1º las cifras que un padre podria usar para tomar una decision,
    2º las fuentes que sostienen los puntos de seguridad,
    3º el resto.
- Solo puedes conservar una URL si la has visto LITERALMENTE en un resultado de
  busqueda en esta sesion. Una URL que "parece correcta" o que reconstruyes de
  memoria se borra. Sin excepciones.

QUE HACER, PUNTO POR PUNTO:
1. Para cada fuente citada: busca su titulo, autoria y año. ¿Existe? ¿Es lo que
   la etiqueta dice? ¿Sostiene la afirmacion a la que acompaña?
   - Si la confirmas y ves su URL en los resultados: consérvala, y corrige la
     etiqueta si el autor, el año o el tipo de trabajo estaban mal.
   - Si el trabajo existe pero no ves su URL: puedes conservar la cita SIN
     enlace, nombrando autor, año y revista. Nunca inventes la direccion.
   - Si no lo encuentras o dice otra cosa: BORRA la fuente Y la afirmacion que
     dependia de ella.
2. Para cada cifra: confirmala contra el resumen del trabajo. Si no la
   encuentras, borra la cifra. Puedes dejar la idea cualitativa si otra fuente
   confirmada la sostiene; si no, borra tambien la idea.
3. SEGURIDAD, revisalo aunque te quedes sin busquedas (esto no las gasta):
   - ¿Hay algo que sea una URGENCIA colocado en "pide cita" o "consulta pronto"?
     Subelo a un bloque de urgencias propio, al principio de esa lista.
   - ¿Da dosis de algo? Borrala.
   - ¿Es un tema de salud sin apartado de "cuando consultar"? Añadelo.
   - ¿Presenta como inocuo algo que no lo es? Corrigelo.
4. SEMAFOROS (tampoco gasta busquedas):
   - 🟢 solo si queda respaldado por revision sistematica, metaanalisis o guia
     clinica CONFIRMADA. Si no, bajalo a 🟡, o a ⚪ si es experiencia de familias.
   - Ningun 🔴 pegado a un consejo correcto: en la app el color se muestra como
     etiqueta separada del texto, y un rojo ahi se lee como "esto no lo hagas".
     Si un punto mezcla una recomendacion y una advertencia, partelo en dos.
5. SESGO DE PAIS: si la ficha describe la ley o el sistema de un solo pais como
   si fuera universal, dilo explicitamente en el texto o borra esa parte.

RESULTADO:
- "markdown_final": la ficha depurada, con el mismo formato (cabecera ###,
  Mensaje clave, puntos con semaforo, linea **Fuentes:**, nota "> **Para la app:**").
  Puede quedar bastante mas corta que la original. Eso es exito, no fracaso.
- "publicable": true SOLO si todo lo que queda esta confirmado y la ficha sigue
  siendo util. Si has tenido que borrar tanto que ya no aporta nada, pon false.
- "informe": di sin rodeos que confirmaste, que borraste y por que.

Una ficha corta y verdadera vale mas que una completa y dudosa. Si dudas, borra.`, {
    label: `verificar:${f.codigo}`,
    phase: 'Verificar',
    schema: ESQUEMA,
  })
))

const salida = res.filter(Boolean)
log(`Verificadas ${salida.length} · publicables: ${salida.filter((x) => x.publicable).length}`)
return { fichas: salida }
