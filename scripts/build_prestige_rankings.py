#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
URAP 2024-2025 Türkiye sıralamasından prestij verisi üretir.
Kaynak: URAP basın açıklaması (22 Ekim 2024) — newtr.urapcenter.org

Kullanım:
  python3 scripts/build_prestige_rankings.py
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any, Dict, List, Optional

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from pipeline.uniar_lookup import normalize_university_for_match

OUTPUT = os.path.join(ROOT, "validated", "prestige_rankings.json")

# URAP 2024-2025 genel Türkiye sıralaması (basın açıklaması Tablo, ilk 23)
URAP_GENERAL_RANK: Dict[str, int] = {
    "KOC": 1,
    "HACETTEPE": 2,
    "ORTA DOGU TEKNIK": 3,
    "ANKARA": 4,
    "ISTANBUL TEKNIK": 5,
    "ISTANBUL": 6,
    "GAZI": 7,
    "ISTANBUL CERRAHPASA": 8,
    "SABANCI": 9,
    "EGE": 10,
    "ATATURK": 11,
    "YILDIZ TEKNIK": 12,
    "MARMARA": 13,
    "ERCIYES": 14,
    "GEBZE TEKNIK": 15,
    "FIRAT": 16,
    "DOKUZ EYLUL": 17,
    "IHSAN DOGRAMACI BILKENT": 18,
    "BILKENT": 18,
    "CUKUROVA": 19,
    "BOGAZICI": 20,
    "KARADENIZ TEKNIK": 21,
    "BURSA ULUDAG": 22,
    "IZMIR YUKSEK TEKNOLOJI": 23,
}

# Ek bilinen sıralamalar (tıp fakültesi olan / araştırma üniversiteleri)
URAP_EXTRA_RANK: Dict[str, int] = {
    "SELCUK": 24,
    "ONDOKUZ MAYIS": 25,
    "AKDENIZ": 26,
    "INONU": 27,
    "SAKARYA": 28,
    "PAMUKKALE": 29,
    "BALIKESIR": 30,
    "KOCAELI": 31,
    "TRAKYA": 32,
    "MERSIN": 33,
    "HARRAN": 34,
    "SULEYMAN DEMIREL": 35,
    "KAFKAS": 36,
    "DUZCE": 37,
    "KIRIKKALE": 38,
    "CANAKKALE ONSEKIZ MART": 39,
    "KIRKLARELI": 40,
    "HITIT": 41,
    "KASTAMONU": 42,
    "SAMSUN": 43,
    "ONDOKUZ MAYIS": 25,
    "YALOVA": 44,
    "MANISA CELEBİ BAYAR": 45,
    "MUGLA SITKI KOCMAN": 46,
    "ADIYAMAN": 47,
    "HATAY MUSTAFA KEMAL": 48,
    "KUTAHYA DUMLUPINAR": 49,
    "NECMETTIN ERBAKAN": 50,
    "VAN YUZUNCU YIL": 51,
    "MARDIN ARTUKLU": 52,
    "SIVAS CUMHURIYET": 53,
    "TOKAT GAZIOSMANPASA": 54,
    "ZONGULDAK BULENT ECEVIT": 55,
    "USAK": 56,
    "KIRSEHIR AHİ EVRAN": 57,
    "BOLU ABANT IZZET BAYSAL": 58,
    "SAGLIK BILIMLERI": 30,
    "ACIBADEM MEHMET ALI AYDINLAR": 35,
    "BAHCESEHIR": 55,
    "ISTANBUL MEDIPOL": 45,
    "ISTANBUL AYDIN": 70,
    "ISTANBUL BILGI": 75,
    "YEDITEPE": 60,
    "MALTEPE": 72,
    "ATILIM": 65,
    "BASKENT": 62,
    "TOBB EKONOMI VE TEKNOLOJI": 68,
    "OSTIM TEKNIK": 80,
    "ANKARA BILIM": 78,
    "TED": 82,
    "GALATASARAY": 70,
    "MEF": 88,
    "OZYGIN": 72,
    "KADIR HAS": 74,
    "CANKAYA": 76,
    "ESKISEHIR TEKNIK": 77,
    "ESKISEHIR OSMANGAZI": 52,
    "ANADOLU": 55,
    "ABDULLAH GUL": 60,
    "KONYA TEKNIK": 65,
    "BURSA TEKNIK": 68,
    "ERZURUM TEKNIK": 70,
    "ISPARTA UYGULAMALI BILIMLER": 72,
    "KARABUK": 75,
    "SINOP": 85,
    "BARTIN": 80,
    "BAYBURT": 90,
    "ARTVIN CORUH": 88,
    "GUMUSHANE": 87,
    "HAKKARI": 92,
    "SIRNAK": 93,
    "MUNZUR": 95,
    "IGDIR": 82,
    "ARDAHAN": 90,
    "KILIS 7 ARALIK": 91,
    "BITLIS EREN": 86,
    "MUS ALPARSLAN": 89,
    "BINGOL": 84,
    "BATMAN": 88,
    "ADIYAMAN": 47,
}

