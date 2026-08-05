#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build universal analysis database from normalized YÖK parquet."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import pandas as pd

from pipeline.config import (
    DEFAULT_UNIAR_YEAR,
    DEFAULT_YOK_YEAR,
    analysis_index_path,
    analysis_json_path,
    analysis_parquet_path,
    build_report_path,
    master_parquet_path,
)
from pipeline.enrich import enrich_batch
from pipeline.transform import yok_record_to_base
from verification.collector_validator import CollectorValidator
from verification.integrity_checker import IntegrityChecker

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s - %(message)s")
logger = logging.getLogger("pipeline.build")


def load_master_records(year: int = DEFAULT_YOK_YEAR, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    path = master_parquet_path(year)
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Master parquet bulunamadı: {path}\n"
            f"Önce çalıştırın: python3 build_national_index.py --year {year}"
        )

    df = pd.read_parquet(path)
    df = df.where(df.notna(), None)
    if limit is not None:
        df = df.head(limit)

    logger.info("Yüklendi: %s (%d kayıt)", path, len(df))
    return df.to_dict(orient="records")


def build_analysis_records(
    year: int = DEFAULT_YOK_YEAR,
    uniar_year: int = DEFAULT_UNIAR_YEAR,
    limit: Optional[int] = None,
) -> List[Dict[str, Any]]:
    yok_rows = load_master_records(year=year, limit=limit)
    base_records = [yok_record_to_base(row) for row in yok_rows]
    logger.info("Zenginleştirme başlıyor (%d kayıt)...", len(base_records))
    enriched = enrich_batch(base_records, uniar_year=uniar_year)
    return enriched


def _compact_index_record(item: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": item["id"],
        "program_id": item["program_id"],
        "full_name": item.get("full_name", ""),
        "university": item.get("university", ""),
        "department": item.get("department", ""),
        "department_group": item.get("department_group", ""),
        "city": item.get("city", ""),
        "degree": item.get("degree", ""),
        "score_type": item.get("score_type", ""),
        "tuition_status": item.get("tuition_status", ""),
        "last_rank": item.get("last_rank"),
        "rating": item.get("rating"),
        "uniar_score": item.get("uniar_score"),
        "scholarship_score": item.get("scholarship_score"),
        "yok_data_available": item.get("yok_data_available", False),
    }


def export_analysis_database(
    records: List[Dict[str, Any]],
    year: int = DEFAULT_YOK_YEAR,
) -> Dict[str, Any]:
    if not records:
        raise ValueError("Export edilecek kayıt yok")

    os.makedirs(os.path.dirname(analysis_parquet_path(year)), exist_ok=True)

    # Validation
    yok_validation = CollectorValidator.validate_yok_batch(records, expected_year=year)
    IntegrityChecker.run_database_checks(records)

    for item in records:
        if "_traceability" in item:
            item["_traceability"]["validated"] = True

    # Parquet (primary artifact)
    df = pd.DataFrame(records)
    parquet_path = analysis_parquet_path(year)
    df.to_parquet(parquet_path, index=False)
    logger.info("analysis_database.parquet → %s (%d kayıt)", parquet_path, len(records))

    # Full JSON for app runtime fetch
    json_path = analysis_json_path(year)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False)
    json_mb = os.path.getsize(json_path) / (1024 * 1024)
    logger.info("analysis_database.json → %.1f MB", json_mb)

    # Compact index for fast lookup
    index = [_compact_index_record(r) for r in records]
    idx_path = analysis_index_path(year)
    os.makedirs(os.path.dirname(idx_path), exist_ok=True)
    with open(idx_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))

    # Legacy path for backward compat (symlink-like copy)
    legacy_validated = os.path.join(
        os.path.dirname(os.path.dirname(analysis_parquet_path(year))),
        "yks_master_database.json",
    )
    with open(legacy_validated, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False)

    legacy_data = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(analysis_parquet_path(year)))),
        "data",
        "yks_master_database.json",
    )
    with open(legacy_data, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False)

    uniar_count = sum(1 for r in records if r.get("uniar_data_available"))
    sch_count = sum(1 for r in records if r.get("scholarship_data_available"))
    trend_count = sum(1 for r in records if r.get("trend_data_available"))
    rating_count = sum(1 for r in records if r.get("rating") is not None)

    report = {
        "built_at": datetime.now().isoformat(),
        "year": year,
        "total_programs": len(records),
        "total_universities": 0,
        "uniar_matched": uniar_count,
        "scholarship_scored": sch_count,
        "trend_scored": trend_count,
        "rated": rating_count,
        "validation": yok_validation,
        "outputs": {
            "parquet": parquet_path,
            "json": json_path,
            "index": idx_path,
            "legacy_validated": legacy_validated,
            "legacy_data": legacy_data,
        },
    }
    report["total_universities"] = len(set(r.get("university") for r in records if r.get("university")))

    with open(build_report_path(), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    logger.info("=" * 60)
    logger.info("UNIVERSAL ANALYSIS DB TAMAMLANDI")
    logger.info("  Program     : %s", f"{len(records):,}")
    logger.info("  ÜNİAR eşleşen: %d", uniar_count)
    logger.info("  Burs skorlu : %d", sch_count)
    logger.info("  Trend skorlu: %d", trend_count)
    logger.info("  Rating hesap: %d", rating_count)
    logger.info("=" * 60)

    return report


def build_analysis_database(
    year: int = DEFAULT_YOK_YEAR,
    uniar_year: int = DEFAULT_UNIAR_YEAR,
    limit: Optional[int] = None,
) -> Dict[str, Any]:
    records = build_analysis_records(year=year, uniar_year=uniar_year, limit=limit)
    return export_analysis_database(records, year=year)
