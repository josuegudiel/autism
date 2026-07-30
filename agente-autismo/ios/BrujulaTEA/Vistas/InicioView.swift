import SwiftUI

struct InicioView: View {
    @Environment(Biblioteca.self) private var biblioteca
    @State private var consulta = ""

    /// Consultas frecuentes tal y como las escribiría una madre.
    private let sugerencias = ["no duerme", "no habla", "se pega", "berrinches", "no come", "colegio"]

    private var consultaLimpia: String {
        consulta.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var buscando: Bool {
        consultaLimpia.count >= 3
    }

    private var resultados: [ResultadoBusqueda] {
        buscando ? biblioteca.buscar(consultaLimpia, limite: 25) : []
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Tema.espacioSeccion) {
                    buscador

                    if buscando {
                        listaResultados
                    } else {
                        sugerenciasFrecuentes
                        accesoAyuda
                        rejillaCategorias
                        pie
                    }
                }
                .padding(.horizontal, Tema.margen)
                .padding(.top, 4)
                .padding(.bottom, 36)
            }
            .background(Tema.fondo)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Brújula TEA")
            .destinosBiblioteca()
        }
    }

    // MARK: Secciones

    private var buscador: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Escribe lo que te preocupa, con tus palabras.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            CampoBusqueda(titulo: "Por ejemplo: no duerme", texto: $consulta)

            if biblioteca.estaListo {
                Text("\(biblioteca.totalTemas) temas · \(biblioteca.totalVerificados) verificados · \(biblioteca.totalFuentes) fuentes")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private var listaResultados: some View {
        VStack(alignment: .leading, spacing: Tema.espacioTarjeta) {
            EncabezadoSeccion(
                titulo: resultados.isEmpty ? "Sin coincidencias" : "Resultados",
                subtitulo: resultados.isEmpty
                    ? nil
                    : (resultados.count == 1 ? "1 tema encontrado" : "\(resultados.count) temas encontrados")
            )

            if resultados.isEmpty {
                EstadoVacio(icono: "magnifyingglass",
                            titulo: "No hemos encontrado nada",
                            mensaje: "Prueba con otras palabras, por ejemplo «no duerme» o «se pega».")
                    .tarjeta()
            } else {
                ForEach(resultados) { resultado in
                    NavigationLink(value: resultado.tema) {
                        TarjetaTema(tema: resultado.tema, motivo: resultado.motivo)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var sugerenciasFrecuentes: some View {
        VStack(alignment: .leading, spacing: Tema.espacioTarjeta) {
            EncabezadoSeccion(titulo: "Consultas frecuentes")
            FlujoChips(elementos: sugerencias) { texto in
                ChipConsulta(texto: texto) { consulta = texto }
            }
        }
    }

    private var accesoAyuda: some View {
        NavigationLink(value: DestinoApp.ayuda) {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: "lifepreserver")
                    .font(.title3)
                    .foregroundStyle(Tema.alerta)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Ayuda urgente")
                        .font(.headline)
                        .foregroundStyle(.primary)
                    Text("Teléfonos de crisis, señales de alarma y qué hacer ahora mismo.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
                    .accessibilityHidden(true)
            }
            .tarjeta()
        }
        .buttonStyle(.plain)
        .accessibilityHint("Abre los teléfonos de ayuda")
    }

    @ViewBuilder
    private var rejillaCategorias: some View {
        VStack(alignment: .leading, spacing: Tema.espacioTarjeta) {
            EncabezadoSeccion(titulo: "Categorías",
                              subtitulo: "Explora por temas, sin buscar nada.")

            switch biblioteca.estado {
            case .cargando, .inactivo:
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)

            case .fallo(let mensaje):
                EstadoVacio(icono: "exclamationmark.triangle",
                            titulo: "No se pudo cargar la biblioteca",
                            mensaje: mensaje)
                    .tarjeta()

            case .listo:
                LazyVGrid(columns: [GridItem(.flexible(), spacing: Tema.espacioTarjeta),
                                    GridItem(.flexible(), spacing: Tema.espacioTarjeta)],
                          spacing: Tema.espacioTarjeta) {
                    ForEach(biblioteca.categorias) { categoria in
                        NavigationLink(value: categoria) {
                            TarjetaCategoria(categoria: categoria)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var pie: some View {
        Text("Brújula TEA no sustituye a un profesional. Toda la información funciona sin conexión y no sale de tu iPhone.")
            .font(.footnote)
            .foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, 4)
    }
}

/// Fila de chips que salta de línea, sin depender de nada externo.
struct FlujoChips<Contenido: View>: View {
    let elementos: [String]
    @ViewBuilder let contenido: (String) -> Contenido

    private let columnas = [GridItem(.adaptive(minimum: 120, maximum: 220), spacing: 8, alignment: .leading)]

    var body: some View {
        LazyVGrid(columns: columnas, alignment: .leading, spacing: 8) {
            ForEach(elementos, id: \.self) { elemento in
                contenido(elemento)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}
