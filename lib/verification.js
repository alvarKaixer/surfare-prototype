export async function verify(request,env,fetcher=fetch) {
 const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method==='GET')return json({configured:!!env.GOOGLE_SAFE_BROWSING_API_KEY});
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origin rejected'},403);
 if(Number(request.headers.get('content-length')||0)>20000)return json({error:'Request too large'},413);
 let body;try{const raw=await request.text();if(raw.length>20000)return json({error:'Request too large'},413);body=JSON.parse(raw);}catch{return json({error:'Invalid JSON'},400);}
 if(!Array.isArray(body.urls)||body.urls.length<1||body.urls.length>10||body.urls.some(v=>typeof v!=='string'||v.length>2048))return json({error:'Provide 1–10 URLs, at most 2048 characters each.'},400);
 const urls=[];try{for(const s of body.urls){const u=new URL(s);if(!['http:','https:'].includes(u.protocol))throw Error();urls.push(u.href);}}catch{return json({error:'Only HTTP and HTTPS URLs are supported.'},400);}
 if(!env.GOOGLE_SAFE_BROWSING_API_KEY)return json({status:'unavailable',message:'Google Safe Browsing API key has not been configured. Local results only.'},503);
 try {
 const response=await fetcher('https://safebrowsing.googleapis.com/v4/threatMatches:find?key='+encodeURIComponent(env.GOOGLE_SAFE_BROWSING_API_KEY),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client:{clientId:'surfare',clientVersion:'1.0'},threatInfo:{threatTypes:['MALWARE','SOCIAL_ENGINEERING','UNWANTED_SOFTWARE','POTENTIALLY_HARMFUL_APPLICATION'],platformTypes:['ANY_PLATFORM'],threatEntryTypes:['URL'],threatEntries:urls.map(url=>({url}))}}),signal:AbortSignal.timeout(10000)});
 if(!response.ok)return json({status:'unavailable',message:'The reputation provider could not complete this check. Local results still apply.'},502);
 const data=await response.json();return json({status:'completed',checkedAt:new Date().toISOString(),results:urls.map(url=>({url,threats:(data.matches||[]).filter(m=>m.threat?.url===url).map(m=>m.threatType)}))});
 }catch{return json({status:'unavailable',message:'Online verification timed out or could not connect.'},502);}
}
