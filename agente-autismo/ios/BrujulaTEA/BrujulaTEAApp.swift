import SwiftUI

@main
struct BrujulaTEAApp: App {
    /// Única instancia de datos: el índice se carga al arrancar, el cuerpo bajo demanda.
    @State private var biblioteca = Biblioteca()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(biblioteca)
                .tint(Tema.acento)
        }
    }
}
