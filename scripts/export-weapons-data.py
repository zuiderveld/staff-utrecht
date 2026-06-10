import json
import re
from pathlib import Path

SRC = Path(r"F:/[dumps]/[wapens]/ox_inventory_weapons_merged.lua")
OUT = Path(__file__).resolve().parent.parent / "js" / "weapons-data.js"


def section(text: str, name: str) -> str:
    match = re.search(rf"{name}\s*=\s*\{{", text)
    if not match:
        return ""
    start = match.end() - 1
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return ""


def parse_entries(block: str) -> list[dict]:
    items = []
    pattern = re.compile(r"\[\s*['\"]([^'\"]+)['\"]\s*\]\s*=\s*\{")
    for match in pattern.finditer(block):
        key = match.group(1)
        brace = block.find("{", match.end() - 1)
        depth = 0
        body = ""
        for i in range(brace, len(block)):
            if block[i] == "{":
                depth += 1
            elif block[i] == "}":
                depth -= 1
                if depth == 0:
                    body = block[brace : i + 1]
                    break
        label = re.search(r"label\s*=\s*['\"]([^'\"]*)['\"]", body)
        ammo = re.search(r"ammoname\s*=\s*['\"]([^'\"]*)['\"]", body)
        typ = re.search(r"type\s*=\s*['\"]([^'\"]*)['\"]", body)
        items.append(
            {
                "name": key,
                "label": label.group(1) if label else key,
                "ammo": ammo.group(1) if ammo else None,
                "type": typ.group(1) if typ else None,
                "heavy": "heavy = true" in body,
            }
        )
    return items


def categorize(component: dict) -> str:
    name = component["name"].lower()
    typ = (component.get("type") or "").lower()
    if any(x in name for x in ("supp", "suppressor", "silencer", "socomsup", "muz")):
        return "suppressor"
    if typ in {"sight", "scope"} or "scope" in name:
        return "scope"
    if typ in {"magazine", "clip", "mag"} or "clip" in name or "mag" in name:
        return "magazine"
    if typ in {"flashlight", "grip", "stock", "skin", "variant", "body", "handguard", "laser"}:
        return typ
    if typ in {"muzzle", "barrel"}:
        return "barrel"
    return typ or "other"


def main() -> None:
    text = SRC.read_text(encoding="utf-8")
    weapons = parse_entries(section(text, "Weapons"))
    components = parse_entries(section(text, "Components"))
    ammo = parse_entries(section(text, "Ammo"))
    for component in components:
        component["category"] = categorize(component)

    payload = {
        "lastUpdated": "10/06/2026",
        "weapons": weapons,
        "components": components,
        "ammo": ammo,
    }
    OUT.write_text(
        "/** ox_inventory wapens & attachments — auto gegenereerd */\n"
        "window.WEAPONS_DATA = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    print(f"Written {OUT} ({OUT.stat().st_size} bytes)")
    print(f"weapons={len(weapons)} components={len(components)} ammo={len(ammo)}")


if __name__ == "__main__":
    main()
