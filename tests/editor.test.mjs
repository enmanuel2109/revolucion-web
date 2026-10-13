import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GitHubClient, API, safeURL, utf8Base64, decodeBase64, validateContent, miamiTimestamp, fileName } from '../public_html/admin/core.mjs';

const schema = JSON.parse(await readFile(new URL('../public_html/admin/schema.json',import.meta.url),'utf8'));
const content = JSON.parse(await readFile(new URL('../content/site.json',import.meta.url),'utf8'));

test('El contenido y los acentos conservan su codificación',()=>{
 assert.equal(decodeBase64(utf8Base64('España · ¡R-evolución! 🎉')),'España · ¡R-evolución! 🎉');
 assert.equal(validateContent(schema,content),true);
});
test('Solo se aceptan enlaces y recursos admitidos',()=>{
 for(const v of ['https://example.com','tel:+14075358668','mailto:test@example.com','#programa'])assert.equal(safeURL(v),true,v);
 for(const v of ['javascript:alert(1)','data:text/html,evil','//evil.example','assets/../secreto','https://user:pass@example.com/a.jpg'])assert.equal(safeURL(v,true),false,v);
 assert.equal(safeURL('assets/uploads/prueba.jpg',true),true);
 assert.equal(safeURL('https://example.com/v.mp4',true),true);
});
test('La hora de Miami respeta verano, invierno y fechas imposibles',()=>{
 assert.equal(new Date(miamiTimestamp('2026-10-26T10:00')).toISOString(),'2026-10-26T14:00:00.000Z');
 assert.equal(new Date(miamiTimestamp('2026-12-20T10:00')).toISOString(),'2026-12-20T15:00:00.000Z');
 assert.throws(()=>miamiTimestamp('2026-02-30T10:00'));
 assert.throws(()=>miamiTimestamp('2027-03-14T02:30'));
});
test('Los nombres de archivo no pueden escapar del directorio de subidas',()=>{
 const path=fileName('../../Fotografía<script>.jpg','abc123');
 assert.match(path,/^assets\/uploads\/abc123-[a-zA-Z0-9._-]+$/);
 assert.ok(!path.includes('../'));
});

function server({conflict=false,lateConflict=false,failUpload=false,unauthorized=false}={}){
 const calls=[];let reads=0;let switched=false;
 const transport=async (url,options)=>{
  assert.ok(url.startsWith(API+'/'));assert.equal(options.headers.Authorization,'Bearer TEST_ONLY');
  const path=url.slice(API.length+1),method=options.method,body=options.body?JSON.parse(options.body):null;
  calls.push({path,method,body});let data={};
  if(unauthorized)return new Response('{}',{status:401});
  if(path==='git/ref/heads/main'){reads++;data={object:{sha:lateConflict&&reads>1?'another-head':'head'}};}
  else if(path.startsWith('contents/content/site.json'))data={sha:conflict?'new-content':'old-content'};
  else if(path==='git/commits/head')data={tree:{sha:'old-tree'}};
  else if(path==='git/blobs'){
   if(failUpload)return new Response('{}',{status:500});
   data={sha:body.encoding==='utf-8'?'content-blob':'file-blob'};
  }else if(path==='git/trees'){assert.equal(body.base_tree,'old-tree');data={sha:'next-tree'};}
  else if(path==='git/commits'){assert.deepEqual(body.parents,['head']);data={sha:'next-commit'};}
  else if(path==='git/refs/heads/main'){assert.equal(method,'PATCH');assert.equal(body.force,false);switched=true;data={};}
  else throw new Error('Ruta inesperada: '+path);
  return new Response(JSON.stringify(data),{status:200});
 };
 return {transport,calls,get switched(){return switched;}};
}
test('Publicar guarda contenido y recursos juntos en un único commit',async()=>{
 const s=server();const client=new GitHubClient('TEST_ONLY',s.transport);
 const result=await client.publish(content,'old-content',[{path:'assets/uploads/image.jpg',base64:'aGVsbG8='}]);
 assert.equal(result.contentSHA,'content-blob');assert.equal(result.commit,'next-commit');assert.equal(s.switched,true);
 const tree=s.calls.find(c=>c.path==='git/trees').body.tree;
 assert.deepEqual(tree.map(e=>e.path),['public_html/assets/uploads/image.jpg','content/site.json']);
 assert.equal(s.calls.filter(c=>c.path==='git/refs/heads/main').length,1);
 assert.ok(!JSON.stringify(s.calls).includes('TEST_ONLY'));
});
test('Un conflicto de contenido bloquea la publicación antes de escribir',async()=>{
 const s=server({conflict:true});const c=new GitHubClient('TEST_ONLY',s.transport);
 await assert.rejects(c.publish(content,'old-content'),/Otra persona/);
 assert.equal(s.switched,false);assert.ok(s.calls.every(c=>c.method==='GET'));
});
test('Un cambio simultáneo en la rama no se sobrescribe',async()=>{
 const s=server({lateConflict:true});const c=new GitHubClient('TEST_ONLY',s.transport);
 await assert.rejects(c.publish(content,'old-content'),/repositorio ha cambiado/);assert.equal(s.switched,false);
});
test('Una subida fallida no publica contenido incompleto',async()=>{
 const s=server({failUpload:true});const c=new GitHubClient('TEST_ONLY',s.transport);
 await assert.rejects(c.publish(content,'old-content',[{path:'assets/uploads/image.jpg',base64:'aGVsbG8='}]));
 assert.equal(s.switched,false);assert.ok(!s.calls.some(c=>c.path==='git/trees'));
});
test('La sesión rechaza credenciales inválidas y no puede usarse al cerrarla',async()=>{
 const s=server({unauthorized:true});const c=new GitHubClient('TEST_ONLY',s.transport);
 await assert.rejects(c.publish(content,'old-content'),/clave no es válida/);
 c.clear();await assert.rejects(c.publish(content,'old-content'),/Conecta tu acceso/);
});
