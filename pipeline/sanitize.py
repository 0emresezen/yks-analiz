#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Offline sanitization — frontend should receive clean data."""

from __future__ import annotations

import re
from typing import Any, Dict, List

PLAIN_TEXT_FIELDS = {
    "university", "department", "department_group", "faculty", "city", "district",
    "language", "tuition_status", "full_name", "notes", "degree", "score_type",
    "instruction_type", "scholarship_rate", "transport_desc",
    "uniar_desc", "prestige_desc", "academic_desc", "trend_desc", "yok_rank_desc",
    "transport_data_note", "uniar_data_note", "prestige_data_note",
    "academic_data_note", "scholarship_data_note", "partial_rating_note",
    "yok_data_note", "trend_data_note", "yok_rank_data_note", "career_data_note",
}

_TAG_RE = re.compile(r"<[^>]+>")


def _clean_text(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    text = _TAG_RE.sub("", value)
    return text.strip()


def sanitize_record(record: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(record)
    for field in PLAIN_TEXT_FIELDS:
        if field in out:
            out[field] = _clean_text(out.get(field))
    if isinstance(out.get("notes"), str) and not out["notes"]:
        out["notes"] = "-"
    return out


def sanitize_batch(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [sanitize_record(r) for r in records]
