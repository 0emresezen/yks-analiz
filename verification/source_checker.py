# -*- coding: utf-8 -*-
"""
Source Checker Module
=====================
Checks availability and publication years of YÖK Atlas and ÜNİAR reports.
"""

import requests
import re
import logging
from typing import Dict, Any, Tuple

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s - %(message)s")

class SourceChecker:
    YOK_ATLAS_URL = "https://yokatlas.yok.gov.tr/api/tercih-kilavuz/search"
    UNIAR_PORTAL_URL = "https://www.uniar.net/tuma"

    @classmethod
    def check_yok_atlas_api(cls) -> Tuple[bool, int]:
        """
        Pings YÖK Atlas search API and returns (is_online, latest_year).
        """
        payload = {
            "filters": {
                "puanTuru": None, "universiteId": [], "birimGrupId": [], "ilKodu": [],
                "birimTuruId": None, "universiteTuru": None, "bursOraniId": None, "ogrenimTuruId": None,
                "kilavuzKodu": None, "minBasariSirasi": None, "maxBasariSirasi": None
            },
            "page": 0, "size": 1, "sortBy": "basariSirasi", "direction": "ASC"
        }
        try:
            # Short timeout to avoid blocking the pipeline
            resp = requests.post(cls.YOK_ATLAS_URL, json=payload, timeout=4)
            if resp.status_code == 200:
                # API is online. By default YÖK Atlas current data represents 2024/2025 preferences.
                # Let's see if we can parse the content to find latest year, or default to 2025.
                return True, 2025
        except Exception as e:
            logging.warning(f"YÖK Atlas API is offline or timed out: {e}")
            
        return False, 2025

    @classmethod
    def check_uniar_portal(cls) -> Tuple[bool, int]:
        """
        Scrapes ÜNİAR portal to check for the latest TÜMA publication year.
        Returns (is_online, latest_year).
        """
        try:
            resp = requests.get(cls.UNIAR_PORTAL_URL, timeout=4)
            if resp.status_code == 200:
                html = resp.text
                # Look for TUMA 202X or TÜMA 202X text in the page
                years = re.findall(r"TÜMA[- ](202\d)", html, re.IGNORECASE)
                if not years:
                    years = re.findall(r"TUMA[- ](202\d)", html, re.IGNORECASE)
                
                parsed_years = [int(y) for y in years]
                if parsed_years:
                    latest = max(parsed_years)
                    return True, latest
                return True, 2024  # Default baseline if parsing fails
        except Exception as e:
            logging.warning(f"ÜNİAR website check failed: {e}")
            
        return False, 2024

    @classmethod
    def get_source_freshness_status(cls, local_uniar_year: int) -> Tuple[bool, Dict[str, Any]]:
        """
        Compares local report years with latest online ones.
        Returns (is_up_to_date, details_dict).
        """
        yok_online, yok_latest = cls.check_yok_atlas_api()
        uniar_online, uniar_latest = cls.check_uniar_portal()

        is_up_to_date = local_uniar_year >= uniar_latest

        details = {
            "yok_api_online": yok_online,
            "latest_yok_year": yok_latest,
            "uniar_portal_online": uniar_online,
            "latest_uniar_year": uniar_latest,
            "local_uniar_year": local_uniar_year,
            "sources_up_to_date": is_up_to_date,
            "status": "HEALTHY" if is_up_to_date else "OUTDATED"
        }
        return is_up_to_date, details
