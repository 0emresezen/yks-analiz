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
    analysis_parquet_path,
    build_report_path,
    master_parquet_path,
)
from pipeline.enrich import enrich_batch
from pipeline.export import export_layered
from pipeline.sanitize import sanitize_batch
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
    return sanitize_batch(enriched)


def export_analysis_database(
    records: List[Dict[str, Any]],
    year: int = DEFAULT_YOK_YEAR,
) -> Dict[str, Any]:
    if not records:
        raise ValueError("Export edilecek kayıt yok")

    os.makedirs(os.path.dirname(analysis_parquet_path(year)), exist_ok=True)

    yok_validation = CollectorValidator.validate_yok_batch(records, expected_year=year)
    IntegrityChecker.run_database_checks(records)

    for item in records:
        if "_traceability" in item:
            item["_traceability"]["validated"] = True

    parquet_path = analysis_parquet_path(year)
    pd.DataFrame(records).to_parquet(parquet_path, index=False)
    logger.info("analysis.parquet (kaynak) → %s (%d kayıt)", parquet_path, len(records))

    layered_meta = export_layered(records, year=year)

    uniar_count = sum(1 for r in records if r.get("uniar_data_available"))
    sch_count = sum(1 for r in records if r.get("scholarship_data_available"))
    trend_count = sum(1 for r in records if r.get("trend_data_available"))
    rating_count = sum(1 for r in records if r.get("rating") is not None)

    report = {
        "built_at": datetime.now().isoformat(),
        "year": year,
        "total_programs": len(records),
        "total_universities": len(set(r.get("university") for r in records if r.get("university"))),
        "uniar_matched": uniar_count,
        "scholarship_scored": sch_count,
        "trend_scored": trend_count,
        "rated": rating_count,
        "validation": yok_validation,
        "layered": layered_meta,
        "outputs": {
            "parquet": parquet_path,
            "layered_base": layered_meta.get("paths", {}).get("base"),
            "index": layered_meta.get("paths", {}).get("index"),
            "details_dir": layered_meta.get("paths", {}).get("details_dir"),
        },
    }

    with open(build_report_path(), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    logger.info("=" * 60)
    logger.info("UNIVERSAL ANALYSIS DB TAMAMLANDI")
    logger.info("  Program     : %s", f"{len(records):,}")
    logger.info("  Index       : %.2f MB (gzip %.2f MB)", layered_meta.get("index_mb", 0), layered_meta.get("index_gzip_mb", 0))
    logger.info("  Partitions  : %d (city-based)", layered_meta.get("partition_count", 0))
    logger.info("=" * 60)

    return report


def build_analysis_database(
    year: int = DEFAULT_YOK_YEAR,
    uniar_year: int = DEFAULT_UNIAR_YEAR,
    limit: Optional[int] = None,
) -> Dict[str, Any]:
    records = build_analysis_records(year=year, uniar_year=uniar_year, limit=limit)
    return export_analysis_database(records, year=year)
