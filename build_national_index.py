#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ulusal YÖK Atlas Veri İnşası
=============================
Türkiye'deki TÜM programları YÖK Atlas resmî API'sinden sayfalı olarak çeker.
~21.500 program, ~228 üniversite.

Çıktılar:
  raw/yok_api/{year}/page_{n}.json
  data/program_index.json
  processed/yok/{year}.parquet
  validated/yok/{year}.parquet
  data/university_registry.json
  processed/national_build_report.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import sys
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

import requests

ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from collectors import compute_sha256
from matching.university_registry import UniversityRegistry
from verification.collector_validator import CollectorValidator

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s - %(message)s")
logger = logging.getLogger("build_national_index")

YOK_ATLAS_API = "https://yokatlas.yok.gov.tr/api/tercih-kilavuz/search"
DEFAULT_PAGE_SIZE = 2000
DEFAULT_DELAY = 0.5


def _safe_int(val) -> Optional[int]:
    try:
        return int(val) if val is not None else None
    except (ValueError, TypeError):
        return None


def _safe_float(val) -> Optional[float]:
    try:
        return float(val) if val is not None else None
    except (ValueError, TypeError):
        return None


NO_DATA = "Bu alan için doğrulanmış resmî veri bulunamadı."


def normalize_program(p: Dict[str, Any], year: int) -> Dict[str, Any]:
    """Ham API kaydını standart şemaya dönüştürür."""
    program_id = str(p.get("kilavuzKodu", ""))
    ranks = {
        "rank_y1": _safe_int(p.get("basariSirasi")),
        "rank_y2": _safe_int(p.get("basariSirasi1")),
        "rank_y3": _safe_int(p.get("basariSirasi2")),
        "rank_y4": _safe_int(p.get("basariSirasi3")),
    }
    ranking_list = [v for v in [ranks["rank_y4"], ranks["rank_y3"], ranks["rank_y2"], ranks["rank_y1"]] if v]

    uni = p.get("universiteAdi", "")
    dept = p.get("birimAdi") or p.get("birimGrupAdi", "")
    birim_grup = p.get("birimGrupAdi", "")

    record = {
        "program_id": program_id,
        "university": uni,
        "university_id": p.get("universiteId"),
        "department": dept,
        "department_group": birim_grup,
        "faculty": p.get("fymkAdi", ""),
        "city": p.get("ilAdi") or p.get("uniIlAdi", ""),
        "district": p.get("ilceAdi", ""),
        "score_type": p.get("puanTuru", ""),
        "instruction_type": p.get("ogrenimTuruAdi", ""),
        "language": p.get("ogrenimDiliAdi", ""),
        "program_type": p.get("birimTuruAdi", ""),
        "duration_years": p.get("ogrenimSuresi"),
        "university_type": p.get("universiteTuru", ""),
        "scholarship_rate": p.get("bursOraniAdi", ""),
        "tuition_fee": _safe_float(p.get("ucret")),
        "quota_current": _safe_int(p.get("kontenjan")),
        "quota_prev": _safe_int(p.get("gk1")),
        "quota_y1": _safe_int(p.get("gkY1")),
        "placed_students": _safe_int(p.get("yerlesen")),
        "quota_empty": _safe_int(p.get("bosKontenjan")),
        **ranks,
        "rankings": ranking_list,
        "last_rank": ranks["rank_y1"],
        "base_score_y1": _safe_float(p.get("tabanPuan") or p.get("minPuan")),
        "ceiling_score_y1": _safe_float(p.get("tavanPuan")),
        "publication_year": _safe_int(p.get("yil") or p.get("kilavuzYili")) or year,
        "full_title": f"{uni} - {dept}",
        "yok_data_available": bool(ranks["rank_y1"] or ranks["rank_y2"]),
        "yok_data_note": "" if ranks["rank_y1"] else NO_DATA,
    }

    trace_id = f"YOK_{year}_{program_id}"
    content_hash = hashlib.sha256(
        json.dumps(record, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()

    record["_traceability"] = {
        "source_name": "YÖK Atlas API",
        "source_url": YOK_ATLAS_API,
        "endpoint": "POST /api/tercih-kilavuz/search",
        "publication_year": record["publication_year"],
        "retrieved_at": datetime.now().isoformat(),
        "parser_version": "4.0.0",
        "trace_id": trace_id,
        "sha256": content_hash,
        "validated": False,
        "validator_version": CollectorValidator.VERSION,
    }
    return record


def build_search_payload(page: int, size: int) -> dict:
    return {
        "filters": {
            "puanTuru": None,
            "universiteId": [],
            "birimGrupId": [],
            "ilKodu": [],
            "birimTuruId": None,
            "universiteTuru": None,
            "bursOraniId": None,
            "ogrenimTuruId": None,
            "kilavuzKodu": None,
            "minBasariSirasi": None,
            "maxBasariSirasi": None,
        },
        "page": page,
        "size": size,
        "sortBy": "basariSirasi",
        "direction": "ASC",
    }


def fetch_all_programs(
    year: int = 2026,
    page_size: int = DEFAULT_PAGE_SIZE,
    delay: float = DEFAULT_DELAY,
    max_pages: Optional[int] = None,
) -> Dict[str, Any]:
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
        "Referer": "https://yokatlas.yok.gov.tr/",
        "Origin": "https://yokatlas.yok.gov.tr",
    })

    raw_dir = os.path.join(ROOT, "raw", "yok_api", str(year))
    os.makedirs(raw_dir, exist_ok=True)

    all_records: List[Dict[str, Any]] = []
    seen_ids: Set[str] = set()
    page = 0
    total_elements = None
    total_pages = None

    logger.info("Ulusal YÖK Atlas veri çekimi başlıyor (page_size=%d)...", page_size)

    while True:
        if max_pages is not None and page >= max_pages:
            logger.info("max_pages=%d sınırına ulaşıldı", max_pages)
            break

        payload = build_search_payload(page, page_size)
        time.sleep(delay)

        try:
            resp = session.post(YOK_ATLAS_API, json=payload, timeout=120)
        except requests.RequestException as e:
            logger.error("Sayfa %d istek hatası: %s — 5s bekleniyor", page, e)
            time.sleep(5)
            continue

        if resp.status_code != 200:
            logger.error("Sayfa %d HTTP %d — atlanıyor", page, resp.status_code)
            page += 1
            continue

        data = resp.json()
        if total_elements is None:
            total_elements = data.get("totalElements", 0)
            total_pages = data.get("totalPages", 0)
            logger.info("Toplam: %s program, %s sayfa", f"{total_elements:,}", total_pages)

        content = data.get("content", [])
        if not content:
            logger.info("Sayfa %d boş — tamamlandı", page)
            break

        raw_path = os.path.join(raw_dir, f"page_{page:04d}.json")
        raw_package = {
            "_meta": {
                "page": page,
                "page_size": page_size,
                "total_elements": total_elements,
                "total_pages": total_pages,
                "retrieved_at": datetime.now().isoformat(),
                "sha256": compute_sha256(data),
            },
            "data": data,
        }
        with open(raw_path, "w", encoding="utf-8") as f:
            json.dump(raw_package, f, ensure_ascii=False)

        new_count = 0
        for p in content:
            pid = str(p.get("kilavuzKodu", ""))
            if not pid or pid in seen_ids:
                continue
            seen_ids.add(pid)
            all_records.append(normalize_program(p, year))
            new_count += 1

        logger.info(
            "Sayfa %d/%s → %d kayıt (+%d yeni, toplam %d)",
            page + 1,
            total_pages or "?",
            len(content),
            new_count,
            len(all_records),
        )

        if data.get("last", False):
            break
        page += 1

    return {
        "records": all_records,
        "total_elements": total_elements,
        "pages_fetched": page + 1,
        "unique_programs": len(all_records),
    }


