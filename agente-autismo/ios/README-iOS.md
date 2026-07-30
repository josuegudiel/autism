# Brújula TEA — app de iPhone (SwiftUI)

Biblioteca offline de 308 temas sobre autismo, en español. Sin backend, sin
cuentas y sin red: todo el contenido viaja dentro de la app.

- **Mínimo:** iOS 17 · Xcode 15 · Swift 5.9
- **Dependencias externas:** ninguna

---

## 1. Crear el proyecto en Xcode

1. Xcode → **File ▸ New ▸ Project… ▸ iOS ▸ App**.
2. Rellena:
   - *Product Name:* `BrujulaTEA`
   - *Interface:* **SwiftUI** · *Language:* **Swift**
   - *Storage:* **None** · desmarca Tests si no los quieres.
3. Borra los dos archivos que genera Xcode (`ContentView.swift` y
   `BrujulaTEAApp.swift`); los sustituyen los de este repositorio.
4. Arrastra la carpeta `BrujulaTEA/` completa sobre el proyecto en el
   navegador de Xcode y marca:
   - ☑ *Copy items if needed*
   - ☑ *Create groups*
   - ☑ el target **BrujulaTEA** en *Add to targets*.
5. En **Project ▸ target BrujulaTEA ▸ General**, pon *Minimum Deployments*
   en **iOS 17.0**.

## 2. Dónde poner los JSON

Los tres archivos de datos van en el **bundle**, sin subcarpeta ni renombrado:

| Archivo | Tamaño aprox. | Cuándo se carga |
|---|---|---|
| `biblioteca-indice.json` | ~295 KB | al arrancar la app |
| `biblioteca-cuerpo.json` | ~1,6 MB | al abrir el primer tema |
| `ayuda-urgente.json` | pequeño | al abrir la pestaña Ayuda |

Pasos:

1. Arrástralos al proyecto (mismo diálogo de antes, *Copy items if needed*).
2. Selecciona cada JSON y comprueba en el inspector de la derecha, apartado
   **Target Membership**, que **BrujulaTEA está marcado**. Si no lo está, la
   app arranca pero muestra «No se encontró biblioteca-indice.json».
3. Verifica que aparecen en **Build Phases ▸ Copy Bundle Resources**.

Los nombres se resuelven en `Biblioteca.decodificar(_:recurso:)` con
`Bundle.main.url(forResource:withExtension:)`. Si renombras un archivo,
cambia también ahí la cadena correspondiente.

## 3. Info.plist y bundle id

- Si tu plantilla de Xcode genera su propio `Info.plist`, puedes quedarte con
  él y **descartar** el de este repositorio: el incluido solo documenta el
  mínimo necesario (idioma `es`, nombre visible, orientaciones, `tel` en
  `LSApplicationQueriesSchemes`).
- Para usar el de aquí: target ▸ **Build Settings** ▸ busca `INFOPLIST_FILE`
  y apúntalo a `BrujulaTEA/Info.plist`; pon `GENERATE_INFOPLIST_FILE = NO`.
- **Bundle identifier:** target ▸ **Signing & Capabilities** ▸ *Bundle
  Identifier*. Cámbialo por uno tuyo, p. ej. `com.tunombre.brujulatea`, y
  elige tu *Team*. Con una cuenta gratuita de Apple ya puedes instalarla en
  tu propio iPhone.

## 4. Ejecutar

⌘R en el simulador o en un iPhone conectado. Sin red, sin permisos y sin
cuentas: la app no pide nada.

---

## Estructura

```
BrujulaTEA/
  BrujulaTEAApp.swift              punto de entrada, crea la Biblioteca
  Modelos/Modelos.swift            Codable de los tres JSON + NivelEvidencia
  Datos/Biblioteca.swift           carga perezosa, caché y motor de búsqueda
  Diseno/Tema.swift                color, métrica, iconos SF Symbols
  Utilidades/MarkdownLigero.swift  cuerpo Markdown -> bloques + evidencia
  Vistas/RootView.swift            TabView de 4 pestañas y rutas comunes
  Vistas/InicioView.swift          buscador destacado, chips, rejilla
  Vistas/BibliotecaView.swift      búsqueda, categorías y todos los temas
  Vistas/TemaDetalleView.swift     título, cuerpo, fuentes, relacionados
  Vistas/DetectorView.swift        terapias y productos, con desambiguación
  Vistas/AyudaView.swift           teléfonos de crisis, alarma y qué hacer
  Vistas/Componentes.swift         tarjetas, badges, leyenda, markdown
  Info.plist
```

## Cómo funciona el buscador

`Biblioteca.buscar(_:en:limite:)`:

1. Normaliza la consulta (minúsculas, sin acentos ni signos) y exige **3
   caracteres** como mínimo.
2. Aplica el diccionario `sinonimos`: frase contenida en la consulta = +1000;
   todas sus palabras presentes = +720; coincidencia parcial = hasta +320.
3. Suma por **título** (hasta +900), por **claves** (tope +420) y por
   **mensaje** (tope +150).
4. Devuelve una **lista ordenada** con `confianza` alta / media / baja. Nunca
   un único resultado adivinado.

El **Detector** usa ese motor restringido a la categoría `pseudociencia`.
Solo da veredicto si la mejor coincidencia es de confianza alta *y* supera a
la segunda en un 50 %. En cualquier otro caso muestra «¿A cuál te refieres?»
con candidatos, o «No tenemos ficha de…» sin opinar. Un falso «Evítalo»
asustaría a una familia sin motivo.

## Marcadores de evidencia

En el JSON las viñetas terminan en 🟢 🟡 🔴 ⚪. `MarkdownLigero` los extrae
como dato (`NivelEvidencia`) y los borra del texto; la interfaz los pinta
como punto de color + etiqueta: *Evidencia sólida*, *Evidencia limitada*,
*Desaconsejado*, *Experiencia vivida*. Nunca se muestran como emoji.

## Notas de diseño

- Acento verde-teal (#1F8A70), un poco más claro en modo oscuro.
- Fondo `systemGroupedBackground`, tarjetas `secondarySystemGroupedBackground`.
- Sin degradados, sin sombras, sin subrayados decorativos, sin emojis.
- Toda la iconografía es SF Symbols.
- Dynamic Type respetado (`.fixedSize(horizontal: false, vertical: true)` en
  los textos largos), modo oscuro automático y etiquetas de VoiceOver en
  badges, botones de llamada y tarjetas.

## Qué falta para publicar

- Icono de app y pantalla de carga (`Assets.xcassets`).
- Revisión en un Mac: el código se escribió sin Xcode delante.
- Opcional: `SFSafariViewController` si prefieres abrir las fuentes dentro de
  la app en lugar de saltar a Safari.
