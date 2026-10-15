// Ejecutar desde la carpeta que contiene panel_costos.
const {chromium}=require('C:/Users/fperezh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),http=require('node:http');
const root=path.resolve(__dirname,'..'),out=path.join(root,'motor/respaldos/portal_tres_vistas_20261014/verificacion');
const home=path.join(root,'Panel Costos Resiter.html');
const clave=fs.readFileSync(path.join(root,'motor/clave.txt'),'utf8').trim();
const campos=['fPeriodo','fZona','fUnidad','fLinea','fDetalle'];
const leerFiltros=page=>page.evaluate(ids=>ids.map(id=>document.getElementById(id).value),campos);
const sinDesborde=async page=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
const server=http.createServer((req,res)=>{
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'');
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  const tipos={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png'};
  res.writeHead(200,{'Content-Type':tipos[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const blob=file=>JSON.parse(fs.readFileSync(file,'utf8').match(/^const CIFRADO = (.*?);/)[1]);
    const anterior=path.join(out,'../app/panel.js');
    if(fs.existsSync(anterior))assert.deepEqual(blob(path.join(root,'app/panel.js')),blob(anterior));
    for(const modo of ['local','http']){
      const context=await browser.newContext({viewport:{width:1440,height:1050},acceptDownloads:true});
      const page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('dialog',async dialog=>{errors.push(dialog.message());await dialog.dismiss();});
      page.on('console',msg=>{if(msg.type()==='error'&&!msg.text().includes('404'))errors.push(msg.text());});
      const url=modo==='local'?pathToFileURL(home).href:`http://127.0.0.1:${server.address().port}/Panel%20Costos%20Resiter.html`;
      await page.goto(url);
      assert.equal(await page.locator('.panel-enlace').count(),3);
      assert.equal(await page.locator('#gate').count(),0);
      assert.equal(await page.locator('header .logo').evaluate(img=>img.complete&&img.naturalWidth>0),true);
      await sinDesborde(page);
      if(modo==='local')await page.screenshot({path:path.join(out,'inicio-escritorio.png'),fullPage:true});
      await page.setViewportSize({width:390,height:844});await sinDesborde(page);
      if(modo==='local')await page.screenshot({path:path.join(out,'inicio-movil.png'),fullPage:true});
      await page.setViewportSize({width:1440,height:1050});
      await page.locator('.panel-enlace').first().click();
      await page.waitForURL(/Panel_Reporte_Costos\.html/);
      await page.locator('#gatePass').fill('prueba-invalida');await page.locator('#gateBtn').click();
      await page.locator('#gateErr').filter({hasText:'Contraseña incorrecta.'}).waitFor();
      await page.locator('#gatePass').fill(clave);await page.locator('#gateBtn').click();
      await page.locator('#gate').waitFor({state:'detached'});
      assert.equal(await page.locator('#reporteCostos').count(),1);
      assert.equal(await page.locator('#vistaGraficos,#vistaDiccionario').count(),0);
      await page.locator('#fZona').selectOption('Zona 1 + 2');
      await page.locator('#fUnidad').selectOption({index:1});
      const linea=await page.locator('#fLinea option:not([disabled])').nth(1).getAttribute('value');
      // Las opciones de línea usan el texto como valor.
      await page.locator('#fLinea').selectOption(linea||{label:await page.locator('#fLinea option:not([disabled])').nth(1).textContent()});
      const filtros=await leerFiltros(page),tarjetas=await page.locator('#tarjetasResumen').innerText();
      await page.locator('#expandir').click();assert.equal(await page.locator('#tarjetasResumen').innerText(),tarjetas);
      await page.locator('#vista-graficos').click();await page.waitForURL(/Panel_Proyectado_Real\.html/);
      await page.locator('#gate').waitFor({state:'detached'});
      assert.deepEqual(await leerFiltros(page),filtros);
      assert.equal(await page.locator('#tarjetasResumen').innerText(),tarjetas);
      assert.equal(await page.locator('#reporteCostos,#vistaDiccionario').count(),0);
      assert.ok(await page.locator('.marca-mensual').count()>0);
      assert.equal(await page.locator('#descargarPdfMensual').isVisible(),true);
      await page.locator('#detalleMesGrafico').click();
      assert.equal(await page.locator('#modalBg').evaluate(el=>el.classList.contains('on')),true);
      assert.ok(await page.locator('#mBody table').count()>0);await page.locator('#mCerrar').click();
      await page.evaluate(()=>{const crear=URL.createObjectURL;URL.createObjectURL=blob=>{window.pdfGenerado=blob;return crear(blob);};});
      const descargar=page.waitForEvent('download');await page.locator('#descargarPdfMensual').click();
      const pdf=await descargar;assert.ok(pdf.suggestedFilename().endsWith('.pdf'));
      // Chromium administrado puede cancelar el guardado automático; verificar
      // también los bytes del mismo Blob que recibe el enlace de descarga.
      fs.writeFileSync(path.join(out,`mensual-${modo}.pdf`),Buffer.from(await page.evaluate(async()=>Array.from(new Uint8Array(await window.pdfGenerado.arrayBuffer())))));
      assert.equal(fs.readFileSync(path.join(out,`mensual-${modo}.pdf`)).subarray(0,5).toString(),'%PDF-');
      await page.locator('#vista-diccionario').click();await page.waitForURL(/Panel_Diccionario\.html/);
      await page.locator('#gate').waitFor({state:'detached'});
      assert.deepEqual(await leerFiltros(page),filtros);
      assert.equal(await page.locator('#reporteCostos,#vistaGraficos').count(),0);
      assert.ok(await page.locator('#dicTerminos .dic-termino').count()>0);
      await page.locator('#dicBuscar').fill('IG');assert.ok(await page.locator('#dicTerminos .dic-termino:visible').count()>0);
      await page.locator('.dic-atajos [data-ir-diccionario="dic-ig"]').click();
      assert.equal(await page.locator('#dic-ig').evaluate(el=>el===document.activeElement),true);
      await page.locator('.volver-inicio').click();await page.waitForURL(/Panel%20Costos%20Resiter\.html/);
      await page.locator('.panel-enlace').nth(1).click();await page.waitForURL(/Panel_Proyectado_Real\.html/);
      await page.locator('#gate').waitFor({state:'detached'});assert.deepEqual(await leerFiltros(page),filtros);
      await page.locator('#limpiarFiltros').click();
      await page.locator('#vista-reporte').click();await page.locator('#gate').waitFor({state:'detached'});
      if(await page.locator('.enlace-diccionario').isVisible()){
        await page.locator('.enlace-diccionario').click();await page.waitForURL(/Panel_Diccionario\.html.*#dic-ig$/);
        await page.locator('#gate').waitFor({state:'detached'});
        assert.equal(await page.locator('#dic-ig').evaluate(el=>el===document.activeElement),true);
      }
      for(const id of ['vista-reporte','vista-graficos','vista-diccionario']){
        await page.locator('#'+id).click();await page.locator('#gate').waitFor({state:'detached'});
        await page.setViewportSize({width:390,height:844});await sinDesborde(page);
        if(modo==='local')await page.screenshot({path:path.join(out,id+'-movil.png'),fullPage:true});
        await page.setViewportSize({width:1440,height:1050});
      }
      assert.deepEqual(errors,[]);await context.close();
      console.log(`OK ${modo}: tres HTML, acceso, filtros, navegación, detalle, PDF y móvil.`);
    }
    const aislado=await browser.newContext();
    const page=await aislado.newPage();await page.goto(pathToFileURL(path.join(root,'web/pages/Panel_Diccionario.html')).href);
    assert.equal(await page.locator('#gate').isVisible(),true);await aislado.close();
    console.log('OK: datos cifrados idénticos y acceso requerido en una sesión nueva.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
