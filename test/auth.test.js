import {test} from 'node:test';
import assert from 'node:assert/strict';

test('password auth preserves identity, restores sessions, refreshes and handles recovery',async()=>{
 const names=['localStorage','sessionStorage','location','history','fetch'];const original=new Map(names.map(n=>[n,Object.getOwnPropertyDescriptor(globalThis,n)]));
 const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};
 let calls=[],rejectPassword=false,signupSession=false,expired=false;
 const session=()=>({access_token:'mock-access',refresh_token:'mock-refresh',expires_at:Math.floor(Date.now()/1000)+(expired?10:3600),user:{id:'existing-user'}});
 try{
 globalThis.localStorage=memory();globalThis.sessionStorage=memory();globalThis.location={origin:'https://example.test',hash:'',pathname:'/',search:'',reload(){}};globalThis.history={replaceState(){location.hash='';}};
 globalThis.fetch=async(url,options)=>{const path=new URL(url).pathname;const body=options.body?JSON.parse(options.body):undefined;calls.push({url,options,body});let status=200,data={};
 if(url.includes('grant_type=password')){if(rejectPassword){status=400;data={msg:'Invalid login credentials'};}else data=session();}
 else if(url.includes('grant_type=refresh_token')){expired=false;data=session();}
 else if(path==='/auth/v1/signup')data=signupSession?session():{user:{id:'new-user'}};
 else if(path==='/auth/v1/user')data={id:'existing-user'};
 else if(path==='/rest/v1/lu_members')data=[{home_id:'11111111-1111-4111-8111-111111111111',user_id:'existing-user'}];
 else if(path.startsWith('/rest/'))data=[];
 return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});};
 const load=()=>import('../public/cloud.js?test='+Math.random());
 let auth=await load();rejectPassword=true;await assert.rejects(auth.signInPassword('test@example.com','test-password-only'),/Invalid login/);assert.equal(auth.signedIn(),false);assert.equal(localStorage.getItem('little-us-auth'),null);
 rejectPassword=false;await auth.signInPassword('test@example.com','test-password-only');assert.equal(auth.signedIn(),true);assert.equal(JSON.parse(localStorage.getItem('little-us-auth')).user.id,'existing-user');assert.ok(!localStorage.getItem('little-us-auth').includes('test-password-only'));
 auth=await load();assert.equal(auth.signedIn(),true);await auth.api('state');assert.equal(calls.filter(c=>c.url.includes('/otp')).length,0);
 await auth.setPassword('replacement-test-password');assert.equal(calls.at(-1).options.method,'PUT');assert.equal(calls.at(-1).options.headers.Authorization,'Bearer mock-access');assert.ok(!localStorage.getItem('little-us-auth').includes('replacement-test-password'));
 expired=true;await auth.signInPassword('test@example.com','test-password-only');auth=await load();await auth.api('state');assert.equal(calls.filter(c=>c.url.includes('grant_type=refresh_token')).length,1);
 await auth.sendPasswordReset('test@example.com');assert.ok(calls.at(-1).url.includes('/recover?redirect_to=https%3A%2F%2Fexample.test%2F'));
 location.hash='#access_token=recovery-access&refresh_token=recovery-refresh&expires_in=3600&type=recovery';assert.equal((await auth.initializeAuth()).recovery,true);assert.equal(location.hash,'');assert.equal((await auth.initializeAuth()).recovery,true);await auth.setPassword('recovery-test-password');assert.equal(sessionStorage.getItem('little-us-recovery'),null);
 await auth.signOut();auth=await load();assert.equal(auth.signedIn(),false);
 assert.equal(await auth.registerPassword('test@example.com','test-password-only'),false);assert.equal(auth.signedIn(),false);
 signupSession=true;assert.equal(await auth.registerPassword('test@example.com','test-password-only'),true);assert.equal(auth.signedIn(),true);
 }finally{for(const [n,d]of original){if(d)Object.defineProperty(globalThis,n,d);else delete globalThis[n];}}
});
