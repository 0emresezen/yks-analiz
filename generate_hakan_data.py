import json
import csv
import os

# Hakan'ın 8 Tercihi ve YÖK Atlas Verileri
hakan_records = [
  {
    "id": 1,
    "program_id": "110110507",
    "degree": "Lisans (4Y)",
    "score_type": "EA",
    "university": "YILDIZ TEKNİK ÜNİVERSİTESİ (İSTANBUL)",
    "department": "İktisat (İngilizce)",
    "full_name": "YILDIZ TEKNİK ÜNİVERSİTESİ (İSTANBUL) - İktisat (İngilizce)",
    "faculty": "İktisadi ve İdari Bilimler Fakültesi",
    "language": "İngilizce",
    "tuition_status": "Devlet (Ücretsiz)",
    "city": "İstanbul",
    "transport_desc": "Davutpaşa Kampüsü (M1B YTÜ Davutpaşa Metro durağı kampüs içinde).",
    "transport_score": 9,
    "uniar_score": 9,
    "uniar_desc": "Büyükşehir sosyalleşme imkanları ve zengin kulüp faaliyetleri (ÜNİAR A+).",
    "prestige_score": 9,
    "prestige_desc": "Teknik üniversite diploması ve finans/fintech sektöründe yüksek kabul.",
    "academic_score": 9,
    "academic_desc": "Köklü akademik kadro (16 Prof, 2 Doç), zorunlu hazırlık.",
    "last_rank": 3868,
    "prediction": {
      "tahmini_skor": 3450
    },
    "history_rankings": [24514, 10367, 6753, 3868],
    "history_quotas": [75, 75, 70, 70],
    "rating": 9,
    "notes": "Özel Koşullar: Bk. 22, 23, 24 (%100 İngilizce, Zorunlu Hazırlık)",
    "isFavorite": False
  },
  {
    "id": 2,
    "program_id": "107290348",
    "degree": "Lisans (4Y)",
    "score_type": "EA",
    "university": "MARMARA ÜNİVERSİTESİ (İSTANBUL)",
    "department": "Yönetim Bilişim Sistemleri (İngilizce)",
    "full_name": "MARMARA ÜNİVERSİTESİ (İSTANBUL) - Yönetim Bilişim Sistemleri (İngilizce)",
    "faculty": "İşletme Fakültesi",
    "language": "İngilizce",
    "tuition_status": "Devlet (Ücretsiz)",
    "city": "İstanbul",
    "transport_desc": "Recep Tayyip Erdoğan Külliyesi (Maltepe Başıbüyük yerleşkesi).",
    "transport_score": 8,
    "uniar_score": 9,
    "uniar_desc": "Büyükşehir sosyalleşme imkanları ve yazılım/bilişim kulüpleri (ÜNİAR A).",
    "prestige_score": 10,
    "prestige_desc": "Türkiye'nin en köklü YBS departmanlarından biri; yazılım & bankacılık mezun ağı.",
    "academic_score": 9,
    "academic_desc": "İşletme Fakültesi bünyesinde güçlü İngilizce YBS müfredatı.",
    "last_rank": 3946,
    "prediction": {
      "tahmini_skor": 3820
    },
    "history_rankings": [6831, 3470, 3942, 3946],
    "history_quotas": [60, 60, 60, 60],
    "rating": 10,
    "notes": "Özel Koşullar: Bk. 22, 23, 24 (%100 İngilizce, Zorunlu Hazırlık)",
    "isFavorite": False
  },
  {
    "id": 3,
    "program_id": "110190084",
    "degree": "Lisans (4Y)",
    "score_type": "EA",
    "university": "YILDIZ TEKNİK ÜNİVERSİTESİ (İSTANBUL)",
    "department": "İşletme (İngilizce)",
    "full_name": "YILDIZ TEKNİK ÜNİVERSİTESİ (İSTANBUL) - İşletme (İngilizce)",
    "faculty": "İktisadi ve İdari Bilimler Fakültesi",
    "language": "İngilizce",
    "tuition_status": "Devlet (Ücretsiz)",
    "city": "İstanbul",
    "transport_desc": "Davutpaşa Kampüsü (Metro bağlantısı ve sosyal imkanlar).",
    "transport_score": 9,
    "uniar_score": 9,
    "uniar_desc": "YTÜ Kampüs yaşamı ve girişimcilik kulüpleri (ÜNİAR A+).",
    "prestige_score": 9,
    "prestige_desc": "Teknik üniversitede İngilizce İşletme; denetim (Big 4) ve kurumsal sektör gücü.",
    "academic_score": 9,
    "academic_desc": "Akredite lisans müfredatı, uluslararası değişim imkanları.",
    "last_rank": 4470,
    "prediction": {
      "tahmini_skor": 3980
    },
    "history_rankings": [25731, 12061, 7943, 4470],
    "history_quotas": [70, 70, 70, 70],
    "rating": 9,
    "notes": "Özel Koşullar: Bk. 22, 23, 24 (%100 İngilizce, Zorunlu Hazırlık)",
    "isFavorite": False
  },
  {
    "id": 4,
    "program_id": "200510349",
    "degree": "Lisans (4Y)",
    "score_type": "EA",
    "university": "BAHÇEŞEHİR ÜNİVERSİTESİ (İSTANBUL)",
    "department": "İşletme (İngilizce) (Burslu)",
    "full_name": "BAHÇEŞEHİR ÜNİVERSİTESİ (İSTANBUL) - İşletme (İngilizce) (Burslu)",
    "faculty": "İktisadi, İdari ve Sosyal Bilimler Fakültesi",
    "language": "İngilizce",
    "tuition_status": "Vakıf (Burslu)",
    "city": "İstanbul",
    "transport_desc": "Beşiktaş Güney Kampüsü (Boğaz kıyısında, ulaşım ve konum mükemmel).",
    "transport_score": 10,
    "uniar_score": 9,
    "uniar_desc": "Beşiktaş merkezde yüksek sosyal yaşam ve global network.",
    "prestige_score": 9,
    "prestige_desc": "CO-OP eğitim modeli ile okurken kurumsal şirketlerde uzun dönemli staj.",
    "academic_score": 8,
    "academic_desc": "BAU Global ağları ve İngilizce işletme eğitimi.",
    "last_rank": 5650,
    "prediction": {
      "tahmini_skor": 5200
    },
    "history_rankings": [5218, 4364, 4886, 5650],
    "history_quotas": [10, 10, 10, 10],
    "rating": 9,
    "notes": "Özel Koşullar: Bk. 18, 21, 22, 23, 24, 64 (%100 Burslu, Beşiktaş Kampüsü)",
    "isFavorite": False
  },
  {
    "id": 5,
    "program_id": "105690802",
    "degree": "Lisans (4Y)",
    "score_type": "EA",
    "university": "İSTANBUL ÜNİVERSİTESİ",
    "department": "Yönetim Bilişim Sistemleri (İngilizce)",
    "full_name": "İSTANBUL ÜNİVERSİTESİ - Yönetim Bilişim Sistemleri (İngilizce)",
    "faculty": "İktisat Fakültesi",
    "language": "İngilizce",
    "tuition_status": "Devlet (Ücretsiz)",
    "city": "İstanbul",
    "transport_desc": "Beyazıt Ana Kampüsü (T1 Tramvay ve M2 Vezneciler durağı yanında).",
    "transport_score": 10,
    "uniar_score": 8,
    "uniar_desc": "Tarihi yarımada yerleşkesi ve köklü öğrenci kulüpleri.",
    "prestige_score": 9,
    "prestige_desc": "İÜ İktisat ekolü ile bilişimin birleşimi; yüksek mezun tanınırlığı.",
    "academic_score": 9,
    "academic_desc": "Köklü profesör kadrosu ve İngilizce YBS eğitimi.",
    "last_rank": 6097,
    "prediction": {
      "tahmini_skor": 5850
    },
    "history_rankings": [15584, 6451, 7190, 6097],
    "history_quotas": [60, 60, 60, 60],
    "rating": 9,
    "notes": "Özel Koşullar: Bk. 22, 23, 24 (%100 İngilizce, Zorunlu Hazırlık)",
    "isFavorite": False
  },
  {
    "id": 6,
    "program_id": "104810432",
    "degree": "Lisans (4Y)",
    "score_type": "EA",
    "university": "HACETTEPE ÜNİVERSİTESİ (ANKARA)",
    "department": "İşletme (İngilizce)",
    "full_name": "HACETTEPE ÜNİVERSİTESİ (ANKARA) - İşletme (İngilizce)",
    "faculty": "İktisadi ve İdari Bilimler Fakültesi",
    "language": "İngilizce",
    "tuition_status": "Devlet (Ücretsiz)",
    "city": "Ankara",
    "transport_desc": "Beytepe Kampüsü (M2 Metro + Beytepe ring otobüsleri).",
    "transport_score": 7,
    "uniar_score": 9,
    "uniar_desc": "Ankara Beytepe yeşil kampüs ortamı ve zengin öğrenci kulüpleri (ÜNİAR A+).",
    "prestige_score": 9,
    "prestige_desc": "Hacettepe İİBF markası; kamu, savunma sanayii ve kurumsal mezun ağı.",
    "academic_score": 9,
    "academic_desc": "Köklü Ankara İİBF akademik geleneği.",
    "last_rank": 7904,
    "prediction": {
      "tahmini_skor": 6900
    },
    "history_rankings": [52363, 25471, 15884, 7904],
    "history_quotas": [80, 80, 80, 80],
    "rating": 8,
    "notes": "Özel Koşullar: Bk. 22, 23, 24 (%100 İngilizce, Zorunlu Hazırlık)",
    "isFavorite": False
  },
  {
    "id": 7,
    "program_id": "104810414",
    "degree": "Lisans (4Y)",
    "score_type": "EA",
    "university": "HACETTEPE ÜNİVERSİTESİ (ANKARA)",
    "department": "İktisat (İngilizce)",
    "full_name": "HACETTEPE ÜNİVERSİTESİ (ANKARA) - İktisat (İngilizce)",
    "faculty": "İktisadi ve İdari Bilimler Fakültesi",
    "language": "İngilizce",
    "tuition_status": "Devlet (Ücretsiz)",
    "city": "Ankara",
    "transport_desc": "Beytepe Kampüsü (M2 Metro + Beytepe ring otobüsleri).",
    "transport_score": 7,
    "uniar_score": 9,
    "uniar_desc": "Ankara Beytepe kampüs yaşamı.",
    "prestige_score": 9,
    "prestige_desc": "Hacettepe İktisat ekolü; Merkez Bankası, Hazine ve finans sektöründe güçlü mezunlar.",
    "academic_score": 9,
    "academic_desc": "Güçlü teorik ve ekonometrik altyapı (16 Prof, 2 Doç).",
    "last_rank": 9782,
    "prediction": {
      "tahmini_skor": 8500
    },
    "history_rankings": [66564, 38246, 20752, 9782],
    "history_quotas": [75, 75, 70, 70],
    "rating": 8,
    "notes": "Özel Koşullar: Bk. 22, 23, 24 (%100 İngilizce, Zorunlu Hazırlık)",
    "isFavorite": False
  },
  {
    "id": 8,
    "program_id": "110110137",
    "degree": "Lisans (4Y)",
    "score_type": "EA",
    "university": "YILDIZ TEKNİK ÜNİVERSİTESİ (İSTANBUL)",
    "department": "İşletme",
    "full_name": "YILDIZ TEKNİK ÜNİVERSİTESİ (İSTANBUL) - İşletme",
    "faculty": "İktisadi ve İdari Bilimler Fakültesi",
    "language": "İngilizce (%30)",
    "tuition_status": "Devlet (Ücretsiz)",
    "city": "İstanbul",
    "transport_desc": "Davutpaşa Kampüsü (Metro bağlantısı, geniş sosyal tesisler).",
    "transport_score": 9,
    "uniar_score": 9,
    "uniar_desc": "YTÜ Kampüs ortamı (ÜNİAR A+).",
    "prestige_score": 8,
    "prestige_desc": "STAR akreditasyonlu %30 İngilizce İşletme eğitimi; yüksek sektör tanınırlığı.",
    "academic_score": 9,
    "academic_desc": "18 Prof, 8 Doçent ile son derece geniş akademik kadro.",
    "last_rank": 10109,
    "prediction": {
      "tahmini_skor": 8900
    },
    "history_rankings": [82578, 51678, 24350, 10109],
    "history_quotas": [90, 100, 70, 70],
    "rating": 8,
    "notes": "Özel Koşullar: Bk. 22, 24, 34 (%30 İngilizce, Zorunlu Hazırlık)",
    "isFavorite": False
  }
]

