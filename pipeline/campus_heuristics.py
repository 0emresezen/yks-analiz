#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Kampüs düzeyinde tahmini metrikler — resmî kaynak yoksa şehir/konum heuristikleri.
Her campus_key için bir kez hesaplanır, tüm bölümlere kopyalanır.
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from pipeline.campus_key import normalize_token

HEURISTIC_SOURCE = "Kampüs konum modeli (şehir tier + ilçe heuristikleri)"
HEURISTIC_NOTE = (
    "Resmî açık veri yerine şehir ulaşım altyapısı, yaşam maliyeti ve "
    "barınma yoğunluğu için üretilmiş tahmini skor; kampüs bazında paylaşılır."
)

METRO_CITIES = frozenset({
    "ISTANBUL", "ANKARA", "IZMIR", "BURSA", "ANTALYA", "KOCAELI",
    "ADANA", "GAZIANTEP", "MERSIN", "KONYA", "ESKISEHIR",
})

REGIONAL_HUBS = frozenset({
    "SAMSUN", "TRABZON", "KAYSERI", "DENIZLI", "MANISA", "MUGLA",
    "TEKIRDAG", "SAKARYA", "BALIKESIR", "AYDIN", "DIYARBAKIR",
    "SANLIURFA", "MALATYA", "ERZURUM", "VAN", "SIVAS", "TOKAT",
})

HIGH_COST_CITIES = frozenset({"ISTANBUL", "IZMIR", "ANTALYA", "MUGLA", "KOCAELI"})

REMOTE_DISTRICT_MARKERS = frozenset({
    "AYAS", "SEREFLIKOCHISAR", "POLATLI", "BEYPAZARI", "BEYPAZARI",
    "GUDUL", "NALLIHAN", "CUBUK", "KIZILCAHAMAM", "GOLBASI", "SILIVRI",
    "CATALCA", "SILE", "TUZLA", "PENDIK",
})

KKTC_MARKERS = frozenset({"KKTC", "KIBRIS", "GAZIMAGUSA", "LEFKOSA", "LEFKOŞA"})


def _round_score(value: float) -> float:
    return round(max(0.0, min(10.0, value)), 1)


def _city_tier(city: str, university: str) -> str:
    city_norm = normalize_token(city)
    uni_norm = normalize_token(university)
    if any(m in city_norm or m in uni_norm for m in KKTC_MARKERS):
        return "kktc"
    if city_norm in METRO_CITIES:
        return "metro"
    if city_norm in REGIONAL_HUBS:
        return "regional"
    return "local"


def _campus_life_boost(context: Dict[str, Any]) -> float:
    sub = context.get("uniar_subcategories") or {}
    campus_life = sub.get("campus_life")
    if campus_life is None:
        return 0.0
    try:
        return (float(campus_life) - 6.5) * 0.25
    except (TypeError, ValueError):
        return 0.0


def _transport_metrics(
    tier: str,
    city: str,
    district: str,
    boost: float,
) -> Tuple[float, str]:
    district_norm = normalize_token(district)
    if tier == "kktc":
        score, desc = 5.5, (
            f"{city} kampüsü: ada içi ulaşım ve şehir merkezine erişim sınırlı; "
            "öğrenci ulaşımı genelde otobüs ve özel araç ağırlıklı."
        )
    elif tier == "metro":
        score, desc = 7.8, (
            f"{city} metropolünde metro/tramvay ve yoğun toplu taşıma ağı; "
            "kampüse ulaşım genelde kolay, KYK ve özel yurt seçenekleri çok."
        )
    elif tier == "regional":
        score, desc = 6.2, (
            f"{city} bölgesel merkez: şehir içi otobüs hatları ve ana arterler mevcut; "
            "kampüs ulaşımı orta düzey, merkeze bağlantı genelde yeterli."
        )
    else:
        score, desc = 4.8, (
            f"{city} yerel ölçek: toplu taşıma sınırlı, kampüse ulaşım çoğunlukla "
            "şehir içi otobüs veya özel araç ile; planlı ulaşım önemli."
        )

    if any(marker in district_norm for marker in REMOTE_DISTRICT_MARKERS):
        score -= 1.4
        desc += f" {district} ilçesi/uzak kampüs konumu ulaşımı zorlaştırıyor."

    score = _round_score(score + boost)
    return score, desc


def _cost_metrics(tier: str, city: str) -> Tuple[float, str]:
    city_norm = normalize_token(city)
    if tier == "kktc":
        return 5.5, f"{city}: döviz ve lojistik nedeniyle yaşam maliyeti orta-yüksek bandında."
    if city_norm in HIGH_COST_CITIES:
        return 4.2, f"{city} yüksek yaşam maliyeti bandı; kira ve günlük harcamalar Türkiye ortalamasının üzerinde."
    if tier == "metro":
        return 4.8, f"{city} metropol: kira ve sosyal yaşam maliyeti yüksek, bütçe planlaması kritik."
    if tier == "regional":
        return 6.0, f"{city} bölgesel merkez: yaşam maliyeti orta band; barınma ve yeme-içme dengeli."
    return 7.2, f"{city} yerel ölçek: genel yaşam maliyeti Türkiye ortalamasının altında veya dengeli."


