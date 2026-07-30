import SwiftUI

/// Destinos que no son un tema ni una categoría.
enum DestinoApp: Hashable {
    case ayuda
}

extension View {
    /// Rutas compartidas por las pestañas que tienen NavigationStack.
    func destinosBiblioteca() -> some View {
        self
            .navigationDestination(for: TemaResumen.self) { tema in
                TemaDetalleView(tema: tema)
            }
            .navigationDestination(for: CategoriaResumen.self) { categoria in
                CategoriaTemasView(categoria: categoria)
            }
            .navigationDestination(for: DestinoApp.self) { destino in
                switch destino {
                case .ayuda:
                    AyudaContenidoView()
                        .navigationTitle("Ayuda urgente")
                        .navigationBarTitleDisplayMode(.inline)
                }
            }
    }
}

@MainActor
struct RootView: View {
    enum Pestana: Hashable {
        case inicio, biblioteca, detector, ayuda
    }

    @Environment(Biblioteca.self) private var biblioteca
    @State private var seleccion: Pestana = .inicio

    var body: some View {
        TabView(selection: $seleccion) {
            InicioView()
                .tabItem { Label("Inicio", systemImage: "house") }
                .tag(Pestana.inicio)

            BibliotecaView()
                .tabItem { Label("Biblioteca", systemImage: "books.vertical") }
                .tag(Pestana.biblioteca)

            DetectorView()
                .tabItem { Label("Detector", systemImage: "checkmark.shield") }
                .tag(Pestana.detector)

            AyudaView()
                .tabItem { Label("Ayuda", systemImage: "cross.case") }
                .tag(Pestana.ayuda)
        }
        .tint(Tema.acento)
        .task {
            await biblioteca.cargarIndice()
        }
    }
}
