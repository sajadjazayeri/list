// Local static preview. Production deploys public/ directly to Cloudflare Pages.
import http from 'node:http';
import { readFileSync } from 'node:fs';
const files={'/':'index.html','/style.css':'style.css','/app.js':'app.js','/cloud.js':'cloud.js','/config.js':'config.js','/manifest.webmanifest':'manifest.webmanifest','/icon.svg':'icon.svg','/sw.js':'sw.js','/apple-touch-icon.png':'apple-touch-icon.png','/icon-192.png':'icon-192.png','/icon-512.png':'icon-512.png'};
const types={png:'image/png',html:'text/html',css:'text/css',js:'application/javascript',svg:'image/svg+xml',webmanifest:'application/manifest+json'};
const headers={};
for(const line of readFileSync(new URL('./public/_headers',import.meta.url),'utf8').split('\n')){if(!line.startsWith('  '))continue;const colon=line.indexOf(':');headers[line.slice(0,colon).trim()]=line.slice(colon+1).trim();}
http.createServer((req,res)=>{
 const file=files[new URL(req.url,'http://localhost').pathname];
 if(!['GET','HEAD'].includes(req.method)||!file){res.writeHead(404,headers);return res.end('Not found');}
 try{res.writeHead(200,{...headers,'Content-Type':types[file.split('.').pop()]});res.end(req.method==='HEAD'?undefined:readFileSync(new URL('./public/'+file,import.meta.url)));}
 catch{res.writeHead(500);res.end('Unable to serve this file.');}
}).listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('little us is listening on port '+(process.env.PORT||3000)));
