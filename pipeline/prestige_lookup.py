# -*- coding: utf-8 -*-
"""URAP tabanlı üniversite prestij skorları — deterministik formül yerine kaynak veri."""

from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional, Tuple

from pipeline.config import NO_DATA_NOTE, ROOT
from pipeline.uniar_lookup import normalize_university_for_match

PRESTIGE_PATH = os.path.join(ROOT, "validated", "prestige_rankings.json")
SOURCE_NAME = "URAP 2024-2025 Türkiye Sıralaması"
SOURCE_URL = "https://www.urap.hacettepe.edu.tr"

_CACHE: Optional[Dict[str, Any]] = None


def _load_prestige_data(path: str = PRESTIGE_PATH) -> Dict[str, Any]:
    if not os.path.exists(path):
        return {"universities": {}, "year": 2024}
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def get_prestige_lookup() -> Tuple[Dict[str, Dict[str, Any]], int, str, str]:
    global _CACHE
    if _CACHE is None:
        data = _load_prestige_data()
        _CACHE = data
    return (
        _CACHE.get("universities", {}),
        int(_CACHE.get("year", 2024)),
        _CACHE.get("source", SOURCE_NAME),
        _CACHE.get("source_url", SOURCE_URL),
    )


def reset_prestige_cache() -> None:
    global _CACHE
    _CACHE = None


def match_prestige(
    university: str,
    lookup: Dict[str, Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    if not university or not lookup:
        return None

    norm = normalize_university_for_match(university)
    if not norm:
        return None

    return lookup.get(norm)


def _build_desc(entry: Dict[str, Any], year: int) -> str:
    stored = entry.get("prestige_desc")
    if stored:
        return stored

    rank = entry.get("urap_rank")
    tier = entry.get("tier", "")
    if rank:
        if rank <= 10:
            band = "ülkenin en yüksek akademik prestijine sahip üniversitelerden"
        elif rank <= 30:
            band = "güçlü akademik prestij ve diploma tanınırlığına sahip"
        elif rank <= 80:
            band = "bölgesel düzeyde tanınan akademik itibara sahip"
        else:
            band = "yerel düzeyde akademik tanınırlığa sahip"
        return f"URAP {year}-{year + 1} Türkiye genel sıralamasında {rank}. — {band}."

    if tier == "kktc":
        return "KKTC üniversitesi; Türkiye URAP sıralaması dışında, bölgesel diploma tanınırlığı değerlendirilmiştir."
    if tier == "vakif_premium":
        return "Seçkin vakıf üniversitesi; işveren tanınırlığı ve mezun ağı güçlü."
    if tier == "vakif":
        return "Vakıf üniversitesi; sektör tanınırlığı orta-yüksek bandında."
    return "Bölgesel devlet üniversitesi; diploma tanınırlığı bölgesel istihdam pazarında değerlendirilmiştir."


def apply_prestige_fields(item: Dict[str, Any]) -> bool:
    """URAP prestij verisini programa uygular. Eşleşme varsa True döner."""
    lookup, year, source, source_url = get_prestige_lookup()
    entry = match_prestige(item.get("university", ""), lookup)

    if not entry or entry.get("prestige_score") is None:
        item["prestige_score"] = None
        item["prestige_data_available"] = False
        item["prestige_data_note"] = NO_DATA_NOTE
        item["prestige_desc"] = None
        item["prestige_data_source"] = None
        item["prestige_data_url"] = None
        item["prestige_urap_rank"] = None
        item["prestige_planned_source"] = SOURCE_NAME
        item["prestige_planned_source_url"] = SOURCE_URL
        return False

    score = round(float(entry["prestige_score"]), 1)
    item["prestige_score"] = score
    item["prestige_data_available"] = True
    item["prestige_data_source"] = source
    item["prestige_data_url"] = source_url
    item["prestige_data_note"] = ""
    item["prestige_desc"] = _build_desc(entry, year)
    item["prestige_urap_rank"] = entry.get("urap_rank")
    item["prestige_planned_source"] = SOURCE_NAME
    item["prestige_planned_source_url"] = SOURCE_URL
    return True
