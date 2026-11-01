"""Prepare downloaded public corpora without executing third-party code.

Inputs: .preview/datasets/{uci.zip,filipino.csv}. See docs/DETECTION.md.
Only development data is written; raw messages are not bundled in the app.
"""
import csv, hashlib, io, json, pathlib, re, unicodedata, zipfile

root = pathlib.Path('.preview/datasets')
uci = zipfile.ZipFile(root / 'uci.zip').read('SMSSpamCollection').decode('utf-8')
rows = []
for line in uci.splitlines():
    label, text = line.split('\t', 1)
    rows.append(dict(text=text, label=label, source='UCI SMS Spam Collection'))
# This upstream CSV mixes legacy encodings. Preserve ASCII and replace undecodable bytes.
raw = (root / 'filipino.csv').read_bytes().decode('utf-8', errors='replace')
for row in csv.DictReader(io.StringIO(raw)):
    label = row['label'].strip().lower()
    if label not in ('ham', 'spam'):
        raise ValueError('Unexpected upstream label: ' + label)
    rows.append(dict(text=row['message'], label=label, source='Filipino SMS corpus'))

def fingerprint(text):
    text = unicodedata.normalize('NFKC', text).lower()
    text = re.sub(r'https?://\S+|\b\S+\.(?:com|net|org|ph|online|xyz|co|uk)\S*', ' url ', text)
    text = re.sub(r'\d+', ' number ', text)
    return ' '.join(re.findall(r'[a-z]+', text))

groups = {}
for row in rows:
    key = fingerprint(row['text'])
    groups.setdefault(key, []).append(row)
output = []
conflicts = 0
for key, group in groups.items():
    if len({r['label'] for r in group}) != 1:
        conflicts += len(group)
        continue
    # A whole normalized template belongs to one split; keep one representative.
    digest = hashlib.sha256(('surfare-v1|' + key).encode()).hexdigest()
    bucket = int(digest[:8], 16) % 100
    row = group[0]
    output.append(dict(row, id=digest[:16], split='train' if bucket < 70 else 'validation' if bucket < 85 else 'test'))
payload = dict(rows=output, provenance=dict(rawCount=len(rows), uniqueTemplates=len(output), conflictingRowsRemoved=conflicts,
    sources=[dict(file=name, sha256=hashlib.sha256((root / name).read_bytes()).hexdigest()) for name in ['uci.zip', 'filipino.csv']],
    split='SHA-256 of normalized template; 70/15/15 train/validation/test; URLs and digits masked before grouping'))
(root / 'prepared.json').write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8')
print(json.dumps({**payload['provenance'], 'splits': {s: sum(r['split']==s for r in output) for s in ['train','validation','test']}}))
