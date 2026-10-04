import { yangoUrl } from './rules';
type RecordValue=Record<string,unknown>;
const record=(v:unknown):RecordValue=>v&&typeof v==='object'&&!Array.isArray(v)?v as RecordValue:{};
const items=(v:unknown):unknown[]=>Array.isArray(v)?v:[];
const label=(v:unknown)=>typeof v==='string'?v:String(record(v).text||'');
function bs(v:unknown) {
 const s=label(v).replace(/[\u00a0\u202f]/g,' ').trim();
 const m=s.match(/^(?:Bs\.?|BOB)\s*(\d+(?:[.,]\d{1,2})?)$/i)||s.match(/^(\d+(?:[.,]\d{1,2})?)\s*(?:Bs\.?|BOB)$/i);
 return m?Number(m[1].replace(',','.')):null;
}
/** Read only price-labelled delivery details, not arbitrary monetary text. */
export function yangoFeeFromResponse(raw:unknown):number|null {
 const values:number[]=[];
 for(const section of items(record(raw).content_sections)) for(const item of items(record(section).items)) {
  if(record(item).type!=='details')continue;
  for(const detail of items(record(item).sections)) for(const row of items(record(detail).items)) {
   if(!/^(precio|price|preço)$/i.test(label(record(row).subtitle).trim()))continue;
   const value=bs(record(row).title);if(value!==null)values.push(value);
  }
 }
 return values.length&&new Set(values).size===1?values[0]:null;
}
/** Same public read endpoint used by Yango's tracking page. No account credentials. */
export async function lookupYangoFee(link:string):Promise<number|null> {
 const url=new URL(yangoUrl(link));
 const key=url.hash.slice(1);
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(key))return null;
 try {
  const response=await fetch('https://ya-authproxy.yango.com/4.0/cargo-c2c/v1/shared-route/info',{
   method:'POST',headers:{'Content-Type':'application/json','Accept-Language':'es','X-Taxi':'Mozilla/5.0 turboapp_delivery',Origin:'https://delivery.yango.com'},
   body:JSON.stringify({key}),redirect:'error',signal:AbortSignal.timeout(8000)
  });
  if(!response.ok)return null;
  return yangoFeeFromResponse(await response.json());
 } catch {return null;}
}
