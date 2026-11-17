import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import QRCode from 'qrcode';
import { createCaptureRouter, capturePages, captureImportState, type CaptureSession, type CaptureStorage, CaptureError } from '../capture.js';

class MemoryStorage implements CaptureStorage {
  states = new Map<string,{session:CaptureSession;version:string}>();
  photos = new Map<string,Uint8Array>();
  n=0;
  async read(id:string) { const r=this.states.get(id); return r ? structuredClone(r) : null; }
  async write(session:CaptureSession,version?:string) {
    const old=this.states.get(session.id);
    if (version ? old?.version!==version : old) throw new CaptureError(409,'STATE_CONFLICT','conflict');
    this.states.set(session.id,{session:structuredClone(session),version:String(++this.n)});
  }
  async putPhoto(path:string,bytes:Uint8Array) { this.photos.set(path,bytes); }
  async photo(path:string) { return this.photos.get(path)||null; }
  async removePhoto(path:string) { this.photos.delete(path); }
}

test('paired camera session keeps credentials separate, signals ordered and photos private',async t=>{
  const storage=new MemoryStorage();
  const app=express();app.use('/api/capture',createCaptureRouter({storage}));
  const server=app.listen(0,'127.0.0.1');
  await new Promise<void>(r=>server.once('listening',r));
  t.after(()=>{server.closeAllConnections();server.close();});
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/capture`;
  const call=(path:string,token?:string,method='GET',body?:unknown)=>fetch(base+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const created=await call('/sessions',undefined,'POST',{});assert.equal(created.status,201);
  const session=await created.json();
  const phone=new URLSearchParams(new URL(session.phoneUrl).hash.slice(1)).get('token')!;
  assert.notEqual(session.hostToken,phone);
  const state=await(await call(`/sessions/${session.id}`,phone)).json();
  assert.equal(state.status,'waiting');assert.ok(!('hostHash' in state));assert.ok(!JSON.stringify(state).includes(session.hostToken));
  assert.equal((await call(`/sessions/${session.id}`)).status,404);
  assert.equal((await call(`/sessions/${session.id}/signals`,phone,'POST',{type:'offer',data:{sdp:'wrong'}})).status,403);
  await Promise.all(Array.from({length:8},(_,n)=>call(`/sessions/${session.id}/signals`,phone,'POST',{type:n?'ice':'ready',data:{candidate:`candidate-${n}`}})));
  const signals=await(await call(`/sessions/${session.id}/signals?after=0`,session.hostToken)).json();
  assert.equal(signals.messages.length,8);assert.deepEqual(signals.messages.map((s:{id:number})=>s.id),[1,2,3,4,5,6,7,8]);
  const own=await(await call(`/sessions/${session.id}/signals?after=0`,phone)).json();assert.equal(own.messages.length,0);
  const png=await QRCode.toDataURL('Policy Lens source photo',{width:128});
  const uploaded=await call(`/sessions/${session.id}/pages`,phone,'POST',{dataUrl:png,name:'保單第一頁'});assert.equal(uploaded.status,201);
  const page=await uploaded.json();assert.equal(page.width,128);assert.ok(!('path' in page));
  assert.equal((await call(`/sessions/${session.id}/pages/${page.id}`)).status,404);
  const image=await call(`/sessions/${session.id}/pages/${page.id}`,session.hostToken);assert.equal(image.status,200);assert.match(image.headers.get('content-type')!,/image\/png/);
  const imported=await capturePages(session.id,session.hostToken,storage);assert.equal(imported.length,1);assert.ok(imported[0].bytes.length>0);
  await assert.rejects(capturePages(session.id,phone,storage),/電腦端/);
  assert.equal((await call(`/sessions/${session.id}/pages`,session.hostToken,'POST',{dataUrl:png})).status,403);
  assert.equal((await call(`/sessions/${session.id}/pages`,phone,'POST',{dataUrl:'data:image/png;base64,AAAA'})).status,415);
  assert.equal((await call(`/sessions/${session.id}/pages/${page.id}`,phone,'DELETE')).status,403);
  await captureImportState(session.id,session.hostToken,'processing',storage);
  assert.equal((await call(`/sessions/${session.id}/pages`,phone,'POST',{dataUrl:png})).status,409);
  assert.equal((await call(`/sessions/${session.id}/pages/${page.id}`,session.hostToken,'DELETE')).status,409);
  await call(`/sessions/${session.id}/signals`,phone,'POST',{type:'ready',data:{}});
  assert.equal((await(await call(`/sessions/${session.id}`,phone)).json()).status,'processing');
  await captureImportState(session.id,session.hostToken,'connected',storage);
  assert.equal((await call(`/sessions/${session.id}`,session.hostToken,'DELETE')).status,204);
  assert.equal(storage.photos.size,0);
  assert.equal((await call(`/sessions/${session.id}/signals`,phone)).status,410);
});

test('expired sessions and foreign-origin writes are refused',async t=>{
  const storage=new MemoryStorage();const app=express();app.use('/api/capture',createCaptureRouter({storage}));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/capture`;
  assert.equal((await fetch(base+'/sessions',{method:'POST',headers:{Origin:'https://foreign.example'}})).status,403);
  const s=await(await fetch(base+'/sessions',{method:'POST'})).json();
  storage.states.get(s.id)!.session.expiresAt=Date.now()-1;
  assert.equal((await fetch(base+`/sessions/${s.id}`,{headers:{Authorization:`Bearer ${s.hostToken}`}})).status,410);
});
