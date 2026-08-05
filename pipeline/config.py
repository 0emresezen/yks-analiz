#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pipeline paths and deterministic score weights."""

from __future__ import annotations

import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DEFAULT_YOK_YEAR = 2026
DEFAULT_UNIAR_YEAR = 2026

NO_DATA_NOTE = "Bu alan için doğrulanmış resmî veri bulunamadı."

# Deterministic composite weights (only applied when inputs exist)
PRESTIGE_WEIGHTS = {
    "uniar": 0.45,
    "accreditation": 0.25,
    "research": 0.20,
    "faculty_ratio": 0.10,
}

CAREER_WEIGHTS = {
    "employment": 0.35,
    "salary": 0.30,
    "graduate_success": 0.20,
    "industry_density": 0.15,
}

COMPOSITE_RATING_WEIGHTS = {
    "uniar": 0.35,
    "scholarship": 0.15,
    "trend": 0.20,
    "prestige": 0.15,
    "yok_rank": 0.15,
}


def master_parquet_path(year: int = DEFAULT_YOK_YEAR) -> str:
    validated = os.path.join(ROOT, "validated", "yok", f"{year}.parquet")
    processed = os.path.join(ROOT, "processed", "yok", f"{year}.parquet")
    return validated if os.path.exists(validated) else processed


def analysis_parquet_path(year: int = DEFAULT_YOK_YEAR) -> str:
    return os.path.join(ROOT, "validated", "analysis_database", f"{year}.parquet")


def analysis_json_path(year: int = DEFAULT_YOK_YEAR) -> str:
    return os.path.join(ROOT, "validated", "analysis_database", f"{year}.json")


def analysis_index_path(year: int = DEFAULT_YOK_YEAR) -> str:
    return os.path.join(ROOT, "data", f"analysis_index_{year}.json")


def build_report_path() -> str:
    return os.path.join(ROOT, "processed", "analysis_build_report.json")
