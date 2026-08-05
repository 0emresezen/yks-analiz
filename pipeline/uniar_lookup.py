# -*- coding: utf-8 -*-
"""ÜNİAR/TÜMA lookup and in-place enrichment helpers (stdlib only)."""

from __future__ import annotations

import difflib
import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

NO_DATA_NOTE = "Bu alan için doğrulanmış resmî veri bulunamadı."
VALIDATED_SAT_PATH = "validated/satisfaction_validated.json"
DEFAULT_SOURCE_URL = "https://uniar.net/tr/siralama/tuma"


def ascii_fold(text: str) -> str:
    table = str.maketrans({
        "İ": "I", "ı": "i", "Ğ": "G", "ğ": "g",
        "Ü": "U", "ü": "u", "Ş": "S", "ş": "s",
        "Ö": "O", "ö": "o", "Ç": "C", "ç": "c",
    })
    return text.translate(table).upper()


def normalize_university_for_match(name: str) -> str:
    if not name:
        return ""
    name = ascii_fold(name)
    name = re.sub(r"\([^)]*\)", "", name)
    name = re.sub(r"[^A-Z0-9\s]", " ", name)
    stop = {
        "UNIVERSITESI", "UNIVERSITE", "ENSTITUSU", "ENSTITU",
        "VAKIF", "DEVLET", "TC", "T", "C",
    }
    words = [w for w in name.split() if w and w not in stop]
    return " ".join(words)


def load_satisfaction_records(
    path: str = VALIDATED_SAT_PATH,
    year: Optional[int] = None,
) -> List[Dict[str, Any]]:
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as fh:
        records = json.load(fh)
    if year is None:
        years = [r.get("year") for r in records if r.get("year")]
        year = max(years) if years else None
    if year is None:
        return records
    return [r for r in records if r.get("year") == year]


def build_uniar_lookup(
    records: Optional[List[Dict[str, Any]]] = None,
    year: Optional[int] = None,
    path: str = VALIDATED_SAT_PATH,
) -> Tuple[Dict[str, Dict[str, Any]], int]:
    """Returns (normalized_name -> satisfaction record, year used)."""
    if records is None:
        records = load_satisfaction_records(path=path, year=year)
    if not records:
        return {}, year or 0

    used_year = records[0].get("year", year or 0)
    lookup: Dict[str, Dict[str, Any]] = {}
    for rec in records:
        key = normalize_university_for_match(rec.get("university_name", ""))
        if key:
            lookup[key] = rec
    return lookup, int(used_year or 0)


def match_satisfaction(
    university: str,
    lookup: Dict[str, Dict[str, Any]],
    cutoff: float = 0.85,
) -> Optional[Dict[str, Any]]:
    if not university or not lookup:
        return None

    norm = normalize_university_for_match(university)
    if not norm:
        return None

    hit = lookup.get(norm)
    if hit:
        return hit

    best = difflib.get_close_matches(norm, list(lookup.keys()), n=1, cutoff=cutoff)
    if best:
        return lookup[best[0]]
    return None


def apply_uniar_fields(
    item: Dict[str, Any],
    lookup: Dict[str, Dict[str, Any]],
    year: int,
) -> bool:
    """Apply TÜMA fields to a program record. Returns True if matched."""
    sat = match_satisfaction(item.get("university", ""), lookup)
    if not sat:
        item["uniar_score"] = None
        item["uniar_data_available"] = False
        item["uniar_data_source"] = None
        item["uniar_data_url"] = None
        item["uniar_year"] = None
        item["uniar_grade"] = None
        item["uniar_desc"] = None
        item["uniar_data_note"] = NO_DATA_NOTE
        item["uniar_subcategories"] = None
        return False

    score = round(float(sat["overall_score"]), 1)
    sub_meta = sat.get("source_metadata") or {}
    item["uniar_score"] = score
    item["uniar_data_available"] = True
    item["uniar_data_source"] = sat.get("source") or f"ÜNİAR TÜMA {year} Sıralamaları"
    item["uniar_data_url"] = sat.get("source_url") or DEFAULT_SOURCE_URL
    item["uniar_year"] = sat.get("year", year)
    item["uniar_grade"] = sat.get("overall_grade")
    item["uniar_subcategories"] = {
        "learning_experience": sat.get("learning_experience"),
        "campus_life": sat.get("campus_life"),
        "academic_support": sat.get("academic_support"),
        "management": sat.get("management"),
        "career_support": sat.get("career_support"),
        "learning_resources": sub_meta.get("learning_resources"),
    }
    if score >= 9.0:
        item["uniar_desc"] = "A+ Öğrenci Memnuniyeti & Canlı Kampüs Yaşamı"
    elif score >= 7.5:
        item["uniar_desc"] = "Yüksek Öğrenci Memnuniyeti & Aktif Sosyal Hayat"
    elif score >= 5.0:
        item["uniar_desc"] = "Orta Düzey Sosyal İmkânlar & Standart Memnuniyet"
    else:
        item["uniar_desc"] = "Sınırlı Kampüs İmkânları & Gelişmekte Olan Sosyal Hayat"
    item["uniar_data_note"] = ""
    return True
