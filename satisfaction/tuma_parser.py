# -*- coding: utf-8 -*-
"""
TÜMA PDF Metin Ayrıştırıcı
==========================
Resmî TÜMA 2024 PDF'inden Tablo 2 (200 üniversite genel memnuniyet) verisini çıkarır.
Puanlar 60–600 ölçeğindedir; 0–10 ölçeğine dönüştürülür (puan / 60).
"""

from __future__ import annotations

import json
import os
import re
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

from satisfaction.models import UniversitySatisfaction

logger = logging.getLogger(__name__)

TUMa_ROW_RE = re.compile(
    r"^(\d{1,3})\s+(.+?)\s+(\d{1,4})\s+(\d{2,3})\s+(A\+|A|B|C|D|FF)\s*$",
    re.MULTILINE,
)

DETAILED_ROW_RE = re.compile(
    r"^(\d{1,3})\s+(.+?)\s+(\d{3})\s+"
    r"(\d{2,3})\s+\d+\s+"  # öğrenim puan + sıra
    r"(\d{2,3})\s+\d+\s+"  # yerleşke puan + sıra
    r"(\d{2,3})\s+\d+\s+"  # akademik puan + sıra
    r"(\d{2,3})\s+\d+\s+"  # yönetim puan + sıra
    r"(\d{2,3})\s+\d+\s+"  # öğrenme imkan puan + sıra
    r"(\d{2,3})\s+\d+\s*$",  # kariyer puan + sıra
    re.MULTILINE,
)

SOURCE_URL = "https://www.uniar.net/_files/ugd/779fe1_a9d7928b211f4426bbda59c3d3881fba.pdf"


def tuma_to_scale_10(tuma_score: int) -> float:
    """TÜMA genel memnuniyet (60–600) → 0–10 ölçeği."""
    return round(tuma_score / 60.0, 1)


def subscore_to_scale_10(val: int) -> float:
    """TÜMA alt alan puanı (10–100) → 0–10."""
    return round(val / 10.0, 1)


def parse_tablo2_general(text: str) -> List[Dict[str, Any]]:
    """Tablo 2: 200 üniversite genel memnuniyet sıralaması."""
    start = text.find("ÜNİVERSİTELERİN GENEL MEMNUNİYET SIRALAMASI")
    end = text.find("DEVLET ÜNİVERSİTELERİ GENEL MEMNUNİYET SIRALAMASI")
    if start == -1 or end == -1:
        logger.warning("Tablo 2 bölümü bulunamadı, tüm metin taranıyor")
        section = text
    else:
        section = text[start:end]

    records = []
    seen = set()
    for m in TUMa_ROW_RE.finditer(section):
        rank = int(m.group(1))
        name = m.group(2).strip()
        n_participants = int(m.group(3))
        tuma_score = int(m.group(4))
        grade = m.group(5)

        if tuma_score < 60 or tuma_score > 600:
            continue
        key = name.upper()
        if key in seen:
            continue
        seen.add(key)

        records.append({
            "rank": rank,
            "university_name": name.upper(),
            "participants": n_participants,
            "tuma_overall": tuma_score,
            "overall_grade": grade,
            "overall_score": tuma_to_scale_10(tuma_score),
        })

    logger.info("Tablo 2: %d üniversite parse edildi", len(records))
    return records


def parse_detailed_subscores(text: str) -> Dict[str, Dict[str, float]]:
    """Tablo 11: devlet üniversiteleri alt alan puanları."""
    start = text.find("Tablo 11. Devlet Üniversitelerinin Memnuniyet Alanlarına Göre")
    if start == -1:
        return {}

    section = text[start:start + 80000]
    subscores: Dict[str, Dict[str, float]] = {}

    for m in DETAILED_ROW_RE.finditer(section):
        name = m.group(2).strip().upper()
        learning = int(m.group(4))
        campus = int(m.group(5))
        academic = int(m.group(6))
        management = int(m.group(7))
        resources = int(m.group(8))
        career = int(m.group(9))
        subscores[name] = {
            "learning_experience": subscore_to_scale_10(learning),
            "campus_life": subscore_to_scale_10(campus),
            "academic_support": subscore_to_scale_10(academic),
            "management": subscore_to_scale_10(management),
            "career_support": subscore_to_scale_10(career),
            "learning_resources": subscore_to_scale_10(resources),
        }

    logger.info("Tablo 11: %d üniversite alt alan puanı", len(subscores))
    return subscores


