#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
YKS Master Database Builder — V10 Kanıta Dayalı Karar Motoru
=============================================================
Tüm veriler resmî kaynaklardan gelir.
ASLA veri üretilmez, tahmin edilmez veya uydurulmaz.
Kaynak bulunamıyorsa ilgili alan null bırakılır ve
"Bu alan için doğrulanmış resmî veri bulunamadı." olarak işaretlenir.

Gerçek Veri Kaynakları:
  - YÖK Atlas API     → sıralama, kontenjan, yerleşen, puan, burs, dil, öğretim türü
  - ÜNİAR TÜMA PDF   → öğrenci memnuniyeti (uniar_score)
  - ÖSYM Kılavuzu    → burs oranı, ücret statüsü, kontenjan (kılavuzdan elle girilmiş)

Null Olan Alanlar (henüz resmî kaynak bağlanmamış):
  - prestige_score    → URAP/QS verisi entegre edildiğinde doldurulacak
  - academic_score    → YÖK Akademik Personel istatistikleri entegre edildiğinde
  - transport_score   → Belediye açık veri API'si entegre edildiğinde
  - industry_score    → Kariyer.net/LinkedIn API entegre edildiğinde
  - research_score    → URAP/TÜBİTAK API entegre edildiğinde
  - career_score      → Kariyer.net mezun istatistikleri entegre edildiğinde
  - ai_opportunity    → Teknopark/AI endüstrisi API entegre edildiğinde
  - internship_score  → Kariyer.net staj veritabanı entegre edildiğinde
  - startup_score     → TÜBİTAK Girişimci Üniversite endeksi entegre edildiğinde
  - cost_score        → Numbeo/TÜİK açık veri entegre edildiğinde
  - housing_score     → KYK açık veri entegre edildiğinde
  - international_score → Erasmus istatistikleri entegre edildiğinde
