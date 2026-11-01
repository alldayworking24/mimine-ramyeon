import {mkdir,copyFile,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const file of ['index.html','layout-v2.js','layout-v2.css','allbase-connect.html','allbase-route.js','forecast.js','finance-core.js','finance-suite.js','finance-suite.css','apple-touch-icon.png','favicon-32.png','icon-192.png','icon-512.png','manifest.webmanifest','mimine-face-logo.png','mimine-logo.png','_headers','_redirects'])await copyFile(file,'dist/'+file);
