export const meta = {
  name: 'investigar-temas-tea',
  description: 'Investiga temas nuevos para la biblioteca de autismo y los verifica en fuente antes de darlos por buenos',
  whenToUse: 'Rondas de ampliación de la biblioteca, 4 temas como máximo por ronda',
  phases: [
    { title: 'Investigar', detail: 'un investigador por tema' },
    { title: 'Verificar', detail: 'un verificador comprueba cada fuente y borra lo que no se sostiene' },
  ],
}

// Uso:
//   Workflow({ scriptPath: "agente-autismo/scripts/workflows/investigar-temas.mjs",
//              args: { ronda: 20, codigos: ["LS","LT","LU","LV"],
//                      temas: [{titulo, porque}, ...] } })
//
// LIMITE DURO: 4 temas por ronda. El presupuesto de WebSearch de la sesion son
// 200 llamadas COMPARTIDAS. Con 4 temas son 4 investigadores x 15 + 4
// verificadores x 15 = 120, que cabe. Con 12 temas no cabe, y los agentes
// siguen trabajando a ciegas en vez de parar: eso fue lo que invalido la
// primera version de la ronda 19.

const E = typeof args === 'string' ? JSON.parse(args) : args
const TEMAS = (E.temas || []).slice(0, 4)
const CODIGOS = E.codigos
const RONDA = E.ronda
const BUSQUEDAS = E.busquedas || 15

const REGLAS = `
REGLAS INNEGOCIABLES
- WEBFETCH NO FUNCIONA EN ESTE ENTORNO: la politica de red devuelve HTTP 403
  para CUALQUIER direccion, incluida example.com. No la llames ni una vez.
  Tu unica herramienta de comprobacion es WebSearch, que si funciona y devuelve
  titulo, autoria, año, revista y a menudo el resumen con las cifras.
- No investigues ni intentes rodear esa restriccion. No toques el proxy, las
  variables de entorno ni archivos del sistema.
- NUNCA inventes ni adivines una URL. Solo puedes citar direcciones que hayas
  visto LITERALMENTE en un resultado de busqueda de esta sesion. Una URL
  reconstruida de memoria es el peor fallo posible en esta biblioteca: puede
  llevar a un padre a un documento que dice otra cosa.
- Tienes un presupuesto de unas ${BUSQUEDAS} busquedas. Es compartido: si lo
  agotas, dejas ciegos a los demas agentes.
- Si no puedes verificar algo, NO lo escribas. Una ficha corta y solida vale
  mas que una larga y sin respaldo.
- El publico son padres de niños autistas, muchos sin formacion tecnica y en
  paises de habla hispana con recursos muy desiguales.
`

const FORMATO = `
FORMATO EXACTO DE LA FICHA (markdown, español neutro):

### CODIGO. Titulo del tema — ✅ cubierto (Ronda ${RONDA}, fuentes verificadas)
**Mensaje clave:** dos o tres frases para el padre o la madre, en lenguaje llano.

- **Titulo del punto en negrita:** explicacion, terminada en un semaforo:
  🟢 evidencia solida (metanalisis, revisiones sistematicas, guias clinicas)
  🟡 evidencia limitada o consenso profesional sin ensayos
  🔴 desaconsejado o dañino
  ⚪ experiencia vivida de familias, sin respaldo de estudios
- Entre 5 y 8 puntos.
- Si el tema toca salud: PRIMERO un punto de urgencias (que exige ir a
  urgencias hoy), DESPUES uno de "cuando consultar". Nunca al final.
- Nunca des dosis de nada.
- Si algo cambia segun el pais, dilo; no describas un pais como si fuera todos.
- Ningun 🔴 pegado a una recomendacion correcta: en la app el color se muestra
  como etiqueta separada del texto. Si un punto mezcla consejo y advertencia,
  partelo en dos puntos.

**Fuentes:** [Autor, año, que es el trabajo](URL) · [otra](URL) · ...
> **Para la app:** una frase sobre como se usaria esta ficha.
`

const ESQUEMA_FICHA = {
  type: 'object',
  properties: {
    codigo: { type: 'string' },
    titulo: { type: 'string' },
    markdown: { type: 'string' },
    fuentes_verificadas: { type: 'integer' },
    avisos: { type: 'string', description: 'lo que NO has podido verificar, dicho claramente' },
    busquedas_usadas: { type: 'integer' },
  },
  required: ['codigo', 'titulo', 'markdown', 'fuentes_verificadas'],
}

const ESQUEMA_VERIF = {
  type: 'object',
  properties: {
    codigo: { type: 'string' },
    publicable: { type: 'boolean' },
    markdown_final: { type: 'string' },
    fuentes_confirmadas: { type: 'integer' },
    fuentes_eliminadas: { type: 'integer' },
    afirmaciones_eliminadas: { type: 'integer' },
    informe: { type: 'string' },
  },
  required: ['codigo', 'publicable', 'markdown_final', 'fuentes_confirmadas', 'informe'],
}