from enes.fetch_and_enrich import calculate_detailed_metrics
from datetime import datetime

for r in hakan_records:
    if "prediction" in r:
        r["prediction"]["model"] = "linear_regression_elastic_quota"
        r["prediction"]["confidence"] = "high"
        r["prediction"]["prediction_generated_at"] = datetime.now().isoformat()
    
    # Run the 14-dimensional scoring model
    calculate_detailed_metrics(r)

# Restore existing ai_eval fields if any to prevent overwriting LLM analysis
hakan_db_path = "hakan/yks_master_database.json"
if os.path.exists(hakan_db_path):
    try:
        with open(hakan_db_path, "r", encoding="utf-8") as f:
            old_data = json.load(f)
            old_evals = {item["program_id"]: item["ai_eval"] for item in old_data if "ai_eval" in item}
            for r in hakan_records:
                if r["program_id"] in old_evals:
                    r["ai_eval"] = old_evals[r["program_id"]]
    except Exception as e:
        print(f"Warning: Could not load old data to preserve ai_eval: {e}")

# Verify integrity before writing validated output
from verification.integrity_checker import IntegrityChecker
IntegrityChecker.run_database_checks(hakan_records)

os.makedirs("hakan", exist_ok=True)

# 1. Write yks_master_database.json
with open(hakan_db_path, "w", encoding="utf-8") as f:
    json.dump(hakan_records, f, ensure_ascii=False, indent=2)