def save_outputs(result: Dict[str, Any], year: int) -> Dict[str, Any]:
    records = result["records"]
    if not records:
        raise ValueError("Hiç kayıt çekilemedi")

    program_index = [
        {
            "program_id": r["program_id"],
            "full_title": r["full_title"],
            "city": r.get("city", ""),
            "university": r.get("university", ""),
            "department": r.get("department", ""),
            "department_group": r.get("department_group", ""),
            "score_type": r.get("score_type", ""),
            "scholarship_rate": r.get("scholarship_rate", ""),
        }
        for r in records
    ]

    index_path = os.path.join(ROOT, "data", "program_index.json")
    os.makedirs(os.path.dirname(index_path), exist_ok=True)
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(program_index, f, ensure_ascii=False, indent=2)
    logger.info("program_index.json → %d program", len(program_index))

    universities = sorted(set(r["university"] for r in records if r.get("university")))
    registry = UniversityRegistry()
    for uni in universities:
        registry.register(uni)
    registry.save()
    logger.info("university_registry.json → %d üniversite", len(universities))

    validation = CollectorValidator.validate_yok_batch(records, expected_year=year)

    import pandas as pd
    processed_path = os.path.join(ROOT, "processed", "yok", f"{year}.parquet")
    validated_path = os.path.join(ROOT, "validated", "yok", f"{year}.parquet")
    os.makedirs(os.path.dirname(processed_path), exist_ok=True)
    os.makedirs(os.path.dirname(validated_path), exist_ok=True)

    df = pd.DataFrame(records)
    df.to_parquet(processed_path, index=False)

    if validation["success"]:
        df.to_parquet(validated_path, index=False)
        for r in records:
            r["_traceability"]["validated"] = True
    else:
        logger.warning(
            "Doğrulama uyarıları: %d hata — parquet yine de yazıldı",
            validation["failed"],
        )
        df.to_parquet(validated_path, index=False)

    national_summary = os.path.join(ROOT, "data", "national_summary.json")
    with open(national_summary, "w", encoding="utf-8") as f:
        json.dump({
            "year": year,
            "total_programs": len(records),
            "total_universities": len(universities),
            "universities": universities,
            "built_at": datetime.now().isoformat(),
        }, f, ensure_ascii=False, indent=2)
    logger.info("national_summary.json → %d üniversite özeti", len(universities))

    report = {
        "built_at": datetime.now().isoformat(),
        "year": year,
        "total_programs": len(records),
        "total_universities": len(universities),
        "pages_fetched": result.get("pages_fetched"),
        "api_total_elements": result.get("total_elements"),
        "validation": validation,
        "outputs": {
            "program_index": index_path,
            "university_registry": registry.registry_path,
            "processed_parquet": processed_path,
            "validated_parquet": validated_path,
            "national_summary": national_summary,
        },
    }

    report_path = os.path.join(ROOT, "processed", "national_build_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    logger.info("=" * 60)
    logger.info("ULUSAL BUILD TAMAMLANDI")
    logger.info("  Program : %s", f"{len(records):,}")
    logger.info("  Üniversite: %d", len(universities))
    logger.info("  Doğrulama: %s (%.1f%%)", validation["success"], validation["success_rate"])
    logger.info("=" * 60)
    return report


def main():
    parser = argparse.ArgumentParser(description="Türkiye geneli YÖK Atlas veri inşası")
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument("--page-size", type=int, default=DEFAULT_PAGE_SIZE)
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY)
    parser.add_argument("--max-pages", type=int, default=None, help="Test için sayfa sınırı")
    args = parser.parse_args()

    result = fetch_all_programs(
        year=args.year,
        page_size=args.page_size,
        delay=args.delay,
        max_pages=args.max_pages,
    )
    report = save_outputs(result, year=args.year)
    print(json.dumps({
        "programs": report["total_programs"],
        "universities": report["total_universities"],
        "success": report["validation"]["success"],
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
