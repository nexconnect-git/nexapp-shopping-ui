"""Record explicitly inspected extra-width pairs, bound to original image hashes."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[2] / 'artifacts/customer-ui-parity'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--id', action='append', required=True)
parser.add_argument('--width', action='append', type=int)
parser.add_argument('--notes', required=True)
parser.add_argument('--status', default='REVIEWED — real-data differences documented')
args = parser.parse_args()
path = root / 'extra-visual-review-ledger.json'
ledger = json.loads(path.read_text(encoding='utf-8')) if path.exists() else []
records = json.loads((root / 'extra-actual-captures.json').read_text(encoding='utf-8'))
for record in records:
    if record['id'] not in args.id or (args.width and record['geometry']['width'] not in args.width):
        continue
    folder = root / record['id'] / record['device']
    entry = dict(id=record['id'], device=record['device'], status=args.status,
                 reviewed_at=datetime.now(timezone.utc).isoformat(), notes=args.notes,
                 actual_sha256=hashlib.sha256((folder / 'actual-after.jpg').read_bytes()).hexdigest(),
                 reference_sha256=hashlib.sha256((folder / 'reference-static.jpg').read_bytes()).hexdigest())
    ledger = [r for r in ledger if (r['id'], r['device']) != (record['id'], record['device'])]
    ledger.append(entry)
path.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print(f'{len(ledger)} explicitly inspected extra-width pairs recorded.')
