#!/bin/bash
# Doble clic para levantar la app y abrirla en el navegador.
# Cerrá esta ventana de Terminal cuando termines.

cd "$(dirname "$0")" || exit 1
PORT=8123

while lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

echo "Gallery wall corriendo en http://localhost:$PORT"
echo "Dejá esta ventana abierta mientras usás la app."
echo

( sleep 1 && open "http://localhost:$PORT/index.html" ) &
python3 -m http.server "$PORT" --bind 127.0.0.1
