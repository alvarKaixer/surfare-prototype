"""Import user-supplied corpora for development, without training or evaluation.

Usage: python research/scripts/import-development-data.py messages.csv urls.csv
Raw data and deterministic holdouts remain in ignored .preview storage.
"""
import csv
import hashlib
import json
import pathlib
import re
import sys

root = pathlib.Path('.preview/datasets')
root.mkdir(parents=True, exist_ok=True)
manifest = {'purpose': 'development only; no accuracy evaluation performed', 'sources': []}
for name, filename, text_key, label_key in [
    ('asea', sys.argv[1], 'text', 'intent'),
    ('phiusiil', sys.argv[2], 'URL', 'label'),
]:
    source = pathlib.Path(filename)
    out = root / name
    out.mkdir(exist_ok=True)
    # Group repeated templates together before inspecting development examples.
    groups = {}
    with source.open(encoding='utf-8-sig', newline='') as handle:
        for row in csv.DictReader(handle):
            text, label = row[text_key].strip(), row[label_key].strip()
            if not text or not label:
                continue
            template = re.sub(r'\s+', ' ', text.casefold())
            if name == 'asea':
                template = re.sub(r'https?://\S+|www\.\S+', '[url]', template)
                template = re.sub(r'\d+', '#', template)
            else:
                from urllib.parse import urlsplit
                template = urlsplit(text if '://' in text else 'https://' + text).hostname or template
            key = hashlib.sha256(template.encode()).hexdigest()
            groups.setdefault(key, []).append({'text': text, 'label': label})
    counts = {'development': 0, 'holdout': 0, 'conflicting_groups': 0}
    labels = {}
    with (out / 'development.jsonl').open('w', encoding='utf-8') as dev, (out / 'holdout.jsonl').open('w', encoding='utf-8') as hold:
        for key, rows in groups.items():
            if len({r['label'] for r in rows}) != 1:
                counts['conflicting_groups'] += 1
                continue
            split = 'holdout' if int(key[:8], 16) % 5 == 0 else 'development'
            seen = set()
            for row in rows:
                if row['text'] in seen:
                    continue
                seen.add(row['text'])
                (hold if split == 'holdout' else dev).write(json.dumps(row, ensure_ascii=False) + '\n')
                counts[split] += 1
                if split == 'development':
                    labels[row['label']] = labels.get(row['label'], 0) + 1
    manifest['sources'].append({'name': name, 'file': source.name, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'counts': counts, 'development_labels': labels})
(root / 'development-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(json.dumps(manifest, indent=2))
