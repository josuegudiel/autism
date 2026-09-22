# Estado del proyecto — Brújula TEA 🧭

_Última actualización: 2026-09-20_

Este documento explica **qué está hecho** y **qué falta**, para quien retome el proyecto (o quiera colaborar/apoyar).

## En una frase

**Brújula TEA** es una PWA gratuita en español para familias de niños con autismo: junta **información basada en evidencia**, un **detector de pseudociencia**, un **seguimiento personal** (privado, en el dispositivo) y un **asistente de IA** que cita fuentes y nunca recomienda algo peligroso. Sin ánimo de lucro.

---

## ✅ Lo que ya está hecho

### La app (MVP funcional)
- **PWA estática** instalable y con contenido offline (service worker + manifest). No requiere build ni Node para probarse (`python3 serve.py`).
- **Pieza 1 — Centro de evidencia**: 24 tarjetas en 7 secciones, con niveles 🟢/🟡/🔴 y 33 enlaces a fuentes (`web/content/evidencia.json`).
- **Pieza 2 — Detector de pseudociencia**: 35 fichas (quelación, MMS, test de cabello/bioresonancia, dietas-cura, cámara hiperbárica, secretina, comunicación facilitada, GcMAF, exorcismo, baños iónicos, leucovorina, PANS/PANDAS, etc.) con veredicto + porqué + fuentes (`web/content/banderas-rojas.json`).
- **Pieza 3 — Seguimiento de mi hijo**: registro local con **IndexedDB** (los datos **no salen del dispositivo**; sin cuentas ni nube). **Solo en la web**: la app nativa de `ios/` no tiene rastreador.
- **Pieza 4 — Asistente**: interfaz de chat completa en **modo demostración** + backend **stub** (`api/chat.ts`) con las **reglas de seguridad** ya escritas (no diagnostica, no da dosis, nunca recomienda quelación/MMS/etc., cita fuentes, deriva a profesionales).
- **Base de conocimiento** del agente (`shared/knowledge-base.json`).
- **README** con cómo correr, publicar y "encender" la IA real.

### La biblioteca de investigación (`research/biblioteca-autismo.md`)
Un respaldo documental grande y citado que **ya alimenta el contenido de la app**: **437 temas** cubiertos dominio por dominio, cada uno con hallazgos, **fuentes enlazadas** (4.261 en total), etiquetas de fiabilidad y una nota **"Para la app"**.
- **226 temas verificados** con verificación adversarial de 3 votos (marcados ✅✅).
- **211 temas en "síntesis desde fuentes canónicas"** (marcados ⚠️) — redactados desde fuentes establecidas cuando el motor de verificación estaba limitado; **pendientes de re-verificar**.

_(Las tres cifras salen de `web/content/biblioteca-indice.json`; el conversor las imprime al terminar.)_

---

## ⏳ / 📋 Lo que falta

| Prioridad | Tarea | Notas |
|---|---|---|
| 🟡 **Media** | **Que el Detector y el Centro de evidencia alcancen a la biblioteca** | El volcado al buscador ya está hecho: 437 temas en 12 categorías. El Detector pasó de 15 a **35 fichas** y el Centro de evidencia de 4 secciones y 15 tarjetas a **7 y 24**, los dos el 22/09 y los dos volcando lo que la biblioteca ya tenía verificado (entre ello las nueve de **CS**, la ficha que se escribió justo para alimentar el Detector). Lo que sigue corto son las fichas de detector frente a los 437 temas, pero ya no es el cuello de botella que era. |
| 🔴 **Alta** | **Arreglar el target de iOS** | `Vistas/DetectorView.swift` y `Vistas/AyudaView.swift` perdieron la declaración de su vista, así que la app nativa no compila. Ver `ios/README.md`. |
| 🟠 **Alta** | **Activar la IA real de Claude** | El asistente está en modo demo. Ver README → "Encender la IA real" (poner `ANTHROPIC_API_KEY` en el servidor + cambiar el stub por la llamada real). |
| 🟡 **Media** | **Re-verificar los 211 temas de síntesis** | Subirlos de "síntesis" a "verificado 3 votos" (ya se hizo con Sueño, Intervención temprana, Pantallas y Cannabis/CBD). Son 437 − 226 = 211, y ese número lo da el propio índice. |
| 🟢 **Hecho** | **Publicar la app** | `.github/workflows/publicar.yml` pasa la suite de pruebas y, solo si está en verde, publica `web/` en GitHub Pages. Ojo al disparador: únicamente salta cuando el push toca `web/`, `herramientas/`, `scripts/pruebas/` o el propio workflow, así que un cambio solo de documentación **no** redespliega. La versión de la caché la estampa el despliegue, para que una corrección llegue también a quien ya tiene la app abierta. |
| 🟢 **Baja** | **Pulido**: iconos/branding definitivos, revisión de textos | Los iconos actuales son SVG de marcador de posición. El pase de accesibilidad ya se hizo: contrastes medidos en navegador, región viva acotada, foco al navegar y nombres accesibles en campos, gráfica y botones de borrado. |
| 🟢 **Baja** | **Materiales para ONG/donantes** | Pitch + datos de impacto (empleo, seguridad, acceso en LatAm) que ya están en la biblioteca. |

