import { formatNpr } from '@smart/shared';
export class ApiError extends Error { status:number; code:string; details:any; constructor(s:number,c:string,m:string,d?:any){super(m);this.status=s;this.code=c;this.details=d;} }
const base = (m:string)=>({ 'X-Client':'admin', ...(m!=='GET'?{'X-CSRF':'1'}:{}) });
let refreshing: Promise<boolean>|null = null;
function refresh(){ if(!refreshing) refreshing = fetch('/api/v1/auth/refresh',{method:'POST',credentials:'include',headers:base('POST')}).then(r=>r.ok).catch(()=>false).finally(()=>{setTimeout(()=>{refreshing=null},50)}); return refreshing; }
export async function api<T=any>(path:string, o:{method?:string;body?:any;form?:FormData;blob?:boolean}={}):Promise<T>{
  const method=o.method||'GET';
  const go=()=>fetch('/api/v1'+path,{method,credentials:'include',headers:{...base(method),...(o.body!==undefined?{'Content-Type':'application/json'}:{})},body:o.form?o.form:o.body!==undefined?JSON.stringify(o.body):undefined});
  let r=await go();
  if(r.status===401 && !path.startsWith('/auth/login')){ if(await refresh()) r=await go(); else { if(typeof window!=='undefined' && !location.pathname.startsWith('/login')) location.href='/login'; } }
  if(o.blob){ if(!r.ok) throw new ApiError(r.status,'download_failed','Download failed ('+r.status+')'); return (await r.blob()) as any; }
  const txt=await r.text(); let j:any=null; try{ j=txt?JSON.parse(txt):null }catch{}
  if(!r.ok){ const e=j?.error||{}; throw new ApiError(r.status,e.code||'error',e.message||('Request failed ('+r.status+')'),e.details); }
  return j as T;
}
export async function saveRes(path:string,id:string|null,body:any){ if(!id) return api(path,{method:'POST',body}); try{ return await api(`${path}/${id}`,{method:'PUT',body}); }catch(e:any){ if(e.status===404||e.status===405) return api(`${path}/${id}`,{method:'PATCH',body}); throw e; } }
export async function download(path:string,name:string){ const b:Blob=await api(path,{blob:true}); const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),2000); }
export const rs=(m:number)=>formatNpr(m||0);
export const toMinor=(v:any)=>Math.round(parseFloat(String(v||'0').replace(/,/g,''))*100)||0;
export const toRs=(m:any)=>m==null||m===''?'':String(Math.round(Number(m))/100);
export const dt=(x:any)=>x?new Date(x).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'—';
export const pick=(o:any,...k:string[])=>{for(const x of k){if(o&&o[x]!==undefined&&o[x]!==null)return o[x]}return undefined};
export const qs=(o:Record<string,any>)=>{const p=new URLSearchParams();Object.entries(o).forEach(([k,v])=>{if(v!==''&&v!=null&&v!==false)p.set(k,String(v))});const s=p.toString();return s?'?'+s:''};
export const errText=(e:any)=>e?.status===403?'Your role does not allow this action.':(e?.message||'Something went wrong');
