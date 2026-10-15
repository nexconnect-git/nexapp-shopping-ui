"""Pair saved extra-width screenshots without browser automation or cropping."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[2] / 'artifacts/customer-ui-parity'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--id', action='append')
args = parser.parse_args()
records = json.loads((root / 'extra-actual-captures.json').read_text())
if args.id:
    records = [r for r in records if r['id'] in args.id]
for record in records:
    folder = root / record['id'] / record['device']
    width = record['geometry']['width']
    height = record['geometry']['height']
    original = [Image.open(folder / name).convert('RGB') for name in ('reference-static.jpg', 'actual-after.jpg')]
    native = Image.new('RGB', (sum(i.width for i in original) + 8, max(i.height for i in original)), '#deded4')
    native.paste(original[0], (0, 0))
    native.paste(original[1], (original[0].width + 8, 0))
    native.save(folder / 'pair-direct.jpg', quality=90)
    normalized = []
    for im in original:
        if abs(im.width / im.height - width / height) >= .003:
            raise ValueError(f"Non-uniform capture geometry: {folder} {im.size}")
        normalized.append(im.resize((width, height), Image.Resampling.LANCZOS))
    pair = Image.new('RGB', (2 * width + 8, height + 28), 'white')
    ImageDraw.Draw(pair).text((8, 8), f"{record['id']} {width}px REFERENCE / ACTUAL", fill='black')
    pair.paste(normalized[0], (0, 28))
    pair.paste(normalized[1], (width + 8, 28))
    pair.save(folder / 'pair-review.jpg', quality=90)
print(f'Paired {len(records)} current extra-width captures; original pixels retained.')
