const {chromium}=require('C:/Users/fperezh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url'),http=require('node:http');
const root=path.resolve(__dirname,'../../..'),out=path.join(__dirname,'verificacion');
fs.mkdirSync(out,{recursive:true});
const clave=fs.readFileSync(path.join(root,'motor/clave.txt'),'utf8').trim();
const campos=['fPeriodo','fZona','fUnidad','fLinea','fDetalle'];
const seleccion=page=>page.evaluate(ids=>ids.map(id=>document.getElementById(id).value),campos);
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,''));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  const tipos={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png'};
  res.writeHead(200,{'Content-Type':tipos[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
async function abrir(page,url){
  await page.goto(url);await page.locator('#gatePass').fill(clave);await page.locator('#gateBtn').click();
  await page.locator('#gate').waitFor({state:'detached'});
}
async function sinDesborde(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
async function lista(page,archivo){
  await page.waitForURL(url=>url.pathname.endsWith('/'+archivo));
  await page.locator('#gate').waitFor({state:'detached'});
  await page.waitForFunction(()=>document.getElementById('fPeriodo')?.value&&document.getElementById('tarjetasResumen')?.childElementCount===5);
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const previo=path.join(root,'motor/respaldos/portal_tres_vistas_20261014/app/panel.js');
    const blob=file=>fs.readFileSync(file,'utf8').match(/^const CIFRADO = (.*?);/)[1];
    if(fs.existsSync(previo))assert.equal(blob(path.join(root,'app/panel.js')),blob(previo));
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'motor/data/data.json'))).digest('hex').toUpperCase(),'88A9617F14ADAAC4E68CFE41A9C8FCFDA52681C4EF9EF78FD202BCEBEDC8607F');
    for(const modo of ['local','http']){
      const context=await browser.newContext({viewport:{width:1440,height:1050}}),page=await context.newPage(),errors=[];
      page.on('pageerror',e=>{errors.push(e.message);console.error('Error de página:',e.message);});
      page.on('console',msg=>{if(msg.type()==='error'&&!msg.text().includes('404'))errors.push(msg.text());});
      const base=modo==='local'?pathToFileURL(root+path.sep).href:`http://127.0.0.1:${server.address().port}/`;
      await abrir(page,new URL('web/pages/Panel_Reporte_Costos.html',base).href);
      assert.equal(await page.locator('.barra').isVisible(),true);
      await page.locator('#fPeriodo').selectOption('2026-09');
      await page.locator('#fZona').selectOption('Zona 1 + 2');await page.locator('#fUnidad').selectOption({index:1});
      const filtros=await seleccion(page),total=await page.locator('#pie tr').first().locator('td').allTextContents();
      await page.locator('#vista-diccionario').click();await lista(page,'Panel_Diccionario.html');
      assert.equal(await page.locator('.barra').isVisible(),false);
      assert.equal(await page.locator('.barra').getAttribute('inert'),'');
      assert.equal(await page.locator('select:visible').count(),0);
      assert.deepEqual(await seleccion(page),filtros);
      assert.equal(await page.locator('[role=tabpanel]:visible').count(),1);
      assert.equal(await page.locator('#dic-panel-uso').isVisible(),true);
      await sinDesborde(page);
      if(modo==='local')await page.screenshot({path:path.join(out,'inicio-escritorio.png'),fullPage:true});

      // Pestañas con teclado y estado accesible; ningún filtro recibe el foco.
      await page.locator('#dic-tab-uso').focus();await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('#dic-tab-terminos').getAttribute('aria-selected'),'true');
      assert.equal(await page.locator('#dicTerminos .dic-termino').count(),20);
      await page.locator('#dicExpandirTerminos').click();
      assert.equal(await page.locator('#dicTerminos details[open]').count(),20);
      await page.locator('#dicExpandirTerminos').click();
      assert.equal(await page.locator('#dicTerminos details[open]').count(),0);
      await page.locator('#dicTerminos summary').first().focus();await page.keyboard.press('Enter');
      assert.equal(await page.locator('#dicTerminos details[open]').count(),1);

      // La búsqueda abarca términos, procedimientos, respuestas y fuentes.
      for(const consulta of ['depreciacion','IG pendiente','descargas','FECHACREACION','CONCEPTOIMPUTACION']){
        await page.locator('#dicBuscar').fill(consulta);
        assert.ok(await page.locator('.dic-resultado').count()>0,consulta);
      }
      await page.locator('#dicBuscar').fill('zzsincoincidenciaszz');assert.equal(await page.locator('#dicVacio').isVisible(),true);
      await page.locator('#dicBuscar').fill('   ');assert.equal(await page.locator('#dicBusquedaResultados').isVisible(),false);
      await page.locator('#dicBuscar').fill('diferencia');await page.keyboard.press('Escape');
      assert.equal(await page.locator('#dicBuscar').inputValue(),'');
      await page.locator('#dicBuscar').fill('IG pendiente');
      await page.locator('#dicCoincidencias [data-ir-diccionario="dic-duda-ig"]').click();
      assert.equal(await page.locator('#dic-panel-dudas').isVisible(),true);
      assert.equal(await page.locator('#dic-duda-ig').getAttribute('open'),'');
      await page.locator('#dic-duda-ig button').click();
      assert.equal(await page.locator('#dic-panel-actualizar').isVisible(),true);
      assert.equal(await page.evaluate(()=>document.activeElement.id),'dic-ig');
      assert.match(await page.locator('#dicEstado').innerText(),/IG reconocido hasta/);
      assert.match(await page.locator('#dicEjemploIg').innerText(),/sep-26/);
      if(modo==='local')await page.screenshot({path:path.join(out,'actualizar-escritorio.png')});

      // Un resultado en una tabla abre también su contenedor contraído.
      await page.locator('#dicBuscar').fill('Diccionario de clasificación OC');
      const fuente=page.locator('#dicCoincidencias .dic-resultado').filter({hasText:'Fuentes'}).first();
      await fuente.click();assert.equal(await page.locator('.dic-fuentes-detalle').getAttribute('open'),'');
      assert.equal(await page.locator('#dic-panel-actualizar').isVisible(),true);
      assert.equal(await page.evaluate(()=>document.activeElement.tagName),'TR');

      // El cálculo usa exactamente el total filtrado del reporte.
      await page.locator('#dicBuscar').fill('Cómo se calcula mi selección');await page.keyboard.press('Enter');
      assert.equal(await page.locator('#dic-panel-terminos').isVisible(),true);
      assert.equal(await page.locator('#dicVerCalculo').getAttribute('open'),'');
      assert.match(await page.locator('#dicSeleccion').innerText(),/sep-26 · Zona 1 \+ 2/);
      assert.ok((await page.locator('#dicCalculo dd').first().innerText()).includes(total[1]));
      await page.locator('#dicVolverReporte').click();await lista(page,'Panel_Reporte_Costos.html');
      assert.equal(await page.locator('.barra').isVisible(),true);
      assert.deepEqual(await seleccion(page),filtros);
      assert.deepEqual(await page.locator('#pie tr').first().locator('td').allTextContents(),total);

      // Acceso contextual desde el aviso IG, recarga y navegación por gráfico.
      await page.locator('#limpiarFiltros').click();
      if(await page.locator('#ayudaIg').isVisible()){
        await page.locator('#ayudaIg button').click();await lista(page,'Panel_Diccionario.html');
        assert.equal(await page.locator('#dic-panel-actualizar').isVisible(),true);
        assert.equal(await page.evaluate(()=>document.activeElement.id),'dic-ig');
        await page.reload();await lista(page,'Panel_Diccionario.html');
        assert.equal(await page.locator('#dic-panel-actualizar').isVisible(),true);
      }
      await page.locator('#vista-graficos').click();await lista(page,'Panel_Proyectado_Real.html');
      assert.equal(await page.locator('.barra').isVisible(),true);
      assert.ok(await page.locator('.marca-mensual').count()>0);
      await page.locator('#vista-diccionario').click();await lista(page,'Panel_Diccionario.html');

      for(const width of [390,768,1440]){
        await page.setViewportSize({width,height:900});
        for(const tab of ['uso','terminos','dudas','actualizar']){
          await page.locator('#dic-tab-'+tab).click();await sinDesborde(page);
          assert.equal(await page.locator('[role=tabpanel]:visible').count(),1);
          if(modo==='local'&&(width===390||width===1440)&&tab==='uso')await page.screenshot({path:path.join(out,`uso-${width}.png`),fullPage:true});
        }
        await page.locator('#dicBuscar').fill('IG');await sinDesborde(page);
        await page.locator('#dicLimpiarBusqueda').click();
        assert.equal(await page.evaluate(()=>document.activeElement.id),'dicBuscar');
      }
      await page.locator('#dic-tab-dudas').click();await page.locator('#dic-duda-comparable summary').click();
      if(modo==='local')await page.screenshot({path:path.join(out,'dudas-escritorio.png'),fullPage:true});
      await page.locator('header [data-control-tema]').click();
      assert.equal(await page.locator('html').getAttribute('data-tema'),'oscuro');
      for(const tab of ['uso','terminos','dudas','actualizar']){await page.locator('#dic-tab-'+tab).click();await sinDesborde(page);}
      await page.locator('#dic-tab-uso').click();
      if(modo==='local')await page.screenshot({path:path.join(out,'oscuro-escritorio.png'),fullPage:true});
      assert.deepEqual(errors,[]);await context.close();
      console.log(`OK ${modo}: filtros ocultos, 4 secciones, búsqueda global, fuentes, enlaces contextuales, teclado, cálculo y retorno con filtros, gráfico, 390/768/1440 px, tema oscuro y consola limpia.`);
    }
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
