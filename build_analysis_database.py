#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Universal Analysis Database Builder
====================================
YÖK master parquet (21.493 program) → deterministik enrich → analysis_database

Kullanım:
  python3 build_analysis_database.py
  python3 build_analysis_database.py --limit 100   # test
  python3 build_analysis_database.py --year 2026
"""

from __future__ import annotations

import argparse
import json
import sys

from pipeline.build import build_analysis_database


def main() -> None:
    parser = argparse.ArgumentParser(description="Evrensel deterministik analiz veritabanı oluştur")
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument("--uniar-year", type=int, default=2026)
    parser.add_argument("--limit", type=int, default=None, help="Test için kayıt sınırı")
    args = parser.parse_args()

    try:
        report = build_analysis_database(
            year=args.year,
            uniar_year=args.uniar_year,
            limit=args.limit,
        )
        print(json.dumps({
            "programs": report["total_programs"],
            "universities": report["total_universities"],
            "uniar_matched": report["uniar_matched"],
            "rated": report["rated"],
            "success": report["validation"]["success"],
        }, ensure_ascii=False))
    except Exception as e:
        print(f"HATA: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
