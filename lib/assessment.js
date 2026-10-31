// Keep local findings distinct from reputation results. No match is not proof of safety.
export function combineAssessment(local,verification=null) {
 const base={...local,localLevel:local.level};
 if(verification?.status==='completed'&&verification.results?.some(r=>r.threats?.length))return {...base,level:'High risk',recommendation:'Google Safe Browsing reports a potentially unsafe URL. Avoid opening it or submitting information.'};
 if(local.urls.length&&local.level==='Low risk')return {...base,level:'Insufficient evidence',recommendation:'The URL has no strong local warning signs, but its safety is unconfirmed. Verify the destination through an official source before sharing information.'};
 return base;
}
