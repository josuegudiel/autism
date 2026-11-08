import SwiftUI

/// Pestaña «Detector»: ¿qué dice la biblioteca de esta terapia, producto o prueba?
///
/// Con una coincidencia débil pregunta a cuál se refiere la familia, y sin
/// ficha propia lo dice en vez de callarse. La búsqueda vive en
/// `Biblioteca.evaluarDetector(_:)`; esto solo la pinta.
///
/// NO pinta el veredicto de color que calcula `Biblioteca.nivel(de:)`. Ese
/// veredicto sale de contar los semáforos de la ficha, y una ficha que
/// DESMIENTE un mito está llena de verdes: la de vacunas y autismo salía
/// «Con respaldo — La evidencia disponible lo apoya» a la consulta «las vacunas
/// causan autismo» (lo cazó la auditoría de septiembre). Hasta que iOS lea los
/// veredictos explícitos de `banderas-rojas.json`, como hace la web, aquí se
/// abre la ficha, que es la que explica qué dice la evidencia y por qué.
@MainActor
struct DetectorView: View {
    @Environment(Biblioteca.self) private var biblioteca
    @State private var consulta = ""

    private var consultaLimpia: String {
        consulta.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Tema.espacioSeccion) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Escribe el nombre de una terapia, un producto o una prueba y te decimos qué dice la evidencia.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                        CampoBusqueda(titulo: "Por ejemplo: quelación", texto: $consulta)
                    }
                    contenido
                }
                .padding(.horizontal, Tema.margen)
                .padding(.top, 4)
                .padding(.bottom, 36)
            }
            .background(Tema.fondo)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Detector")
            .destinosBiblioteca()
        }
    }

    @ViewBuilder
    private var contenido: some View {
        switch biblioteca.evaluarDetector(consultaLimpia) {
        case .vacio:
            ejemplos
        case .sinDatos(let texto):
            EstadoVacio(
                icono: "questionmark.circle",
                titulo: "No tenemos una ficha de «\(texto)»",
                mensaje: "Eso no quiere decir que sea bueno ni malo. Si promete una cura, no aparece en estudios independientes o te piden dinero por «desintoxicar», trátalo como bandera roja y consúltalo con un profesional."
            )
            .tarjeta()
        case .ambiguo(let candidatos):
            VStack(alignment: .leading, spacing: Tema.espacioTarjeta) {
                EncabezadoSeccion(titulo: "¿A cuál te refieres?",
                                  subtitulo: "Elige una para ver el veredicto con sus fuentes.")
                ForEach(candidatos) { candidato in
                    NavigationLink(value: candidato.tema) {
                        TarjetaTema(tema: candidato.tema, motivo: candidato.motivo)
                    }
                    .buttonStyle(.plain)
                }
            }
        case .claro(let veredicto):
            VStack(alignment: .leading, spacing: Tema.espacioTarjeta) {
                EncabezadoSeccion(titulo: "Lo que dice la biblioteca",
                                  subtitulo: "Ábrela para ver qué dice la evidencia y sus fuentes.")
                NavigationLink(value: veredicto.tema) {
                    TarjetaTema(tema: veredicto.tema)
                }
                .buttonStyle(.plain)
                .accessibilityHint("Abre la ficha completa con sus fuentes")
            }
        }
    }

    @ViewBuilder
    private var ejemplos: some View {
        let lista = biblioteca.ejemplosDetector()
        if !lista.isEmpty {
            VStack(alignment: .leading, spacing: Tema.espacioTarjeta) {
                EncabezadoSeccion(titulo: "Lo que más se consulta")
                ForEach(lista) { tema in
                    NavigationLink(value: tema) {
                        HStack(spacing: 12) {
                            FilaTema(tema: tema, mostrarCategoria: false)
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.tertiary)
                                .accessibilityHidden(true)
                        }
                        .tarjeta()
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}
