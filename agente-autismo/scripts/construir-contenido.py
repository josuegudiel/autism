#!/usr/bin/env python3
"""
Convierte research/biblioteca-autismo.md en los JSON que consume la app.

Uso:
    python3 scripts/construir-contenido.py

Genera:
    web/content/biblioteca-indice.json    índice ligero para buscar (títulos, resumen, palabras clave)
    web/content/biblioteca-cuerpo.json    contenido completo de cada tema (se carga al abrir uno)

No hace falta instalar nada: solo Python 3.
Si añades o editas un tema en la biblioteca, vuelve a ejecutar este script.
"""

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
    ]),
    ("escuela", "Escuela y aprendizaje", [
        "escuela", "escolar", "colegio", "aula", "recreo", "comedor", "excursion",
        "deberes", "exámenes", "universidad", "formación profesional", "dislexia",
        "discalculia", "disgrafía", "funciones ejecutivas", "memoria", "juego",
        "educación en casa", "doble excepcionalidad", "acoso", "reuniones escolares",
        "percepción del tiempo", "reconocimiento de caras",
    ]),
    ("familia", "Familia y vida diaria", [
        "familia", "cuidador", "hermanos", "abuelos", "pareja", "divorcio", "duelo",
        "respiro", "crianza", "explicar el autismo", "estigma", "viajes", "salir:",
        "campamento", "transporte", "emergencias", "baño", "cocinar", "dinero",
        "organización y tareas", "habilidades de vida", "amistades", "amistad",
    ]),
    ("adultez", "Adolescencia y vida adulta", [
        "adolescencia", "adultez", "adulto", "empleo", "trabajo", "entrevistas",
        "vivienda", "conducir", "envejecimiento", "sexualidad", "citas y relaciones",
        "maternidad", "embarazo", "planificación financiera", "justicia", "coaching",
        "independencia", "menopausia",
    ]),
    ("derechos", "Derechos y recursos por país", [
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


def categoria_de(titulo):
    t = normalizar(titulo)
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
    """Devuelve [{'label':..., 'url':...}] de los enlaces markdown de un texto."""
    fuentes = []
    vistos = set()
    for m in re.finditer(r"\[([^\]]+)\]\((https?://[^\s)]+)\)", texto):
        label, url = m.group(1).strip(), m.group(2).strip()
        if url not in vistos:
            vistos.add(url)
            fuentes.append({"label": label, "url": url})
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
        cat_clave, cat_nombre = categoria_de(titulo)

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
    dominios, avisos = parsear(md)

    if not dominios:
        sys.exit("No se encontró ningún tema. ¿Cambió el formato de la biblioteca?")

    # Sinónimos: lo que escribe una familia -> códigos de tema.
    sinonimos = {}
    if os.path.exists(SINONIMOS):
        sinonimos = json.load(open(SINONIMOS, encoding="utf-8"))

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

    ruta_indice = os.path.join(SALIDA, "biblioteca-indice.json")
    ruta_cuerpo = os.path.join(SALIDA, "biblioteca-cuerpo.json")
    with open(ruta_indice, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, separators=(",", ":"))
    with open(ruta_cuerpo, "w", encoding="utf-8") as f:
        json.dump(cuerpos, f, ensure_ascii=False, separators=(",", ":"))

    print(f"✅ {len(indice)} temas ({meta['verificados']} verificados), "
          f"{meta['totalFuentes']} fuentes, {len(categorias)} categorías.")
    print(f"   {ruta_indice}  ({os.path.getsize(ruta_indice)//1024} KB)")
    print(f"   {ruta_cuerpo}  ({os.path.getsize(ruta_cuerpo)//1024} KB)")
    for c in categorias:
        print(f"     · {c['nombre']}: {c['n']}")
    if avisos:
        print(f"\n⚠️  {len(avisos)} aviso(s) — temas a los que les falta algo:")
        for a in avisos:
            print("   -", a)


if __name__ == "__main__":
    main()
