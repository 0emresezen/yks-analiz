import requests
import json
import os
from yokatlas_py.client import YokAtlasClient

target_depts = [
    "Bilişim Sistemleri ve Teknolojileri",
    "Bilgisayar Bilimleri",
    "Bilgisayar Teknolojisi ve Bilişim Sistemleri",
    "Yazılım Geliştirme",
    "Bilgi Güvenliği Teknolojisi"
]

client = YokAtlasClient()
client._ensure_lookups()

group_ids = []
for g in client._lookups.program_groups:
    if g.birim_grup_adi in target_depts:
        group_ids.append(g.birim_grup_id)

print("Found group IDs:", group_ids)

# Fetch programs
payload = {
    "filters": {
        "puanTuru": None, "universiteId": [], "birimGrupId": group_ids, "ilKodu": [],
        "birimTuruId": None, "universiteTuru": None, "bursOraniId": None, "ogrenimTuruId": None,
        "kilavuzKodu": None, "minBasariSirasi": 200000, "maxBasariSirasi": 400000
    },
    "page": 0, "size": 500, "sortBy": "basariSirasi", "direction": "ASC"
}

resp = requests.post("https://yokatlas.yok.gov.tr/api/tercih-kilavuz/search", json=payload, headers={"User-Agent": "Mozilla/5.0"})
data = resp.json().get("content", [])

print(f"Found {len(data)} programs between 200k and 400k")

# Read existing markdown
md_path = "engine/lisans_tercih_analizi.md"
with open(md_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

existing = set()
for line in lines:
    if "|" in line and "**" in line:
        cols = [c.strip() for c in line.split("|")]
        if len(cols) > 3:
            existing.add(cols[2])

added_count = 0
last_idx = 49 # Starting after 49
with open(md_path, "a", encoding="utf-8") as f:
    for p in data:
        uni = p.get("universiteAdi")
        dept = p.get("birimGrupAdi")
        city = p.get("ilAdi")
        full_title = f"{uni} - {dept}"
        
        # Don't add if already in existing
        if full_title not in existing:
            last_idx += 1
            f.write(f"| **{last_idx}** | {full_title} | {city} | - | - | - | - | - |\n")
            existing.add(full_title)
            added_count += 1

print(f"Added {added_count} new programs to markdown.")