def build_satisfaction_records(
    text: str,
    year: int = 2024,
    source_url: str = SOURCE_URL,
    file_hash: str = "",
) -> List[UniversitySatisfaction]:
    general = parse_tablo2_general(text)
    subscores = parse_detailed_subscores(text)
    retrieved_at = datetime.now().isoformat()
    records: List[UniversitySatisfaction] = []

    for rec in general:
        name = rec["university_name"]
        subs = subscores.get(name, {})
        trace_id = f"UNIAR_{year}_{''.join(c for c in name if c.isalnum())[:30]}"

        records.append(UniversitySatisfaction(
            university_name=name,
            year=year,
            overall_score=rec["overall_score"],
            overall_grade=rec["overall_grade"],
            learning_experience=subs.get("learning_experience"),
            campus_life=subs.get("campus_life"),
            academic_support=subs.get("academic_support"),
            management=subs.get("management"),
            career_support=subs.get("career_support"),
            source=f"ÜNİAR TÜMA {year} Raporu",
            source_url=source_url,
            retrieved_at=retrieved_at,
            trace_id=trace_id,
            source_metadata={
                "tuma_overall": rec["tuma_overall"],
                "rank": rec["rank"],
                "participants": rec["participants"],
                "file_hash": file_hash,
                "parser_version": "4.0.0",
                "scale_note": "Genel puan TÜMA 60-600 ölçeğinden /60 ile 0-10'a dönüştürüldü",
            },
        ))

    return records


def extract_pdf_text(pdf_path: str) -> str:
    import pdfplumber
    parts = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                parts.append(t)
    return "\n".join(parts)


WEB_SOURCE_URL = "https://uniar.net/tr/siralama/tuma"
WEB_PARSER_VERSION = "5.0.0"


def normalize_university_name(name: str) -> str:
    """ÜNİAR web/PDF kayıtları için tutarlı büyük harf adlandırma."""
    return name.strip().upper()


def build_satisfaction_records_from_web(
    payload: Dict[str, Any],
    retrieved_at: Optional[str] = None,
) -> List[UniversitySatisfaction]:
    """
    ÜNİAR web sıralama sayfasından çekilen JSON verisini UniversitySatisfaction listesine dönüştürür.
    Genel puan: TÜMA 60–600 ölçeği → /60 ile 0–10.
    Alt alanlar: 10–100 ölçeği → /10 ile 0–10.
    """
    year = int(payload.get("year", 2026))
    source_url = payload.get("source_url", WEB_SOURCE_URL)
    retrieved_at = retrieved_at or payload.get("retrieved_at") or datetime.now().isoformat()
    universities = payload.get("universities", [])
    records: List[UniversitySatisfaction] = []

    for entry in universities:
        name = normalize_university_name(entry["name"])
        tuma_overall = int(round(float(entry["overall"])))
        trace_id = f"UNIAR_{year}_{''.join(c for c in name if c.isalnum())[:30]}"

        records.append(UniversitySatisfaction(
            university_name=name,
            year=year,
            overall_score=tuma_to_scale_10(tuma_overall),
            overall_grade=entry["grade"],
            learning_experience=subscore_to_scale_10(int(round(float(entry["learning"])))),
            campus_life=subscore_to_scale_10(int(round(float(entry["campus"])))),
            academic_support=subscore_to_scale_10(int(round(float(entry["academic"])))),
            management=subscore_to_scale_10(int(round(float(entry["management"])))),
            career_support=subscore_to_scale_10(int(round(float(entry["career"])))),
            source=payload.get("source", f"ÜNİAR TÜMA {year} Sıralamaları"),
            source_url=source_url,
            retrieved_at=retrieved_at,
            trace_id=trace_id,
            source_metadata={
                "tuma_overall": tuma_overall,
                "rank": int(entry["rank"]),
                "university_type": entry.get("type"),
                "learning_resources": subscore_to_scale_10(int(round(float(entry["resources"])))),
                "parser_version": payload.get("parser_version", WEB_PARSER_VERSION),
                "scale_note": "Genel puan TÜMA 60-600 ölçeğinden /60 ile 0-10'a dönüştürüldü",
                "data_source": "web",
            },
        ))

    logger.info("Web JSON: %d üniversite parse edildi (%d)", len(records), year)
    return records


def load_web_json(json_path: str) -> List[UniversitySatisfaction]:
    with open(json_path, "r", encoding="utf-8") as fh:
        payload = json.load(fh)
    return build_satisfaction_records_from_web(payload)


def default_web_json_path(year: int, root: Optional[str] = None) -> str:
    base = root or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, "raw", "uniar", f"tuma_{year}.json")
