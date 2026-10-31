import {analyze} from './detection.js';
export function validateCases(data){
 if(!Array.isArray(data)||data.length<1||data.length>500)throw Error('Use a JSON array of 1–500 labeled cases.');
 const ids=new Set();
 return data.map((c,i)=>{if(!c||!['scam','legitimate'].includes(c.label)||typeof c.text!=='string'||!c.text.trim()||c.text.length>12000||!['English','Filipino','Taglish'].includes(c.language))throw Error('Case '+(i+1)+' needs text, label (scam/legitimate) and language (English/Filipino/Taglish).');const id=String(c.id||i+1);if(ids.has(id))throw Error('Case IDs must be unique.');ids.add(id);return {id,text:c.text,label:c.label,language:c.language};});
}
export function evaluateCases(cases){
 const rows=validateCases(cases).map(c=>{const start=performance.now(),r=analyze(c.text),ms=performance.now()-start;const predicted=['High risk','Suspicious'].includes(r.level)?'scam':r.level==='Low risk'?'legitimate':'abstain';return {...c,predicted,level:r.level,ms,correct:predicted===c.label};});
 const metrics=group=>{const tp=group.filter(r=>r.label==='scam'&&r.predicted==='scam').length,fp=group.filter(r=>r.label==='legitimate'&&r.predicted==='scam').length,fn=group.filter(r=>r.label==='scam'&&r.predicted!=='scam').length,tn=group.filter(r=>r.label==='legitimate'&&r.predicted==='legitimate').length,abstain=group.filter(r=>r.predicted==='abstain').length;return {count:group.length,tp,fp,fn,tn,abstain,precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null,falsePositiveRate:group.filter(r=>r.label==='legitimate').length?fp/group.filter(r=>r.label==='legitimate').length:null,accuracy:group.length?(tp+tn)/group.length:null,averageMs:group.length?group.reduce((n,r)=>n+r.ms,0)/group.length:0};};
 return {rows,overall:metrics(rows),byLanguage:Object.fromEntries(['English','Filipino','Taglish'].map(l=>[l,metrics(rows.filter(r=>r.language===l))]))};
}
export function characterErrorRate(reference,observed){
 const a=reference.normalize('NFKC').replace(/\s+/g,' ').trim(),b=observed.normalize('NFKC').replace(/\s+/g,' ').trim();if(!a.length)throw Error('Add the expected image text first.');if(a.length>5000||b.length>5000)throw Error('Use text under 5,000 characters for this comparison.');
 let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=row;}return prev[b.length]/a.length;
}
