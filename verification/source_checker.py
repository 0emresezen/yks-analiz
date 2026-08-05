# -*- coding: utf-8 -*-
"""
Source Checker — V2
====================
YÖK Atlas ve ÜNİAR kaynak güncellik kontrolü.
- YÖK Atlas: API'den gerçek kılavuz yılını parse eder (hardcoded yok)
- ÜNİAR: uniar.net/tuma sayfasından en güncel rapor yılını bulur + SHA256 ile değişiklik tespiti
"""

import requests
import re
import hashlib
import logging
from typing import Dict, Any, Tuple, Optional

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s - %(message)s")

YOK_ATLAS_API = "https://yokatlas.yok.gov.tr/api/tercih-kilavuz/search"
UNIAR_PORTAL_URL = "https://www.uniar.net/tuma"


class SourceChecker:

    # ------------------------------------------------------------------
    # YÖK Atlas
    # ------------------------------------------------------------------
    @classmethod
    def check_yok_atlas_api(cls) -> Tuple[bool, Optional[int]]:
        """
        YÖK Atlas API'ye bağlanır ve gerçek kılavuz yılını döndürür.
        Yıl bulunamazsa None döner (hardcoded default YOK).
        """
        payload = {
            "filters": {
                "puanTuru": None, "universiteId": [], "birimGrupId": [], "ilKodu": [],
                "birimTuruId": None, "universiteTuru": None, "bursOraniId": None,
                "ogrenimTuruId": None, "kilavuzKodu": None,
                "minBasariSirasi": None, "maxBasariSirasi": None
            },
            "page": 0, "size": 1, "sortBy": "basariSirasi", "direction": "ASC"
        }
        try:
            resp = requests.post(YOK_ATLAS_API, json=payload, timeout=6)
            if resp.status_code == 200:
                data = resp.json()
                year = cls._extract_yok_year(data)
                return True, year
        except Exception as e:
            logging.warning(f"YÖK Atlas API erişilemedi: {e}")
        return False, None

    @staticmethod
    def _extract_yok_year(api_response: Dict) -> Optional[int]:
        """
        API yanıtından kılavuz yılını çıkarır.
        Sırasıyla: kilavuzYili → yil → yilStr alanlarına bakar.
        Hiçbiri yoksa None döner.
        """
        try:
            content = api_response.get("content", [])
            if content:
                p = content[0]
                for field in ["kilavuzYili", "yil", "tercihYili", "yilStr"]:
                    val = p.get(field)
                    if val:
                        try:
                            return int(str(val)[:4])
                        except (ValueError, TypeError):
                            continue
        except Exception:
            pass
        return None

    # ------------------------------------------------------------------
    # ÜNİAR
    # ------------------------------------------------------------------
    @classmethod
    def check_uniar_portal(cls) -> Tuple[bool, Optional[int]]:
        """
        ÜNİAR portalından en güncel TÜMA rapor yılını çeker.
        Başarısızsa None döner.
        """
        try:
            resp = requests.get(UNIAR_PORTAL_URL, timeout=6)
            if resp.status_code == 200:
                html = resp.text
                # "TÜMA 2025", "TUMA-2024" gibi ifadeleri ara
                years = re.findall(r"T[ÜU]MA[-\s]?(202\d)", html, re.IGNORECASE)
                if not years:
                    years = re.findall(r"(202\d).*?rapor", html, re.IGNORECASE)
                parsed = [int(y) for y in years]
                if parsed:
                    return True, max(parsed)
                return True, None  # Portal açık ama yıl parse edilemedi
        except Exception as e:
            logging.warning(f"ÜNİAR portal erişilemedi: {e}")
        return False, None

    @classmethod
    def check_uniar_pdf_changed(cls, pdf_url: str, known_sha256: str) -> Tuple[bool, str]:
        """
        Belirtilen URL'deki PDF'in SHA256 özetini hesaplar.
        known_sha256 ile karşılaştırarak değişiklik olup olmadığını döndürür.
        """
        try:
            resp = requests.get(pdf_url, timeout=30, stream=True)
            if resp.status_code == 200:
                sha256 = hashlib.sha256()
                for chunk in resp.iter_content(65536):
                    sha256.update(chunk)
                new_hash = sha256.hexdigest()
                changed = new_hash != known_sha256
                return changed, new_hash
        except Exception as e:
            logging.warning(f"PDF SHA256 kontrolü başarısız: {e}")
        return False, ""

    # ------------------------------------------------------------------
    # Genel Güncellik Raporu
    # ------------------------------------------------------------------
    @classmethod
    def get_source_freshness_status(cls, local_uniar_year: int,
                                    local_yok_year: Optional[int] = None) -> Tuple[bool, Dict[str, Any]]:
        """
        Yerel verinin güncelliğini API/portal ile karşılaştırır.
        """
        yok_online, yok_latest = cls.check_yok_atlas_api()
        uniar_online, uniar_latest = cls.check_uniar_portal()

        yok_status = "UNKNOWN"
        if yok_online and yok_latest and local_yok_year:
            if local_yok_year >= yok_latest:
                yok_status = "HEALTHY"
            else:
                yok_status = "OUTDATED"
        elif yok_online and yok_latest is None:
            yok_status = "ONLINE_BUT_YEAR_UNKNOWN"
        elif not yok_online:
            yok_status = "OFFLINE"

        uniar_status = "UNKNOWN"
        if uniar_online and uniar_latest:
            if local_uniar_year >= uniar_latest:
                uniar_status = "HEALTHY"
            else:
                uniar_status = "OUTDATED"
        elif not uniar_online:
            uniar_status = "OFFLINE"

        is_up_to_date = (yok_status == "HEALTHY" and uniar_status == "HEALTHY")

        details = {
            "yok": {
                "api_online": yok_online,
                "latest_year_from_api": yok_latest,
                "local_year": local_yok_year,
                "status": yok_status,
            },
            "uniar": {
                "portal_online": uniar_online,
                "latest_year_from_portal": uniar_latest,
                "local_year": local_uniar_year,
                "status": uniar_status,
            },
            "overall_status": "HEALTHY" if is_up_to_date else "OUTDATED_OR_UNKNOWN",
        }

        # Loglama
        logging.info(f"YÖK Atlas: {yok_status} (API yılı: {yok_latest}, yerel: {local_yok_year})")
        logging.info(f"ÜNİAR:     {uniar_status} (Portal yılı: {uniar_latest}, yerel: {local_uniar_year})")

        return is_up_to_date, details
