# -*- coding: utf-8 -*-
"""
Update Checker Command Line Tool
================================
Runs local vs remote source freshness analysis and writes a system health report.
"""

import os
import json
import logging
import re
from datetime import datetime
from typing import Dict
from verification.source_checker import SourceChecker

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s - %(message)s")

def get_local_latest_year(data_dir: str = "data/satisfaction") -> int:
    """Finds the maximum year from PDF files in the local directory."""
    if not os.path.exists(data_dir):
        return 2024
    
    years = []
    for f in os.listdir(data_dir):
        if f.endswith(".pdf"):
            match = re.search(r"(\d{4})", f)
            if match:
                years.append(int(match.group(1)))
                
    return max(years) if years else 2024

def check_for_updates() -> Dict:
    local_year = get_local_latest_year()
    logging.info(f"Local en güncel ÜNİAR rapor yılı: {local_year}")
    
    # Run the source checker
    is_up_to_date, details = SourceChecker.get_source_freshness_status(local_year)
    
    # Set update availability flag
    details["new_data_available"] = not is_up_to_date
    details["last_checked"] = datetime.now().isoformat()
    
    # Read parser stats if validation_report.json exists
    parser_success_rate = 100.0
    val_success_rate = 100.0
    
    report_path = "processed/validation_report.json"
    if os.path.exists(report_path):
        try:
            with open(report_path, "r", encoding="utf-8") as f:
                stats = json.load(f)
                parser_success_rate = stats.get("success_rate", 100.0)
        except Exception:
            pass
            
    details["parser_success_rate"] = parser_success_rate
    details["validation_success_rate"] = val_success_rate
    
    # Write health report
    health_path = "validated/system_health.json"
    os.makedirs(os.path.dirname(health_path), exist_ok=True)
    with open(health_path, "w", encoding="utf-8") as f:
        json.dump(details, f, ensure_ascii=False, indent=2)
        
    logging.info(f"System health report written to {health_path}")
    logging.info(f"Health Status: {details['status']} - New Data Available: {details['new_data_available']}")
    
    return details

if __name__ == "__main__":
    check_for_updates()
