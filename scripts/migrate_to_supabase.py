#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Parquet analiz veritabanını Supabase'e yükler.

Gereksinimler:
  - supabase/analysis_schema.sql Supabase SQL Editor'da çalıştırılmış olmalı
  - Ortam değişkenleri:
      SUPABASE_URL (veya VITE_SUPABASE_URL)
      SUPABASE_SERVICE_ROLE_KEY

Kullanım:
  .venv/bin/python scripts/migrate_to_supabase.py
  .venv/bin/python scripts/migrate_to_supabase.py --year 2026 --batch-size 400
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from pipeline.config import analysis_parquet_path

CARD_FIELDS = {
    "program_id",
    "university",
    "department",
    "department_group",
    "faculty",
    "city",
    "full_name",
    "degree",
    "score_type",
    "language",
    "tuition_status",
    "scholarship_rate",
    "university_type",
    "last_rank",
    "rating",
    "scholarship_score",
    "trend_score",
    "yok_rank_score",
    "uniar_score",
    "prestige_score",
    "academic_score",
    "transport_score",
    "yok_data_available",
    "publication_year",
}


def _env(name: str, fallback: str = "") -> str:
    return os.environ.get(name, fallback).strip()


def _clean(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if hasattr(value, "tolist"):
        return value.tolist()
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): _clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_clean(v) for v in value]
    try:
        import numpy as np

        if isinstance(value, (np.integer,)):
            return int(value)
        if isinstance(value, (np.floating,)):
            f = float(value)
            return None if math.isnan(f) or math.isinf(f) else f
        if isinstance(value, np.ndarray):
            return value.tolist()
    except ImportError:
        pass
    return value


def _record_to_card(record: Dict[str, Any]) -> Dict[str, Any]:
    program_id = str(record.get("program_id") or record.get("id", "")).strip()
    rating = record.get("rating")
    rating_f: Optional[float] = None
    if rating is not None:
        try:
            rating_f = float(rating)
            if math.isnan(rating_f):
                rating_f = None
        except (TypeError, ValueError):
            rating_f = None

    overall = round(rating_f * 10, 1) if rating_f is not None else None
    last_rank = record.get("last_rank")
    try:
        last_rank = int(last_rank) if last_rank is not None and not (
            isinstance(last_rank, float) and math.isnan(last_rank)
        ) else None
    except (TypeError, ValueError):
        last_rank = None

    def _score(key: str) -> Optional[float]:
        val = record.get(key)
        if val is None:
            return None
        try:
            f = float(val)
            return None if math.isnan(f) else round(f, 1)
        except (TypeError, ValueError):
            return None

    pub_year = record.get("publication_year")
    try:
        pub_year = int(pub_year) if pub_year is not None and not (
            isinstance(pub_year, float) and math.isnan(pub_year)
        ) else None
    except (TypeError, ValueError):
        pub_year = None

    return {
        "program_id": program_id,
        "university": str(record.get("university") or ""),
        "department": str(record.get("department") or ""),
        "department_group": str(record.get("department_group") or "") or None,
        "faculty": str(record.get("faculty") or "") or None,
        "city": str(record.get("city") or "") or None,
        "full_name": str(record.get("full_name") or "") or None,
        "degree": str(record.get("degree") or "") or None,
        "score_type": str(record.get("score_type") or "") or None,
        "language": str(record.get("language") or "") or None,
        "tuition_status": str(record.get("tuition_status") or "") or None,
        "scholarship_rate": str(record.get("scholarship_rate") or "") or None,
        "university_type": str(record.get("university_type") or "") or None,
        "last_rank": last_rank,
        "overall_rating": overall,
        "rating": round(rating_f, 2) if rating_f is not None else None,
        "scholarship_score": _score("scholarship_score"),
        "trend_score": _score("trend_score"),
        "yok_rank_score": _score("yok_rank_score"),
        "uniar_score": _score("uniar_score"),
        "prestige_score": _score("prestige_score"),
        "academic_score": _score("academic_score"),
        "transport_score": _score("transport_score"),
        "yok_data_available": bool(record.get("yok_data_available", False)),
        "publication_year": pub_year,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def _record_to_detail(record: Dict[str, Any]) -> Dict[str, Any]:
    detail: Dict[str, Any] = {}
    for key, val in record.items():
        if key in CARD_FIELDS or key in ("id", "isFavorite", "notes"):
            continue
        cleaned = _clean(val)
        if cleaned is None:
            continue
        detail[key] = cleaned
    return detail


class SupabaseLoader:
    def __init__(self, url: str, service_key: str, batch_size: int = 400) -> None:
        self.base = url.rstrip("/")
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        }
        self.batch_size = batch_size
        self.client = httpx.Client(timeout=120.0)

    def upsert(self, table: str, rows: List[Dict[str, Any]], on_conflict: str = "program_id") -> None:
        if not rows:
            return
        endpoint = f"{self.base}/rest/v1/{table}?on_conflict={on_conflict}"
        resp = self.client.post(endpoint, headers=self.headers, json=rows)
        if resp.status_code >= 400:
            raise RuntimeError(f"{table} upsert failed ({resp.status_code}): {resp.text[:500]}")

    def upsert_filter_options(self, df: pd.DataFrame) -> None:
        options = {
            "cities": sorted({str(x) for x in df["city"].dropna().unique() if str(x).strip()}),
            "degrees": sorted({str(x) for x in df["degree"].dropna().unique() if str(x).strip()}),
            "languages": sorted({str(x) for x in df["language"].dropna().unique() if str(x).strip()}),
            "tuition_statuses": sorted({str(x) for x in df["tuition_status"].dropna().unique() if str(x).strip()}),
            "universities": sorted({str(x) for x in df["university"].dropna().unique() if str(x).strip()}),
            "program_count": int(len(df)),
            "migrated_at": datetime.now(timezone.utc).isoformat(),
        }
        rows = [
            {"key": "filters", "values": options, "updated_at": datetime.now(timezone.utc).isoformat()},
        ]
        self.upsert("analysis_filter_options", rows, on_conflict="key")


