import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
const SESSION_KEY = 'little-us-auth';
let session;
try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { session = null; }
let renewing;
const save = value => {session=value;if(value)localStorage.setItem(SESSION_KEY,JSON.stringify(value));else localStorage.removeItem(SESSION_KEY);};
async function request(path,method='GET',body,access){
 const response=await fetch(SUPABASE_URL+path,{method,headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${access||SUPABASE_KEY}`,...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const raw=await response.text();let data;try{data=raw?JSON.parse(raw):null;}catch{throw new Error('The connection returned an unexpected response.');}
 if(!response.ok){const e=new Error(data?.msg||data?.message||data?.error_description||'Couldn’t connect. Please try again.');e.status=response.status;throw e;}
 return data;
}
export const signedIn=()=>Boolean(session?.access_token);
export async function sendSignIn(email){
 await request('/auth/v1/otp?redirect_to='+encodeURIComponent(location.origin+'/'),'POST',{email,create_user:true});
}
// Passwords go directly to Supabase Auth over HTTPS, never into local storage.
export async function signInPassword(email,password){
 const value=await request('/auth/v1/token?grant_type=password','POST',{email,password});save(value);
}
export async function registerPassword(email,password){
 const value=await request('/auth/v1/signup?redirect_to='+encodeURIComponent(location.origin+'/'),'POST',{email,password});
 if(value.access_token){save(value);return true;}return false;
}
export async function setPassword(password){
 await request('/auth/v1/user','PUT',{password},await access());
 sessionStorage.removeItem('little-us-recovery');
}
export async function sendPasswordReset(email){
 await request('/auth/v1/recover?redirect_to='+encodeURIComponent(location.origin+'/'),'POST',{email});
}
export async function verifyCode(email,token){const value=await request('/auth/v1/verify','POST',{email,token,type:'email'});save(value);}
export async function initializeAuth(){
 const fragment=new URLSearchParams(location.hash.slice(1));
 if(fragment.has('access_token')){
  const recovery=fragment.get('type')==='recovery';
  const access=fragment.get('access_token'),refresh=fragment.get('refresh_token');history.replaceState(null,'',location.pathname+location.search);
  if(!refresh)throw new Error('That sign-in link is incomplete. Request a new one.');
  await request('/auth/v1/user','GET',undefined,access);
  save({access_token:access,refresh_token:refresh,expires_at:Math.floor(Date.now()/1000)+Number(fragment.get('expires_in')||3600)});
  if(recovery)sessionStorage.setItem('little-us-recovery','true');
 }else if(fragment.has('error_description')){const message=fragment.get('error_description');history.replaceState(null,'',location.pathname+location.search);throw new Error(message);}
 return {recovery:sessionStorage.getItem('little-us-recovery')==='true'&&signedIn()};
}
async function access(){
 if(!signedIn()){const e=new Error('Sign in to your little space.');e.status=401;throw e;}
 if(Number(session.expires_at)<Date.now()/1000+60){
  if(!renewing)renewing=request('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:session.refresh_token}).then(value=>{save(value);return value;}).catch(e=>{if(e.status===400||e.status===401)save(null);throw e;}).finally(()=>renewing=null);
  await renewing;
 }
 return session.access_token;
}
export async function signOut(){const a=await access();await request('/auth/v1/logout?scope=local','POST',{},a);save(null);location.reload();}
async function rpc(name,args={}){return request('/rest/v1/rpc/'+name,'POST',args,await access());}
async function home(){const data=await request('/rest/v1/lu_members?select=home_id&limit=1','GET',undefined,await access());if(!data.length){const e=new Error('Create or join your space.');e.status=409;throw e;}return data[0].home_id;}
export async function api(path,method='GET',body={}){
 if(path==='home')return rpc('lu_create_home');
 if(path==='join')return rpc('lu_join_home',{invitation:body.code.trim().toUpperCase()});
 if(path==='invite')return {code:await rpc('lu_invite')};
 const id=await home(),a=await access();
 if(path==='state'){
  const [items,members,stores]=await Promise.all([request('/rest/v1/lu_items?select=id,kind,title,store,done,cuisine,address,notes&home_id=eq.'+id+'&order=created_at.asc','GET',undefined,a),request('/rest/v1/lu_members?select=user_id&home_id=eq.'+id,'GET',undefined,a),request('/rest/v1/lu_stores?select=name&home_id=eq.'+id+'&order=name.asc','GET',undefined,a)]);
  return {items,members:members.length,stores:stores.map(s=>s.name)};
 }
 if(path==='stores'&&method==='POST')return request('/rest/v1/lu_stores','POST',{home_id:id,name:body.name},a);
 if(path==='items'&&method==='POST')return request('/rest/v1/lu_items','POST',{home_id:id,kind:body.kind,title:body.title,store:body.store,...(body.kind==='restaurants'?{cuisine:body.cuisine||'',address:body.address||'',notes:body.notes||''}:{})},a);
 if(path==='items/clear')return request('/rest/v1/lu_items?home_id=eq.'+id+'&done=eq.true&kind=eq.'+encodeURIComponent(body.kind),'DELETE',undefined,a);
 if(path.startsWith('items/')){const query='/rest/v1/lu_items?home_id=eq.'+id+'&id=eq.'+encodeURIComponent(path.split('/')[1]);return request(query,method,method==='PATCH'?(typeof body.done==='boolean'?{done:body.done}:{title:body.title,cuisine:body.cuisine,address:body.address,notes:body.notes}):undefined,a);}
 throw new Error('Unknown action.');
}
