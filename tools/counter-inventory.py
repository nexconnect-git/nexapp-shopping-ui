"""Build a source-only design inventory without overwriting the acceptance ledger."""
import argparse
import json
import pathlib
import re

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("prototype", type=pathlib.Path)
prototype = parser.parse_args().prototype
source = prototype.read_text(encoding="utf-8")
manifest = json.JSONDecoder().raw_decode(source.split("const MANIFEST=", 1)[1])[0]
root = pathlib.Path("projects/vendor-app/src/app")
names = dict(zip(
    [f"P{i:02}" for i in range(1, 25)],
    ["dashboard", "live-orders", "orders", "order-detail", "order-prep", "inventory", "products",
     "product-create", "product-edit", "catalog-requests", "sales-report", "payments", "transactions",
     "coupons", "reviews", "notifications", "support", "store-settings", "login", "register",
     "change-password", "password-recovery", "password-recovery", "pending-approval"],
))
out = ["# Counter migration inventory", "",
       "Reference: `Nextou_Counter_Prototype.html`, design atlas 1.0. Direct source inspection approved on 7 October 2026 after the browser URL policy blocked local-file access. Prototype records and executable business state are excluded from runtime code.", "",
       "## Route and behavior mapping", "",
       "| Route | Family | Existing component | State/API owners retained | Conversion | Browser |",
       "| --- | --- | --- | --- | --- | --- |"]
for key, page in manifest["pages"].items():
    name = names.get(key)
    file = root / "pages" / name / (name + ".component.ts") if name else root / "app.component.ts"
    text = file.read_text(encoding="utf-8") if file.exists() else ""
    services = ", ".join(x for x in re.findall(r"inject\((\w+)\)", text)
                         if x not in ["Router", "ActivatedRoute", "DestroyRef", "ElementRef", "Injector", "NgZone"])
    if key == "U01":
        services = "PageFeatureUnavailableComponent; approvedVendorGuard"
    out.append(f"| `{page['route']}` | {key} | `{name or ('app shell' if key == 'S00' else 'shared feature unavailable')}` | {services} | Pending | Pending |")
out += ["", "## Complete atlas state mapping", "",
        "All 173 views are mapped below to route states. Unsupported capabilities remain design-only explanations. Atlas API notes must be checked against the existing typed clients.", "",
        "| ID | Route | State / overlay | Entry | Interaction | Business boundary |",
        "| --- | --- | --- | --- | --- | --- |"]
for screen in manifest["screens"]:
    values = [screen["id"], "`" + screen["route"] + "`",
              screen["title"] + " / " + (screen.get("overlay") or screen.get("flavor") or "default"),
              screen["enter"], screen["action"], screen["rule"]]
    out.append("| " + " | ".join(str(v).replace("|", " / ").replace("\n", " ") for v in values) + " |")
out += ["", "## Compatibility routes", "",
        "`/products/health`, `/products/edit/:id`, `/order/:id/tracking`, `/order/:id`, `/profile`, `/sales-report`, `/stock-management`, `/wallet`, `/payments`, `/coupons`, `/store/settings`.", "",
        "## Verification ledger", "",
        "No redesign or workflow verification is claimed by this inventory. Source inspection, browser layout checks, persisted writes, provider checks and production acceptance are separate evidence."]
target = pathlib.Path("docs/counter-source-inventory.md")
target.parent.mkdir(exist_ok=True)
target.write_text("\n".join(out) + "\n", encoding="utf-8")
print(f"Mapped {len(manifest['screens'])} design states to {len(manifest['pages'])} route/shell families.")
