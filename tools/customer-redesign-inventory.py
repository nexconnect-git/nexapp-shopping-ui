"""Record the customer atlas and existing route/API owners before presentation edits."""
import json
import pathlib
import re

root = pathlib.Path(__file__).resolve().parents[1]
app = root / 'projects/customer-app/src/app'
source = pathlib.Path(r'C:\Users\haiia\Downloads\Nextou_Customer_Redesign.html').read_text(encoding='utf-8')
manifest = json.JSONDecoder().raw_decode(source.split('const MANIFEST=', 1)[1])[0]
names = dict(zip(['C02','C01','C03','C04','C05','C06','C07','C08','C09','C10','C11','C12','C13','C14','C15','C16','C17','C18'],
                 ['home','location','categories','category','stores','search','store-detail','product-detail','cart','checkout','orders','order-confirmed','tracking','order-finished','profile','addresses','notifications','privacy-policy']))
rows = ['# Customer redesign implementation and acceptance ledger', '',
        'Reference inspected through a loopback-only HTTP preview on 8 October 2026. All 150 atlas states have been selected and their rendered contents inspected. Browser evidence is recorded separately from implementation. No prototype business records or executable demo logic enter production.', '',
        '## Baseline routes and retained behavior', '',
        '| Family | Route | Component | Existing owners | Existing actions | API reference to verify | Implementation | Browser acceptance |',
        '| --- | --- | --- | --- | --- | --- | --- | --- |']
for family, page in manifest['pages'].items():
    name = names.get(family)
    files = [app/'pages'/name/(name+'.component.ts')] if name else list((app/'shared').glob('*/*.ts')) if family in ['A01','S00'] else []
    text = '\n'.join(p.read_text(encoding='utf-8') for p in files if p.exists())
    owners = sorted(set(re.findall(r'(\w+(?:Service|Facade))', text)))
    actions = re.findall(r'^  (?:async )?(\w+)\([^\n]*\)(?:\s*:\s*[^\n{]+)?\s*\{', text, re.M)
    values = [family,page['route'], name or ('shared overlays' if family in ['A01','S00'] else 'system / proposed'), ', '.join(owners), ', '.join(actions), page['api'], 'Pending', 'Pending']
    rows.append('| '+' | '.join(str(x).replace('|',' / ') for x in values)+' |')
rows += ['', '## Every named prototype state', '', '| ID | State | Route | Owner | Status | Verified |', '| --- | --- | --- | --- | --- | --- |']
for s in manifest['screens']:
    rows.append('| '+' | '.join([s['id'],s['title'],s['route'],names.get(s['page'],'shared / proposed'),'Pending' if s['page']!='P01' else 'Contract review; inactive','No'])+' |')
rows += ['', '## Preserved API implementation sources', '']
for p in sorted((app/'services').glob('*api*.ts')):
    rows += ['### '+p.name, '', '```typescript', p.read_text(encoding='utf-8'), '```', '']
rows += ['## Known baseline gaps', '',
         '- Location guard converts failed serviceability to available; must retain unknown/error semantics.',
         '- Home purchase/popularity labels use inferred catalog/cart scores; only actual purchase-history rails may say Buy again.',
         '- Existing checkout splits desktop/mobile templates and omits a distinct delivery step in desktop.',
         '- Modal shell lacks a shared focus trap and restoration contract.',
         '- API checks, persisted writes, payment-provider acceptance, and live GPS acceptance remain unverified until exercised against isolated QA.', '',
         '## Proposed boundaries', '',
         'Delivery capacity slots and P01 support surfaces require verified contracts. Preserve inactive support compatibility redirects until contract review; never activate demo messages or pretend slots.', '']
# This captures a baseline; never overwrite the reviewed acceptance ledger.
target = root/'docs/customer-redesign-baseline.md'
target.parent.mkdir(exist_ok=True)
target.write_text('\n'.join(rows),encoding='utf-8')
print(f'Inventory: {target}; {len(names)} route components, {len(manifest["screens"])} states')
