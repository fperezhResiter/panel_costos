from pathlib import Path

motor = Path(__file__).resolve().parents[2]
path = motor / 'template.html'
html = path.read_text(encoding='utf-8')
original = (Path(__file__).parent / 'template.html').read_text(encoding='utf-8')

def seccion(nombre):
    inicio = original.index('    <section class="tarjeta dic-seccion" aria-labelledby="' + nombre + '">')
    fin = original.index('\n    </section>', inicio) + len('\n    </section>')
    return original[inicio:fin]

publicacion = seccion('dic-publicacion').replace('Datos reconocidos por esta publicación', 'Comprueba qué información está publicada')
inicio = original.index('    <div class="dic-columnas">')
fin = original.index('    <section class="tarjeta dic-seccion" aria-labelledby="dic-calculo">')
actualizacion = original[inicio:fin].rstrip()
actualizacion = actualizacion.replace('id="dic-ig" tabindex="-1"', 'id="dic-ig" tabindex="-1"')
actualizacion = actualizacion.replace('<section class="tarjeta dic-seccion" aria-labelledby="dic-ig">', '<section class="tarjeta dic-seccion" aria-labelledby="dic-ig" data-dic-articulo="Actualizar el IG · Informe de Gestión" data-dic-destino="dic-ig" data-dic-categoria="Actualizar datos">')
actualizacion = actualizacion.replace('<h2 id="dic-problemas">', '<h2 id="dic-problemas" tabindex="-1">')
actualizacion = actualizacion.replace('<details open>', '<details>')
actualizacion = actualizacion.replace('<details>', '<details data-dic-articulo data-dic-categoria="Problemas con el IG">')
actualizacion = actualizacion.replace('En esta vista, <b>IG reconocido hasta</b>', 'En <b>Actualizar datos</b> de esta guía, <b>IG reconocido hasta</b>')

calculo = seccion('dic-calculo')
calculo = calculo.replace('id="dic-calculo" tabindex="-1">Así se calcula tu selección', 'id="dic-calculo" tabindex="-1" data-dic-abrir="dicVerCalculo">Tu selección, explicada')
calculo = calculo.replace('<div class="dic-contenido"><p id="dicSeleccion"></p>', '''<div class="dic-contenido">
        <div class="dic-contexto"><div><b>Selección conservada del reporte</b><p id="dicSeleccion"></p></div><a id="dicVolverReporte" class="btn dic-volver-reporte" href="Panel_Reporte_Costos.html">Cambiar selección en el reporte →</a></div>
        <p>Esta explicación usa el período, zona, unidad y línea que elegiste en el reporte o en el gráfico. Al volver, se conserva esa selección.</p>
        <details id="dicVerCalculo" class="dic-articulo" data-dic-articulo="Cómo se calcula mi selección: real, comparable, diferencia y avance" data-dic-destino="dic-calculo" data-dic-categoria="Cálculos"><summary>Ver el cálculo paso a paso con mis datos</summary>''')
calculo = calculo.replace('</p></div>\n    </section>', '</p></details></div>\n    </section>')

fuentes = seccion('dic-fuentes')
fuentes = fuentes.replace('<div class="scroll" tabindex="0" role="region" aria-label="Fuentes del panel">', '<details class="dic-fuentes-detalle"><summary>Consultar los archivos y las reglas de cada fuente</summary><div class="scroll" tabindex="0" role="region" aria-label="Fuentes del panel">')
fuentes = fuentes.replace('</tbody></table></div>', '</tbody></table></div></details>')
fuentes = fuentes.replace('<tr><td><b>', '<tr data-dic-articulo data-dic-categoria="Fuentes"><td><b>')

