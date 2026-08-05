#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build Pipeline — Kanıta Dayalı Veri Toplama Orkestratörü
=========================================================
Tam ulusal build:
  1. build_national_index.py  → ~21.500 program, ~228 üniversite
  2. download_uniar.py        → TÜMA PDF
  3. UNIARCollector           → memnuniyet verisi
  4. main.py + generate_app_data.py → tercih listesi (opsiyonel)
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional

ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from collectors.yok.collector import YOKAtlasCollector
from collectors.uniar.collector import UNIARCollector
from matching.university_registry import UniversityRegistry
from verification.collector_validator import CollectorValidator
from verification.source_checker import SourceChecker

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s - %(message)s")
logger = logging.getLogger("build_pipeline")

NO_DATA_NOTE = "Bu alan için doğrulanmış resmî veri bulunamadı."


def get_local_yok_year() -> Optional[int]:
    validated_dir = os.path.join(ROOT, "validated", "yok")
    if not os.path.isdir(validated_dir):
        return None
    years = []
    for f in os.listdir(validated_dir):
        m = re.search(r"(\d{4})", f)
        if m:
            years.append(int(m.group(1)))
    return max(years) if years else None


def get_local_uniar_year() -> int:
    web_dir = os.path.join(ROOT, "raw", "uniar")
    if os.path.isdir(web_dir):
        years = []
        for f in os.listdir(web_dir):
            if f.startswith("tuma_") and f.endswith(".json"):
                m = re.search(r"(\d{4})", f)
                if m:
                    years.append(int(m.group(1)))
        if years:
            return max(years)
    for pdf_dir in ("raw/pdf", "data/satisfaction"):
        path = os.path.join(ROOT, pdf_dir)
        if not os.path.isdir(path):
            continue
        years = []
        for f in os.listdir(path):
            if f.endswith(".pdf"):
                m = re.search(r"(\d{4})", f)
                if m:
                    years.append(int(m.group(1)))
        if years:
            return max(years)
    validated = os.path.join(ROOT, "validated", "satisfaction_validated.json")
    if os.path.exists(validated):
        with open(validated, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        yrs = [r.get("year") for r in data if r.get("year")]
        if yrs:
            return max(yrs)
    return 2024


def check_freshness() -> Dict[str, Any]:
    local_uniar = get_local_uniar_year()
    local_yok = get_local_yok_year()
    is_up_to_date, details = SourceChecker.get_source_freshness_status(
        local_uniar_year=local_uniar,
        local_yok_year=local_yok,
    )
    details["last_checked"] = datetime.now().isoformat()
    details["new_data_available"] = not is_up_to_date

    health_path = os.path.join(ROOT, "validated", "system_health.json")
    os.makedirs(os.path.dirname(health_path), exist_ok=True)
    with open(health_path, "w", encoding="utf-8") as f:
        json.dump(details, f, ensure_ascii=False, indent=2)

    logger.info(
        "Güncellik: YÖK=%s, ÜNİAR=%s, genel=%s",
        details["yok"]["status"],
        details["uniar"]["status"],
        details["overall_status"],
    )
    return details


def load_program_ids(index_path: str = "data/program_index.json") -> List[str]:
    full = os.path.join(ROOT, index_path)
    if not os.path.exists(full):
        logger.warning("program_index bulunamadı: %s", full)
        return []
    with open(full, "r", encoding="utf-8") as f:
        programs = json.load(f)
    ids = []
    for p in programs:
        pid = str(p.get("program_id", "")).strip()
        if pid.isdigit():
            ids.append(pid)
    return ids


def run_yok_collector(
    year: int = 2025,
    program_ids: Optional[List[str]] = None,
    limit: Optional[int] = None,
) -> Dict[str, Any]:
    program_ids = program_ids or load_program_ids()
    if limit:
        program_ids = program_ids[:limit]

    if not program_ids:
        return {"validated": False, "message": "Program ID listesi boş"}

    collector = YOKAtlasCollector(year=year)
    return collector.export_year(program_ids, year=year)


def run_uniar_collector(year: int = 2024) -> Dict[str, Any]:
    pdf_path = os.path.join(ROOT, "raw", "pdf", f"tuma_{year}.pdf")
    if not os.path.exists(pdf_path):
        alt = os.path.join(ROOT, "data", "satisfaction", f"tuma_{year}.pdf")
        pdf_path = alt if os.path.exists(alt) else pdf_path

    collector = UNIARCollector(year=year)
    result = collector.run(pdf_path=pdf_path)

    if not result or not result.data_available:
        note = result.data_note if result else NO_DATA_NOTE
        logger.warning("ÜNİAR verisi alınamadı: %s", note)
        return {"validated": False, "message": note}

    raw_path = os.path.join(ROOT, "raw", "pdf", f"uniar_{year}_parsed.json")
    collector.save_raw(result, raw_path)

    records = result.data
    validation = CollectorValidator.validate_uniar_batch(records, expected_year=year)

    processed_path = os.path.join(ROOT, "processed", "satisfaction_processed.json")
    collector.save_processed({"records": records, "validation": validation}, processed_path)

    validated_path = os.path.join(ROOT, "validated", "satisfaction_validated.json")
    if validation["success"]:
        collector.save_validated(records, validated_path)
    else:
        logger.error("ÜNİAR doğrulama başarısız — validated yazılmadı")
        return {"validated": False, "validation": validation}

    return {"validated": True, "records": len(records), "validation": validation}


def build_university_registry() -> int:
    registry = UniversityRegistry()
    return registry.build_from_program_index()


def run_national_build(year: int = 2026, max_pages: Optional[int] = None) -> Dict[str, Any]:
    from build_national_index import fetch_all_programs, save_outputs
    result = fetch_all_programs(year=year, max_pages=max_pages)
    return save_outputs(result, year=year)


def run_uniar_download(year: int = 2024) -> Dict[str, Any]:
    from download_uniar import download_pdf
    ok, msg = download_pdf(year)
    return {"success": ok, "message": msg}


def run_main_pipeline(input_path: str = "engine/lisans_tercih_analizi.md", yok_year: int = 2025) -> Dict[str, Any]:
    full = os.path.join(ROOT, input_path)
    if not os.path.exists(full):
        logger.warning("Tercih listesi bulunamadı, main.py atlanıyor: %s", full)
        return {"skipped": True, "reason": "input_not_found"}

    from main import process_pipeline
    records = process_pipeline(
        full,
        os.path.join(ROOT, "yokatlas_sonuclar.xlsx"),
        os.path.join(ROOT, "engine", "zenginlestirilmis_analiz.md"),
        yok_year=yok_year,
    )
    return {"skipped": False, "records": len(records)}


def run_generate_app_data() -> Dict[str, Any]:
    from generate_app_data import build_and_save
    try:
        records = build_and_save()
        return {"success": True, "count": len(records)}
    except FileNotFoundError as e:
        logger.warning("generate_app_data atlandı: %s", e)
        return {"success": False, "error": str(e)}


def run_enrichment() -> bool:
    """Mevcut data/yks_master_database.json üzerinde V10 enrich (yedek yol)."""
    data_path = os.path.join(ROOT, "data", "yks_master_database.json")
    if not os.path.exists(data_path):
        return False
    from data.fetch_and_enrich import main as enrich_main
    enrich_main()
    return True


def run_analysis_build(year: int = 2026, uniar_year: int = 2024, limit: Optional[int] = None) -> Dict[str, Any]:
    from pipeline.build import build_analysis_database
    return build_analysis_database(year=year, uniar_year=uniar_year, limit=limit)


def run_pipeline(
    skip_freshness: bool = False,
    skip_national: bool = False,
    skip_yok: bool = True,
    skip_uniar: bool = False,
    skip_uniar_download: bool = False,
    skip_main: bool = True,
    skip_generate: bool = False,
    skip_enrich: bool = True,
    skip_analysis: bool = False,
    analysis_limit: Optional[int] = None,
    yok_year: int = 2026,
    uniar_year: int = 2024,
    yok_limit: Optional[int] = None,
    national_max_pages: Optional[int] = None,
    input_path: str = "engine/lisans_tercih_analizi.md",
) -> Dict[str, Any]:
    report: Dict[str, Any] = {
        "started_at": datetime.now().isoformat(),
        "steps": {},
    }

    if not skip_freshness:
        report["steps"]["freshness"] = check_freshness()

    if not skip_national:
        logger.info("=== ULUSAL YÖK BUILD BAŞLIYOR ===")
        report["steps"]["national"] = run_national_build(year=yok_year, max_pages=national_max_pages)
        report["steps"]["registry"] = {"count": report["steps"]["national"].get("total_universities", 0)}
    else:
        report["steps"]["registry"] = {"count": build_university_registry()}

    if not skip_uniar_download:
        report["steps"]["uniar_download"] = run_uniar_download(year=uniar_year)

    if not skip_main:
        report["steps"]["main"] = run_main_pipeline(input_path=input_path, yok_year=yok_year)

    if not skip_yok:
        report["steps"]["yok_bulk"] = run_yok_collector(year=yok_year, limit=yok_limit)

    if not skip_uniar:
        try:
            from build_uniar_full import build as build_uniar
            report["steps"]["uniar"] = build_uniar(year=uniar_year)
        except Exception as e:
            logger.warning("ÜNİAR full build başarısız, collector fallback: %s", e)
            report["steps"]["uniar"] = run_uniar_collector(year=uniar_year)

    try:
        from build_program_search_index import main as build_search_index
        build_search_index()
        report["steps"]["search_index"] = {"success": True}
    except Exception as e:
        report["steps"]["search_index"] = {"success": False, "error": str(e)}

    if not skip_analysis:
        logger.info("=== UNIVERSAL ANALYSIS DB BUILD BAŞLIYOR ===")
        report["steps"]["analysis"] = run_analysis_build(
            year=yok_year,
            uniar_year=uniar_year,
            limit=analysis_limit,
        )

    if not skip_generate:
        report["steps"]["generate"] = run_generate_app_data()

    if not skip_enrich:
        try:
            ok = run_enrichment()
            report["steps"]["enrich"] = {"success": ok}
        except Exception as e:
            report["steps"]["enrich"] = {"success": False, "error": str(e)}

    report["finished_at"] = datetime.now().isoformat()
    report_path = os.path.join(ROOT, "processed", "build_report.json")
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    logger.info("Build pipeline tamamlandı → %s", report_path)
    return report


def main():
    parser = argparse.ArgumentParser(description="Kanıta dayalı veri toplama pipeline")
    parser.add_argument("--skip-freshness", action="store_true")
    parser.add_argument("--skip-national", action="store_true")
    parser.add_argument("--skip-yok", action="store_true", default=True)
    parser.add_argument("--with-yok-bulk", action="store_true")
    parser.add_argument("--skip-uniar", action="store_true")
    parser.add_argument("--skip-uniar-download", action="store_true")
    parser.add_argument("--with-main", action="store_true", help="Tercih listesi için main.py çalıştır")
    parser.add_argument("--skip-generate", action="store_true")
    parser.add_argument("--skip-analysis", action="store_true", help="Evrensel analiz DB build atla")
    parser.add_argument("--analysis-limit", type=int, default=None, help="Test: analiz build kayıt sınırı")
    parser.add_argument("--skip-enrich", action="store_true", default=True)
    parser.add_argument("--input", default="engine/lisans_tercih_analizi.md")
    parser.add_argument("--yok-year", type=int, default=2026)
    parser.add_argument("--uniar-year", type=int, default=2024)
    parser.add_argument("--yok-limit", type=int, default=None)
    parser.add_argument("--national-max-pages", type=int, default=None, help="Test: ulusal build sayfa sınırı")
    args = parser.parse_args()

    run_pipeline(
        skip_freshness=args.skip_freshness,
        skip_national=args.skip_national,
        skip_yok=args.skip_yok and not args.with_yok_bulk,
        skip_uniar=args.skip_uniar,
        skip_uniar_download=args.skip_uniar_download,
        skip_main=not args.with_main,
        skip_generate=args.skip_generate,
        skip_enrich=args.skip_enrich,
        skip_analysis=args.skip_analysis,
        analysis_limit=args.analysis_limit,
        yok_year=args.yok_year,
        uniar_year=args.uniar_year,
        yok_limit=args.yok_limit,
        national_max_pages=args.national_max_pages,
        input_path=args.input,
    )


if __name__ == "__main__":
    main()