"""

import os
import json
import csv
import sys
from datetime import datetime
from typing import Optional, Dict, Any

parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

from satisfaction.repository import SatisfactionRepository
from verification.integrity_checker import IntegrityChecker

# ---------------------------------------------------------------------------
# Sabit: Resmî veri bulunamadı mesajı
# ---------------------------------------------------------------------------
NO_DATA_NOTE = "Bu alan için doğrulanmış resmî veri bulunamadı."


def _null_metric(data_available: bool = False, note: str = NO_DATA_NOTE) -> Dict[str, Any]:
    """Veri bulunmayan alanlar için standart null yapısı."""
    return {
        "score": None,
        "data_available": data_available,
        "data_note": note if not data_available else "",
    }


def build_traceability(item: Dict, source_name: str, source_url: str) -> Dict[str, Any]:
    """Her kayıt için traceability alanlarını oluşturur."""
    import hashlib
    content = json.dumps(item, ensure_ascii=False, sort_keys=True).encode("utf-8")
    sha256 = hashlib.sha256(content).hexdigest()
    uni_clean = "".join(c for c in item.get("university", "") if c.isalnum()).upper()
    dept_clean = "".join(c for c in item.get("department", "") if c.isalnum()).upper()[:20]
    trace_id = f"YKS_{item.get('id', 'UNK')}_{uni_clean[:15]}_{dept_clean}"
    return {
        "source_name": source_name,
        "source_url": source_url,
        "publication_year": 2025,
        "retrieved_at": datetime.now().isoformat(),
        "parser_version": "10.0.0",
        "trace_id": trace_id,
        "sha256": sha256,
        "validated": False,  # integrity_checker geçince True olacak
        "validator_version": "2.0.0",
    }


def enrich_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Bir kayıt için gerçek veri kaynaklarından zenginleştirme yapar.
    Veri bulunmazsa alan null bırakılır.
    """
    uni = item.get("university", "")
    city = item.get("city", "")
    dept = item.get("department", "")
    tuition = item.get("tuition_status", "").lower()
    language = item.get("language", "").lower()

    # ------------------------------------------------------------------
    # 1. ÜNİAR Öğrenci Memnuniyeti — GERÇEK VERİ (TÜMA, en güncel yıl)
    # ------------------------------------------------------------------
    repo = SatisfactionRepository.get_instance()
    sat_rec = repo.get_score(uni)  # year=None → en güncel TÜMA
    if sat_rec:
        item["uniar_score"] = round(sat_rec.overall_score, 1)
        item["uniar_data_available"] = True
        item["uniar_data_source"] = sat_rec.source or f"ÜNİAR TÜMA {sat_rec.year}"
        item["uniar_data_url"] = sat_rec.source_url or "https://uniar.net/tr/siralama/tuma"
        item["uniar_year"] = sat_rec.year
        item["uniar_grade"] = sat_rec.overall_grade
        sub_meta = (sat_rec.source_metadata or {})
        item["uniar_subcategories"] = {
            "learning_experience": sat_rec.learning_experience,
            "campus_life": sat_rec.campus_life,
            "academic_support": sat_rec.academic_support,
            "management": sat_rec.management,
            "career_support": sat_rec.career_support,
            "learning_resources": sub_meta.get("learning_resources"),
        }
        if item["uniar_score"] >= 9.0:
            item["uniar_desc"] = "A+ Öğrenci Memnuniyeti & Canlı Kampüs Yaşamı"
        elif item["uniar_score"] >= 7.5:
            item["uniar_desc"] = "Yüksek Öğrenci Memnuniyeti & Aktif Sosyal Hayat"
        elif item["uniar_score"] >= 5.0:
            item["uniar_desc"] = "Orta Düzey Sosyal İmkânlar & Standart Memnuniyet"
        else:
            item["uniar_desc"] = "Sınırlı Kampüs İmkânları & Gelişmekte Olan Sosyal Hayat"
    else:
        item["uniar_score"] = None
        item["uniar_data_available"] = False
        item["uniar_data_source"] = None
        item["uniar_data_url"] = None
        item["uniar_desc"] = None
        item["uniar_data_note"] = NO_DATA_NOTE
        item["uniar_subcategories"] = None

    # ------------------------------------------------------------------
    # 2. Burs Skoru — GERÇEK VERİ (ÖSYM Kılavuzu / tuition_status alanı)
    # ------------------------------------------------------------------
    if tuition:
        if "burslu" in tuition and "%100" not in tuition and "%" not in tuition:
            scholarship_score = 10.0
            scholarship_note = "Tam burslu program (ÖSYM Kılavuzu)"
        elif "%75" in tuition or "%100 burslu" in tuition:
            scholarship_score = 9.0
            scholarship_note = "%75 burslu program (ÖSYM Kılavuzu)"
        elif "%50" in tuition:
            scholarship_score = 6.0
            scholarship_note = "%50 burslu program (ÖSYM Kılavuzu)"
        elif "%25" in tuition:
            scholarship_score = 4.0
            scholarship_note = "%25 burslu program (ÖSYM Kılavuzu)"
        elif "ücretli" in tuition:
            scholarship_score = 2.0
            scholarship_note = "Ücretli program (ÖSYM Kılavuzu)"
        else:
            # Devlet üniversitesi / ücretsiz
            scholarship_score = 8.0
            scholarship_note = "Devlet programı — harç muaf (ÖSYM Kılavuzu)"
        item["scholarship_score"] = scholarship_score
        item["scholarship_data_available"] = True
        item["scholarship_data_source"] = "ÖSYM Tercih Kılavuzu"
        item["scholarship_data_url"] = "https://www.osym.gov.tr"
        item["scholarship_data_note"] = scholarship_note
    else:
        item["scholarship_score"] = None
        item["scholarship_data_available"] = False
        item["scholarship_data_note"] = NO_DATA_NOTE

    # ------------------------------------------------------------------
    # 3. Eğitim Dili Verisi — GERÇEK VERİ (YÖK Atlas / kılavuz)
    # ------------------------------------------------------------------
    item["language_data_available"] = bool(language)
    item["language_data_source"] = "YÖK Atlas / ÖSYM Kılavuzu" if language else None

    # ------------------------------------------------------------------
    # 4. Null Alanlar — Resmî API/PDF entegre edilene kadar boş
    # ------------------------------------------------------------------
    NULL_METRICS = {
        "prestige": ("URAP / QS Turkey Rankings", "https://www.urap.hacettepe.edu.tr"),
        "academic": ("YÖK Akademik Personel İstatistikleri", "https://istatistik.yok.gov.tr"),
        "transport": ("Şehir/Belediye Ulaşım Açık Verisi", ""),
        "industry": ("Kariyer.net & LinkedIn İşveren Anketleri", ""),
        "research": ("URAP & TÜBİTAK Girişimci Üniversite Endeksi", ""),
        "international": ("YÖK Atlas Erasmus & Uluslararası İstatistikler", ""),
        "cost": ("TÜİK Tüketici Fiyat Endeksi & Numbeo", ""),
        "housing": ("KYK Genel Müdürlüğü Açık Verisi", ""),
        "career": ("Kariyer.net Mezun Başarı Raporları", ""),
        "ai_opportunity": ("Teknoloji Geliştirme Bölgeleri Yönetimi A.Ş.", ""),
        "internship": ("Kariyer.net Staj İstatistikleri", ""),
        "startup": ("TÜBİTAK Girişimci & Yenilikçi Üniversite Endeksi", ""),
    }

    for metric_key, (planned_source, planned_url) in NULL_METRICS.items():
        item[f"{metric_key}_score"] = None
        item[f"{metric_key}_data_available"] = False
        item[f"{metric_key}_data_note"] = NO_DATA_NOTE
        item[f"{metric_key}_planned_source"] = planned_source
        item[f"{metric_key}_planned_source_url"] = planned_url

    # ------------------------------------------------------------------
    # 5. Ulaşım — Manuel girdi (kullanıcı tarafından yazılmış, API değil)
    # ------------------------------------------------------------------
    transport_desc = item.get("transport_desc", "")
    if transport_desc and transport_desc not in ["-", "", "None"]:
        item["transport_data_available"] = False  # API'den gelmiyor
        item["transport_data_source"] = "manuel_entry"
        item["transport_data_note"] = (
            "Bu değer kullanıcı tarafından manuel olarak girilmiştir. "
            "Resmî ulaşım verisi entegre edilene kadar geçici olarak gösterilmektedir."
        )
    else:
        item["transport_data_available"] = False
        item["transport_data_note"] = NO_DATA_NOTE

    # ------------------------------------------------------------------
    # 6. Özet puan (yalnızca mevcut gerçek verilerden — UNIAR + burs)
    # ------------------------------------------------------------------
    real_scores = []
    if item.get("uniar_score") is not None:
        real_scores.append(item["uniar_score"])
    if item.get("scholarship_score") is not None:
        real_scores.append(item["scholarship_score"])

    if real_scores:
        item["partial_rating"] = round(sum(real_scores) / len(real_scores), 1)
        item["partial_rating_note"] = (
            f"Bu puan yalnızca doğrulanmış {len(real_scores)} veri kaynağından "
            "hesaplanmıştır. Diğer kaynaklar entegre edildiğinde güncellenecektir."
        )
    else:
        item["partial_rating"] = None
        item["partial_rating_note"] = NO_DATA_NOTE

    # rating geriye dönük uyumluluk için
    item["rating"] = item["partial_rating"]

    # ------------------------------------------------------------------
    # 7. Traceability
    # ------------------------------------------------------------------
    item["_traceability"] = build_traceability(
        item,
        source_name="YKS Analiz Master Builder V10",
        source_url="https://yokatlas.yok.gov.tr"
    )

    return item


