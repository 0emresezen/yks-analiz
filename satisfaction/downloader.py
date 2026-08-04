# -*- coding: utf-8 -*-
"""
Downloader Module
=================
Legally downloads ÜNİAR TÜMA PDF reports from official and public academic sources.
"""

import os
import requests
import logging
from typing import List, Dict

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s - %(message)s")

class UNIARDownloader:
    # Highly stable and verified public URLs for ÜNİAR TÜMA PDF reports
    OFFICIAL_URLS: Dict[int, str] = {
        2024: "https://gorsel.odu.edu.tr/dosyalar/gorsel/duyuru/tuma-2024-raporu.pdf",
        2023: "https://www.uniar.net/_files/ugd/779fe1_9485b312238f4f8e93c478dd33852036.pdf"
    }

    @classmethod
    def download_report(cls, year: int, dest_dir: str = "raw/pdf") -> bool:
        """
        Downloads the ÜNİAR TÜMA report for the specified year.
        Saves it directly to raw/pdf/{year}.pdf.
        """
        if year not in cls.OFFICIAL_URLS:
            logging.error(f"Indirme Hatası: {year} yılı için resmi kaynak URL'i tanımlı değil.")
            return False

        url = cls.OFFICIAL_URLS[year]
        os.makedirs(dest_dir, exist_ok=True)
        dest_path = os.path.join(dest_dir, f"{year}.pdf")

        logging.info(f"⬇️ {year} yılı ÜNİAR raporu indiriliyor: {url}")
        try:
            # Polite request with user-agent
            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            }
            resp = requests.get(url, headers=headers, timeout=15, stream=True)
            if resp.status_code == 200:
                with open(dest_path, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                logging.info(f"✅ Rapor indirildi ve kaydedildi: {os.path.abspath(dest_path)}")
                return True
            else:
                logging.error(f"❌ İndirme başarısız. HTTP Durum Kodu: {resp.status_code}")
        except Exception as e:
            logging.error(f"❌ İndirme sırasında hata oluştu: {e}")

        return False

    @classmethod
    def download_missing_reports(cls, years: List[int], dest_dir: str = "raw/pdf") -> Dict[int, bool]:
        """
        Downloads missing reports for the given list of years.
        """
        results = {}
        for y in years:
            dest_path = os.path.join(dest_dir, f"{y}.pdf")
            if not os.path.exists(dest_path):
                success = cls.download_report(y, dest_dir)
                results[y] = success
            else:
                logging.info(f"ℹ️ {y} yılı raporu zaten mevcut: {dest_path}")
                results[y] = True
        return results
