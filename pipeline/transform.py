#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""YÖK normalized record → universal analysis base record."""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

from pipeline.campus_key import compute_campus_key
from pipeline.config import NO_DATA_NOTE


def _is_valid_num(val: Any) -> bool:
    if val is None:
        return False
    try:
        if isinstance(val, float) and math.isnan(val):
            return False
    except TypeError:
        return False
    return True


def _safe_int(val: Any) -> Optional[int]:
    if not _is_valid_num(val):
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def _infer_degree(program_type: str) -> str:
    upper = (program_type or "").upper()
    if "ÖNLISANS" in upper or "ONLISANS" in upper:
        return "Önlisans (2Y)"
    return "Lisans (4Y)"


def _infer_tuition_status(scholarship_rate: str, university_type: str) -> str:
    rate = (scholarship_rate or "").strip()
    uni_type = (university_type or "").upper()

    if rate == "Burslu":
        return "Burslu"
    if rate == "Ücretli":
        return "Ücretli"
    if "%50" in rate:
        return "%50 İndirimli"
    if "%25" in rate:
        return "%25 İndirimli"
    if "%75" in rate:
        return "%75 İndirimli"
    if uni_type in ("VAKIF", "KKTC", "YURTDISI VAKIF"):
        return "Vakıf (Ücretli)"
    return "Devlet (Ücretsiz)"


def _build_history_rankings(row: Dict[str, Any]) -> List[int]:
    rankings = row.get("rankings")
    if isinstance(rankings, list) and rankings:
        return [_safe_int(r) for r in rankings if _safe_int(r) is not None]
    out = []
    for key in ("rank_y4", "rank_y3", "rank_y2", "rank_y1"):
        val = _safe_int(row.get(key))
        if val is not None:
            out.append(val)
    return out


def _build_history_quotas(row: Dict[str, Any]) -> List[int]:
    out = []
    for key in ("quota_y1", "quota_prev", "quota_current"):
        val = _safe_int(row.get(key))
        if val is not None:
            out.append(val)
    return out


def yok_record_to_base(row: Dict[str, Any]) -> Dict[str, Any]:
    """Convert normalized YÖK parquet row to app-compatible base record."""
    program_id = str(row.get("program_id", "")).strip()
    scholarship_rate = row.get("scholarship_rate") or ""
    university_type = row.get("university_type") or ""

    base = {
        "id": program_id,
        "program_id": program_id,
        "degree": _infer_degree(row.get("program_type", "")),
        "score_type": row.get("score_type") or "",
        "university": row.get("university") or "",
        "university_id": row.get("university_id"),
        "university_type": university_type,
        "department": row.get("department") or "",
        "department_group": row.get("department_group") or "",
        "full_name": row.get("full_title") or f"{row.get('university', '')} - {row.get('department', '')}",
        "faculty": row.get("faculty") or "",
        "language": row.get("language") or "",
        "instruction_type": row.get("instruction_type") or "",
        "tuition_status": _infer_tuition_status(scholarship_rate, university_type),
        "scholarship_rate": scholarship_rate,
        "tuition_fee": row.get("tuition_fee"),
        "city": row.get("city") or "",
        "district": row.get("district") or "",
        "duration_years": row.get("duration_years"),
        "transport_desc": None,
        "last_rank": _safe_int(row.get("last_rank")),
        "base_score_y1": row.get("base_score_y1"),
        "quota_current": _safe_int(row.get("quota_current")),
        "quota_prev": _safe_int(row.get("quota_prev")),
        "quota_y1": _safe_int(row.get("quota_y1")),
        "placed_students": _safe_int(row.get("placed_students")),
        "yok_data_available": bool(_safe_int(row.get("last_rank")) or _safe_int(row.get("rank_y2"))),
        "yok_data_note": "" if _safe_int(row.get("last_rank")) else NO_DATA_NOTE,
        "history_rankings": _build_history_rankings(row),
        "history_quotas": _build_history_quotas(row),
        "rank_y1": _safe_int(row.get("rank_y1")),
        "rank_y2": _safe_int(row.get("rank_y2")),
        "rank_y3": _safe_int(row.get("rank_y3")),
        "rank_y4": _safe_int(row.get("rank_y4")),
        "publication_year": row.get("publication_year"),
        "notes": "-",
        "isFavorite": False,
        "prediction": None,
    }
    base["campus_key"] = compute_campus_key(base)
    return base
