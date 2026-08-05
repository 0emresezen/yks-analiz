#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Deterministic score calculations — no LLM, no randomness."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from pipeline.config import (
    CAREER_WEIGHTS,
    COMPOSITE_RATING_WEIGHTS,
    NO_DATA_NOTE,
)


def _round_score(value: float) -> float:
    return round(max(0.0, min(10.0, value)), 1)


def scholarship_score_from_yok(
    scholarship_rate: str,
    university_type: str,
) -> Tuple[Optional[float], bool, str]:
    rate = (scholarship_rate or "").strip().lower()
    uni_type = (university_type or "").upper()

    if rate == "burslu":
        return 10.0, True, "Tam burslu program (ÖSYM Kılavuzu)"
    if "%75" in rate:
        return 9.0, True, "%75 burslu program (ÖSYM Kılavuzu)"
    if "%50" in rate:
        return 6.0, True, "%50 indirimli program (ÖSYM Kılavuzu)"
    if "%25" in rate:
        return 4.0, True, "%25 indirimli program (ÖSYM Kılavuzu)"
    if rate == "ücretli" or uni_type in ("VAKIF", "KKTC", "YURTDISI VAKIF"):
        if not rate and uni_type == "DEVLET":
            return 8.0, True, "Devlet programı — harç muaf (ÖSYM Kılavuzu)"
        return 2.0, True, "Ücretli program (ÖSYM Kılavuzu)"

    if uni_type == "DEVLET" or not rate:
        return 8.0, True, "Devlet programı — harç muaf (ÖSYM Kılavuzu)"

    return None, False, NO_DATA_NOTE


def trend_score_from_rankings(rankings: List[int]) -> Tuple[Optional[float], bool, str]:
    """
    Deterministic trend from rank history (oldest → newest).
    Improving rank (lower number) → higher score.
    """
    clean = [r for r in rankings if r and r > 0]
    if len(clean) < 2:
        return None, False, NO_DATA_NOTE

    oldest, newest = clean[0], clean[-1]
    if oldest <= 0:
        return None, False, NO_DATA_NOTE

    # Positive change = rank improved (number went down)
    pct_change = (oldest - newest) / oldest

    if pct_change >= 0.15:
        score, desc = 9.0, "Güçlü yükseliş trendi (son yıllarda sıra iyileşti)"
    elif pct_change >= 0.05:
        score, desc = 7.5, "Yükseliş eğilimi"
    elif pct_change >= -0.05:
        score, desc = 6.0, "Yatay trend"
    elif pct_change >= -0.15:
        score, desc = 4.5, "Düşüş eğilimi"
    else:
        score, desc = 3.0, "Belirgin düşüş trendi"

    return _round_score(score), True, desc


def yok_rank_score(last_rank: Optional[int]) -> Tuple[Optional[float], bool, str]:
    """Map taban sıra to 0-10 accessibility/competitiveness score."""
    if not last_rank or last_rank <= 0:
        return None, False, NO_DATA_NOTE

    if last_rank <= 10_000:
        score, desc = 9.5, "Çok seçici program (ilk 10.000)"
    elif last_rank <= 50_000:
        score, desc = 8.0, "Seçici program (ilk 50.000)"
    elif last_rank <= 150_000:
        score, desc = 6.5, "Orta düzey rekabet"
    elif last_rank <= 500_000:
        score, desc = 5.0, "Geniş erişimli program"
    else:
        score, desc = 3.5, "Düşük rekabet / yüksek erişim"

    return _round_score(score), True, desc


def career_score(item: Dict[str, Any]) -> Tuple[Optional[float], bool, str]:
    """Career composite — only when employment/salary/etc. sources exist."""
    components: List[Tuple[float, float]] = []

    for key, weight in CAREER_WEIGHTS.items():
        val = item.get(f"_{key}_score") or item.get(f"{key}_score")
        if val is not None:
            components.append((float(val), weight))

    if not components:
        return None, False, NO_DATA_NOTE

    total_w = sum(w for _, w in components)
    raw = sum(v * w for v, w in components) / total_w
    return _round_score(raw), True, f"Deterministik kariyer skoru ({len(components)} kaynak)"


def composite_rating(item: Dict[str, Any]) -> Tuple[Optional[float], str]:
    """Weighted composite from all available deterministic scores."""
    parts: List[Tuple[float, float]] = []

    mapping = {
        "uniar": item.get("uniar_score"),
        "scholarship": item.get("scholarship_score"),
        "trend": item.get("trend_score"),
        "prestige": item.get("prestige_score"),
        "yok_rank": item.get("yok_rank_score"),
    }

    for key, weight in COMPOSITE_RATING_WEIGHTS.items():
        val = mapping.get(key)
        if val is not None:
            parts.append((float(val), weight))

    if not parts:
        return None, NO_DATA_NOTE

    total_w = sum(w for _, w in parts)
    raw = sum(v * w for v, w in parts) / total_w
    note = (
        f"Deterministik bileşik puan — {len(parts)} kaynak "
        f"({', '.join(k for k, v in mapping.items() if v is not None)})"
    )
    return _round_score(raw), note
