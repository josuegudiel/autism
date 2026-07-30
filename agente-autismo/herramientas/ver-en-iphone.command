#!/bin/bash
# ---------------------------------------------------------------------------
# Brújula TEA — ver la app en un iPhone simulado (macOS)
#
# Doble clic en este archivo. Arranca un servidor local y abre el simulador
# en tu navegador. Para cerrarlo, cierra esta ventana de Terminal.
#
# La primera vez, si macOS no te deja abrirlo, ejecuta una sola vez en la
# Terminal:   chmod +x ver-en-iphone.command
# ---------------------------------------------------------------------------

set -u
PUERTO=8099

# Situarse en la carpeta del proyecto (la que contiene web/ y herramientas/)
cd "$(dirname "$0")/.." || exit 1

if [ ! -d "web" ]; then
  echo "No encuentro la carpeta 'web'. Coloca este archivo dentro de agente-autismo/herramientas/."
  read -r -p "Pulsa Intro para cerrar…"
  exit 1
fi

# Si el puerto ya está ocupado, busca el siguiente libre
while lsof -i :"$PUERTO" >/dev/null 2>&1; do
  PUERTO=$((PUERTO + 1))
done

URL="http://localhost:$PUERTO/herramientas/simulador-iphone.html"

echo ""
echo "  Brújula TEA — simulador de iPhone"
echo "  ---------------------------------"
echo "  Sirviendo en el puerto $PUERTO"
echo "  Abriendo: $URL"
echo ""
echo "  Deja esta ventana abierta mientras uses el simulador."
echo "  Para terminar: cierra la ventana o pulsa Control + C."
echo ""

# Abrir el navegador cuando el servidor esté listo
( sleep 1.2; open "$URL" ) &

# python3 viene incluido en macOS
python3 -m http.server "$PUERTO" --bind 127.0.0.1
