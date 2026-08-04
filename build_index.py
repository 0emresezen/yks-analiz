import requests
import json
import os
from yokatlas_py.client import YokAtlasClient

target_depts = [
    "Bilişim Sistemleri ve Teknolojileri",
    "Bilgisayar Bilimleri",
    "Bilgisayar Teknolojisi ve Bilişim Sistemleri",
    "Yazılım Geliştirme",
    "Bilgi Güvenliği Teknolojisi",
    "Bilgisayar Mühendisliği",
    "Yazılım Mühendisliği",
    "Bilişim Sistemleri Mühendisliği",
    "Bilgisayar ve Öğretim Teknolojileri Öğretmenliği",
    "Yapay Zeka ve Makine Öğrenmesi"
]

client = YokAtlasClient()
client._ensure_lookups()

group_ids = []
for g in client._lookups.program_groups:
    if g.birim_grup_adi in target_depts:
        group_ids.append(g.birim_grup_id)

print(f"Found {len(group_ids)} group IDs.")

payload = {
    "filters": {
        "puanTuru": None, "universiteId": [], "birimGrupId": group_ids, "ilKodu": [],
        "birimTuruId": None, "universiteTuru": None, "bursOraniId": None, "ogrenimTuruId": None,
        "kilavuzKodu": None, "minBasariSirasi": None, "maxBasariSirasi": None
    },
    "page": 0, "size": 2000, "sortBy": "basariSirasi", "direction": "ASC"
}

resp = requests.post("https://yokatlas.yok.gov.tr/api/tercih-kilavuz/search", json=payload, headers={"User-Agent": "Mozilla/5.0"})
data = resp.json().get("content", [])

program_index = []
for p in data:
    uni = p.get("universiteAdi")
    dept = p.get("birimGrupAdi")
    city = p.get("ilAdi")
    program_id = str(p.get("kilavuzKodu", ""))
    if not program_id:
        continue
        
    full_title = f"{uni} - {dept}"
    program_index.append({
        "program_id": program_id,
        "full_title": full_title,
        "city": city
    })

os.makedirs("enes", exist_ok=True)
with open("enes/program_index.json", "w", encoding="utf-8") as f:
    json.dump(program_index, f, ensure_ascii=False, indent=2)

print(f"Created enes/program_index.json with {len(program_index)} entries.")
