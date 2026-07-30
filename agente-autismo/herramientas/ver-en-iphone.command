#!/bin/bash
# ---------------------------------------------------------------------------
# Brújula TEA — ver la app en un iPhone simulado (macOS)
#
# Doble clic en este archivo. Arranca un servidor local y abre el simulador
# en tu navegador. Para cerrarlo, cierra esta ventana de Terminal.
#
# Funciona igual en Mac Intel y en Apple Silicon. NO necesita Xcode.
#
# Si macOS no te deja abrirlo: clic derecho sobre el archivo -> Abrir -> Abrir.
# ---------------------------------------------------------------------------

set -u
PUERTO=8099

cd "$(dirname "$0")/.." || exit 1

if [ ! -d "web" ]; then
  echo "No encuentro la carpeta 'web'."
  echo "Este archivo debe estar dentro de agente-autismo/herramientas/."
  read -r -p "Pulsa Intro para cerrar…"
  exit 1
fi

# Buscar un puerto libre
while lsof -i :"$PUERTO" >/dev/null 2>&1; do
  PUERTO=$((PUERTO + 1))
done

URL="http://localhost:$PUERTO/herramientas/simulador-iphone.html"

# --- Elegir con qué servir. macOS reciente no siempre trae python3 listo. ---
SERVIDOR=""
if command -v python3 >/dev/null 2>&1 && python3 -c "" >/dev/null 2>&1; then
  SERVIDOR="python3"
elif command -v ruby >/dev/null 2>&1; then
  SERVIDOR="ruby"          # macOS incluye Ruby
elif command -v php >/dev/null 2>&1; then
  SERVIDOR="php"
elif command -v npx >/dev/null 2>&1; then
  SERVIDOR="npx"
fi

if [ -z "$SERVIDOR" ]; then
  cat <<'AYUDA'

  No encontré ninguna forma de arrancar un servidor local.

  Tienes dos salidas, ambas gratis:

  1) Usar la versión publicada en internet (lo más fácil):
     abre la web del proyecto en GitHub Pages desde cualquier navegador,
     y también desde el iPhone.

  2) Instalar las herramientas de línea de comandos de Apple (incluyen
     python3, NO hace falta Xcode). En la Terminal, una sola vez:

         xcode-select --install

     Después vuelve a hacer doble clic en este archivo.

AYUDA
  read -r -p "Pulsa Intro para cerrar…"
  exit 1
fi

echo ""
echo "  Brújula TEA — simulador de iPhone"
echo "  ---------------------------------"
echo "  Servidor: $SERVIDOR   ·   puerto: $PUERTO"
echo "  Abriendo: $URL"
echo ""
echo "  Deja esta ventana abierta mientras uses el simulador."
echo "  Para terminar: cierra la ventana o pulsa Control + C."
echo ""

( sleep 1.5; open "$URL" ) &

case "$SERVIDOR" in
  python3) python3 -m http.server "$PUERTO" --bind 127.0.0.1 ;;
  ruby)    ruby -run -e httpd . -p "$PUERTO" -b 127.0.0.1 ;;
  php)     php -S "127.0.0.1:$PUERTO" ;;
  npx)     npx --yes serve -l "$PUERTO" . ;;
esac
