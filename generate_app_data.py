#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
App Veritabanı Oluşturucu — V10 Kanıta Dayalı
==============================================
yokatlas_sonuclar.xlsx → enrich → validated/yks_master_database.json
ASLA sentetik skor veya tahmin üretmez.
"""

import json
import os
import re
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional

import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from data.fetch_and_enrich import enrich_item, NO_DATA_NOTE, build_traceability
from verification.integrity_checker import IntegrityChecker

EXCEL_PATH = "yokatlas_sonuclar.xlsx"
VALIDATED_PATH = "validated/yks_master_database.json"
DATA_PATH = "data/yks_master_database.json"


def _parse_rank(value: Any) -> Optional[int]:
    if value is None:
        return None
    raw = str(value).replace(",", "").replace(".", "").strip()
    if not raw or raw in ("-", "NA", "nan"):
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def _parse_int_col(row, key: str, fallback: Optional[int] = None) -> Optional[int]:
    return _parse_rank(row.get(key, fallback))


def _split_uni_dept(raw_name: str):
    parts = raw_name.split(" - ", 1)
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip()
    return raw_name.strip(), raw_name.strip()


def _infer_degree(db_id: int) -> str:
    return "Lisans (4Y)" if db_id <= 49 else "Önlisans (2Y)"


def _infer_tuition(raw_name: str) -> str:
    if "Vakıf" in raw_name or "vakıf" in raw_name:
        if "Burslu" in raw_name or "%" in raw_name:
            return "Vakıf (Burslu)"
        return "Vakıf (Ücretli)"
    return "Devlet (Ücretsiz)"


def load_existing_ai_evals() -> Dict[int, str]:
    evals = {}
    for path in (VALIDATED_PATH, DATA_PATH):
        if not os.path.exists(path):
            continue
        try:
            with open(path, "r", encoding="utf-8") as f:
                for item in json.load(f):
                    if item.get("ai_eval") and item.get("id") is not None:
                        evals[int(item["id"])] = item["ai_eval"]
        except Exception:
            pass
    return evals


def build_records_from_excel(excel_path: str = EXCEL_PATH) -> List[Dict[str, Any]]:
    if not os.path.exists(excel_path):
        raise FileNotFoundError(
            f"{excel_path} bulunamadı. Önce main.py çalıştırın: python3 main.py"
        )

    df = pd.read_excel(excel_path)
    ai_evals = load_existing_ai_evals()
    records = []

    for idx, row in df.iterrows():
        raw_name = str(row.get("Üniversite & Bölüm Adı", ""))
        uni, dept = _split_uni_dept(raw_name)
        city = str(row.get("Şehir", "")).strip() or "Bilinmiyor"
        db_id = int(row.get("Veritabanı", idx + 1))
        program_id = row.get("Program ID")
        if pd.isna(program_id) or program_id in ("NA", "None", ""):
            program_id = None
        else:
            program_id = str(int(program_id)) if str(program_id).replace(".", "").isdigit() else str(program_id)

        last_rank = _parse_int_col(row, "Geçen Yılki Sıralama")
        tahmin_skor = _parse_int_col(row, "Tahmini Skor")

        data_available = str(row.get("Geçen Yılki Sıralama", "-")) != "-"

        item: Dict[str, Any] = {
            "id": db_id,
            "program_id": program_id,
            "degree": _infer_degree(db_id),
            "score_type": "SAY" if db_id <= 49 else "TYT",
            "university": uni,
            "department": dept,
            "full_name": raw_name,
            "faculty": "Fakülte / Meslek Yüksekokulu",
            "language": "Türkçe",
            "tuition_status": _infer_tuition(raw_name),
            "city": city,
            "transport_desc": None,
            "last_rank": last_rank,
            "yok_data_available": data_available and last_rank is not None,
            "yok_data_note": "" if (data_available and last_rank) else NO_DATA_NOTE,
            "history_rankings": [],
            "history_quotas": [],
            "notes": str(row.get("Notlar / Artılar - Eksiler", "-")),
            "isFavorite": False,
        }

        if tahmin_skor and last_rank:
            item["prediction"] = {
                "tahmini_skor": tahmin_skor,
                "model": "linear_regression_elastic_quota",
                "confidence": "medium",
                "prediction_generated_at": datetime.now().isoformat(),
                "data_note": "Yalnızca resmî YÖK sıralama geçmişinden türetilmiştir.",
            }
        else:
            item["prediction"] = None
            item["prediction_data_available"] = False
            item["prediction_data_note"] = NO_DATA_NOTE

        if db_id in ai_evals:
            item["ai_eval"] = ai_evals[db_id]

        records.append(item)

    return records


def build_and_save(
    excel_path: str = EXCEL_PATH,
    validated_path: str = VALIDATED_PATH,
    data_path: str = DATA_PATH,
) -> List[Dict[str, Any]]:
    base_records = build_records_from_excel(excel_path)
    enriched = [enrich_item(item) for item in base_records]

    for item in enriched:
        trace = item.get("_traceability", {})
        trace["validated"] = True
        item["_traceability"] = trace

    IntegrityChecker.run_database_checks(enriched)

    os.makedirs(os.path.dirname(validated_path) or ".", exist_ok=True)
    with open(validated_path, "w", encoding="utf-8") as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)

    os.makedirs(os.path.dirname(data_path) or ".", exist_ok=True)
    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)

    uniar_count = sum(1 for r in enriched if r.get("uniar_data_available"))
    yok_count = sum(1 for r in enriched if r.get("yok_data_available"))
    print(f"Kaydedildi: {len(enriched)} kayıt → {validated_path} + {data_path}")
    print(f"  YÖK verisi: {yok_count}, ÜNİAR verisi: {uniar_count}")
    return enriched


if __name__ == "__main__":
    build_and_save()
