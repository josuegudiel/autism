#!/usr/bin/env python3
"""
Convierte research/biblioteca-autismo.md en los JSON que consume la app.

Uso:
    python3 scripts/construir-contenido.py

Genera:
    web/content/biblioteca-indice.json    índice ligero para buscar (títulos, resumen, palabras clave)
    web/content/biblioteca-cuerpo.json    contenido completo de cada tema (se carga al abrir uno)
    web/content/biblioteca-busqueda.json  palabra del cuerpo -> temas (se carga solo al buscar)

No hace falta instalar nada: solo Python 3.
Si añades o editas un tema en la biblioteca, vuelve a ejecutar este script.
"""

import html
import json
import os
import re
import sys
import unicodedata

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BIBLIOTECA = os.path.join(RAIZ, "research", "biblioteca-autismo.md")
SALIDA = os.path.join(RAIZ, "web", "content")
SINONIMOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sinonimos.json")

# --- Categorías: se asignan por palabras del título. La primera que coincide gana. ---
CATEGORIAS = [
    ("diagnostico", "Diagnóstico y primeros pasos", [
        "diagnóstic", "diagnostico", "cribado", "señales tempranas", "prevalencia",
        "criterios", "dsm-5", "evaluación psicopedag", "primeros pasos", "regresión",
        "diferencial", "biomarcador", "autodiagnóstico", "divulgar el diagnóstico",
        "tras el diagnóstico", "hermanos menores",
    ]),
    ("pseudociencia", "Pseudociencia y desinformación", [
        "pseudocienc", "vacunas", "epigenétic", "microbioma", "intestino permeable",
        "paracetamol", "leucovorina", "mitos ambientales", "cetogénica", "quelación",
        "sulforafano", "pans/pandas", "cannabis", "desinformación", "leer una noticia",
        "elegir profesionales", "oxitocina", "factores ambientales", "nutrición y suplementos",
        "equinoterapia", "animales de apoyo", "musicoterapia",
    ]),
    ("terapias", "Terapias e intervenciones", [
        "intervención", "intervenciones", "terapia ocupacional", "logopedia",
        "habla y lenguaje", "prt ", "floortime", "scerts", "aba", "hanen",
        "video modeling", "refuerzo positivo", "medicación", "tcc", "métodos y enfoques",
        "habilidades sociales", "tecnología de apoyo", "robots sociales", "ejercicio",
        "arte, música", "naturaleza",
    ]),
    ("comunicacion", "Comunicación", [
        "comunicación", "caa", "ecolalia", "lengua de señas", "no verbal",
        "small talk", "contacto visual", "humor", "doble empatía", "bilingüismo",
    ]),
    ("conducta", "Conducta y emociones", [
        "conducta", "meltdown", "rabieta", "shutdown", "stimming", "agresión",
        "regulación emocional", "crisis", "contención", "catatonia", "autolesión",
        "transiciones y apoyos", "intereses intensos", "pda", "burnout",
        "acumulación",
    ]),
    ("sensorial", "Mundo sensorial", [
        "sensorial", "interocepción", "misofonía", "procesamiento auditivo",
        "termorregulación", "sinestesia", "ropa", "higiene sensorial",
        "espacios sensory", "salud visual",
    ]),
    ("salud", "Salud y condiciones asociadas", [
        "salud", "sueño", "epilepsia", "gastrointestinal", "digestiv", "estreñimiento",
        "enuresis", "dolor", "hospitalización", "análisis de sangre", "vacunación sin trauma",
        "dental", "migraña", "alergias", "peso", "condiciones co-ocurrentes", "tics",
        "metabólic", "hipermovilidad", "toc", "ansiedad", "depresión", "trauma",
        "alimentación", "conducta alimentaria", "pubertad", "menstruación", "esfínteres",
        "motricidad", "neurobiología", "genétic", "x frágil", "rett", "esclerosis tuberosa",
        "síndrome de down", "discapacidad intelectual", "sustancias",
        "paliativos", "quimioterapia", "enfermedad grave",
        "urgencias", "medicamento",
    ]),
    ("escuela", "Escuela y aprendizaje", [
        "escuela", "escolar", "colegio", "aula", "recreo", "comedor", "excursion",
        "deberes", "exámenes", "universidad", "formación profesional", "dislexia",
        "discalculia", "disgrafía", "funciones ejecutivas", "memoria", "juego",
        "educación en casa", "doble excepcionalidad", "acoso", "reuniones escolares",
        "percepción del tiempo", "reconocimiento de caras",
        # MV ("expulsiones, partes y exclusión encubierta") no lleva ninguna
        # palabra de esta lista y caia en el cajon por defecto.
        "expulsiones", "exclusión encubierta",
    ]),
    ("familia", "Familia y vida diaria", [
        "familia", "cuidador", "hermanos", "abuelos", "pareja", "divorcio", "duelo",
        "respiro", "crianza", "explicar el autismo", "estigma", "viajes", "salir:",
        "campamento", "transporte", "emergencias", "baño", "cocinar", "dinero",
        "organización y tareas", "habilidades de vida", "amistades", "amistad",
        "cuido",
        "vecinos",
    ]),
    ("adultez", "Adolescencia y vida adulta", [
        "adolescencia", "adultez", "adulto", "empleo", "trabajo", "entrevistas",
        "vivienda", "conducir", "envejecimiento", "sexualidad", "citas y relaciones",
        "maternidad", "embarazo", "planificación financiera", "justicia", "coaching",
        "independencia", "menopausia",
        # La ficha de la cuenta del banco (QD) caia en "Comprender el autismo", que
        # es el cajon por defecto, y arrastraba ahi a LQ y a PV. Los patrones van
        # ajustados a proposito: "tutela" a secas se llevaria PP (piso tutelado) y
        # "los 18" se llevaria MU y QB, que no son de vida adulta.
        "mayor de edad", "mayoría de edad", "incapacitar", "antes de los 18",
    ]),
    ("derechos", "Derechos y recursos por país", [
        # LP (el certificado) y QN (la mudanza entre comunidades) caian en el cajon
        # por defecto. "certificado" a secas se llevaria NU, que esta bien en escuela.
        "valoración de discapacidad", "me vale el certificado",
        "derechos y recursos", "panorama", "en méxico", "en españa", "en argentina",
        "en colombia", "en chile", "en perú", "en brasil", "centroamérica",
        "puerto rico", "costa rica", "honduras", "ee. uu.", "encontrar recursos",
        "no se respetan", "abogar", "acceso", "disparidades", "socioeconómico",
        "diferencias culturales", "inclusión escolar",
    ]),
    ("comprender", "Comprender el autismo", [
        "neurodiversidad", "historia del concepto", "teorías cognitivas", "modelo social",
        "funcionamiento", "identidad", "autodefensa", "voces y experiencias",
        "representación en medios", "diversidad de género", "lgbtq", "niñas",
        "esperanza de vida", "prevalencia mundial", "inteligencia artificial",
        "cultura autista", "orientación sexual", "familias con varios",
    ]),
]

