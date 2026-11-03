import {mkdir,copyFile,rm,readFile,writeFile,cp} from 'node:fs/promises';
import {prepareBrowserVendors} from './vendor-build.mjs';
await prepareBrowserVendors();
await rm('dist',{recursive:true,force:true});await mkdir('dist');
const assets=['layout-v2.js','layout-v2.css','allbase-connect.html','allbase-route.js','forecast.js','finance-core.js','finance-suite.js','finance-suite.css','apple-touch-icon.png','favicon-32.png','icon-192.png','icon-512.png','manifest.webmanifest','mimine-face-logo.png','mimine-logo.png','_headers','_redirects'];
for(const file of assets)await copyFile(file,'dist/'+file);
const providers=await Promise.all(['data-client.js','auth.js'].map(file=>readFile('flow/'+file,'utf8')));
const previewProvider=await readFile('flow/preview-provider.js','utf8');
const modules=['app.js','analytics.js','interactions.js','bank-automation.js','stock-receipts.js','production-runtime.js','button-icons.js','mobile-navigation.js'];
const body=(await Promise.all(modules.map(file=>readFile('flow/'+file,'utf8')))).join('\n');
function boot(mockup=false){
 const entry=mockup?`let parentBridge;try{if(parent!==window&&parent.location.origin===location.origin&&parent.MimineBridge?.isDemo)parentBridge=parent.MimineBridge;}catch{}bootBridge=parentBridge||createMiminePreviewProvider();`:'bootBridge=await createMimineAuthenticatedBridge();';
 return `;(async()=>{${mockup?previewProvider:''}\n${providers.join('\n')}\nlet bootBridge;try{${entry}window.MimineBridge=bootBridge;const note=document.getElementById('local-preview-note');note.hidden=!bootBridge.isDemo;document.getElementById('preview-exit').onclick=()=>location.assign(isMimineLocalDocument()?'https://mimine-ramyeon.netlify.app/':new URL('index.html',location.href).href);}catch(error){document.getElementById('auth-message').textContent=error.message;return;}const productionToday=bootBridge.today();let productionSnapshot;try{productionSnapshot=await bootBridge.snapshot();}catch(error){document.body.classList.remove('auth-loading');document.getElementById('main').innerHTML='<div class="boot-error"><h1>운영 데이터를 불러오지 못했어요.</h1><p></p><button>다시 시도</button></div>';document.querySelector('.boot-error p').textContent=error.message;document.querySelector('.boot-error button').onclick=()=>location.reload();return;}document.body.classList.remove('auth-loading');\n${body}\n})();`;
}
const logo='data:image/png;base64,'+(await readFile('flow/brand.png')).toString('base64');
const adwBrand=JSON.parse(await readFile('flow/adw-brand.json','utf8'));
const adwLogo='data:'+adwBrand.mimeType+';base64,'+adwBrand.base64;
const css=await readFile('flow/style.css','utf8');
const template=await readFile('flow/template.html','utf8');
const render=mockup=>template.replace('/*__CSS__*/',()=>css).replace('/*__JS__*/',()=>boot(mockup)).replaceAll('__LOGO__',logo).replaceAll('__ADW_LOGO__',adwLogo);
const html=render(false);
// Root and publish output are the exact same new application, never a legacy shell.
await writeFile('index.html',html);await writeFile('dist/index.html',html);
// Downloadable mockups are separate from the operational publish directory.
await writeFile('mockup.html',render(true));
await cp('legacy','dist/legacy',{recursive:true});
await cp('flow/vendor','dist/flow/vendor',{recursive:true});
if(process.argv.includes('--preview')){
 await writeFile('dist/mockup.html',render(true));
 await cp('preview','dist/preview',{recursive:true});
 await copyFile('flow/preview-provider.js','dist/preview/preview-provider.js');
}
console.log('Built matching root index.html and dist/index.html.');
