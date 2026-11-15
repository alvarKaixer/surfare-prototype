import { normalizeEvidence, evidenceMatches } from './text-evidence.js';

// Intent combinations informed by development examples, not sender blocklists.
export function scamSignals(text) {
  const source = normalizeEvidence(text),
    signals = [];
  const hits = (pattern) => evidenceMatches(source, pattern, { activeOnly: true });
  const add = (id, title, message, weight, a, b) => {
    const pairs = a.flatMap((left) =>
      b
        .filter(
          (right) =>
            Math.abs(left.start - right.start) <= 220 &&
            !/[!?;\n]/.test(
              text.slice(Math.min(left.end, right.end), Math.max(left.start, right.start)),
            ),
        )
        .flatMap((right) => [left, right]),
    );
    if (pairs.length)
      signals.push({
        id,
        title,
        message,
        weight,
        category: 'scam',
        evidence: [...new Map(pairs.map((p) => [p.start + ':' + p.end, p])).values()],
      });
  };
  const fee = hits(
    /\b(?:advance fee|upfront|processing fee|release fee|activation fee|security deposit|registration fee|magdeposito|mag-deposito|magbayad muna|bayad muna|recharge|top[ -]?up)\b/i,
  );
  add(
    'loan-fee',
    'Payment before a loan is released',
    'A loan offer asks for an advance payment. Verify the lender independently before paying.',
    4,
    hits(/\b(?:loan|pautang|utang|approved credit|cash assistance)\b/i),
    fee,
  );
  add(
    'job-fee',
    'Payment to unlock work or earnings',
    'A work or commission offer asks for a deposit or recharge. This resembles an advance-payment task scam.',
    4,
    hits(/\b(?:job|trabaho|hiring|tasks?|commission|komisyon|salary|sahod)\b/i),
    fee,
  );
  add(
    'task-recruitment',
    'Easy-income recruitment',
    'The message offers earnings for simple online actions and asks you to contact a recruiter. Confirm the employer and avoid deposits.',
    2,
    hits(
      /\b(?:earn|kumita|kikita|kita|paid)\b[^!?;\n]{0,100}\b(?:watching|manood|nanonood|youtube|liking|likes|rating|reviews|tasks?)\b/i,
    ),
    hits(/\b(?:contact|tutor|telegram|whatsapp|recruiter|makipag-ugnayan|message me|register)\b/i),
  );
  add(
    'cancel-lure',
    'Unexpected renewal or cancellation request',
    'A claimed automatic charge asks you to cancel or dispute it through a link. Check the official app independently.',
    3,
    hits(
      /\b(?:automatically renew|auto[ -]?renew|automatic charge|unauthorized (?:payment|transaction)|charged|renewal)\b/i,
    ),
    hits(
      /\b(?:cancel|dispute|reverse|refund|stop)\b[^!?;\n]{0,100}\b(?:visit|click|link|https?|www|here)\b/i,
    ),
  );
  add(
    'benefit-claim',
    'Benefit claim through an unverified channel',
    'A benefit or entitlement asks you to apply or contact someone. Verify eligibility and the contact through the agency directly.',
    2,
    hits(
      /\b(?:social security|sss|gsis|government|ayuda|beneficiary|entitlement|lump sum|contribution)\b/i,
    ),
    hits(
      /\b(?:claim|apply|contact|email|register|kunin)\b[^!?;\n]{0,100}(?:https?:|\b[\w-]+\.[a-z]{2,}\b|@)/i,
    ),
  );
  add(
    'load-transfer',
    'Dial code may transfer prepaid credit',
    'A reward or points message asks you to dial a service code. Confirm what the code does with your mobile provider before calling.',
    4,
    hits(/\b(?:points|bonus|prepaid|load|reward|convert|expire)\b/i),
    hits(/\*[\d*\s]{6,}#/),
  );
  add(
    'guaranteed-winnings',
    'Someone promises to control your winnings',
    'The sender promises winnings and asks for contact or a share. This does not establish that a game or offer is legitimate.',
    3,
    hits(
      /\b(?:panalunin kita|papalduhin kita|ako bahala sa winning|guaranteed win(?:nings)?|sure win)\b/i,
    ),
    hits(/\b(?:reply|message|facebook|peysbuk|fb|bahala sa(?:kin| akin)|share|deposit)\b/i),
  );
  return signals;
}
