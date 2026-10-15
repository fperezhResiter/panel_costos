const {chromium}=require('C:/Users/fperezh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
(async()=>{
const browser=await chromium.launch({headless:true,downloadsPath:path.resolve("panel_costos/motor/respaldos/formato_20261014"),executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(pathToFileURL(path.resolve('panel_costos/Panel Costos Resiter.html')).href);
await page.locator('#gatePass').fill(fs.readFileSync('panel_costos/motor/clave.txt','utf8').trim());
await page.locator('#gateBtn').click();await page.locator('#gate').waitFor({state:'detached'});
await page.screenshot({path:'panel_costos/motor/respaldos/formato_20261014/escritorio.png',fullPage:true});
const total=await page.locator('#pie').innerText();
await page.locator('#expandir').click();if(await page.locator('#pie').innerText()!==total)throw Error('Expansión altera totales');
await page.locator('#colapsar').click();if(await page.locator('#pie').innerText()!==total)throw Error('Contracción altera totales');
await page.locator('#fZona').selectOption({label:'Zona 1'});
await page.locator('#fUnidad').selectOption({index:1});
const contracts=page.locator('#cuerpo .clk');
if(await contracts.count()) {
 await contracts.first().click();await page.locator('#modalBg').waitFor({state:'visible'});
 await page.screenshot({path:'panel_costos/motor/respaldos/formato_20261014/detalle.png'});
 if(await page.locator('#mBody table').count()===0)throw Error('Modal vacío');
 await page.evaluate(()=>{const original=URL.createObjectURL;window.exportSizes=[];URL.createObjectURL=blob=>{window.exportSizes.push(blob.size);return original(blob)};});
 for(const id of ['mDescargarExcel','mReporteCosto'])if(await page.locator('#'+id).isEnabled()) {
  const download=page.waitForEvent('download');await page.locator('#'+id).click();
  const result=await download;console.log('Exportación '+id+': archivo generado; estado de guardado en navegador de prueba = '+(await result.failure()||'OK'));
 }
 const sizes=await page.evaluate(()=>window.exportSizes);if(sizes.length!==2||sizes.some(s=>s<1000))throw Error('Exportaciones sin contenido');
 await page.locator('#mCerrar').click();
}
await page.locator('#fZona').selectOption('');
await page.locator('#fUnidad').selectOption('');
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:'panel_costos/motor/respaldos/formato_20261014/movil.png',fullPage:true});
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
if(overflow)throw Error('Página móvil desborda');
await page.locator('header [data-control-tema]').click();
await page.screenshot({path:'panel_costos/motor/respaldos/formato_20261014/oscuro.png',fullPage:true});
console.log(JSON.stringify({errors,mobileOverflow:overflow,checks:'Acceso cifrado, expansión, filtros, detalle, ambas descargas, escritorio, móvil y modo oscuro'}));
if(errors.length)throw Error(errors.join('\n'));
await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});


