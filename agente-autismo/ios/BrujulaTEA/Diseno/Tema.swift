import SwiftUI
import UIKit

/// Tokens de diseño: color, espaciado y radios. Sin degradados, sin sombras.
enum Tema {

    // MARK: Color

    /// Verde-teal sobrio (#1F8A70), algo más claro en modo oscuro para contraste.
    static let acento = Color(uiColor: UIColor { rasgos in
        rasgos.userInterfaceStyle == .dark
            ? UIColor(red: 0.24, green: 0.73, blue: 0.61, alpha: 1)
            : UIColor(red: 0.12, green: 0.54, blue: 0.44, alpha: 1)
    })

    static let fondo = Color(.systemGroupedBackground)
    static let tarjeta = Color(.secondarySystemGroupedBackground)
    static let tarjetaSecundaria = Color(.tertiarySystemGroupedBackground)
    static let separador = Color(.separator)

    static let alerta = Color(uiColor: UIColor { rasgos in
        rasgos.userInterfaceStyle == .dark
            ? UIColor(red: 1.00, green: 0.45, blue: 0.40, alpha: 1)
            : UIColor(red: 0.75, green: 0.22, blue: 0.17, alpha: 1)
    })

    static let cautela = Color(uiColor: UIColor { rasgos in
        rasgos.userInterfaceStyle == .dark
            ? UIColor(red: 0.94, green: 0.71, blue: 0.29, alpha: 1)
            : UIColor(red: 0.65, green: 0.44, blue: 0.06, alpha: 1)
    })

    static let neutro = Color(uiColor: UIColor { rasgos in
        rasgos.userInterfaceStyle == .dark
            ? UIColor(red: 0.62, green: 0.68, blue: 0.76, alpha: 1)
            : UIColor(red: 0.36, green: 0.42, blue: 0.50, alpha: 1)
    })

    // MARK: Métrica

    static let margen: CGFloat = 20
    static let espacioSeccion: CGFloat = 26
    static let espacioTarjeta: CGFloat = 12
    static let radio: CGFloat = 16
    static let radioPequeno: CGFloat = 12

    // MARK: Iconografía

    static func icono(categoria: CategoriaResumen) -> String {
        icono(clave: categoria.clave, nombre: categoria.nombre)
    }

    /// SF Symbol por categoría, con reglas por palabra y un icono neutro por defecto.
    static func icono(clave: String, nombre: String) -> String {
        let texto = (clave + " " + nombre)
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: nil)
            .lowercased()

        let reglas: [(patron: String, simbolo: String)] = [
            ("pseudo", "exclamationmark.shield"),
            ("bulo", "exclamationmark.shield"),
            ("salud", "heart.text.square"),
            ("sueno", "moon.zzz"),
            ("aliment", "fork.knife"),
            ("comunica", "bubble.left.and.bubble.right"),
            ("lenguaje", "text.bubble"),
            ("habla", "text.bubble"),
            ("conducta", "figure.walk"),
            ("sensor", "waveform"),
            ("escuela", "graduationcap"),
            ("educa", "graduationcap"),
            ("colegio", "graduationcap"),
            ("familia", "house"),
            ("crianza", "house"),
            ("terapia", "cross.case"),
            ("intervenc", "cross.case"),
            ("diagnost", "stethoscope"),
            ("derecho", "building.columns"),
            ("legal", "building.columns"),
            ("recurso", "folder"),
            ("adult", "person.crop.circle"),
            ("adolescen", "person.2"),
            ("mujer", "person.2"),
            ("autonom", "checklist"),
            ("vida", "sun.max"),
            ("emocion", "brain.head.profile"),
            ("salud mental", "brain.head.profile"),
            ("crisis", "lifepreserver"),
            ("tecnolog", "ipad"),
            ("juego", "puzzlepiece"),
            ("social", "person.3"),
            ("investig", "magnifyingglass.circle")
        ]

        for regla in reglas where texto.contains(regla.patron) {
            return regla.simbolo
        }
        return "book.closed"
    }
}

extension NivelEvidencia {
    var color: Color {
        switch self {
        case .solida: return Tema.acento
        case .limitada: return Tema.cautela
        case .desaconsejado: return Tema.alerta
        case .vivencial: return Tema.neutro
        }
    }
}

// MARK: - Modificadores

/// Fondo de tarjeta estándar: relleno plano, esquinas continuas, sin sombra.
struct EstiloTarjeta: ViewModifier {
    var relleno: CGFloat = 16
    var radio: CGFloat = Tema.radio

    func body(content: Content) -> some View {
        content
            .padding(relleno)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Tema.tarjeta, in: RoundedRectangle(cornerRadius: radio, style: .continuous))
    }
}

extension View {
    func tarjeta(relleno: CGFloat = 16, radio: CGFloat = Tema.radio) -> some View {
        modifier(EstiloTarjeta(relleno: relleno, radio: radio))
    }
}