guia = '''  <section id="vistaDiccionario" aria-labelledby="tituloDiccionario">
    <div class="intro dic-intro"><p class="eyebrow">GUÍA DEL PANEL</p><h2 id="tituloDiccionario">Diccionario y ayuda</h2><p>Encuentra qué significa una cifra, cómo usar el panel y qué hacer si falta información.</p></div>
    <div class="tarjeta dic-buscador" role="search" aria-label="Buscar en la ayuda">
      <label for="dicBuscar">¿Qué necesitas resolver?</label>
      <div class="dic-buscar-fila"><input type="search" id="dicBuscar" placeholder="Ej.: IG pendiente, diferencia, descargar…" aria-controls="dicBusquedaResultados" aria-describedby="dicResultados"><button type="button" id="dicLimpiarBusqueda" class="btn" hidden>Limpiar búsqueda</button></div>
      <p id="dicResultados" class="dic-resultados" role="status">Busca en términos, instrucciones, soluciones y fuentes. También puedes elegir una sección debajo.</p>
      <div id="dicBusquedaResultados" hidden><div id="dicCoincidencias" class="dic-coincidencias"></div><p id="dicVacio" hidden>No encontramos esa consulta. Prueba con «IG», «avance», «OC» o «descargas», o revisa las secciones de ayuda.</p></div>
    </div>
    <nav class="dic-atajos" role="tablist" aria-label="Secciones de ayuda">
      <button type="button" id="dic-tab-uso" role="tab" aria-controls="dic-panel-uso" aria-selected="true" data-dic-panel="dic-panel-uso"><span>01 · EMPEZAR</span><b>Cómo usar el panel</b><small>Consulta, detalle y descargas</small></button>
      <button type="button" id="dic-tab-terminos" role="tab" aria-controls="dic-panel-terminos" aria-selected="false" tabindex="-1" data-dic-panel="dic-panel-terminos"><span>02 · ENTENDER</span><b>Términos y cálculos</b><small>Qué significa cada cifra</small></button>
      <button type="button" id="dic-tab-dudas" role="tab" aria-controls="dic-panel-dudas" aria-selected="false" tabindex="-1" data-dic-panel="dic-panel-dudas"><span>03 · RESOLVER</span><b>Dudas frecuentes</b><small>Respuestas y próximos pasos</small></button>
      <button type="button" id="dic-tab-actualizar" role="tab" aria-controls="dic-panel-actualizar" aria-selected="false" tabindex="-1" data-dic-panel="dic-panel-actualizar"><span>04 · ACTUALIZAR</span><b>Actualizar datos</b><small>IG, compras y archivos fuente</small></button>
    </nav>
    <div id="dic-panel-uso" role="tabpanel" aria-labelledby="dic-tab-uso" tabindex="0">
      <section class="tarjeta dic-seccion" aria-labelledby="dic-uso">
        <div class="titulo"><h2 id="dic-uso" tabindex="-1">Una consulta en cuatro pasos</h2></div>
        <div class="dic-contenido">
          <p>Empieza en <a class="dic-volver-reporte" href="Panel_Reporte_Costos.html">Reporte de costos</a>. Revisa primero el alcance y después el detalle.</p>
          <div class="dic-guia-grid">
            <article id="dic-uso-seleccion" tabindex="-1" data-dic-articulo="1. Elegir período, zona, unidad y línea de negocio" data-dic-categoria="Uso del panel"><span class="dic-numero">1</span><h3>Elige qué vas a revisar</h3><p>Selecciona <b>Período → Zona → Unidad → Línea de negocio</b>. Las opciones se ajustan a la selección. <b>Limpiar filtros</b> vuelve a la división y al mes de corte de compras.</p></article>
            <article id="dic-uso-estado" tabindex="-1" data-dic-articulo="2. Leer el estado del mes y los indicadores" data-dic-categoria="Uso del panel"><span class="dic-numero">2</span><h3>Comprueba si falta IG</h3><p>Lee el aviso sobre el mes. Si dice <b>IG pendiente</b>, aún faltan personal y depreciación. Compara el real con <b>Proyectado comparable</b>; la proyección comprometida representa todo el mes.</p></article>
            <article id="dic-uso-detalle" tabindex="-1" data-dic-articulo="3. Expandir filas y abrir el detalle del contrato" data-dic-categoria="Uso del panel"><span class="dic-numero">3</span><h3>Encuentra el origen del gasto</h3><p>La flecha junto a una fila abre o cierra sus niveles. Pulsa el importe real de un contrato o del total para ver <b>partidas, IG y órdenes de compra</b>. Expandir filas conserva los totales.</p></article>
            <article id="dic-uso-descargas" tabindex="-1" data-dic-articulo="4. Comparar meses y descargar PDF o Excel" data-dic-categoria="Uso del panel"><span class="dic-numero">4</span><h3>Compara o comparte</h3><p>En <b>Proyectado vs real por mes</b>, enfoca un punto para ver el valor y púlsalo para elegir el período. Allí puedes <b>Descargar PDF</b>. En el detalle del reporte, usa <b>Resumen Item + Descargar OC</b> o <b>Generar reporte de costo</b>.</p></article>
          </div>
          <div class="dic-claves"><b>Claves para leer las cifras</b><p><b>MM$</b> = millones de pesos. <b>Diferencia positiva</b> = gasto sobre el comparable. <b>Avance de 100%</b> = consumiste toda la referencia comparable.</p></div>
          <div class="dic-semaforo" aria-label="Criterios del semáforo"><span class="sem sem-azul">Hasta 100% · en plan</span><span class="sem sem-amarillo">Más de 100% y hasta 110%</span><span class="sem sem-rojo">Más de 110% · sobre el plan</span></div>
          <p class="dic-aviso">Un avance bajo muestra menor gasto frente a la referencia; por sí solo no acredita ahorro ni cumplimiento operativo.</p>
        </div>
      </section>
      <div class="dic-siguientes"><button class="btn" type="button" data-ir-diccionario="dic-terminos">Entender los indicadores →</button><button class="btn" type="button" data-ir-diccionario="dic-dudas">Resolver una duda →</button></div>
    </div>
    <div id="dic-panel-terminos" role="tabpanel" aria-labelledby="dic-tab-terminos" tabindex="0" hidden>
      <section class="tarjeta dic-seccion" aria-labelledby="dic-terminos">
        <div class="titulo"><h2 id="dic-terminos" tabindex="-1">Términos, fórmulas y criterios</h2><button type="button" class="btn" id="dicExpandirTerminos" aria-expanded="false" aria-controls="dicTerminos">Abrir todos los términos</button></div>
        <div class="dic-contenido"><p>Abre un término para ver su significado, fórmula y fuente. Usa la búsqueda de arriba para encontrar una palabra en toda la guía.</p><div id="dicTerminos"></div></div>
      </section>
''' + calculo + '''
    </div>
    <div id="dic-panel-dudas" role="tabpanel" aria-labelledby="dic-tab-dudas" tabindex="0" hidden>
      <section class="tarjeta dic-seccion" aria-labelledby="dic-dudas">
        <div class="titulo"><h2 id="dic-dudas" tabindex="-1">Respuestas para seguir trabajando</h2></div>
        <div class="dic-contenido dic-soluciones">
          <details id="dic-duda-ig" data-dic-articulo data-dic-categoria="Dudas frecuentes"><summary>¿Qué hago si aparece IG pendiente?</summary><p>Comprueba hasta qué mes llega el IG en <b>Actualizar datos</b>. Si no alcanza el período consultado, incorpora un IG acumulado que lo incluya, ejecuta el actualizador y recarga el panel. Mientras tanto, el real no incluye todos los costos de personal y depreciación; el comparable descuenta su peso histórico.</p><button class="btn" type="button" data-ir-diccionario="dic-ig">Ver cómo actualizar el IG →</button></details>
          <details id="dic-duda-comparable" data-dic-articulo data-dic-categoria="Dudas frecuentes"><summary>¿Por qué el comparable es menor que la proyección del mes?</summary><p>La proyección comprometida es el compromiso del mes entero. El comparable la ajusta al día de corte de las compras y, cuando falta IG, también excluye el peso histórico estimado de personal y depreciación. Son dos referencias con distinto alcance.</p><button class="btn" type="button" data-ir-diccionario="dic-calculo">Ver el cálculo de mi selección →</button></details>
          <details id="dic-duda-vacio" data-dic-articulo data-dic-categoria="Dudas frecuentes"><summary>¿Por qué aparece «—», «nuevo» o «sin meta»?</summary><p><b>—</b> significa que no hay una referencia válida para esa comparación. <b>Nuevo</b> indica que una partida no tiene referencia distinta de cero; puede tener gasto real. <b>Sin meta</b> aparece antes de agosto de 2026, cuando aún no rige la proyección comprometida. Una referencia ausente no equivale a gasto cero.</p></details>
          <details id="dic-duda-total" data-dic-articulo data-dic-categoria="Dudas frecuentes"><summary>¿Por qué una unidad o su meta no aparece en el total?</summary><p>Revisa el período y los filtros. El total incluye las unidades con algún real distinto de cero en los contratos de la selección. Las unidades sin movimiento y sus metas se informan aparte. Administración queda fuera del panel y CAPEX se presenta separado del gasto. Contraer una fila solamente oculta su detalle.</p></details>
          <details id="dic-duda-descarga" data-dic-articulo data-dic-categoria="Dudas frecuentes"><summary>¿Por qué la descarga de OC no coincide con el costo real?</summary><p>La descarga de OC reúne las compras SAP; el real también suma personal y depreciación del IG cuando están reconocidos. Compara las OC con <b>Total compras</b> del detalle y revisa <b>Total IG</b> por separado. Las OC están en pesos CLP; las tarjetas están en MM$.</p><p>La pantalla muestra hasta 1.500 líneas de OC. La descarga incluye todas las líneas de la selección, incluso las que no ves en pantalla.</p></details>
          <details id="dic-duda-revisar" data-dic-articulo data-dic-categoria="Dudas frecuentes"><summary>¿Cómo resuelvo una partida o zona marcada «(Revisar)»?</summary><p>Abre el detalle y confirma la unidad o el código <b>CONCEPTOIMPUTACION</b> de la OC. Una partida sin clasificar requiere asociar ese número a una partida válida en el diccionario de clasificación. Una zona sin resolver requiere revisar la asociación de la unidad con el IG o el presupuesto. Después, ejecuta el actualizador y recarga.</p><button class="btn" type="button" data-ir-diccionario="dic-fuentes">Consultar las fuentes →</button></details>
          <details id="dic-duda-corte" data-dic-articulo data-dic-categoria="Dudas frecuentes"><summary>¿Por qué el corte no es la fecha de hoy?</summary><p>El corte lo determina la última <b>fecha de creación de OC</b> cargada. No sigue el reloj del computador. Incorpora una exportación de compras más reciente y actualiza. Reemplazar solo el IG no cambia la fecha de corte.</p></details>
          <details id="dic-duda-copia" data-dic-articulo data-dic-categoria="Dudas frecuentes"><summary>Actualicé las planillas, ¿por qué sigo viendo lo mismo?</summary><p>El panel consulta una publicación generada por el actualizador. Cambiar Excel no modifica la página abierta: ejecuta <b>Actualizar panel.bat</b> en Windows o <b>Actualizar panel.command</b> en Mac, comprueba el mensaje de éxito y recarga la publicación. Revisa que estés abriendo la copia recién generada.</p><button class="btn" type="button" data-ir-diccionario="dic-actualizar">Ver el procedimiento →</button></details>
        </div>
      </section>
    </div>
    <div id="dic-panel-actualizar" role="tabpanel" aria-labelledby="dic-tab-actualizar" tabindex="0" hidden>
      <section class="tarjeta dic-seccion" aria-labelledby="dic-actualizar">
        <div class="titulo"><h2 id="dic-actualizar" tabindex="-1">Actualiza las fuentes y vuelve a publicar</h2></div>
        <div class="dic-contenido" data-dic-articulo="Actualizar compras OC, IG o proyección" data-dic-destino="dic-actualizar" data-dic-categoria="Actualizar datos">
          <ol class="dic-flujo"><li><b>Prepara los archivos</b><span>Compras: un export vigente por mes. IG: acumulado. Proyección: versión vigente.</span></li><li><b>Ejecuta el actualizador</b><span>Windows: Actualizar panel.bat.<br>Mac: Actualizar panel.command.</span></li><li><b>Comprueba y recarga</b><span>Espera PANEL ACTUALIZADO CORRECTAMENTE. Luego recarga y concilia el mes.</span></li></ol>
          <p class="dic-aviso">Puedes cambiar varias fuentes y ejecutar una sola actualización. Para compartir el resultado, entrega la portada junto con las carpetas <b>web</b> y <b>app</b> de esa misma publicación.</p>
        </div>
      </section>
''' + publicacion + '\n' + actualizacion + '\n' + fuentes + '''
    </div>
  </section>
'''

inicio = html.index('  <section id="vistaDiccionario"')
fin = html.index('<!-- FIN VISTA -->', inicio)
path.write_text(html[:inicio] + guia + html[fin:], encoding='utf-8')
print('Guía organizada en cuatro secciones con búsqueda y ayuda por tarea.')
