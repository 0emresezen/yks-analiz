#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Stable campus key for shared location-based metrics."""

from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict


def _strip_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def normalize_token(text: Any) -> str:
    raw = _strip_accents(str(text or "").strip().upper())
    raw = raw.replace("İ", "I")
    raw = re.sub(r"[^A-Z0-9]+", "_", raw)
    return raw.strip("_") or "BILINMIYOR"


def compute_campus_key(item: Dict[str, Any]) -> str:
    """
    Kampüs = aynı üniversite + şehir + ilçe (fakülte/MYO konumu).
    Bu anahtarla ulaşım, barınma, yaşam maliyeti bir kez hesaplanır.
    """
    university_id = str(item.get("university_id") or "").strip()
    university = normalize_token(item.get("university"))
    city = normalize_token(item.get("city"))
    district = normalize_token(item.get("district")) or "MERKEZ"
    faculty = normalize_token(item.get("faculty"))

    uid = university_id if university_id else university
    if faculty and faculty not in ("BILINMIYOR", "FAKULTE", "MESLEK_YUKSEKOKULU"):
        return f"{uid}|{city}|{district}|{faculty}"
    return f"{uid}|{city}|{district}"