CAT_POR_DEFECTO = ("comprender", "Comprender el autismo")

# Palabras vacías: no sirven para buscar.
VACIAS = set("""
a al algo alguna algunas alguno algunos ante antes aquel aquella aquello aqui asi aun aunque
cada como con contra cual cuales cuando de del desde donde dos el ella ellas ello ellos en entre
era eran es esa esas ese eso esos esta estan estas este esto estos ha hace hacia han hasta hay
la las le les lo los mas me mi mis mucho muy no nos o otra otras otro otros para pero poco por
porque que quien se ser si sin sobre solo son su sus tambien tan tanto te tiene tienen todo todos
tu tus un una uno unos y ya
""".split())


def normalizar(texto):
    texto = str(texto).lower()
    texto = unicodedata.normalize("NFD", texto)
    return "".join(c for c in texto if unicodedata.category(c) != "Mn")


# Asignacion a mano, por codigo. "Comprender el autismo" es el cajon por defecto
# del conversor y habia acabado con 113 de las 429 fichas dentro: "Convulsiones:
# que hacer en el momento" y "No se traga las pastillas" vivian en la misma
# categoria que "Historia del concepto de autismo". Los titulos de esta
# biblioteca estan escritos como habla una familia ("Se le rompen los huesos con
# poco"), y ningun patron de palabras los alcanza; para esos, la unica opcion
# honesta es decir a mano donde va cada uno. Lo que se queda en "comprender" es
# lo que de verdad es conceptual o de identidad.
# Al anadir una ficha nueva: si el patron no la coloca sola, metela aqui.
CATEGORIA_POR_CODIGO = {
    # Salud y condiciones asociadas: la ficha trata un problema medico.
    "JQ": "salud", "KE": "salud", "KF": "salud", "LG": "salud", "LJ": "salud",
    "LK": "salud", "LM": "salud", "LU": "salud", "LY": "salud", "LZ": "salud",
    "ME": "salud", "MG": "salud", "MH": "salud", "MI": "salud", "MK": "salud",
    "MM": "salud", "MN": "salud", "MO": "salud", "MP": "salud", "NJ": "salud",
    "NM": "salud", "NN": "salud", "NS": "salud", "NW": "salud", "PT": "salud",
    "PZ": "salud", "QG": "salud", "QH": "salud", "IQ": "salud", "LE": "salud",
    "LR": "salud", "U": "salud",
    # Diagnostico y primeros pasos.
    "HQ": "diagnostico", "JK": "diagnostico", "JN": "diagnostico", "KA": "diagnostico",
    # Terapias e intervenciones: el "como se ensena" y el "como se evalua".
    "IH": "terapias", "II": "terapias", "IU": "terapias", "IV": "terapias",
    "IY": "terapias", "JA": "terapias", "JF": "terapias", "JT": "terapias",
    "KT": "terapias", "KU": "terapias", "LF": "terapias", "ML": "terapias",
    "PA": "terapias",
    # Conducta y emociones.
    "IL": "conducta", "IM": "conducta", "NC": "conducta",
    # Mundo sensorial.
    "IN": "sensorial", "JU": "sensorial",
    # Familia y vida diaria: la casa, el dia a dia y la seguridad cotidiana.
    "AE": "familia", "AI": "familia", "DV": "familia", "EF": "familia",
    "IE": "familia", "IF": "familia", "IG": "familia", "IJ": "familia",
    "IO": "familia", "IW": "familia", "JB": "familia", "JC": "familia",
    "JD": "familia", "JI": "familia", "JJ": "familia", "JZ": "familia",
    "KM": "familia", "KN": "familia", "LI": "familia", "MJ": "familia",
    "ND": "familia", "NK": "familia", "NL": "familia", "NP": "familia",
    "PF": "familia", "PJ": "familia", "PK": "familia", "PQ": "familia",
    "PX": "familia", "S": "familia",
    # Ronda 46: QT (camas, alarmas y arneses en casa) caia en el cajon por
    # defecto; es equipamiento de casa y seguridad nocturna. Y QV (valproato y
    # la regla) caia en adultez por "la regla", pero es farmacologia: va donde
    # ya esta NW, su ficha hermana.
    "QT": "familia", "QV": "salud",
    # Ronda 47: QX (lo que compras sin receta y choca con lo recetado) caia en
    # terapias por la palabra "medicacion"; es la hermana de LV y QP.
    "QX": "salud",
    # Ronda 48: RC (el babeo) caia en terapias por las opciones de tratamiento;
    # es un problema medico y su ficha hermana NJ ya esta en salud.
    "RC": "salud",
    # PH (dejar el trabajo o reducir jornada para cuidar) caia tambien en
    # terapias, por "terapia" dentro del texto: es vida familiar, como NB y HN.
    "PH": "familia",
    # Escuela y aprendizaje.
    "MU": "escuela", "MW": "escuela",
    # Adolescencia y vida adulta.
    "KJ": "adultez", "PG": "adultez", "PU": "adultez",
    # Ronda 48: RD (pedir plaza) va junto a CM y MC, que describen esos mismos
    # recursos, y no en familia: quien busca residencia busca en vida adulta.
    "RD": "adultez",
    # Derechos y recursos por pais.
    "MR": "derechos", "PB": "derechos", "PN": "derechos", "LX": "derechos",
}

