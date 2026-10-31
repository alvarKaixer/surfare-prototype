// Vercel Node adapter: shares the same verification logic as Cloudflare.
import {verify} from '../lib/verification.js';
export default async function handler(req,res){
 try{
  const headers=new Headers();for(const [key,value] of Object.entries(req.headers||{}))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value);
  const origin='https://'+(req.headers.host||'localhost');let body;
  if(!['GET','HEAD'].includes(req.method)){
   if(req.body!==undefined)body=typeof req.body==='string'?req.body:JSON.stringify(req.body);
   else {const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>20000){res.statusCode=413;res.end(JSON.stringify({error:'Request too large'}));return;}chunks.push(chunk);}body=Buffer.concat(chunks).toString();}
  }
  const request=new Request(new URL(req.url||'/api/verify',origin),{method:req.method,headers,body});
  const response=await verify(request,{GOOGLE_SAFE_BROWSING_API_KEY:process.env.GOOGLE_SAFE_BROWSING_API_KEY});
  res.statusCode=response.status;response.headers.forEach((value,key)=>res.setHeader(key,value));res.end(await response.text());
 }catch{res.statusCode=500;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:'unavailable',message:'Could not complete this check.'}));}
}
