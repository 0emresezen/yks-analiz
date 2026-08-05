#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TÜMA / ÜNİAR → Master Database Entegrasyonu
============================================
validated/satisfaction_validated.json (2026) verisini
validated/yks_master_database.json ve data/yks_master_database.json
üzerindeki tüm programlara uygular; prestij ve rating skorlarını günceller.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional

ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from pipeline.scoring import composite_rating, prestige_score
from pipeline.uniar_lookup import apply_uniar_fields, build_uniar_lookup

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s - %(message)s")
logger = logging.getLogger("integrate_uniar")

TARGETS = [
    os.path.join(ROOT, "validated", "yks_master_database.json"),
    os.path.join(ROOT, "data", "yks_master_database.json"),
    os.path.join(ROOT, "validated", "analysis_database", "2026.json"),
]


def _recalculate_derived_scores(item: Dict[str, Any]) -> None:
    pres_score, pres_avail, pres_note = prestige_score(item)
    item["prestige_score"] = pres_score
    item["prestige_data_available"] = pres_avail
    item["prestige_data_note"] = pres_note if not pres_avail else ""
    item["prestige_desc"] = pres_note if pres_avail else None

    rating, rating_note = composite_rating(item)
    item["partial_rating"] = rating
    item["partial_rating_note"] = rating_note
    item["rating"] = rating


def integrate_records(
    records: List[Dict[str, Any]],
    lookup: Dict[str, Dict[str, Any]],
    year: int,
) -> Dict[str, Any]:
    matched_unis = set()
    matched_programs = 0

    for item in records:
        if apply_uniar_fields(item, lookup, year):
            matched_programs += 1
            matched_unis.add(item.get("university", ""))
            _recalculate_derived_scores(item)

    unique_unis = {r.get("university") for r in records if r.get("university")}
    return {
        "year": year,
        "total_programs": len(records),
        "matched_programs": matched_programs,
        "matched_universities": len(matched_unis),
        "total_universities": len(unique_unis),
        "lookup_size": len(lookup),
    }


def save_json(path: str, records: List[Dict[str, Any]]) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(records, fh, ensure_ascii=False)
    mb = os.path.getsize(path) / (1024 * 1024)
    logger.info("Kaydedildi: %s (%.1f MB, %d kayıt)", path, mb, len(records))


def run(
    year: Optional[int] = None,
    source_path: Optional[str] = None,
    targets: Optional[List[str]] = None,
) -> Dict[str, Any]:
    lookup, used_year = build_uniar_lookup(year=year, path=source_path or "validated/satisfaction_validated.json")
    if not lookup:
        raise FileNotFoundError("TÜMA memnuniyet verisi bulunamadı (validated/satisfaction_validated.json)")

    logger.info("TÜMA %d: %d üniversite lookup hazır", used_year, len(lookup))

    primary = os.path.join(ROOT, "validated", "yks_master_database.json")
    if not os.path.exists(primary):
        raise FileNotFoundError(f"Ana veritabanı bulunamadı: {primary}")

    with open(primary, "r", encoding="utf-8") as fh:
        records = json.load(fh)

    stats = integrate_records(records, lookup, used_year)
    stats["integrated_at"] = datetime.now().isoformat()

    for path in (targets or TARGETS):
        if path == primary or os.path.exists(path) or "yks_master" in path:
            save_json(path, records)

    report_path = os.path.join(ROOT, "processed", "uniar_integration_report.json")
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as fh:
        json.dump(stats, fh, ensure_ascii=False, indent=2)

    logger.info(
        "Entegrasyon tamam: %d/%d program, %d/%d üniversite",
        stats["matched_programs"],
        stats["total_programs"],
        stats["matched_universities"],
        stats["total_universities"],
    )
    return stats


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="TÜMA verisini master database'e entegre et")
    parser.add_argument("--year", type=int, default=None, help="TÜMA yılı (varsayılan: en güncel)")
    args = parser.parse_args()

    try:
        result = run(year=args.year)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as exc:
        logger.error("HATA: %s", exc)
        sys.exit(1)