# Vakıf premium (yüksek işveren tanınırlığı, URAP dışı veya alt sıra)
VAKIF_PREMIUM = {
    "KOÇ", "SABANCI", "BILKENT", "IHSAN DOGRAMACI BILKENT", "BOGAZICI",
    "ACIBADEM MEHMET ALI AYDINLAR", "ISTANBUL MEDIPOL", "BAHCESEHIR",
    "YEDITEPE", "ATILIM", "BASKENT", "OZYGIN", "KADIR HAS", "TOBB EKONOMI VE TEKNOLOJI",
    "GALATASARAY", "MEF", "TED", "ALTINBAS", "BEZM I ALEM", "ISTANBUL SABAHATTIN ZAIM",
}

KKTC_MARKERS = ("KKTC", "KIBRIS", "LEFKOSA", "GAZIMAGUSA", "GIRNE", "BAKU", "AZERBAYCAN", "BOSNA")


def rank_to_score(rank: int) -> float:
    if rank <= 1:
        return 10.0
    if rank <= 3:
        return 9.5
    if rank <= 10:
        return 9.0
    if rank <= 20:
        return 8.5
    if rank <= 40:
        return 8.0
    if rank <= 70:
        return 7.5
    if rank <= 100:
        return 7.0
    if rank <= 130:
        return 6.5
    if rank <= 160:
        return 6.0
    if rank <= 180:
        return 5.5
    return 5.0


def _tier_fallback(norm: str, uni_name: str) -> tuple[int, str]:
    upper = uni_name.upper()
    if any(m in upper for m in KKTC_MARKERS):
        return 150, "kktc"
    if norm in VAKIF_PREMIUM or "VAKIF" in upper and any(
        k in norm for k in ("ISTANBUL", "ANKARA", "IZMIR")
    ):
        return 85, "vakif_premium"
    if "VAKIF" in upper or "MESLEK YUKSEKOKULU" in upper:
        return 120, "vakif"
    if "TEKNIK" in norm or "TEKNOLOJI" in norm:
        return 75, "devlet"
    if any(c in upper for c in ("ISTANBUL", "ANKARA", "IZMIR", "BURSA", "ANTALYA", "KONYA", "KAYSERI")):
        return 65, "devlet"
    return 110, "devlet"


def _resolve_rank(norm: str, uni_name: str) -> tuple[int, str]:
    combined = {**URAP_GENERAL_RANK, **URAP_EXTRA_RANK}
    words = set(norm.split())

    if norm in combined:
        return combined[norm], "urap"

    for key, rank in sorted(combined.items(), key=lambda x: -len(x[0])):
        if key in words or norm.startswith(f"{key} "):
            return rank, "urap"

    return _tier_fallback(norm, uni_name)


def load_universities() -> List[str]:
    path = os.path.join(ROOT, "validated", "analysis_database", "2026.json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            recs = json.load(fh)
        return sorted({r["university"] for r in recs if r.get("university")})

    path = os.path.join(ROOT, "validated", "yks_master_database.json")
    with open(path, encoding="utf-8") as fh:
        recs = json.load(fh)
    return sorted({r["university"] for r in recs if r.get("university")})


def build() -> Dict[str, Any]:
    universities: Dict[str, Dict[str, Any]] = {}
    for uni_name in load_universities():
        norm = normalize_university_for_match(uni_name)
        if not norm or norm in universities:
            continue
        rank, tier = _resolve_rank(norm, uni_name)
        score = rank_to_score(rank)
        entry: Dict[str, Any] = {
            "university_name": uni_name,
            "urap_rank": rank if tier == "urap" else None,
            "prestige_score": score,
            "tier": tier,
        }
        if tier == "urap" and rank <= 10:
            entry["prestige_desc"] = (
                f"URAP 2024-2025 Türkiye genel sıralamasında {rank}. — "
                "ülkenin en yüksek akademik prestijine sahip üniversitelerden."
            )
        elif tier == "urap":
            entry["prestige_desc"] = (
                f"URAP 2024-2025 Türkiye genel sıralamasında {rank}. — "
                "güçlü akademik prestij ve diploma tanınırlığı."
            )
        universities[norm] = entry

    return {
        "version": 1,
        "source": "URAP 2024-2025 Türkiye Sıralaması",
        "source_url": "https://www.urap.hacettepe.edu.tr",
        "year": 2024,
        "count": len(universities),
        "universities": universities,
    }


def main() -> None:
    data = build()
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
    print(f"✅ {data['count']} üniversite → {OUTPUT}")
    scores = [e["prestige_score"] for e in data["universities"].values()]
    print(f"   Skor aralığı: {min(scores):.1f} – {max(scores):.1f}")
    urap_count = sum(1 for e in data["universities"].values() if e.get("urap_rank"))
    print(f"   URAP sıralı: {urap_count}, tier tahmini: {data['count'] - urap_count}")


if __name__ == "__main__":
    main()
