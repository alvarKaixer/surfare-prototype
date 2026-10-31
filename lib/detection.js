import { parse } from 'tldts';
export function normalizeUrl(value) {
  let s=value.trim();
  if (!/^[a-z][a-z\d+.-]*:/i.test(s)) s='https://'+s;
  const u=new URL(s);
  if (!['http:','https:'].includes(u.protocol)||!u.hostname.includes('.') && !u.hostname.includes(':')) throw new Error('Enter a complete HTTP or HTTPS website address.');
  return u;
}
export function extractUrls(text) {
  const matches=text.match(/https?:\/\/[^\s<>"']+|(?:[\p{L}\d](?:[\p{L}\d-]*[\p{L}\d])?\.)+(?:com|net|org|ph|io|co|xyz|top|online|site|info|app|gov|edu|me|ly|link|click|live|shop)(?:\/[^\s<>"']*)?/giu)||[];
  return [...new Set(matches.map(s=>s.replace(/[.,!?;:)\]}]+$/g,'')))].slice(0,10);
}
const brands={gcash:['gcash.com'],bdo:['bdo.com.ph'],bpi:['bpi.com.ph'],paypal:['paypal.com'],maya:['maya.ph','paymaya.com'],facebook:['facebook.com','fb.com'],google:['google.com'],microsoft:['microsoft.com','live.com','office.com'],shopee:['shopee.ph'],lazada:['lazada.com.ph']};
export function analyzeUrl(raw,context='') {
 const u=normalizeUrl(raw), host=u.hostname.toLowerCase(), p=parse(host,{allowPrivateDomains:true}), domain=p.domain||host, indicators=[];
 const add=(id,message,weight)=>indicators.push({id,message,weight});
 if(u.username||u.password)add('userinfo','The address hides the destination after an @ sign. The actual host is '+host+'.',3);
 if(u.protocol==='http:')add('http','This link uses unencrypted HTTP. That alone does not prove a scam.',1);
 if(p.isIp)add('ip','The address uses an IP address instead of a recognizable domain.',2);
 if(host.includes('xn--'))add('idn','The address uses an internationalized domain. Check for look-alike letters.',1);
 if((p.subdomain||'').split('.').filter(Boolean).length>=3)add('subdomains','Many subdomains can make the actual registered domain difficult to notice.',1);
 if(['bit.ly','tinyurl.com','t.co','shorturl.at','rb.gy','cutt.ly','rebrand.ly'].includes(domain))add('shortener','This shortened link hides its final destination. It has not been expanded.',2);
 for(const [brand,valid] of Object.entries(brands)) {
  const claimed=new RegExp('\\b'+brand+'\\b','i').test(context+' '+host);
  if(claimed&&!valid.includes(domain))add('brand-'+brand,'This mentions '+brand+' but the registered domain is '+domain+', outside the known '+brand+' domains. This can also be a third-party reference.',2);
 }
 for(const [key,value] of u.searchParams)if(/^(url|redirect|redirect_uri|redirect_url|next|continue|target|dest|destination)$/i.test(key)&&/^https?:/i.test(value)) {
  try {const nested=new URL(value);if(nested.hostname!==host)add('redirect','The address contains a redirect parameter pointing to '+nested.hostname+'. The destination has not been visited.',2);}catch{}
 }
 if(/(?:verify|secure|login|account|update|wallet)/i.test(host)&&!Object.values(brands).flat().includes(domain))add('lure','The hostname uses account or security language. Verify the actual domain independently.',1);
 return {url:u.href,host,domain,indicators};
}
export function analyze(text,explicitUrls=[]) {
 const indicators=[], add=(id,message,weight)=>indicators.push({id,message,weight});
 const s=text.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').toLowerCase();
 const secret=/\b(otp|one[- ]time (?:password|pin|code)|password|pin|cvv|verification code|recovery phrase|seed phrase)\b/.test(s);
 const request=/\b(send|share|give|provide|enter|submit|reply|confirm|verify|ibigay|isend|i-send|ipadala|ilagay|ibahagi|isulat|pakisend|paki-send)\b/.test(s);
 const sensitiveSentences=s.split(/[.!?\n]+/).filter(x=>/\b(otp|password|pin|cvv|verification code|recovery phrase|seed phrase)\b/.test(x));
 const negation=sensitiveSentences.length>0&&sensitiveSentences.every(x=>/(?:do not|don't|never|huwag|wag)[^.!?\n]{0,45}(?:share|send|give|ibigay|ibahagi|ipadala)/.test(x));
 if(secret&&request&&!negation)add('secret','The message asks you to provide a password, OTP, PIN, or other secret.',4);
 const urgent=/\b(urgent|immediately|now|today|within \d+|suspend(?:ed)?|blocked|deactivat|expire|final warning|agad|ngayon|mawawala|iba-block|maba-block)\b/.test(s);
 const payment=/\b(pay|payment|fee|deposit|transfer|bayad|magbayad|magdeposit|padala|processing|shipping fee|release fee)\b/.test(s);
 const reward=/\b(won|winner|prize|reward|lottery|panalo|nanalo|premyo|cash prize|giveaway|gift\s*card|congratulations|congrats)\b/.test(s);
 const claim=/\b(account|bank|gcash|bdo|bpi|maya|paypal|government|support|customer service|bangko|wallet)\b/.test(s);
 if(urgent&&(claim||secret||(payment&&reward)))add('pressure','Urgency or an account threat pressures you to act before verifying.',2);
 // Reward language alone is weak evidence. Require a claim instruction and action.
 const claiming=/\b(claim|redeem|collect|receive|kunin|i-claim|iclaim)\b/.test(s);
 const action=/\b(click|tap|press|continue|proceed|enter|submit|provide|fill|kumpletuhin|pindutin|ilagay|ibigay)\b/.test(s);
 const countdown=/(?:\b(?:only|just|within|remaining|left|have|mayroon|nalang|na lang)\b[^.!?\n]{0,50}\b\d+\s*(?:seconds?|minutes?|hours?|segundo|minuto|oras)\b|\b\d{1,2}:\d{2}\b[^.!?\n]{0,30}\b(?:left|remaining)|\b(?:expires?|ends?)\s+in\s+\d+\s*(?:seconds?|minutes?|hours?))/i.test(s);
 const claimInfo=/\b(?:enter|submit|provide|fill(?:\s+in|\s+out)?|confirm|ilagay|ibigay)\b[^.!?\n]{0,70}\b(?:information|details|form|survey|impormasyon|detalye)\b/.test(s);
 if(reward&&claiming&&action){
  add('reward-action','A prize or gift-card offer asks you to click or continue to claim it. Unexpected offers like this should be verified independently.',2);
  if(countdown||urgent)add('reward-pressure','A prize offer uses a short countdown or urgent deadline to pressure you to act.',2);
  if(claimInfo)add('reward-information','The prize-claim flow asks you to enter information on another page. This can be used to collect personal details.',2);
  if(/\b(?:facebook user|dear user|dear customer|valued customer|lucky visitor|selected visitor)\b/.test(s))add('generic-reward','The prize addresses a generic user or visitor rather than identifying a verified winner.',1);
 }
 if(reward&&payment)add('advance-fee','A prize or reward is paired with a payment request, a common advance-fee scam pattern.',4);
 if(/(?:guaranteed|risk[- ]free|double your|doble|tiyak na kita)/.test(s)&&/\b(invest|investment|profit|return|pera|kita|money)\b/.test(s))add('investment','Promises of guaranteed or unusually easy investment returns are a warning sign.',4);
 if(/\b(job|trabaho|hiring|task|part.time)\b/.test(s)&&/\b(deposit|activation fee|registration fee|magbayad|recharge)\b/.test(s))add('job-fee','Work or tasks require an upfront payment or recharge.',4);
 if(/\b(remote access|anydesk|teamviewer)\b/.test(s)&&/\b(install|download|support|refund|bank)\b/.test(s))add('remote','The message requests remote-access software. This can give another person control of your device.',3);
 if(/\b(send|provide|submit|ibigay|ipadala)\b/.test(s)&&/\b(id card|passport|bank details|card number|personal information)\b/.test(s))add('personal','The message requests sensitive personal or financial information.',2);
 const urls=[];
 for(const raw of [...new Set([...explicitUrls,...extractUrls(text)])].slice(0,10))try{const a=analyzeUrl(raw,text);if(!urls.some(x=>x.url===a.url))urls.push(a);}catch{}
 for(const url of urls)for(const i of url.indicators)indicators.push({...i,message:i.message+' ['+url.host+']'});
 const score=indicators.reduce((n,i)=>n+i.weight,0);
 const sufficient=text.trim().split(/\s+/).length>=4||urls.length>0;
 return {level:score>=5?'High risk':score>=2?'Suspicious':sufficient?'Low risk':'Insufficient evidence',score,indicators,urls,limitations:['Rule-based screening does not prove a message or website is safe.','Sender identity, claims, and redirect chains are not independently verified.'],recommendation:score>=2?'Do not send money, passwords, or OTPs. Verify through the official app or a contact you already trust.':'Check the sender and destination independently before sharing information or making a payment.'};
}
