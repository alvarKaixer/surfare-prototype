import { parse } from 'tldts';
import { normalizeEvidence, evidenceMatches } from './text-evidence.js';
import { safetySignals } from './safety-signals.js';
import { classifySms } from './sms-model.js';

import { normalizeUrl } from './url-input.js';
export { normalizeUrl } from './url-input.js';

export function extractUrls(text) {
  // Validate bare-domain suffixes instead of relying on a short hardcoded list.
  const matches =
    text.match(
      /(?:https?|hxxps?):\/\/[^\s<>"']+|(?:[\p{L}\d](?:[\p{L}\d-]*[\p{L}\d])?(?:\.|\[\.\]|\(\.\)))+[\p{L}]{2,63}(?::\d{1,5})?(?:[/?#][^\s<>"']*)?/giu,
    ) || [];
  return [...new Set(matches.map((s) => s.replace(/[.,!?;:)\]}]+$/g, '')))]
    .filter((s) => {
      try {
        return (
          /^(?:https?|hxxps?):/i.test(s) ||
          parse(normalizeUrl(s).hostname, { allowPrivateDomains: true }).isIcann
        );
      } catch {
        return false;
      }
    })
    .slice(0, 10);
}
const brands = {
  gcash: ['gcash.com'],
  bdo: ['bdo.com.ph'],
  bpi: ['bpi.com.ph'],
  paypal: ['paypal.com'],
  maya: ['maya.ph', 'paymaya.com'],
  facebook: ['facebook.com', 'fb.com'],
  google: ['google.com'],
  microsoft: ['microsoft.com', 'live.com', 'office.com'],
  shopee: ['shopee.ph'],
  lazada: ['lazada.com.ph'],
};
const oneEdit = (a, b) => {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0,
    j = 0,
    n = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++n > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return n + (i < a.length || j < b.length ? 1 : 0) === 1;
};
export function analyzeUrl(raw, context = '') {
  const u = normalizeUrl(raw),
    host = u.hostname.toLowerCase(),
    p = parse(host, { allowPrivateDomains: true }),
    domain = p.domain || host,
    indicators = [];
  const add = (id, title, message, weight) =>
    indicators.push({ id, title, message, weight, category: 'link', evidence: [] });
  if (u.username || u.password)
    add(
      'userinfo',
      'Hidden destination',
      'The text before @ is not the destination. The actual host is ' + host + '.',
      3,
    );
  if (u.protocol === 'http:')
    add(
      'http',
      'Unencrypted connection',
      'This address uses HTTP. That alone does not establish that it is a scam.',
      1,
    );
  if (p.isIp)
    add(
      'ip',
      'Numeric destination',
      'The address uses an IP address rather than a recognizable domain.',
      2,
    );
  if (host.includes('xn--'))
    add(
      'idn',
      'Internationalized domain',
      'This address uses an internationalized domain. Check for letters that imitate another alphabet.',
      1,
    );
  if ((p.subdomain || '').split('.').filter(Boolean).length >= 3)
    add(
      'subdomains',
      'Complex subdomains',
      'Several subdomains can obscure the actual registered domain: ' + domain + '.',
      1,
    );
  if (
    ['bit.ly', 'tinyurl.com', 't.co', 'shorturl.at', 'rb.gy', 'cutt.ly', 'rebrand.ly'].includes(
      domain,
    )
  )
    add(
      'shortener',
      'Hidden final destination',
      'This shortened address hides its final destination. It has not been expanded.',
      2,
    );
  for (const [brand, valid] of Object.entries(brands)) {
    const claimed = new RegExp('\\b' + brand + '\\b', 'i').test(context + ' ' + host);
    if (claimed && !valid.includes(domain))
      add(
        'brand-' + brand,
        'Possible ' + brand + ' impersonation',
        'This mentions ' +
          brand +
          ' but the registered domain is ' +
          domain +
          ', outside its known domains. A third-party reference is also possible.',
        2,
      );
    const label = p.domainWithoutSuffix || '',
      skeleton = label.replace(/0/g, 'o').replace(/1/g, 'l');
    if (
      brand.length >= 4 &&
      !valid.includes(domain) &&
      !label.includes(brand) &&
      (oneEdit(label, brand) || skeleton === brand)
    )
      add(
        'lookalike-' + brand,
        'Look-alike domain',
        'The registered name resembles ' +
          brand +
          ' with changed characters. Confirm the exact official address.',
        3,
      );
  }
  for (const [key, value] of u.searchParams)
    if (
      /^(url|redirect|redirect_uri|redirect_url|next|continue|target|dest|destination)$/i.test(
        key,
      ) &&
      /^(?:https?:)?\/\//i.test(value)
    ) {
      try {
        const nested = new URL(value, u);
        if (nested.hostname !== host)
          add(
            'redirect',
            'Cross-site redirect parameter',
            'The address includes a destination on ' +
              nested.hostname +
              '. No redirect has been followed.',
            2,
          );
      } catch {}
    }
  if (
    /(?:verify|secure|login|account|update|wallet)/i.test(host) &&
    !Object.values(brands).flat().includes(domain)
  )
    add(
      'lure',
      'Account-themed hostname',
      'The hostname uses account or security language. Verify its registered domain independently.',
      1,
    );
  if (/\.(?:apk|exe|scr|msi|bat|cmd)$/i.test(u.pathname))
    add(
      'download',
      'Executable download',
      'This address appears to offer an app or executable file. Unexpected downloads can install harmful software.',
      3,
    );
  return { url: u.href, host, domain, indicators };
}