---

## 📚 Detalle de la biblioteca (mapa de temas)

**Mapa principal A–O** (verificado ✅✅): comorbilidades · pseudociencia · niñas/mujeres y adultos · comunicación/CAA · sensorial y meltdowns · medicación · salud mental y seguridad · educación · adolescencia/transición · neurodiversidad · genética/sindrómico · intervenciones comparadas · acceso LatAm · bienestar de cuidadores · señales tempranas por edad.

**Ronda 2 P–V**: alimentación selectiva ✅ · epilepsia ✅ · TCC adaptada ✅ · educación sexual/privacidad ✅ · empleo con apoyo ✅ · TDAH co-ocurrente (síntesis) · lenguaje identity-first + NCAEP 28 EBPs (síntesis).

**Ronda 3 W–AS** (temas prácticos): sueño ✅✅ · intervención temprana ✅✅ · TO/integración sensorial · conductas desafiantes/PBS · problemas GI · regulación emocional/alexitimia · habilidades sociales · cómo explicar el autismo · seguridad (wandering/pica) · discapacidad intelectual co-ocurrente · visitas médicas/dentales · escuela y derechos (CDPD, PIAR) · **tecnología/pantallas ✅✅** · **cannabis/CBD ✅✅** · estigma y apoyo entre padres · salud física y esperanza de vida · bilingüismo · burnout autista · diversidad de género · ejercicio · musicoterapia · trauma · animales de apoyo.

_(Los temas sin ✅✅ están redactados desde fuentes canónicas y marcados para re-verificar.)_

---

## 🗺️ Siguiente paso recomendado

1. **Volcar la biblioteca a la app** (Centro de evidencia + Detector) — usar las **28 prácticas basadas en evidencia del NCAEP** como vara en el Detector.
2. **Publicar** `web/` en un hosting estático para que las familias la usen ya.
3. **Activar la IA** cuando haya presupuesto/API key.
4. Re-verificar los temas de síntesis y pulir.

---

## 🔒 Privacidad — qué NO se sube al repo

El `.gitignore` está en la **raíz** del repositorio (no dentro de `agente-autismo/`) y cubre:
- **Todos los PDF**, incluido el informe del niño (`Report-*.pdf`). Si algún día hace falta publicar un PDF legítimo, hay que forzarlo a mano con `git add -f`.
- **`.claude/`** (config local de la herramienta, con rutas del equipo).
- **`PROYECTO.md`** (notas internas de estrategia/contexto personal). _Para hacerlo público, borra su línea en `.gitignore`._
- Claves, `.env`, `*.key` y `*.pem` (la `ANTHROPIC_API_KEY` va **solo** como variable de entorno del servidor, nunca en el código).

Antes de subir cualquier archivo dudoso: `git check-ignore -v <ruta>`.

**Dos límites que conviene tener presentes:**
1. `PROYECTO.md` **sigue rastreado por git** y publicado en el historial. El `.gitignore` no se aplica a un archivo ya rastreado: hasta que se ejecute `git rm --cached agente-autismo/PROYECTO.md`, sigue subiéndose. Y aunque se quite, lo ya publicado permanece en el historial: borrarlo de verdad exige reescribir el historial o poner el repositorio en privado.
2. El `.gitignore` **solo actúa cuando subes con `git`**. La subida por la web de GitHub que explica el `README.md` de la raíz se lo salta por completo: ahí el filtro eres tú.