# Excepciones al orden de CATEGORIAS. El "primera que coincide gana" resuelve
# bien casi todo, pero a veces una palabra generica de una categoria anterior
# se lleva una ficha que el padre buscaria en otra. Aqui solo van frases largas
# del titulo, nunca palabras sueltas, para que no arrastren fichas ajenas.
# Comprueba siempre en seco a quien mueve una frase antes de anadirla.
EXCEPCIONES = [
    # QR es la hermana escolar de LL, pero "contencion" (conducta) va antes que
    # "colegio" (escuela) y se la llevaba a Conducta y emociones.
    ("en el colegio lo sujetan", "escuela"),
]


def categoria_de(titulo, codigo=None):
    if codigo and codigo in CATEGORIA_POR_CODIGO:
        clave = CATEGORIA_POR_CODIGO[codigo]
        for c, nombre, _ in CATEGORIAS:
            if c == clave:
                return c, nombre
        raise SystemExit("CATEGORIA_POR_CODIGO: %s apunta a la categoria "
                         "inexistente %r" % (codigo, clave))
    t = normalizar(titulo)
    for frase, clave in EXCEPCIONES:
        if normalizar(frase) in t:
            for c, nombre, _ in CATEGORIAS:
                if c == clave:
                    return c, nombre
    for clave, nombre, patrones in CATEGORIAS:
        for p in patrones:
            if normalizar(p) in t:
                return clave, nombre
    return CAT_POR_DEFECTO[0], CAT_POR_DEFECTO[1]


