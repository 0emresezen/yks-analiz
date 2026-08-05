#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate campus_metrics.json from YÖK parquet without full analysis rebuild."""

from __future__ import annotations

import argparse
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from pipeline.campus_heuristics import compute_campus_metrics, reset_campus_cache
from pipeline.campus_key import compute_campus_key
from pipeline.config import DEFAULT_YOK_YEAR
from pipeline.build import load_master_records


def build_campus_metrics_index(year: int, limit: int | None = None) -> dict:
    reset_campus_cache()
    rows = load_master_records(year=year, limit=limit)
    index: dict[str, dict] = {}

    for row in rows:
        campus_key = compute_campus_key({
            "university_id": row.get("university_id"),
            "university": row.get("university"),
            "city": row.get("city"),
            "district": row.get("district"),
            "faculty": row.get("faculty"),
        })
        if campus_key in index:
            continue
        index[campus_key] = compute_campus_metrics(campus_key, {
            "city": row.get("city"),
            "district": row.get("district"),
            "university": row.get("university"),
        })

    return {
        "version": 1,
        "source": "campus_heuristics_v1",
        "year": year,
        "campus_count": len(index),
        "metrics": index,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Kampüs metrik indeksi üret")
    parser.add_argument("--year", type=int, default=DEFAULT_YOK_YEAR)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument(
        "--out",
        default=None,
        help="Çıktı yolu (varsayılan: data/analysis/{year}/campus_metrics.json)",
    )
    args = parser.parse_args()

    out = args.out or os.path.join(ROOT, "data", "analysis", str(args.year), "campus_metrics.json")
    doc = build_campus_metrics_index(year=args.year, limit=args.limit)

    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)

    print(f"Kampüs metrik indeksi → {out} ({doc['campus_count']} kampüs)")


if __name__ == "__main__":
    main()
