"""Publicar la portada y las tres vistas sin duplicar los datos cifrados."""
import base64
import html
import json
from pathlib import Path
import re
import shutil

MOTOR = Path(__file__).resolve().parent
RAIZ = MOTOR.parent
VISTAS = (
    ("reporte", "Panel_Reporte_Costos.html", "Reporte de costos"),
    ("graficos", "Panel_Proyectado_Real.html", "Proyectado vs real por mes"),
    ("diccionario", "Panel_Diccionario.html", "Diccionario y ayuda"),
)


def generar_panel(blob, meta=None):
    """Los recursos se comparten en app; cada vista contiene su propio HTML."""
    app = RAIZ / "app"
    pages = RAIZ / "web" / "pages"
    app.mkdir(exist_ok=True)
    pages.mkdir(parents=True, exist_ok=True)
    plantilla = (MOTOR / "template.html").read_text(encoding="utf-8")
    logo_acceso = (MOTOR / "logo_white.b64").read_text(encoding="utf-8").strip()
    css = (MOTOR / "template.css").read_text(encoding="utf-8")
    js = (MOTOR / "template.js").read_text(encoding="utf-8").replace(
        "/*__CIFRADO__*/ null", json.dumps(blob)
    )
    logo_pdf = "data:image/png;base64," + base64.b64encode((MOTOR / "logo_resiter.png").read_bytes()).decode()
    js = js.replace("/*__LOGO_PDF__*/ null", json.dumps(logo_pdf))
    pendientes = {app / "panel.css": css, app / "panel.js": js}
    for vista, archivo, titulo in VISTAS:
        pagina = re.sub(
            r"<!-- VISTA:(\w+) -->(.*?)<!-- FIN VISTA -->",
            lambda m: m[2] if m[1] == vista else "",
            plantilla,
            flags=re.S,
        )
        pagina = pagina.replace("__VISTA__", vista).replace("__TITULO_VISTA__", titulo)
        if vista == "diccionario":
            # Conservar el contexto de cálculo y navegación, sin exponer filtros.
            pagina = pagina.replace('<div class="barra">', '<div class="barra" hidden inert>')
        pagina = pagina.replace("__LOGO__", logo_acceso)
        pagina = pagina.replace('href="app/', 'href="../../app/')
        pagina = pagina.replace('src="app/', 'src="../../app/')
        pagina = pagina.replace('data-menu="../../Panel Universal.html"',
                                'data-menu="../../../../Panel Universal.html"')
        pagina = pagina.replace(f'id="vista-{vista}"',
                                f'id="vista-{vista}" aria-current="page"')
        pendientes[pages / archivo] = pagina
    meta = meta or {}
    publicacion = ""
    if meta.get("generado"):
        publicacion = "Última publicación: " + str(meta["generado"]).replace("T", " ")
    if meta.get("hoy"):
        publicacion += (" · " if publicacion else "") + "Datos al " + str(meta["hoy"])
    portada = (MOTOR / "template_inicio.html").read_text(encoding="utf-8")
    pendientes[RAIZ / "Panel Costos Resiter.html"] = portada.replace(
        "__PUBLICACION__", html.escape(publicacion or "Panel de Costos Resiter")
    ).replace("__LOGO__", logo_acceso)
    # Preparar todos los textos antes de sustituir archivos publicados.
    for destino, contenido in pendientes.items():
        temporal = destino.with_suffix(destino.suffix + ".tmp")
        temporal.write_text(contenido, encoding="utf-8")
    shutil.copyfile(MOTOR / "logo_resiter.png", app / "logo-resiter.png")
    for destino in pendientes:
        destino.with_suffix(destino.suffix + ".tmp").replace(destino)
    return str(RAIZ / "Panel Costos Resiter.html")


if __name__ == "__main__":
    # Reconstruir solo la interfaz desde la publicación vigente: no lee Excel,
    # no cambia la contraseña ni vuelve a cifrar o recalcular los datos.
    publicado = (RAIZ / "app" / "panel.js").read_text(encoding="utf-8")
    match = re.search(r"^const CIFRADO = (.*?);", publicado)
    if not match:
        raise SystemExit("No se encontró la publicación cifrada en app/panel.js.")
    blob = json.loads(match[1])
    meta = json.loads((MOTOR / "data" / "data.json").read_text(encoding="utf-8"))["meta"]
    generar_panel(blob, meta)
    print("Portada y tres vistas HTML publicadas con los datos cifrados vigentes.")
