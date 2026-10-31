export function guidance(result) {
 const ids=result.indicators.map(i=>i.id),has=(...names)=>names.some(n=>ids.includes(n)),steps=[];
 if(has('secret'))steps.push('Keep OTPs, passwords and PINs private. If you already shared a password, change it through the official app and end unfamiliar sessions.');
 if(has('advance-fee','reward-action','reward-information','reward-pressure'))steps.push('Do not pay a fee or enter personal details to unlock an unexpected prize. Verify the promotion through the organization’s official app or website.');
 if(has('investment','job-fee'))steps.push('Pause any deposit or transfer. Verify the company and offer through an independent official contact before paying.');
 if(has('remote'))steps.push('Do not install remote-control software at a stranger’s request. If access was already granted, disconnect it and seek help from a trusted technician.');
 if(has('personal'))steps.push('Avoid sending identification or financial details through an unverified message. Confirm the request through a contact you already know.');
 if(result.urls.length)steps.push('Open the organization’s official app or type its known website yourself. Check the actual domain shown here; a familiar name elsewhere in a link is not proof of identity.');
 if(result.level==='High risk'||result.level==='Suspicious')steps.push('If you already sent money, contact your bank or payment provider promptly through its official support channel. Save evidence and report the message in the app where you received it.');
 if(!steps.length)steps.push('Check who sent this and whether you expected it. Confirm surprising requests through another trusted channel before acting.');
 return steps;
}