def main(json_path: str = "data/yks_master_database.json", validated_path: str = "validated/yks_master_database.json"):
    if not os.path.exists(json_path):
        print(f"Dosya bulunamadı: {json_path}")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"YKS Master Veritabanı V10 dönüştürülüyor ({len(data)} kayıt)...")
    enriched = [enrich_item(item) for item in data]

    IntegrityChecker.run_database_checks(enriched)

    import hashlib
    for item in enriched:
        raw = json.dumps({k: v for k, v in item.items() if k != "_traceability"},
                         ensure_ascii=False, sort_keys=True).encode("utf-8")
        if "_traceability" in item:
            item["_traceability"]["sha256"] = hashlib.sha256(raw).hexdigest()
            item["_traceability"]["validated"] = True

    os.makedirs(os.path.dirname(validated_path) or ".", exist_ok=True)
    with open(validated_path, "w", encoding="utf-8") as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)
    print(f"✅ JSON Veritabanı Kaydedildi ({len(enriched)} Kayıt)")
    print(f"   → ÜNİAR verisi bulunan: {sum(1 for r in enriched if r.get('uniar_data_available'))}")
    print(f"   → Burs verisi bulunan:  {sum(1 for r in enriched if r.get('scholarship_data_available'))}")
    print(f"   → Null metrik sayısı:   12 (prestige, academic, transport, industry, research, international, cost, housing, career, ai, internship, startup)")

    # CSV olarak da kaydet
    csv_path = "data/yks_master_database.csv"
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "ID", "Derece", "Puan Türü", "Üniversite", "Bölüm", "Fakülte",
            "Dil", "Burs/Ücret", "Şehir", "ÜNİAR Skoru", "Burs Skoru",
            "Kısmi Puan", "Notlar", "Trace ID"
        ])
        for r in enriched:
            writer.writerow([
                r.get("id"), r.get("degree", "-"), r.get("score_type", "-"),
                r.get("university"), r.get("department"), r.get("faculty", "-"),
                r.get("language", "-"), r.get("tuition_status", "-"), r.get("city"),
                r.get("uniar_score", "N/A"), r.get("scholarship_score", "N/A"),
                r.get("partial_rating", "N/A"), r.get("notes", "-"),
                r.get("_traceability", {}).get("trace_id", "-")
            ])
    print(f"✅ CSV Veritabanı Kaydedildi ({len(enriched)} Kayıt)")


if __name__ == "__main__":
    main()
