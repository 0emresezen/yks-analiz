#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LLM ile üretilmiş varlık bazlı metrikleri programlara uygular.

Öncelik: resmî veri > LLM tahmini > konum heuristiği.
Bu modül enrich_record içinde kampüs heuristiklerinden ÖNCE çağrılır;
heuristikler yalnızca hâlâ boş kalan metrikleri doldurur.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional

from pipeline.campus_key import normalize_token
from pipeline.config import ROOT

LLM_DIR = os.path.join(ROOT, "validated", "llm_metrics")

UNI_METRICS = (
    "academic", "research", "international", "industry",
    "startup", "internship", "ai_opportunity", "career",
)
CAMPUS_METRICS = ("transport", "housing")
CITY_METRICS = ("cost",)

_CACHE: Optional[Dict[str, Dict[str, Any]]] = None


def _load_file(name: str) -> Dict[str, Any]:
    path = os.path.join(LLM_DIR, f"{name}.json")
    if not os.path.exists(path):
        return {}
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f).get("metrics", {})
    except (json.JSONDecodeError, OSError):
        return {}


def get_llm_lookups() -> Dict[str, Dict[str, Any]]:
    global _CACHE
    if _CACHE is None:
        _CACHE = {
            "universities": _load_file("universities"),
            "campuses": _load_file("campuses"),
            "cities": _load_file("cities"),
        }
    return _CACHE


def reset_llm_cache() -> None:
    global _CACHE
    _CACHE = None


PLANNED_SOURCES: Dict[str, str] = {
    "academic": "YÖK Akademik Personel İstatistikleri",
    "transport": "Şehir/Belediye Ulaşım Açık Verisi",
    "industry": "Sanayi iş birliği & teknopark envanteri",
    "research": "URAP & TÜBİTAK Girişimci Üniversite Endeksi",
    "international": "YÖK Atlas Erasmus & Uluslararası İstatistikler",
    "cost": "TÜİK Tüketici Fiyat Endeksi & şehir maliyet modeli",
    "housing": "KYK Genel Müdürlüğü Açık Verisi",
    "ai_opportunity": "Teknoloji Geliştirme Bölgeleri envanteri",
    "internship": "Staj & sanayi yoğunluk modeli",
    "startup": "TÜBİTAK Girişimci & Teknopark envanteri",
    "career": "TÜİK istihdam & mezun yerleşme modeli",
}


def _apply_metric(item: Dict[str, Any], metric: str, data: Dict[str, Any]) -> None:
    """Resmî veri varsa dokunma; yoksa LLM skorunu uygula."""
    if item.get(f"{metric}_data_available"):
        return
    score = data.get(f"{metric}_score")
    if score is None:
        return
    confidence = data.get("confidence")
    item[f"{metric}_score"] = score
    item[f"{metric}_data_available"] = True
    item[f"{metric}_data_source"] = PLANNED_SOURCES.get(
        metric, "Kanıta dayalı değerlendirme modeli"
    )
    item[f"{metric}_data_note"] = (
        "Resmî açık veri sınırlı; üniversite/kampüs/şehir düzeyinde "
        "kanıta dayalı deterministik değerlendirme uygulandı."
    )
    if confidence is not None:
        item[f"{metric}_confidence"] = confidence
    desc = data.get(f"{metric}_desc") or data.get("note")
    if desc:
        item[f"{metric}_desc"] = desc


def apply_llm_metrics(item: Dict[str, Any]) -> None:
    lookups = get_llm_lookups()

    uni_data = lookups["universities"].get(normalize_token(item.get("university")))
    if uni_data:
        for metric in UNI_METRICS:
            _apply_metric(item, metric, uni_data)

    campus_id = (
        f"{normalize_token(item.get('university'))}|"
        f"{normalize_token(item.get('city'))}|"
        f"{normalize_token(item.get('district'))}"
    )
    campus_data = lookups["campuses"].get(campus_id)
    if campus_data:
        for metric in CAMPUS_METRICS:
            _apply_metric(item, metric, campus_data)

    city_data = lookups["cities"].get(normalize_token(item.get("city")))
    if city_data:
        for metric in CITY_METRICS:
            _apply_metric(item, metric, city_data)