def ronda_de(estado, codigo):
    m = re.search(r"Ronda (\d+)", estado)
    if m:
        return int(m.group(1))
    # Los códigos de una sola letra (A-Z) son de las rondas 1-3 originales.
    return 1 if len(codigo) == 1 else 0


def extraer_enlaces(texto):
    """Devuelve [{'label':..., 'url':...}] de las fuentes de un tema.

    Los enlaces markdown salen con su URL. Pero una fuente puede estar citada
    solo en texto, sin enlace: pasa cuando el verificador confirmó que el
    trabajo existe pero no llegó a ver su dirección, y la regla del proyecto es
    no inventarla nunca. Esas fuentes también cuentan y también se muestran,
    simplemente sin ser clicables ('url' vacío).
    """
    fuentes = []
    vistos = set()
    for m in re.finditer(r"\[([^\]]+)\]\((https?://[^\s)]+)\)", texto):
        label, url = m.group(1).strip(), m.group(2).strip()
        if url not in vistos:
            vistos.add(url)
            # El texto de la etiqueta también se marca como visto, para que la
            # pasada siguiente no vuelva a añadir la misma fuente sin enlace.
            vistos.add(re.sub(r"[*_`]", "", label).strip(" .;"))
            fuentes.append({"label": label, "url": url})

    # Citas en texto de la línea "**Fuentes:**", separadas por " · "
    m = re.search(r"^\*\*Fuentes\*?\*?[^:\n]*:?\*?\*?\s*(.+)$", texto, flags=re.M)
    if m:
        for trozo in m.group(1).split(" · "):
            plano = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", trozo)
            plano = re.sub(r"[*_`]", "", plano).strip(" .;")
            if len(plano) > 15 and not plano.startswith("http") and plano not in vistos:
                vistos.add(plano)
                fuentes.append({"label": plano, "url": ""})
    return fuentes


def limpiar_markdown(texto):
    """Quita marcas markdown para generar texto plano buscable."""
    texto = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", texto)  # enlaces -> su texto
    texto = texto.replace("**", "").replace("*", "").replace("`", "")
    texto = re.sub(r"^[>\-\s]+", "", texto, flags=re.MULTILINE)
    return texto


def palabras_clave(*textos):
    palabras = set()
    for t in textos:
        for p in re.findall(r"[a-záéíóúñü]{4,}", normalizar(limpiar_markdown(t or ""))):
            if p not in VACIAS:
                palabras.add(p)
    return sorted(palabras)


# Una palabra que sale en muchos temas ya no dice a cuál ir: solo alarga la lista
# de resultados. Las que de verdad faltaban ("ozono", "secretina", "mercurio")
# aparecen en uno o dos temas, así que el tope no se lleva por delante nada útil.
TOPE_TEMAS = 24


def indice_del_cuerpo(dominios, indice):
    """Palabra del cuerpo -> códigos de los temas donde aparece.

    El buscador solo veía título, mensaje y claves, así que un nombre que vive
    dentro del texto no lo encontraba nadie: a una familia a la que le ofrecen
    ozonoterapia, escribir "ozono" le devolvía cero resultados. Esto va en un
    fichero aparte, y no en el índice, porque el índice se precachea en la primera
    visita y estas palabras solo hacen falta cuando alguien busca de verdad.
    """
    ya_puntuan = {t["codigo"]: set(t["claves"]) for t in indice}
    postings = {}
    for d in dominios:
        for p in set(re.findall(r"[a-z0-9]{3,}", normalizar(d["_texto"]))):
            # Lo que ya puntúa por título, mensaje o sinónimos no se repite aquí.
            if p in VACIAS or p.isdigit() or p in ya_puntuan.get(d["codigo"], ()):
                continue
            postings.setdefault(p, []).append(d["codigo"])
    return {p: " ".join(sorted(codigos)) for p, codigos in sorted(postings.items())
            if len(codigos) <= TOPE_TEMAS}