log(`Ronda ${RONDA}: ${TEMAS.length} temas · ~${BUSQUEDAS} busquedas por agente`)

const fichas = await pipeline(
  TEMAS.map((t, i) => ({ ...t, codigo: CODIGOS[i] })),

  (t) => agent(`Eres investigador de una biblioteca sobre autismo en español
para padres. Escribe una ficha nueva sobre este tema.

TEMA: ${t.titulo}
CODIGO: ${t.codigo}
POR QUE HACE FALTA: ${t.porque || '(no indicado)'}

${REGLAS}
${FORMATO}

COMO TRABAJAR:
1. Busca primero guias clinicas, revisiones sistematicas y organizaciones de
   referencia. Solo despues estudios sueltos.
2. Anota la cifra y la fuente a la vez, y COPIA la URL tal y como aparece en el
   resultado de busqueda. Si no ves la URL, cita autor, año y revista sin enlace.
3. Distingue lo demostrado, lo que es consenso profesional y lo que es
   experiencia de familias. Los semaforos existen para eso.
4. En "avisos", di sin rodeos que has dejado sin verificar.

Empieza el markdown por la linea "### ${t.codigo}. ".`, {
      label: `investigar:${t.codigo}`,
      phase: 'Investigar',
      schema: ESQUEMA_FICHA,
    }),

  (ficha, t) => {
    if (!ficha || !ficha.markdown) return null
    return agent(`Eres el ultimo filtro antes de publicar. Otro agente ha escrito
esta ficha para una biblioteca sobre autismo dirigida a padres. Tu trabajo no es
mejorarla: es DEPURARLA. Deja solo lo que puedas confirmar y borra lo demas.

FICHA PROPUESTA (tema: ${t.titulo}):
---
${ficha.markdown}
---
Lo que el autor dice haber dejado sin verificar: ${ficha.avisos || 'nada'}

${REGLAS}

QUE COMPROBAR:
1. CADA FUENTE: busca titulo, autoria y año. ¿Existe? ¿Es lo que la etiqueta
   dice? ¿Sostiene la afirmacion que acompaña? Si no lo encuentras o dice otra
   cosa: BORRA la fuente Y la afirmacion que dependia de ella.
2. CADA URL: solo se conserva si TU la has visto en un resultado de busqueda de
   esta sesion. Si no, quita el enlace y deja la cita en texto (autor, año,
   revista). Nunca la reconstruyas.
3. CADA CIFRA: confirmala contra el resumen. Si no aparece, borrala.
4. SEGURIDAD (no gasta busquedas): ¿hay una urgencia colocada en "pide cita"?
   Subela a un bloque de urgencias al principio. ¿Da dosis? Borrala. ¿Tema de
   salud sin "cuando consultar"? Añadelo. ¿Presenta como inocuo algo que no lo es?
5. SEMAFOROS (no gasta busquedas): 🟢 solo con revision sistematica, metanalisis
   o guia clinica confirmada. Ningun 🔴 sobre un consejo correcto.
6. SESGO DE PAIS: si describe la ley de un pais como si fuera universal, dilo o
   borralo.

"markdown_final": la ficha depurada, mismo formato. Puede quedar bastante mas
corta: eso es exito. "publicable": true solo si todo lo que queda esta
confirmado y la ficha sigue siendo util.

Si dudas, borra.`, {
      label: `verificar:${t.codigo}`,
      phase: 'Verificar',
      schema: ESQUEMA_VERIF,
    }).then((v) => ({
      codigo: t.codigo,
      titulo: ficha.titulo || t.titulo,
      publicable: v ? v.publicable : false,
      markdown_final: (v && v.markdown_final) || ficha.markdown,
      fuentes_confirmadas: (v && v.fuentes_confirmadas) || 0,
      fuentes_eliminadas: (v && v.fuentes_eliminadas) || 0,
      afirmaciones_eliminadas: (v && v.afirmaciones_eliminadas) || 0,
      informe: (v && v.informe) || 'SIN VERIFICAR: el verificador no respondio.',
    })).catch(() => ({
      codigo: t.codigo, titulo: t.titulo, publicable: false,
      markdown_final: ficha.markdown, fuentes_confirmadas: 0, fuentes_eliminadas: 0,
      afirmaciones_eliminadas: 0, informe: 'SIN VERIFICAR: el verificador fallo.',
    }))
  }
)

const salida = fichas.filter(Boolean)
log(`Ronda ${RONDA}: ${salida.length} fichas · publicables ${salida.filter((f) => f.publicable).length}`)
return { ronda: RONDA, fichas: salida }
