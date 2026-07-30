import SwiftUI

/// Comprueba terapias y productos. Si la coincidencia es débil no da veredicto:
/// pregunta a cuál se refiere. Un falso "Evítalo" asustaría a una familia sin motivo.
struct DetectorView: View {
    @Environment(Biblioteca.self) private var biblioteca
    @State private var consulta = ""

    private var consultaLimpia: String {
        consulta.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var resultado: ResultadoDetector {
        biblioteca.evaluarDetector(consultaLimpia)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Tema.espacioSeccion) {
                    intro
                    CampoBusqueda(titulo: "Nombre de la terapia o producto", texto: $consulta)
                    cuerpo
                }
                .padding(.horizontal, Tema.margen)
                .padding(.top, 4)
                .padding(.bottom, 40)
            }
            .background(Tema.fondo)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Detector")
            .destinosBiblioteca()
        }
    }

    // MARK: Secciones

    private var intro: some View {
        Text("Escribe una terapia, suplemento o método y te decimos qué dice la evidencia. Si no estamos seguros de a qué te refieres, te lo preguntamos antes de opinar.")
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
    }

    @ViewBuilder
    private var cuerpo: some View {
        switch resultado {
        case .vacio:
            ejemplos

        case .sinDatos(let texto):
            sinDatos(texto)

        case .ambiguo(let candidatos):
            desambiguacion(candidatos)

        case .claro(let veredicto):
            VStack(alignment: .leading, spacing: Tema.espacioTarjeta) {
                TarjetaVeredicto(veredicto: veredicto)
                NavigationLink(value: veredicto.tema) {
                    TarjetaTema(tema: veredicto.tema, motivo: "Ver el tema completo")
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private var ejemplos: some View {
        let muestras = biblioteca.ejemplosDetector(limite: 8)
        if muestras.isEmpty {
            EstadoVacio(icono: "checkmark.shield",
                        titulo: "Detector listo",
                        mensaje: "Escribe arriba el nombre de lo que quieras comprobar.")
                .tarjeta()
        } else {
            VStack(alignment: .leading, spacing: Tema.espacioTarjeta) {
                EncabezadoSeccion(titulo: "Consultas habituales")
                FlujoChips(elementos: muestras.map(\.titulo)) { titulo in
                    ChipConsulta(texto: titulo) { consulta = titulo }
                }
            }
        }
    }

    private func sinDatos(_ texto: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: "questionmark.circle")
                    .font(.title3)
                    .foregroundStyle(Tema.neutro)
                    .accessibilityHidden(true)
                Text("No tenemos ficha de «\(texto)»")
                    .font(.headline)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Text("No damos un veredicto sin datos. Que no aparezca aquí no significa que sea bueno ni malo: consúltalo con tu equipo sanitario.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            let cercanos = biblioteca.buscar(texto, limite: 4)
            if !cercanos.isEmpty {
                Divider().padding(.vertical, 4)
                Text("En la biblioteca sí hay:")
                    .font(.subheadline.weight(.semibold))
                ForEach(cercanos) { cercano in
                    NavigationLink(value: cercano.tema) {
                        HStack(spacing: 8) {
                            Text(cercano.tema.titulo)
                                .font(.subheadline)
                                .foregroundStyle(Tema.acento)
                                .multilineTextAlignment(.leading)
                            Spacer(minLength: 4)
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.tertiary)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .tarjeta()
    }

    private func desambiguacion(_ candidatos: [ResultadoBusqueda]) -> some View {
        VStack(alignment: .leading, spacing: Tema.espacioTarjeta) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 10) {
                    Image(systemName: "questionmark.bubble")
                        .font(.title3)
                        .foregroundStyle(Tema.acento)
                        .accessibilityHidden(true)
                    Text("¿A cuál te refieres?")
                        .font(.headline)
                }
                Text("Hay varias fichas parecidas. Elige una para ver qué dice la evidencia; preferimos preguntar antes que equivocarnos.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .tarjeta()

            ForEach(candidatos) { candidato in
                Button {
                    consulta = candidato.tema.titulo
                } label: {
                    TarjetaTema(tema: candidato.tema, motivo: "Tocar para comprobar")
                }
                .buttonStyle(.plain)
                .accessibilityHint("Comprueba \(candidato.tema.titulo)")
            }
        }
    }
}

struct TarjetaVeredicto: View {
    let veredicto: Veredicto

    private var color: Color {
        switch veredicto.nivel {
        case .respaldado: return Tema.acento
        case .cautela: return Tema.cautela
        case .desaconsejado: return Tema.alerta
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: veredicto.nivel.simbolo)
                    .font(.title3)
                    .foregroundStyle(color)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(veredicto.nivel.titulo)
                        .font(.headline)
                        .foregroundStyle(color)
                    Text(veredicto.tema.titulo)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            Text(veredicto.nivel.explicacion)
                .font(.subheadline)
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)

            if !veredicto.tema.mensaje.isEmpty {
                Text(veredicto.tema.mensaje)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack(spacing: 12) {
                EtiquetaFuentes(cantidad: veredicto.tema.nFuentes)
                ResumenSemaforos(semaforos: veredicto.tema.semaforos)
                Spacer(minLength: 0)
            }
        }
        .tarjeta()
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(color)
                .frame(width: 4)
                .padding(.vertical, 12)
                .padding(.leading, 2)
                .accessibilityHidden(true)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Veredicto: \(veredicto.nivel.titulo) para \(veredicto.tema.titulo)")
    }
}