def parsear(md):
    """Corta el markdown en dominios y extrae los campos de cada uno."""
    # Cada dominio empieza por '### CÓDIGO. ' al principio de una línea.
    partes = re.split(r"^### (?=[A-Z]{1,2}\. )", md, flags=re.MULTILINE)
    dominios = []
    avisos = []

    for parte in partes[1:]:
        lineas = parte.split("\n")
        cabecera = lineas[0].strip()
        cuerpo = "\n".join(lineas[1:]).strip()

        m = re.match(r"^([A-Z]{1,2})\.\s+(.*)$", cabecera)
        if not m:
            avisos.append(f"Cabecera no reconocida: {cabecera[:70]}")
            continue
        codigo = m.group(1)
        resto = m.group(2)

        # El estado va tras el último ' — ' si contiene una marca conocida.
        titulo, estado = resto, ""
        if " — " in resto:
            cand_titulo, cand_estado = resto.rsplit(" — ", 1)
            if any(s in cand_estado for s in ("VERIFICADO", "cubierto", "provisional")):
                titulo, estado = cand_titulo.strip(), cand_estado.strip()

        # Mensaje clave. Las rondas usan variantes: "Mensaje clave:", "Resumen:",
        # "Mensaje clave (compasivo):", "Encuadre obligatorio para la app:"…
        mensaje = ""
        for etiqueta in ("Mensaje clave", "Resumen", "Encuadre obligatorio para la app"):
            mm = re.search(r"\*\*" + re.escape(etiqueta) + r"[^*]*\*\*:?\s*(.+?)(?:\n\n|\n\-|\n>|\Z)",
                           cuerpo, flags=re.DOTALL)
            if mm:
                mensaje = limpiar_markdown(mm.group(1)).strip().replace("\n", " ")
                break
        if not mensaje:
            # Respaldo: la primera frase útil del cuerpo, para que la tarjeta no salga vacía.
            for linea in cuerpo.split("\n"):
                plano = limpiar_markdown(linea).strip()
                if len(plano) > 40 and not plano.startswith(("Fuentes", "✅", "⚠️")):
                    mensaje = plano
                    break
            avisos.append(f"{codigo}: sin 'Mensaje clave' (se usó la primera frase del cuerpo)")

        fuentes = extraer_enlaces(cuerpo)
        if not fuentes:
            avisos.append(f"{codigo}: sin fuentes")

        # Nota "Para la app" (interna: no se muestra a las familias).
        nota = ""
        mn = re.search(r">\s*\*\*Para la app:?\*\*:?\s*(.+?)(?:\n\n|\Z)", cuerpo, flags=re.DOTALL)
        if mn:
            nota = limpiar_markdown(mn.group(1)).strip().replace("\n", " ")

        # El cuerpo que se muestra: sin la nota interna "Para la app".
        cuerpo_publico = re.sub(r"\n?>\s*\*\*Para la app:?\*\*:?.*?(?=\n\n|\Z)", "",
                                cuerpo, flags=re.DOTALL).strip()

        semaforos = {
            "verde": cuerpo.count("🟢"),
            "amarillo": cuerpo.count("🟡"),
            "rojo": cuerpo.count("🔴"),
            "vivencial": cuerpo.count("⚪"),
        }
        cat_clave, cat_nombre = categoria_de(titulo, codigo)

        dominios.append({
            "codigo": codigo,
            "titulo": titulo,
            "estado": estado,
            "verificado": "VERIFICADO" in estado,
            "ronda": ronda_de(estado, codigo),
            "categoria": cat_clave,
            "categoriaNombre": cat_nombre,
            "mensaje": mensaje,
            "cuerpo": cuerpo_publico,
            "fuentes": fuentes,
            "notaApp": nota,
            "semaforos": semaforos,
            "_texto": limpiar_markdown(cuerpo_publico),
        })

    return dominios, avisos


