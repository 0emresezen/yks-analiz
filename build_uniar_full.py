#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tam ÜNİAR Build — TÜMA PDF veya Web JSON
========================================
- 2024: Resmî PDF indirir, parse eder
- 2026+: raw/uniar/tuma_{year}.json web verisi kullanılır
- validated/satisfaction_validated.json yazar (çok yıllı)
"""

from __future__ import annotations

import json
import logging
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from satisfaction.tuma_parser import (
    build_satisfaction_records,
    default_web_json_path,
    extract_pdf_text,
    load_web_json,
    SOURCE_URL,
)
from satisfaction.models import UniversitySatisfaction
from satisfaction.validator import SatisfactionValidator
from satisfaction.loader import SatisfactionLoader
from verification.metadata import get_file_sha256

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s - %(message)s")
logger = logging.getLogger("build_uniar_full")


def _load_existing_records() -> list[UniversitySatisfaction]:
    path = os.path.join(ROOT, "validated", "satisfaction_validated.json")
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    return [UniversitySatisfaction.from_dict(d) for d in data]


def _merge_records(
    existing: list[UniversitySatisfaction],
    new_records: list[UniversitySatisfaction],
    year: int,
) -> list[UniversitySatisfaction]:
    kept = [r for r in existing if r.year != year]
    return kept + new_records


def build_from_pdf(year: int = 2024) -> list[UniversitySatisfaction]:
    from download_uniar import download_pdf

    ok, path_or_msg = download_pdf(year)
    if not ok:
        raise FileNotFoundError(path_or_msg)

    pdf_path = path_or_msg
    logger.info("PDF: %s", pdf_path)

    file_hash = get_file_sha256(pdf_path)
    text = extract_pdf_text(pdf_path)
    logger.info("PDF metin uzunluğu: %d karakter", len(text))

    records = build_satisfaction_records(text, year=year, file_hash=file_hash)
    if len(records) < 100:
        raise ValueError(f"Yetersiz parse: {len(records)} üniversite (beklenen ~200)")
    return records


def build_from_web(year: int = 2026) -> list[UniversitySatisfaction]:
    json_path = default_web_json_path(year, ROOT)
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"Web JSON bulunamadı: {json_path}")

    logger.info("Web JSON: %s", json_path)
    records = load_web_json(json_path)
    if len(records) < 100:
        raise ValueError(f"Yetersiz kayıt: {len(records)} üniversite (beklenen ~200)")
    return records


def build(year: int = 2024, merge: bool = True) -> dict:
    web_path = default_web_json_path(year, ROOT)
    if os.path.exists(web_path):
        new_records = build_from_web(year)
        source_url = new_records[0].source_url if new_records else ""
        file_hash = ""
    else:
        new_records = build_from_pdf(year)
        source_url = SOURCE_URL
        file_hash = new_records[0].source_metadata.get("file_hash", "") if new_records else ""

    if merge:
        existing = _load_existing_records()
        records = _merge_records(existing, new_records, year)
    else:
        records = new_records

    SatisfactionValidator.generate_report(records)
    SatisfactionLoader.save_to_cache(records)

    report = {
        "year": year,
        "universities": len(new_records),
        "total_records": len(records),
        "source": "web" if os.path.exists(web_path) else "pdf",
        "source_url": source_url,
        "file_hash": file_hash,
    }
    report_path = os.path.join(ROOT, "processed", "uniar_build_report.json")
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    logger.info("ÜNİAR build tamamlandı: %d üniversite (%d)", len(new_records), year)
    return report


if __name__ == "__main__":
    year = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
    result = build(year)
    print(json.dumps(result, ensure_ascii=False, indent=2))
