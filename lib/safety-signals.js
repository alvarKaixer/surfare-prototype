import { normalizeEvidence, evidenceMatches } from './text-evidence.js';

export function safetySignals(text) {
  const source = normalizeEvidence(text),
    signals = [];
  const hits = (re, activeOnly = true) => evidenceMatches(source, re, { activeOnly });
  const add = (id, title, message, weight, evidence, category) => {
    if (evidence.length) signals.push({ id, title, message, weight, evidence, category });
  };
  const target = '(?:kita|ka(?:yo)?|ikaw|siya|sila|ang\\s+(?:pamilya|anak|asawa|magulang)\\s+mo)';
  const harm =
    '(?:papatayin|papatayen|papatay|patayin|sasaktan|saktan|babarilin|barilin|bubugbugin|bugbugin|sasaksakin|saksakin|gagahasain|kikidnapin|dudukutin)';
  const filipino = new RegExp(
    '\\b' +
      harm +
      '\\s*(?:(?:ko|namin)\\s*)?' +
      target +
      '\\b|\\b(?:' +
      target +
      ')\\s+(?:(?:ay|talaga|mismo)\\s+)?' +
      harm +
      '\\b',
    'i',
  );
  const english =
    /\b(?:(?:i|we)\s*(?:(?:will|'ll|am going to|are going to|gonna)\s*)?)?(?:kill|hurt|shoot|stab|rape|kidnap|beat\s+up)\s+(?:you|u|your\s+(?:family|child|kids|wife|husband|parents))\b|\byou(?:'re| are)\s+(?:dead|going to die)\b/i;
  let violence = [...hits(filipino), ...hits(english)];
  // Offline coverage for indirect forms; contextual AI handles meaning beyond these patterns.
  violence.push(
    ...hits(/\bpatay\s*(?:ka|kayo)\s+(?:sa\s*['’]?kin|sa\s+akin|saken|sa\s*amin)\b/i, false),
  );
  violence.push(
    ...hits(
      /\b(?:hindi|di)\s+(?:ka|kayo)\s+(?:na\s+)?(?:makakauwi|makakalabas)\s+(?:nang|ng|na)\s+buhay\b|\byou\s+will\s+(?:not|never)\s+live\s+to\s+see\s+tomorrow\b/i,
      false,
    ),
  );
  violence.push(
    ...hits(
      /\b(?:tanggal|putol|pugot)\s+(?:(?:ang|yung|na)\s+){0,2}(?:ulo|leeg)\s+(?:mo|niya|nya|niyo|ninyo)\b|\b(?:pupugutan|pugutan|puputulan|putulan)\s*(?:ko\s+)?(?:kita|ka|siya|sya|sila)\s+(?:ng\s+)?(?:ulo|leeg)\b/i,
    ),
  );
  violence = violence.filter(
    (e) =>
      !(
        /\bshoot\b/i.test(e.text) &&
        /^\s+(?:(?:for|in)\s+(?:a|the)\s+)?(?:portrait|photo|picture|video|scene)\b/i.test(
          text.slice(e.end),
        )
      ),
  );
  // Clearly marked fictional/game discussion is context, unless paired with coercion.
  const demand = hits(
    /\b(?:send(?:an|han)?\s*(?:mo\s*)?(?:ko|me)?|magpadala|padalhan|padala|magbayad|bayaran|pay|transfer|bigay|ibigay)\b[^.!?\n]{0,55}\b(?:pera|money|cash|gcash|bayad|ransom|pantubos|php|pesos?|dollars?)\b/i,
  );
  // "If you don't pay" is a coercive condition, rather than advice not to pay.
  demand.push(
    ...hits(
      /\b(?:pag|kapag|kung)\s+(?:hindi|di)\s+(?:(?:ka|mo|kayo|nyo|ninyo)\s+)?(?:nagpadala|magpadala|nagbayad|magbayad|binayaran|sinend|nag-send)\b[^.!?\n]{0,55}\b(?:pera|money|cash|gcash|bayad|ransom|pantubos|php|pesos?|dollars?)\b/i,
      false,
    ),
  );
  if (!demand.length)
    violence = violence.filter((e) => {
      const clause =
        text
          .slice(0, e.start)
          .split(/[.!?\n]/)
          .pop() || '';
      return !(
        /\b(?:movie|film|pelikula|video game|laro|novel|script|fictional|character)\b/i.test(
          clause,
        ) && /\b(?:quote|line|linya|dialogue|character|kalaban|enemy)\b/i.test(clause)
      );
    });
  add(
    'violence',
    'Threat of physical harm',
    'The wording threatens to harm or kill someone. Treat a personal threat seriously even if no scam link or payment is involved.',
    6,
    violence,
    'personal safety',
  );
  const stalking = hits(
    /\b(?:alam\s+(?:ko|namin)\s+(?:kung\s+)?(?:saan\s+ka\s+(?:nakatira|nagtatrabaho)|ang\s+(?:bahay|address)\s+mo)|i\s+know\s+where\s+you\s+(?:live|work)|(?:pupuntahan|susundan|aabangan)\s*(?:kita|ka))\b/i,
  );
  stalking.push(
    ...hits(
      /\b(?:delikado\s+ka\s+(?:sa\s*['’]?kin|sa\s+akin|saken)|may\s+kalalagyan\s+ka(?:\s+sa\s+akin)?|(?:tingin|tumingin|look)\s+(?:sa\s+likod\s+mo|behind\s+you))\b/i,
      false,
    ),
  );
  // Colloquial retaliation and danger to relatives can imply harm without an explicit violence verb.
  stalking.push(
    ...hits(
      /\bmay\s+araw\s+ka\s*(?:(?:rin|din)\s+)?(?:sa\s*['’]?kin|sa\s+akin|saken|sa\s+amin)\b/i,
    ),
  );
  const familyDanger = hits(
    /\bdelikado\s+(?:(?:na|pati|rin|din|ang|yung)\s+){0,4}(?:pamilya|anak|asawa|magulang)\s+mo\b/i,
  );
  stalking.push(...familyDanger);
  const familyLeverage = hits(
    /\b(?:bayaran|magbayad|bayad|pay|send)\b[^.!?\n]{0,65}\b(?:o|or|kung\s+hindi)\s+(?:(?:ang|yung|your)\s+)?(?:pamilya\s+mo|anak\s+mo|asawa\s+mo|family|children)\b/i,
    false,
  );
  const exposure = hits(
    /\b(?:(?:ikakalat|ipapakalat|ikalat|ipapaskil|ipopost|i-post|ipost|ilalabas|ia-upload)\b[^.!?\n]{0,65}\b(?:larawan|pictures?|photos?|video|nudes?|scandal|sikreto|secrets?)|(?:leak|release|publish|post|share|expose)\b[^.!?\n]{0,55}\b(?:your|ur)\b[^.!?\n]{0,30}\b(?:nudes?|photos?|pictures?|videos?|secrets?))\b/i,
  );
  if (
    familyLeverage.length ||
    (demand.length && (violence.length || stalking.length || exposure.length))
  )
    add(
      'extortion',
      'Coercion or extortion',
      'A demand is paired with harm, intimidation, or a reference to consequences for family or private material. An incomplete threat still warrants caution.',
      6,
      [...demand, ...stalking, ...exposure, ...familyLeverage],
      'personal safety',
    );
  else if (exposure.length)
    add(
      'blackmail',
      'Threat to expose private material',
      'The message threatens to share private images or information. This may be blackmail or image-based abuse.',
      5,
      exposure,
      'personal safety',
    );
  else if (stalking.length)
    add(
      'intimidation',
      'Personal intimidation',
      'The wording implies retaliation, danger to you or your family, or unwanted pursuit. Check the surrounding context and take unwanted intimidation seriously.',
      3,
      stalking,
      'personal safety',
    );
  return signals;
}
