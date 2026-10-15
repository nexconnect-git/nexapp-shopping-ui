"""Assemble saved browser images; never drives a browser or changes captures."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[2] / 'artifacts/customer-ui-parity'
manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
actual = json.loads((ROOT / 'actual-captures.json').read_text(encoding='utf-8'))
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--family', action='append', help='Rebuild only these review families.')
options = parser.parse_args()
if options.family:
    actual = [entry for entry in actual if entry['id'].split('-')[0] in options.family]
refs = [json.loads(p.read_text(encoding='utf-8')) for p in sorted(ROOT.glob('*/*/reference-direct-capture.json'))]
(ROOT / 'reference-direct-captures.json').write_text(json.dumps(refs, indent=2), encoding='utf-8')
out = ROOT / 'review-sheets'
out.mkdir(exist_ok=True)
errors = []
pairs = {}
for entry in actual:
    key = (entry['id'], entry['device'])
    folder = ROOT / key[0] / key[1]
    left = folder / 'reference-rendered.jpg'
    right = folder / 'actual-after.jpg'
    if not left.exists() or not right.exists():
        continue
    ref = Image.open(left).convert('RGB')
    live = Image.open(right).convert('RGB')
    if ref.size != live.size:
        errors.append({'id':key[0], 'device':key[1], 'ref':ref.size, 'actual':live.size, 'severe':abs(ref.width-live.width)>30 or abs(ref.height-live.height)>50})
    canvas = Image.new('RGB',(ref.width+live.width+8,max(ref.height,live.height)), '#deded4')
    canvas.paste(ref,(0,0));canvas.paste(live,(ref.width+8,0))
    canvas.save(folder / 'pair-direct.jpg',quality=90)
    # The browser host can return a uniformly scaled raster despite the requested
    # CSS viewport. Preserve the native pair above; normalize only review sheets
    # when both aspect ratios confirm a uniform scale (never crop or pad a page).
    target = {'desktop': (1440, 960), 'tablet': (834, 1112), 'phone': (390, 844)}[key[1]]
    normalized = []
    for raster in (ref, live):
        if abs(raster.width / raster.height - target[0] / target[1]) < .003:
            normalized.append(raster.resize(target, Image.Resampling.LANCZOS))
        else:
            normalized.append(raster)
    review = Image.new('RGB', (normalized[0].width + normalized[1].width + 8,
                              max(im.height for im in normalized)), '#deded4')
    review.paste(normalized[0], (0, 0))
    review.paste(normalized[1], (normalized[0].width + 8, 0))
    review.save(folder / 'pair-review.jpg', quality=90)
    pairs[key] = review
for family in manifest['pages']:
    if options.family and family not in options.family:
        continue
    states = [s for s in manifest['screens'] if s['id'].startswith(family+'-')]
    for device in ['desktop','tablet','phone']:
        rows = []
        for state in states:
            im = pairs.get((state['id'],device))
            if im is None:
                continue
            im = im.copy();im.thumbnail((740,720))
            row = Image.new('RGB',(760,im.height+32),'white')
            ImageDraw.Draw(row).text((8,8), state['id']+' REFERENCE / ACTUAL',fill='black')
            row.paste(im,(8,28));rows.append(row)
        for n in range(0,len(rows),3):
            part = rows[n:n+3]
            sheet = Image.new('RGB',(760,sum(r.height for r in part)+12*(len(part)-1)), '#d3d6cd')
            y = 0
            for row in part:
                sheet.paste(row,(0,y));y += row.height+12
            sheet.save(out / f'{family}-{device}-{n//3+1}.jpg',quality=90)
audit_name = 'direct-pair-audit.json' if not options.family else 'direct-pair-audit-' + '-'.join(options.family) + '.json'
(ROOT / audit_name).write_text(json.dumps({'reference_count':len(refs),'pair_count':len(pairs),'raster_mismatches':errors},indent=2),encoding='utf-8')
print(f'References {len(refs)}, pairs {len(pairs)}, severe raster differences {sum(e["severe"] for e in errors)}; saved {len(list(out.glob("*.jpg")))} review sheets.')