def migrate(year: int, batch_size: int, dry_run: bool) -> Dict[str, Any]:
    parquet_path = analysis_parquet_path(year)
    if not os.path.exists(parquet_path):
        raise FileNotFoundError(f"Parquet bulunamadı: {parquet_path}")

    url = _env("SUPABASE_URL") or _env("VITE_SUPABASE_URL")
    service_key = _env("SUPABASE_SERVICE_ROLE_KEY")
    if not dry_run and (not url or not service_key):
        raise RuntimeError(
            "SUPABASE_URL (veya VITE_SUPABASE_URL) ve SUPABASE_SERVICE_ROLE_KEY gerekli."
        )

    df = pd.read_parquet(parquet_path)
    records = df.to_dict(orient="records")
    print(f"Kaynak: {parquet_path} ({len(records):,} program)")

    cards: List[Dict[str, Any]] = []
    details: List[Dict[str, Any]] = []
    for record in records:
        card = _record_to_card(record)
        if not card["program_id"]:
            continue
        cards.append(card)
        detail_body = _record_to_detail(record)
        details.append({
            "program_id": card["program_id"],
            "detail": detail_body,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })

    report = {
        "year": year,
        "programs": len(cards),
        "details": len(details),
        "dry_run": dry_run,
        "parquet": parquet_path,
    }

    if dry_run:
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return report

    loader = SupabaseLoader(url, service_key, batch_size=batch_size)

    for i in range(0, len(cards), batch_size):
        batch = cards[i : i + batch_size]
        loader.upsert("analysis_programs", batch)
        print(f"  analysis_programs {i + len(batch):,}/{len(cards):,}")

    for i in range(0, len(details), batch_size):
        batch = details[i : i + batch_size]
        loader.upsert("program_details", batch)
        print(f"  program_details {i + len(batch):,}/{len(details):,}")

    loader.upsert_filter_options(df)
    print("  analysis_filter_options güncellendi")
    print("Tamamlandı.")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Analiz veritabanını Supabase'e yükle")
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument("--batch-size", type=int, default=400)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    migrate(args.year, args.batch_size, args.dry_run)


if __name__ == "__main__":
    main()
