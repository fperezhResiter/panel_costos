const {chromium}=require('C:/Users/fperezh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url');
(async()=>{
const out='panel_costos/motor/respaldos/pdf_mensual_20261014';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{const page=await browser.newPage({viewport:{width:1440,height:1050},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{errors.push(d.message());await d.dismiss();});
await page.goto(pathToFileURL(path.resolve('panel_costos/web/pages/Panel_Reporte_Costos.html')).href);
await page.locator('#gatePass').fill(fs.readFileSync('panel_costos/motor/clave.txt','utf8').trim());await page.locator('#gateBtn').click();await page.locator('#gate').waitFor({state:'detached'});
assert.equal(await page.locator('#descargarPdfMensual').isVisible(),false);
await page.locator('#vista-graficos').click();await page.locator('#graficoMensual svg').waitFor();assert.equal(await page.locator('#descargarPdfMensual').isVisible(),true);
await page.evaluate(()=>{const original=URL.createObjectURL;URL.createObjectURL=b=>{window.pdfGenerado=b;return original(b);};});
let download=page.waitForEvent('download');await page.locator('#descargarPdfMensual').click();assert.ok((await download).suggestedFilename().endsWith('.pdf'));await page.waitForFunction(()=>document.getElementById('descargarPdfMensual').disabled===false);fs.writeFileSync(out+'/general.pdf',Buffer.from(await page.evaluate(async()=>Array.from(new Uint8Array(await window.pdfGenerado.arrayBuffer())))));
await page.locator('#fZona').selectOption('Zona 1 + 2');await page.locator('#fUnidad').selectOption({index:1});await page.locator('#fLinea').selectOption({index:1});
const expected=await page.locator('#tablaMensual').innerText();fs.writeFileSync(out+'/valores.txt',expected);
await page.locator('header [data-control-tema]').click();await page.locator('.marca-mensual').first().hover();
download=page.waitForEvent('download');await page.locator('#descargarPdfMensual').click();assert.ok((await download).suggestedFilename().endsWith('.pdf'));await page.waitForFunction(()=>document.getElementById('descargarPdfMensual').disabled===false);fs.writeFileSync(out+'/filtrado.pdf',Buffer.from(await page.evaluate(async()=>Array.from(new Uint8Array(await window.pdfGenerado.arrayBuffer())))));
await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:out+'/movil.png',fullPage:true});
await page.locator('#vista-reporte').click();await page.locator('#gate').waitFor({state:'detached'});assert.equal(await page.locator('#descargarPdfMensual').isVisible(),false);
assert.deepEqual(errors,[]);console.log('OK: descargas general y filtrada; botón exclusivo del gráfico; móvil y tema oscuro sin errores.');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
