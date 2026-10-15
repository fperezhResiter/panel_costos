"""Instala los controles compartidos en las vistas y sus plantillas."""
from pathlib import Path
import re

MOTOR = Path(__file__).resolve().parent


def sincronizar(raiz):
    raiz = Path(raiz)
    destinos = [(raiz / 'Panel Universal.html', 'portal', 'Panel Universal.html'),
                (raiz / 'portal/plantilla.html', 'portal', 'Panel Universal.html')]
    for area in ['Panel Mantenimiento/panel_mantenimiento', 'Panel Reporte Codelco/panel_codelco']:
        base = raiz / area
        (base / 'app/rutas_menu.py').write_bytes((MOTOR / 'rutas_menu.py').read_bytes())
        for nombre in ['controles-comunes.css', 'controles-comunes.js']:
            (base / 'web' / ('css' if nombre.endswith('.css') else 'js') / nombre).write_bytes((MOTOR / nombre).read_bytes())
        for html in [base / 'Panel.html', *(base / 'web/pages').glob('*.html')]:
            sub = html.parent != base
            destinos.append((html, '..' if sub else 'web', '../../../../Panel Universal.html' if sub else '../../Panel Universal.html'))
    costos = raiz / 'Panel Costos Resiter/panel_costos'
    for nombre in ['controles-comunes.css', 'controles-comunes.js']:
        (costos / 'app' / nombre).write_bytes((MOTOR / nombre).read_bytes())
    destinos += [(costos / 'Panel Costos Resiter.html', 'app', '../../Panel Universal.html'),
                 (costos / 'motor/template.html', 'app', '../../Panel Universal.html'),
                 (costos / 'motor/template_inicio.html', 'app', '../../Panel Universal.html')]
    destinos += [(vista, '../../app', '../../../../Panel Universal.html')
                 for vista in (costos / 'web/pages').glob('*.html')]
    admin = raiz / 'Panel Administradores Resiter'
    destinos += [(admin / 'Panel Administradores.html', '../portal', '../Panel Universal.html'),
                 (admin / 'motor/template.html', '../portal', '../Panel Universal.html')]
    for html, recursos, menu in destinos:
        if not html.exists():
            continue
        texto = html.read_text(encoding='utf-8-sig')
        texto = re.sub(r'\n?<!-- INICIO CONTROLES UNIVERSALES -->.*?<!-- FIN CONTROLES UNIVERSALES -->\n?', '\n', texto, flags=re.S)
        # Administradores conserva su función para redibujar el gráfico; el control común gestiona el tema.
        if html.parent == admin or html == admin / 'motor/template.html':
            texto = re.sub(r'const btnTema = \$\("#btnTema"\);.*?\n};', '', texto, flags=re.S)
        css = f'{recursos}/controles-comunes.css' if recursos not in ('web', '..') else f'{recursos}/css/controles-comunes.css'
        js = f'{recursos}/controles-comunes.js' if recursos not in ('web', '..') else f'{recursos}/js/controles-comunes.js'
        # Login/Perfil usan rutas absolutas incluso al abrirse bajo /login o /perfil.
        if html.stem in ('Login', 'Perfil'):
            css, js = '/web/css/controles-comunes.css', '/web/js/controles-comunes.js'
        bloque = ('<!-- INICIO CONTROLES UNIVERSALES -->\n'
                  f'<link rel="stylesheet" href="{css}">\n'
                  f'<script src="{js}" data-menu="{menu}"></script>\n'
                  '<!-- FIN CONTROLES UNIVERSALES -->\n')
        texto = texto.replace('</head>', bloque + '</head>', 1)
        html.write_text(texto, encoding='utf-8', newline='\n')


if __name__ == '__main__':
    sincronizar(MOTOR.parent)
