#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Deterministic enrichment for universal analysis records."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from pipeline.config import NO_DATA_NOTE
from pipeline.scoring import (
    career_score,
    composite_rating,
    prestige_score,
    scholarship_score_from_yok,
    trend_score_from_rankings,
    yok_rank_score,
)
from satisfaction.uniar_lookup import apply_uniar_fields, build_uniar_lookup

NULL_METRICS = {
    "academic": ("YÖK Akademik Personel İstatistikleri", "https://istatistik.yok.gov.tr"),
    "transport": ("Şehir/Belediye Ulaşım Açık Verisi", ""),
    "industry": ("Kariyer.net & LinkedIn İşveren Anketleri", ""),
    "research": ("URAP & TÜBİTAK Girişimci Üniversite Endeksi", ""),
    "international": ("YÖK Atlas Erasmus & Uluslararası İstatistikler", ""),
    "cost": ("TÜİK Tüketici Fiyat Endeksi & Numbeo", ""),
    "housing": ("KYK Genel Müdürlüğü Açık Verisi", ""),
    "ai_opportunity": ("Teknoloji Geliştirme Bölgeleri Yönetimi A.Ş.", ""),
    "internship": ("Kariyer.net Staj İstatistikleri", ""),
    "startup": ("TÜBİTAK Girişimci & Yenilikçi Üniversite Endeksi", ""),
}


def _apply_null_metrics(item: Dict[str, Any]) -> None:
    for metric_key, (planned_source, planned_url) in NULL_METRICS.items():
        item[f"{metric_key}_score"] = None
        item[f"{metric_key}_data_available"] = False
        item[f"{metric_key}_data_note"] = NO_DATA_NOTE
        item[f"{metric_key}_planned_source"] = planned_source
        item[f"{metric_key}_planned_source_url"] = planned_url


def _apply_uniar_null(item: Dict[str, Any]) -> None:
    """ÜNİAR alanlarını null yap — enrich_record içinde lookup ile doldurulur."""
    item["uniar_score"] = None
    item["uniar_data_available"] = False
    item["uniar_data_source"] = None
    item["uniar_data_url"] = None
    item["uniar_year"] = None
    item["uniar_grade"] = None
    item["uniar_desc"] = None
    item["uniar_data_note"] = NO_DATA_NOTE
    item["uniar_subcategories"] = None
    item["uniar_planned_source"] = "ÜNİAR TÜMA Raporu"
    item["uniar_planned_source_url"] = "https://uniar.net/tr/siralama/tuma"


_UNIAR_LOOKUP: Optional[Dict[str, Any]] = None
_UNIAR_YEAR: int = 0


def _get_uniar_lookup(uniar_year: Optional[int] = None):
    global _UNIAR_LOOKUP, _UNIAR_YEAR
    if _UNIAR_LOOKUP is None:
        _UNIAR_LOOKUP, _UNIAR_YEAR = build_uniar_lookup(year=uniar_year)
    return _UNIAR_LOOKUP, _UNIAR_YEAR


def build_traceability(item: Dict[str, Any], source_name: str, source_url: str) -> Dict[str, Any]:
    content = json.dumps(
        {k: v for k, v in item.items() if k != "_traceability"},
        ensure_ascii=False,
        sort_keys=True,
        default=str,
    ).encode("utf-8")
    program_id = item.get("program_id", "UNK")
    return {
        "source_name": source_name,
        "source_url": source_url,
        "publication_year": item.get("publication_year") or 2026,
        "retrieved_at": datetime.now().isoformat(),
        "parser_version": "11.0.0",
        "trace_id": f"ANALYSIS_{program_id}",
        "sha256": hashlib.sha256(content).hexdigest(),
        "validated": False,
        "validator_version": "2.1.0",
    }


def enrich_record(item: Dict[str, Any], uniar_year: Optional[int] = None) -> Dict[str, Any]:
    """Deterministic enrichment — same input always yields same output."""
    _apply_uniar_null(item)
    lookup, year = _get_uniar_lookup(uniar_year)
    apply_uniar_fields(item, lookup, year)

    sch_score, sch_avail, sch_note = scholarship_score_from_yok(
        item.get("scholarship_rate", ""),
        item.get("university_type", ""),
    )
    item["scholarship_score"] = sch_score
    item["scholarship_data_available"] = sch_avail
    item["scholarship_data_source"] = "ÖSYM Tercih Kılavuzu / YÖK Atlas" if sch_avail else None
    item["scholarship_data_url"] = "https://www.osym.gov.tr" if sch_avail else None
    item["scholarship_data_note"] = sch_note

    item["language_data_available"] = bool(item.get("language"))
    item["language_data_source"] = "YÖK Atlas / ÖSYM Kılavuzu" if item.get("language") else None

    trend, trend_avail, trend_note = trend_score_from_rankings(item.get("history_rankings", []))
    item["trend_score"] = trend
    item["trend_data_available"] = trend_avail
    item["trend_data_note"] = trend_note
    item["trend_desc"] = trend_note if trend_avail else None

    rank_score, rank_avail, rank_note = yok_rank_score(item.get("last_rank"))
    item["yok_rank_score"] = rank_score
    item["yok_rank_data_available"] = rank_avail
    item["yok_rank_data_note"] = rank_note
    item["yok_rank_desc"] = rank_note if rank_avail else None

    _apply_null_metrics(item)

    pres_score, pres_avail, pres_note = prestige_score(item)
    item["prestige_score"] = pres_score
    item["prestige_data_available"] = pres_avail
    item["prestige_data_note"] = pres_note if not pres_avail else ""
    item["prestige_desc"] = pres_note if pres_avail else None
    item["prestige_planned_source"] = "URAP / QS Turkey Rankings"
    item["prestige_planned_source_url"] = "https://www.urap.hacettepe.edu.tr"

    car_score, car_avail, car_note = career_score(item)
    item["career_score"] = car_score
    item["career_data_available"] = car_avail
    item["career_data_note"] = car_note
    item["career_planned_source"] = "Kariyer.net Mezun Başarı Raporları"

    item["transport_data_available"] = False
    item["transport_data_note"] = NO_DATA_NOTE
    item["transport_planned_source"] = "Şehir/Belediye Ulaşım Açık Verisi"

    rating, rating_note = composite_rating(item)
    item["partial_rating"] = rating
    item["partial_rating_note"] = rating_note
    item["rating"] = rating

    item["_traceability"] = build_traceability(
        item,
        source_name="YKS Universal Analysis Pipeline V11",
        source_url="https://yokatlas.yok.gov.tr",
    )

    return item


def enrich_batch(records: List[Dict[str, Any]], uniar_year: int = 2026) -> List[Dict[str, Any]]:
    global _UNIAR_LOOKUP, _UNIAR_YEAR
    _UNIAR_LOOKUP = None
    _UNIAR_YEAR = 0
    return [enrich_record(dict(r), uniar_year=uniar_year) for r in records]
