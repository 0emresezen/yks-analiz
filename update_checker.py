# -*- coding: utf-8 -*-
"""
Update Checker Command Line Tool
================================
Yerel vs uzak kaynak güncellik analizi ve system_health.json raporu.
"""

import os
import json
import logging
import re
from datetime import datetime
from typing import Dict, Optional
from verification.source_checker import SourceChecker

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s - %(message)s")


def get_local_uniar_year() -> int:
    """raw/pdf veya data/satisfaction içindeki PDF'lerden en güncel yılı bulur."""
    years = []
    for data_dir in ("raw/pdf", "data/satisfaction"):
        if not os.path.exists(data_dir):
            continue
        for f in os.listdir(data_dir):
            if f.endswith(".pdf"):
                match = re.search(r"(\d{4})", f)
                if match:
                    years.append(int(match.group(1)))

    if years:
        return max(years)

    validated = "validated/satisfaction_validated.json"
    if os.path.exists(validated):
        try:
            with open(validated, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            yrs = [r.get("year") for r in data if r.get("year")]
            if yrs:
                return max(yrs)
        except Exception:
            pass

    return 2024


def get_local_yok_year() -> Optional[int]:
    """validated/yok veya raw/yok_api içinden yerel YÖK yılını bulur."""
    years = []
    for data_dir in ("validated/yok", "raw/yok_api"):
        if not os.path.exists(data_dir):
            continue
        for f in os.listdir(data_dir):
            match = re.search(r"(\d{4})", f)
            if match:
                years.append(int(match.group(1)))
    return max(years) if years else None


def check_for_updates() -> Dict:
    local_uniar = get_local_uniar_year()
    local_yok = get_local_yok_year()
    logging.info(f"Yerel ÜNİAR yılı: {local_uniar}, YÖK yılı: {local_yok}")

    is_up_to_date, details = SourceChecker.get_source_freshness_status(
        local_uniar_year=local_uniar,
        local_yok_year=local_yok,
    )

    details["new_data_available"] = not is_up_to_date
    details["last_checked"] = datetime.now().isoformat()

    parser_success_rate = 100.0
    report_path = "processed/validation_report.json"
    if os.path.exists(report_path):
        try:
            with open(report_path, "r", encoding="utf-8") as f:
                stats = json.load(f)
                parser_success_rate = stats.get("success_rate", 100.0)
        except Exception:
            pass

    details["parser_success_rate"] = parser_success_rate
    details["validation_success_rate"] = parser_success_rate

    health_path = "validated/system_health.json"
    os.makedirs(os.path.dirname(health_path), exist_ok=True)
    with open(health_path, "w", encoding="utf-8") as f:
        json.dump(details, f, ensure_ascii=False, indent=2)

    logging.info(f"System health report: {health_path}")
    logging.info(
        f"Genel durum: {details['overall_status']} — Yeni veri: {details['new_data_available']}"
    )

    return details


if __name__ == "__main__":
    check_for_updates()