print("Saved hakan/yks_master_database.json")

# 2. Write yks_master_database.csv
with open("hakan/yks_master_database.csv", "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.writer(f)
    writer.writerow([
        "Sıra", "Kod", "Özel Koşullar", "Üniversite", "Fakülte", "Bölüm Adı",
        "Şehir", "Dil", "Burs / Ücret", "Geçen Yıl Sıralama", "Tahmini Skor", "Kişisel Puan (1-10)", "Notlar"
    ])
    for r in hakan_records:
        writer.writerow([
            r["id"], r["program_id"], r["notes"], r["university"], r["faculty"], r["department"],
            r["city"], r["language"], r["tuition_status"], r["last_rank"], r["prediction"]["tahmini_skor"],
            r["rating"], r["notes"]
        ])

print("Saved hakan/yks_master_database.csv")

# 3. Write hakan_tercih_analizi.md
md_content = """# Hakan YKS Tercih Bilgileri ve Analizi

| Sıra | Kod | Özel Koşullar | Program Adı | Şehir | Geçen Yıl Sıralama | Tahmini Skor | Kişisel Puan |
| :---: | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
"""

for r in hakan_records:
    md_content += f"| **{r['id']}. Tercih** | {r['program_id']} | {r['notes']} | {r['full_name']} | {r['city']} | {r['last_rank']:,} | {r['prediction']['tahmini_skor']:,} | {r['rating']}/10 |\n"

with open("hakan/hakan_tercih_analizi.md", "w", encoding="utf-8") as f:
    f.write(md_content)

print("Saved hakan/hakan_tercih_analizi.md")

# 4. Write README.md
readme_content = """# Hakan YKS Master Veritabanı ve Analiz Modülü

Bu dizin (`hakan/`), Hakan için özel olarak hazırlanan 8 YKS üniversite ve bölüm tercihinin son YÖK Atlas verileriyle zenginleştirilmiş veritabanını içerir.

---

## 📂 İçindekiler

| Dosya Adı | Açıklama |
| :--- | :--- |
| [yks_master_database.json](file:///Users/hasanemresezen/Desktop/cs/yks-analiz/hakan/yks_master_database.json) | Hakan'ın 8 tercihinin son 4 yıllık sıralama, kontenjan, puan ve regresyon tahmin skorlarını içeren ana JSON veritabanı. |
| [yks_master_database.csv](file:///Users/hasanemresezen/Desktop/cs/yks-analiz/hakan/yks_master_database.csv) | Excel veya veri analiz araçları (Pandas, Excel, Google Sheets) için CSV veritabanı. |
| [hakan_tercih_analizi.md](file:///Users/hasanemresezen/Desktop/cs/yks-analiz/hakan/hakan_tercih_analizi.md) | Tercih listesi ve özet analiz tablosu. |

---

## 🎯 Tercih Özeti (8 Bölüm)

1. **110110507** - YILDIZ TEKNİK ÜNİVERSİTESİ - İktisat (İngilizce)
2. **107290348** - MARMARA ÜNİVERSİTESİ - Yönetim Bilişim Sistemleri (İngilizce)
3. **110190084** - YILDIZ TEKNİK ÜNİVERSİTESİ - İşletme (İngilizce)
4. **200510349** - BAHÇEŞEHİR ÜNİVERSİTESİ - İşletme (İngilizce) (Burslu)
5. **105690802** - İSTANBUL ÜNİVERSİTESİ - Yönetim Bilişim Sistemleri (İngilizce)
6. **104810432** - HACETTEPE ÜNİVERSİTESİ - İşletme (İngilizce)
7. **104810414** - HACETTEPE ÜNİVERSİTESİ - İktisat (İngilizce)
8. **110110137** - YILDIZ TEKNİK ÜNİVERSİTESİ - İşletme
"""

with open("hakan/README.md", "w", encoding="utf-8") as f:
    f.write(readme_content)

print("Saved hakan/README.md")

# 5. Program Index
program_index = []
for r in hakan_records:
    program_index.append({
        "program_id": r["program_id"],
        "full_title": r["full_name"],
        "city": r["city"]
    })

with open("hakan/program_index.json", "w", encoding="utf-8") as f:
    json.dump(program_index, f, ensure_ascii=False, indent=2)

print("Saved hakan/program_index.json")