export function analyze(text, explicitUrls = []) {
  const source = normalizeEvidence(text),
    indicators = safetySignals(text);
  const find = (re, activeOnly = true) => evidenceMatches(source, re, { activeOnly });
  const add = (id, title, message, weight, evidence, category = 'scam') => {
    if (!indicators.some((i) => i.id === id))
      indicators.push({ id, title, message, weight, evidence, category });
  };
  const secret = find(
    /\b(?:o\s*t\s*p|one[- ]time (?:password|pin|code)|password|passcode|pin|cvv|verification code|recovery phrase|seed phrase)\b/i,
  );
  const request = find(
    /\b(?:send|share|give|provide|enter|submit|reply|confirm|verify|ibigay|isend|i-send|ipadala|ilagay|ibahagi|isulat|pakisend|paki-send|paki\s*bigay|paki\s*send)\b/i,
  );
  const secretRequests = secret.filter((e) =>
    request.some((r) => {
      const between = text.slice(Math.min(e.end, r.end), Math.max(e.start, r.start));
      return Math.abs(e.start - r.start) < 150 && !/[.!?;\n]/.test(between);
    }),
  );
  if (secretRequests.length)
    add(
      'secret',
      'Request for a secret',
      'The message asks for an OTP, password, PIN, or other secret. Sharing it can give someone access to an account.',
      4,
      [
        ...secretRequests,
        ...request.filter((r) => secretRequests.some((e) => Math.abs(e.start - r.start) < 150)),
      ],
    );
  const urgent = find(
    /\b(?:urgent|immediately|now|today|within \d+|suspend(?:ed)?|blocked|deactivat\w*|expire\w*|final warning|agad|ngayon|mawawala|iba-block|maba-block|isususpinde)\b/i,
  );
  const payment = find(
    /\b(?:pay|payment|fee|deposit|transfer|bayad|magbayad|magdeposit|padala|processing|shipping fee|release fee)\b/i,
  );
  const reward = find(
    /\b(?:won|winner|prize|reward|lottery|panalo|nanalo|premyo|cash prize|giveaway|gift\s*card|congratulations|congrats)\b/i,
  );
  const claim = find(
    /\b(?:account|bank|gcash|bdo|bpi|maya|paypal|government|support|customer service|bangko|wallet)\b/i,
  );
  if (urgent.length && (claim.length || secretRequests.length || (payment.length && reward.length)))
    add(
      'pressure',
      'Pressure to act quickly',
      'Urgency or an account threat pressures you to act before verifying.',
      2,
      urgent,
    );
  const claiming = find(/\b(?:claim|redeem|collect|receive|kunin|i-claim|iclaim)\b/i),
    action = find(
      /\b(?:click|tap|press|continue|proceed|enter|submit|provide|fill|kumpletuhin|pindutin|ilagay|ibigay)\b/i,
    );
  const countdown = find(
    /\b(?:only|just|within|remaining|left|have|mayroon|nalang|na lang)\b[^.!?\n]{0,50}\b\d+\s*(?:seconds?|minutes?|hours?|segundo|minuto|oras)\b|\b(?:expires?|ends?)\s+in\s+\d+\s*(?:seconds?|minutes?|hours?)/i,
  );
  const claimInfo = find(
    /\b(?:enter|submit|provide|fill(?:\s+in|\s+out)?|confirm|ilagay|ibigay)\b[^.!?\n]{0,70}\b(?:information|details|form|survey|impormasyon|detalye)\b/i,
  );
  if (reward.length && claiming.length && action.length) {
    add(
      'reward-action',
      'Unexpected prize claim',
      'A prize or gift offer asks you to take action to claim it. Verify the promotion independently.',
      2,
      [...reward, ...claiming, ...action],
    );
    if (countdown.length || urgent.length)
      add(
        'reward-pressure',
        'Prize countdown',
        'The offer uses a short deadline or countdown to discourage careful checking.',
        2,
        [...countdown, ...urgent],
      );
    if (claimInfo.length)
      add(
        'reward-information',
        'Details requested for a prize',
        'The prize flow requests information, which could be used to collect personal details.',
        2,
        claimInfo,
      );
    const generic = find(
      /\b(?:facebook user|dear user|dear customer|valued customer|lucky visitor|selected visitor)\b/i,
    );
    if (generic.length)
      add(
        'generic-reward',
        'Generic winner greeting',
        'The offer addresses a generic visitor rather than a verified winner.',
        1,
        generic,
      );
  }
  if (reward.length && payment.length)
    add(
      'advance-fee',
      'Payment to receive a reward',
      'A prize or reward is paired with a payment request, a common advance-fee pattern.',
      4,
      [...reward, ...payment],
    );
  const guaranteed = find(
      /\b(?:guaranteed|risk[- ]free|double your|doble|tiyak na kita|doblehin)\b/i,
    ),
    investment = find(/\b(?:invest|investment|profit|return|pera|kita|money)\b/i);
  if (guaranteed.length && investment.length)
    add(
      'investment',
      'Unrealistic investment promise',
      'Guaranteed or unusually easy returns are a warning sign.',
      4,
      guaranteed,
    );
  const job = find(/\b(?:job|trabaho|hiring|task|part.time)\b/i),
    upfront = find(/\b(?:deposit|activation fee|registration fee|magbayad|recharge)\b/i);
  if (job.length && upfront.length)
    add(
      'job-fee',
      'Payment to get work',
      'Work or tasks require an upfront payment or recharge.',
      4,
      [...job, ...upfront],
    );
  const remote = find(/\b(?:remote access|anydesk|teamviewer)\b/i),
    install = find(/\b(?:install|download|support|refund|bank)\b/i);
  if (remote.length && install.length)
    add(
      'remote',
      'Remote control request',
      'The message requests remote-access software, which can let someone control your device.',
      3,
      remote,
    );
  const personal = find(/\b(?:id card|passport|bank details|card number|personal information)\b/i);
  if (request.length && personal.length)
    add(
      'personal',
      'Sensitive information request',
      'The message requests sensitive personal or financial information.',
      2,
      personal,
    );
  const delivery = find(/\b(?:parcel|package|delivery|shipment|pakete|padala)\b/i),
    deliveryIssue = find(
      /\b(?:failed|held|on hold|incomplete|invalid|undeliverable|kulang|hindi maihatid|customs)\b/i,
    );
  if (delivery.length && deliveryIssue.length && (payment.length || action.length))
    add(
      'delivery',
      'Delivery problem requiring action',
      'A delivery problem is used to request a payment or updated details. Verify it directly with the courier.',
      3,
      [...deliveryIssue, ...payment, ...action],
    );
  const changedNumber = find(
    /\b(?:new number|bagong number|nasira (?:ang )?(?:phone|cp)|lost my phone|ito (?:ang )?bago kong number)\b/i,
  );
  if (changedNumber.length && payment.length)
    add(
      'new-number',
      'New-number payment request',
      'Someone using a new number asks for money. Confirm their identity through an existing trusted contact.',
      3,
      [...changedNumber, ...payment],
    );
  const cryptoBalance = find(
    /\b(?:balance|available|left\s+you|inheritance|beneficiary|bequeath|withdraw|withdrawal)\b[^\n]{0,110}\b(?:usdt|btc|bitcoin|crypto|ethereum)\b|\b\d[\d,.]*\s*(?:usdt|btc|eth)\b/i,
  );
  const suppliedLogin = find(/\b(?:user\s*name|login|password)\s*[:=]\s*\S+/i, false);
  const wealthStory = find(
    /\b(?:left\s+you\s+(?:some\s+)?money|inheritance|next\s+life|farewell|beneficiary|bequeath|claim\s+(?:the|your)\s+(?:funds|balance))\b/i,
    false,
  );
  if (cryptoBalance.length && suppliedLogin.length && wealthStory.length)
    add(
      'account-bait',
      'Crypto-account bait',
      'An unexpected crypto balance and supplied login details lure you to a withdrawal site.',
      5,
      [...cryptoBalance, ...suppliedLogin, ...wealthStory],
    );
  const urls = [];
  for (const raw of [...new Set([...explicitUrls, ...extractUrls(text)])].slice(0, 10))
    try {
      const a = analyzeUrl(raw, text);
      if (urls.some((u) => u.url === a.url)) continue;
      const start = text.indexOf(raw),
        evidence = start >= 0 ? [{ start, end: start + raw.length, text: raw }] : [];
      for (const i of a.indicators) {
        i.evidence = evidence;
        add(i.id, i.title, i.message + ' [' + a.host + ']', i.weight, evidence, 'link');
      }
      urls.push(a);
    } catch {}
  const model = classifySms(text);
  const protectiveOnly =
    /\b(?:never|do not|don't|huwag|wag)\s+(?:share|send|give|ibigay|ibahagi|ipadala)\b/i.test(
      text,
    ) &&
    /\b(?:otp|password|pin|cvv|seed phrase)\b/i.test(text) &&
    request.length === 0 &&
    indicators.length === 0;
  if (model.flagged && !protectiveOnly)
    add(
      'sms-pattern',
      'Pattern found in unwanted messages',
      'The offline SMS model found wording similar to labeled spam. This is a review signal, not proof of fraud or a calibrated probability.',
      2,
      model.evidence,
      'message pattern',
    );
  // The learned signal may repeat a rule's evidence; do not double-count it into High risk.
  const score = Math.max(
      indicators.filter((i) => i.id !== 'sms-pattern').reduce((n, i) => n + i.weight, 0),
      indicators.some((i) => i.id === 'sms-pattern') ? 2 : 0,
    ),
    sufficient = text.trim().split(/\s+/).length >= 4 || urls.length > 0;
  const level =
    score >= 5
      ? 'High risk'
      : score >= 2
        ? 'Suspicious'
        : sufficient
          ? 'Low risk'
          : 'Insufficient evidence';
  const personalThreat = indicators.some((i) => i.category === 'personal safety');
  const accountBait = indicators.some((i) => i.id === 'account-bait');
  const summary = personalThreat
    ? 'The content contains ' +
      (indicators.some((i) => i.id === 'extortion')
        ? 'a demand backed by intimidation or harm.'
        : indicators.some((i) => i.id === 'violence')
          ? 'a threat of physical harm.'
          : 'personal intimidation or a threat to expose private material.')
    : accountBait
      ? 'This looks like a crypto-account scam using a farewell story and supplied login details.'
      : level === 'High risk'
        ? 'Several strong warning signs point to a potentially harmful request.'
        : level === 'Suspicious'
          ? 'Warning signs need independent verification before you act.'
          : level === 'Low risk'
            ? 'No strong warning signs were found in the checks performed. This does not guarantee safety.'
            : 'There is not enough information to make a reliable assessment.';
  return {
    level,
    score,
    summary,
    sourceText: text,
    indicators,
    urls,
    model: { available: true, flagged: model.flagged },
    limitations: [
      'Local rules and an offline SMS model can miss new wording or misunderstand context.',
      'Sender identity, factual claims, and live redirect chains are not independently verified.',
    ],
    recommendation: personalThreat
      ? 'Save the message, avoid confronting the sender, and seek help. If danger is immediate, contact local emergency services.'
      : accountBait
        ? 'Do not sign in, send money, or share your details. Block and report the sender.'
        : score >= 2
          ? 'Pause before clicking, paying, or sharing information. Verify the request through an official app or a contact you already trust.'
          : 'Confirm unexpected requests through another trusted channel before acting.',
  };
}