def _housing_metrics(tier: str, city: str, boost: float) -> Tuple[float, str]:
    if tier == "kktc":
        score, desc = 5.8, f"{city}: KYK ve özel yurt kapasitesi sınırlı; erken başvuru önerilir."
    elif tier == "metro":
        score, desc = 6.5, (
            f"{city}: KYK ve özel yurt seçenekleri geniş; yoğun talep nedeniyle "
            "kampüs yakını kira baskısı yüksek olabilir."
        )
    elif tier == "regional":
        score, desc = 6.8, f"{city}: yurt ve kiralık daire seçenekleri orta-yüksek; KYK başvurusu önemli."
    else:
        score, desc = 7.5, (
            f"{city}: barınma maliyeti genelde düşük; KYK ve özel yurt kapasitesi "
            "çoğu öğrenci için yeterli olabilir."
        )
    score = _round_score(score + boost * 0.5)
    return score, desc


def compute_campus_metrics(campus_key: str, context: Dict[str, Any]) -> Dict[str, Any]:
    city = str(context.get("city") or "Bilinmiyor")
    district = str(context.get("district") or "Merkez")
    university = str(context.get("university") or "")
    tier = _city_tier(city, university)
    boost = _campus_life_boost(context)

    transport_score, transport_desc = _transport_metrics(tier, city, district, boost)
    cost_score, cost_desc = _cost_metrics(tier, city)
    housing_score, housing_desc = _housing_metrics(tier, city, boost)

    return {
        "campus_key": campus_key,
        "transport_score": transport_score,
        "transport_desc": transport_desc,
        "transport_data_available": True,
        "transport_data_source": HEURISTIC_SOURCE,
        "transport_data_note": HEURISTIC_NOTE,
        "cost_score": cost_score,
        "cost_desc": cost_desc,
        "cost_data_available": True,
        "cost_data_source": HEURISTIC_SOURCE,
        "cost_data_note": HEURISTIC_NOTE,
        "housing_score": housing_score,
        "housing_desc": housing_desc,
        "housing_data_available": True,
        "housing_data_source": HEURISTIC_SOURCE,
        "housing_data_note": HEURISTIC_NOTE,
    }


def apply_campus_metrics_to_item(item: Dict[str, Any], metrics: Dict[str, Any]) -> None:
    """Yalnızca hâlâ verisi olmayan metrikleri doldur (resmî/LLM verisi önceliklidir)."""
    for metric in ("transport", "cost", "housing"):
        if item.get(f"{metric}_data_available"):
            continue
        for suffix in ("_score", "_desc", "_data_available", "_data_source", "_data_note"):
            key = f"{metric}{suffix}"
            if key in metrics:
                item[key] = metrics[key]


def apply_academic_heuristic(item: Dict[str, Any]) -> None:
    if item.get("academic_data_available"):
        return
    sub = item.get("uniar_subcategories") or {}
    parts = []
    labels = []
    for label, field in (
        ("öğrenme deneyimi", "learning_experience"),
        ("akademik destek", "academic_support"),
        ("öğrenme kaynakları", "learning_resources"),
    ):
        val = sub.get(field)
        if val is not None:
            try:
                parts.append(float(val))
                labels.append(label)
            except (TypeError, ValueError):
                continue
    if not parts:
        return
    score = _round_score(sum(parts) / len(parts))
    item["academic_score"] = score
    item["academic_data_available"] = True
    item["academic_data_source"] = "ÜNİAR alt kategorilerinden türetilmiş tahmin"
    item["academic_desc"] = (
        f"ÜNİAR öğrenci anketinden türetilmiş tahmini akademik kalite "
        f"({', '.join(labels)})."
    )
    item["academic_data_note"] = (
        "Resmî YÖK personel verisi yerine ÜNİAR alt skorlarından türetildi."
    )


_CAMPUS_METRICS_CACHE: Dict[str, Dict[str, Any]] = {}


def reset_campus_cache() -> None:
    _CAMPUS_METRICS_CACHE.clear()


def get_campus_metrics_cache() -> Dict[str, Dict[str, Any]]:
    return dict(_CAMPUS_METRICS_CACHE)


def apply_campus_metrics(item: Dict[str, Any]) -> None:
    from pipeline.campus_key import compute_campus_key

    campus_key = compute_campus_key(item)
    item["campus_key"] = campus_key

    if campus_key not in _CAMPUS_METRICS_CACHE:
        context = {
            "city": item.get("city"),
            "district": item.get("district"),
            "university": item.get("university"),
            "uniar_subcategories": item.get("uniar_subcategories"),
            "uniar_score": item.get("uniar_score"),
        }
        _CAMPUS_METRICS_CACHE[campus_key] = compute_campus_metrics(campus_key, context)

    apply_campus_metrics_to_item(item, _CAMPUS_METRICS_CACHE[campus_key])
