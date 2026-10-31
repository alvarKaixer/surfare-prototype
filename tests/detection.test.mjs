import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze,analyzeUrl,normalizeUrl,extractUrls} from '../lib/detection.js';
import {verify} from '../lib/verification.js';
const cases=[
 ['GCash: Send your OTP now or your account will be blocked today.','High risk'],
 ['Nanalo ka ng premyo! Magbayad ng processing fee ngayon.','High risk'],
 ['Please submit your password to verify your bank account immediately.','High risk'],
 ['Hiring part time task workers. Pay a registration fee first.','Suspicious'],
 ['Guaranteed profit: double your money with our investment.','Suspicious'],
 ['Hi Kai, our meeting is at 4 PM. Please bring your notes.','Low risk'],
 ['Never share your OTP or password with anyone.','Low risk'],
 ['Huwag ibigay ang OTP o password mo sa iba.','Low risk'],
 ['Please pay for lunch today.','Low risk'],
 ['hello','Insufficient evidence']
];
for(const [input,expected] of cases)test(input,()=>assert.equal(analyze(input).level,expected));
test('registered domain defeats subdomain impersonation',()=>assert.equal(analyzeUrl('https://gcash.com.attacker.example/login').domain,'attacker.example'));
test('correct PH domain suffix',()=>assert.equal(analyzeUrl('https://online.bdo.com.ph').domain,'bdo.com.ph'));
test('userinfo does not hide actual host',()=>assert(analyzeUrl('https://gcash.com@evil.example').indicators.some(x=>x.id==='userinfo')));
test('reject unsafe schemes',()=>assert.throws(()=>normalizeUrl('javascript:alert(1)')));
test('trailing punctuation stripped',()=>assert.deepEqual(extractUrls('Open https://example.com/test.'),['https://example.com/test']));
test('official gcash not flagged for brand',()=>assert(!analyzeUrl('https://www.gcash.com').indicators.some(x=>x.id.startsWith('brand'))));
const req=(body)=>new Request('https://surfare.example/api/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('no key is unavailable, never safe',async()=>assert.equal((await verify(req({urls:['https://example.com']}),{})).status,503));
test('malicious scheme refused',async()=>assert.equal((await verify(req({urls:['file:///etc/passwd']}),{})).status,400));
test('provider threat mapped',async()=>{const r=await verify(req({urls:['https://example.com/']}),{GOOGLE_SAFE_BROWSING_API_KEY:'test'},async()=>Response.json({matches:[{threat:{url:'https://example.com/'},threatType:'SOCIAL_ENGINEERING'}]}));assert.deepEqual((await r.json()).results[0].threats,['SOCIAL_ENGINEERING']);});
test('provider failure does not claim safety',async()=>{const r=await verify(req({urls:['https://example.com/']}),{GOOGLE_SAFE_BROWSING_API_KEY:'test'},async()=>new Response('',{status:429}));assert.equal((await r.json()).status,'unavailable');});

// Regression: text actually recovered by OCR from the reported gift-card image.
const giftCardOcr=`CONGRATULATIONS!
(1) $1000 Amazon Gift Card
is reserved just for you, Facebook User!
Step 1: Click the CONTINUE button to claim your prize.
Step 2: Enter the correct information on the next page to claim your prize.
You only have 4 minutes 14 seconds to claim your prize!`;
test('reported image: countdown + prize + information request',()=>{
 const r=analyze(giftCardOcr);assert.equal(r.level,'High risk');
 for(const id of ['reward-action','reward-pressure','reward-information'])assert(r.indicators.some(i=>i.id===id));
});
test('same pattern without brand names',()=>assert.equal(analyze('Congratulations! A gift card is reserved for you. Click to claim your reward. You have only 3 minutes left. Enter your details on the next page.').level,'High risk'));
test('Taglish reward claim deadline',()=>assert.equal(analyze('Nanalo ka ng gift card! Pindutin ang continue para i-claim ang premyo. Mayroon ka na lang 5 minuto.').level,'Suspicious'));
test('prize link without urgency requires verification',()=>assert.equal(analyze('Click continue to claim your prize.').level,'Suspicious'));
test('ordinary gift card receipt',()=>assert.equal(analyze('Your Amazon gift card purchase receipt is attached. Thank you for your order.').level,'Low risk'));
test('birthday gift card',()=>assert.equal(analyze('Happy birthday! I got you a gift card for your favorite bookstore.').level,'Low risk'));
test('legitimate event countdown without prize',()=>assert.equal(analyze('The meeting starts in 4 minutes. Click continue to join the video call.').level,'Low risk'));
test('prize congratulations without action',()=>assert.equal(analyze('Congratulations to the winners of our school science fair! Prizes will be awarded at the ceremony.').level,'Low risk'));

import {combineAssessment} from '../lib/assessment.js';
test('unchecked URL does not imply low risk',()=>assert.equal(combineAssessment(analyze('',['https://example.com'])).level,'Insufficient evidence'));
test('no-match URL does not imply safety',()=>assert.equal(combineAssessment(analyze('',['https://example.com']),{status:'completed',results:[{threats:[]}]}).level,'Insufficient evidence'));
test('provider failure preserves uncertainty',()=>assert.equal(combineAssessment(analyze('',['https://example.com']),{status:'unavailable'}).level,'Insufficient evidence'));
test('real provider match overrides local result',()=>assert.equal(combineAssessment(analyze('',['https://example.com']),{status:'completed',results:[{threats:['SOCIAL_ENGINEERING']}]}).level,'High risk'));
test('no-match never downgrades local scam signals',()=>assert.equal(combineAssessment(analyze('Send your OTP now or your account will be blocked. https://example.com'),{status:'completed',results:[{threats:[]}]}).level,'High risk'));

import {inspectFileBytes} from '../lib/file-validation.js';
import {evaluateCases,validateCases,characterErrorRate} from '../lib/evaluation.js';
import {guidance} from '../lib/guidance.js';
test('file signatures reject a fake PNG',()=>assert.throws(()=>inspectFileBytes(new TextEncoder().encode('<script>'),100),/supported image/));
test('file signatures accept PNG and reject oversized files',()=>{const b=new Uint8Array([137,80,78,71,13,10,26,10]);assert.equal(inspectFileBytes(b,100),'image/png');assert.throws(()=>inspectFileBytes(b,11*1024*1024),/10 MB/);});
test('evaluation counts false positives and missed scams transparently',()=>{const r=evaluateCases([{id:'1',label:'scam',language:'English',text:'Send your OTP now or your bank account will be blocked.'},{id:'2',label:'scam',language:'English',text:'hello'},{id:'3',label:'legitimate',language:'Filipino',text:'Meeting natin bukas sa paaralan.'},{id:'4',label:'legitimate',language:'English',text:'Send your OTP now or your account will be blocked.'}]);assert.equal(r.overall.tp,1);assert.equal(r.overall.fp,1);assert.equal(r.overall.fn,1);assert.equal(r.overall.tn,1);assert.equal(r.overall.abstain,1);assert.equal(r.overall.precision,.5);assert.equal(r.overall.recall,.5);});
test('import validates labels and languages',()=>{assert.throws(()=>validateCases([{label:'safe',text:'a message',language:'English'}]));assert.throws(()=>validateCases([{label:'scam',text:'a message',language:'Unknown'}]));});
test('OCR comparison uses edit distance and normalized whitespace',()=>{assert.equal(characterErrorRate('hello world','hello\nworld'),0);assert.equal(characterErrorRate('hello','hallo'),.2);assert.throws(()=>characterErrorRate('','text'));});
test('specific advice explains OTP protection',()=>assert(guidance(analyze('Send your OTP now or your account will be blocked.')).some(s=>s.includes('change it'))));