def main():
    if not os.path.exists(BIBLIOTECA):
        sys.exit(f"No encuentro la biblioteca en {BIBLIOTECA}")

    md = open(BIBLIOTECA, encoding="utf-8").read()
    # Alguna entrada llega con entidades HTML (&amp;, &gt;) desde la investigación.
    # Se decodifican aquí para que la app no muestre "&amp;" en pantalla.
    md = html.unescape(md)
    dominios, avisos = parsear(md)

    if not dominios:
        sys.exit("No se encontró ningún tema. ¿Cambió el formato de la biblioteca?")

    # Sinónimos: lo que escribe una familia -> códigos de tema.
    # Se descartan las claves que empiezan por "_" (son notas de documentación,
    # no listas de códigos: dejarlas rompe la carga en clientes con tipos estrictos).
    sinonimos = {}
    if os.path.exists(SINONIMOS):
        crudo = json.load(open(SINONIMOS, encoding="utf-8"))
        sinonimos = {k: v for k, v in crudo.items()
                     if not k.startswith("_") and isinstance(v, list)}

    indice = []
    cuerpos = {}
    for d in dominios:
        extra = " ".join(k for k, codigos in sinonimos.items() if d["codigo"] in codigos)
        indice.append({
            "codigo": d["codigo"],
            "titulo": d["titulo"],
            "categoria": d["categoria"],
            "categoriaNombre": d["categoriaNombre"],
            "verificado": d["verificado"],
            "mensaje": d["mensaje"],
            "nFuentes": len(d["fuentes"]),
            "semaforos": d["semaforos"],
            "claves": palabras_clave(d["titulo"], d["mensaje"], extra),
        })
        cuerpos[d["codigo"]] = {
            "codigo": d["codigo"],
            "titulo": d["titulo"],
            "estado": d["estado"],
            "categoriaNombre": d["categoriaNombre"],
            "cuerpo": d["cuerpo"],
            "fuentes": d["fuentes"],
        }

    os.makedirs(SALIDA, exist_ok=True)

    categorias = []
    for clave, nombre, _ in CATEGORIAS:
        n = sum(1 for d in indice if d["categoria"] == clave)
        if n:
            categorias.append({"clave": clave, "nombre": nombre, "n": n})

    meta = {
        "generado": "scripts/construir-contenido.py",
        "totalTemas": len(indice),
        "verificados": sum(1 for d in indice if d["verificado"]),
        "totalFuentes": sum(len(d["fuentes"]) for d in dominios),
        "categorias": categorias,
        "sinonimos": sinonimos,
        "temas": indice,
    }

    palabras = indice_del_cuerpo(dominios, indice)

    ruta_indice = os.path.join(SALIDA, "biblioteca-indice.json")
    ruta_cuerpo = os.path.join(SALIDA, "biblioteca-cuerpo.json")
    ruta_busqueda = os.path.join(SALIDA, "biblioteca-busqueda.json")
    with open(ruta_indice, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, separators=(",", ":"))
    with open(ruta_cuerpo, "w", encoding="utf-8") as f:
        json.dump(cuerpos, f, ensure_ascii=False, separators=(",", ":"))
    with open(ruta_busqueda, "w", encoding="utf-8") as f:
        json.dump({"generado": "scripts/construir-contenido.py", "palabras": palabras},
                  f, ensure_ascii=False, separators=(",", ":"))

    print(f"✅ {len(indice)} temas ({meta['verificados']} verificados), "
          f"{meta['totalFuentes']} fuentes, {len(categorias)} categorías.")
    print(f"   {ruta_indice}  ({os.path.getsize(ruta_indice)//1024} KB)")
    print(f"   {ruta_cuerpo}  ({os.path.getsize(ruta_cuerpo)//1024} KB)")
    print(f"   {ruta_busqueda}  ({os.path.getsize(ruta_busqueda)//1024} KB, "
          f"{len(palabras)} palabras del cuerpo)")
    for c in categorias:
        print(f"     · {c['nombre']}: {c['n']}")
    if avisos:
        print(f"\n⚠️  {len(avisos)} aviso(s) — temas a los que les falta algo:")
        for a in avisos:
            print("   -", a)


if __name__ == "__main__":
    main()
