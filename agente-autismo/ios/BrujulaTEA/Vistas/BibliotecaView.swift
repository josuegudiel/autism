import SwiftUI

@MainActor
struct BibliotecaView: View {
    @Environment(Biblioteca.self) private var biblioteca
    @State private var consulta = ""

    private var consultaLimpia: String {
        consulta.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var buscando: Bool {
        consultaLimpia.count >= 3
    }

    private var resultados: [ResultadoBusqueda] {
        buscando ? biblioteca.buscar(consultaLimpia, limite: 60) : []
    }

    private var temasOrdenados: [TemaResumen] {
        biblioteca.temas.sorted { $0.titulo.localizedStandardCompare($1.titulo) == .orderedAscending }
    }

    var body: some View {
        NavigationStack {
            List {
                if buscando {
                    seccionResultados
                } else {
                    seccionCategorias
                    seccionTodos
                }
            }
            .listStyle(.insetGrouped)
            .scrollDismissesKeyboard(.immediately)
            .navigationTitle("Biblioteca")
            .searchable(text: $consulta,
                        placement: .navigationBarDrawer(displayMode: .always),
                        prompt: "Buscar tema, síntoma o palabra")
            .overlay {
                if case .cargando = biblioteca.estado {
                    ProgressView()
                }
            }
            .destinosBiblioteca()
        }
    }

    // MARK: Secciones

    @ViewBuilder
    private var seccionResultados: some View {
        if resultados.isEmpty {
            Section {
                EstadoVacio(icono: "magnifyingglass",
                            titulo: "Sin coincidencias",
                            mensaje: "Prueba con palabras más sencillas, como «duerme» o «rabietas».")
                    .listRowBackground(Color.clear)
            }
        } else {
            Section {
                ForEach(resultados) { resultado in
                    NavigationLink(value: resultado.tema) {
                        FilaTema(tema: resultado.tema, motivo: resultado.motivo)
                    }
                }
            } header: {
                Text(resultados.count == 1 ? "1 resultado" : "\(resultados.count) resultados")
            }
        }
    }

    @ViewBuilder
    private var seccionCategorias: some View {
        if !biblioteca.categorias.isEmpty {
            Section {
                ForEach(biblioteca.categorias) { categoria in
                    NavigationLink(value: categoria) {
                        HStack(spacing: 12) {
                            Image(systemName: Tema.icono(categoria: categoria))
                                .font(.body)
                                .foregroundStyle(Tema.acento)
                                .frame(width: 26)
                                .accessibilityHidden(true)
                            Text(categoria.nombre)
                                .font(.body)
                                .fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 8)
                            Text("\(categoria.n)")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .accessibilityLabel("\(categoria.n) temas")
                        }
                        .padding(.vertical, 2)
                    }
                }
            } header: {
                Text("Categorías")
            }
        }
    }

    @ViewBuilder
    private var seccionTodos: some View {
        if !temasOrdenados.isEmpty {
            Section {
                ForEach(temasOrdenados) { tema in
                    NavigationLink(value: tema) {
                        FilaTema(tema: tema)
                    }
                }
            } header: {
                Text("Todos los temas")
            } footer: {
                Text("\(biblioteca.totalTemas) temas · \(biblioteca.totalVerificados) verificados. Todo funciona sin conexión.")
            }
        }
    }
}

/// Temas de una categoría concreta.
@MainActor
struct CategoriaTemasView: View {
    let categoria: CategoriaResumen
    @Environment(Biblioteca.self) private var biblioteca

    private var temas: [TemaResumen] {
        biblioteca.temas(deCategoria: categoria.clave)
    }

    var body: some View {
        List {
            Section {
                ForEach(temas) { tema in
                    NavigationLink(value: tema) {
                        FilaTema(tema: tema, mostrarCategoria: false)
                    }
                }
            } footer: {
                Text(temas.count == 1 ? "1 tema en esta categoría" : "\(temas.count) temas en esta categoría")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(categoria.nombre)
        .navigationBarTitleDisplayMode(.inline)
        .overlay {
            if temas.isEmpty {
                EstadoVacio(icono: "tray",
                            titulo: "Todavía no hay temas",
                            mensaje: "Esta categoría está vacía en esta versión.")
            }
        }
    }
}
