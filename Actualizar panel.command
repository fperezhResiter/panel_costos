#!/bin/bash
# Doble clic para regenerar el panel con los datos que estén en la carpeta "Fuentes".
cd "$(dirname "$0")"
clear
echo "============================================================"
echo "   ACTUALIZANDO EL PANEL DE COSTOS RESITER"
echo "============================================================"
echo ""
echo "Leyendo los archivos de la carpeta 'Fuentes'..."
echo "Esto demora 1 a 2 minutos. No cierres esta ventana."
echo ""

# Verificar Python
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: No está instalado Python 3."
  echo "Instálalo desde https://www.python.org/downloads/ y vuelve a intentar."
  echo ""; echo "Presiona Enter para cerrar."; read; exit 1
fi

# Verificar/instalar las librerías necesarias (leer Excel + cifrar el panel)
python3 -c "import openpyxl" 2>/dev/null || {
  echo "Instalando un componente necesario (openpyxl)..."
  python3 -m pip install --user openpyxl >/dev/null 2>&1
}
python3 -c "import cryptography" 2>/dev/null || {
  echo "Instalando un componente necesario (cryptography)..."
  python3 -m pip install --user cryptography >/dev/null 2>&1
}

python3 motor/real.py
echo ""
echo "Presiona Enter para cerrar esta ventana."
read
