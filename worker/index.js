import {verify} from '../lib/verification.js';
export default {async fetch(request,env){
 if(new URL(request.url).pathname==='/api/verify')return verify(request,env);
 if(new URL(request.url).pathname.startsWith('/api/'))return Response.json({error:'Not found'},{status:404});
 return env.ASSETS.fetch(request);
}};
