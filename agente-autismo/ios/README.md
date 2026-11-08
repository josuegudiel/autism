# Brújula TEA para iPhone (app nativa, SwiftUI)

Proyecto nativo en SwiftUI de la misma biblioteca que usa la web. Todo el
contenido va **dentro de la app**: funciona sin conexión y sin ningún coste
de servidor.

> ⚠️ **Estado: reescrito, pendiente de compilar en un Mac.** `Vistas/DetectorView.swift`
> y `Vistas/AyudaView.swift` se habían quedado sin sus vistas y el target no
> compilaba. El 22/10 se reescribieron a partir de las APIs que ya existen en
> `Datos/Biblioteca.swift` y `Modelos/Modelos.swift`, **en Linux y sin
> compilador de Swift delante**: lo más probable es que Xcode pida algún
> retoque. El Detector de iOS, a propósito, **no pinta veredicto de color**:
> el que calcula `Biblioteca.nivel(de:)` cuenta semáforos y decía «Con
> respaldo» a «las vacunas causan autismo»; abre la ficha en su lugar. Que
> lea los veredictos explícitos de `banderas-rojas.json`, como la web, queda
> pendiente.
>
> ⚠️ **Aquí no hay rastreador.** El «Seguimiento de mi hijo» del proyecto
> existe **solo en la web**: en `ios/` no hay IndexedDB, ni SwiftData, ni
> Core Data.

## Qué necesitas

| | |
|---|---|
| Un Mac con **Xcode 15** o superior | imprescindible para compilar |
| iOS 17 como mínimo | usa `@Observable` y APIs recientes |
| Cuenta de desarrollador de Apple | solo si quieres **publicar** en la App Store (99 €/año). Para probarlo en tu propio iPhone basta una cuenta gratuita. |

## Cómo abrirlo

1. En Xcode: **File → New → Project → iOS → App**. Nómbralo `BrujulaTEA`,
   interfaz **SwiftUI**, lenguaje **Swift**.
2. Borra los archivos que crea Xcode por defecto (`ContentView.swift` y el
   `App.swift`) y **arrastra la carpeta `BrujulaTEA/` de este repositorio**
   al proyecto, marcando *Copy items if needed* y *Create groups*.
3. Arrastra también estos tres JSON al proyecto, marcando el target en
   *Target Membership* (si no, la app no los encontrará al arrancar):
   - `web/content/biblioteca-indice.json`
   - `web/content/biblioteca-cuerpo.json`
   - `web/content/ayuda-urgente.json`
4. En **Signing & Capabilities**, elige tu equipo y cambia el *Bundle
   Identifier* por uno tuyo (por ejemplo `com.tunombre.brujulatea`).
5. Ejecuta con ⌘R en el simulador o en tu iPhone conectado.

## Estructura

```
BrujulaTEA/
  BrujulaTEAApp.swift          punto de entrada
  Modelos/Modelos.swift        tipos Codable de los JSON
  Datos/Biblioteca.swift       carga, caché y motor de búsqueda
  Diseno/Tema.swift            colores, tipografía y espaciado
  Vistas/RootView.swift        las cuatro pestañas: Inicio, Biblioteca, Detector, Ayuda
  Vistas/InicioView.swift      buscador y categorías
  Vistas/BibliotecaView.swift  lista y filtros
  Vistas/TemaDetalleView.swift ficha de un tema
  Vistas/DetectorView.swift    INCOMPLETO: perdió la declaración de la vista
  Vistas/AyudaView.swift       INCOMPLETO: solo conserva el enum Telefono
  Vistas/Componentes.swift     tarjetas y badges reutilizables
  Utilidades/MarkdownLigero.swift  convierte el texto de la biblioteca
  Info.plist
```

## Cuando actualices la biblioteca

Ejecuta `python3 scripts/construir-contenido.py` como siempre y vuelve a
arrastrar los JSON regenerados al proyecto de Xcode. La app nativa **no se
actualiza sola**: cada cambio de contenido exige recompilar y, si está
publicada, pasar por la revisión de Apple (suele tardar días).

Por eso la versión web sigue siendo la vía principal: se actualiza al
instante y se instala gratis desde Safari con *Añadir a pantalla de inicio*.
