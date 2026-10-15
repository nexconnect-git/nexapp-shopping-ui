"""Correct descriptive metadata for restored feedback without editing screenshots."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2] / 'artifacts/customer-ui-parity'
index_path = root / 'extra-actual-captures.json'
records = json.loads(index_path.read_text(encoding='utf-8'))
description = 'Actual delivered owned order with persisted original store4/5; duplicate feedback hidden; temporary delivery feedback restored.'
for record in records:
    if record['id'] != 'C14-04':
        continue
    record['state'] = description
    path = root / record['id'] / record['device'] / 'actual-capture.json'
    metadata = json.loads(path.read_text(encoding='utf-8'))
    metadata['state'] = description
    path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
index_path.write_text(json.dumps(records, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print('Corrected five original-feedback capture descriptions; screenshots unchanged.')
