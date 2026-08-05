# -*- coding: utf-8 -*-
"""
ÜNİAR TÜMA PDF İndirici
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from datetime import datetime
from typing import List, Optional, Tuple

import requests

logger = logging.getLogger(__name__)

ROOT = os.path.dirname(os.path.abspath(__file__))

TUMa_PDF_URLS = {
    2024: "https://www.uniar.net/_files/ugd/779fe1_a9d7928b211f4426bbda59c3d3881fba.pdf",
    2023: "https://www.uniar.net/_files/ugd/779fe1_a9d7928b211f4426bbda59c3d3881fba.pdf",
}

# Resmî site PDF'i kaldırdığında Wayback Machine arşivi (aynı dosya, 2024 TÜMA raporu)
WAYBACK_PDF_URLS = {
    2024: "https://web.archive.org/web/20250424001655/https://www.uniar.net/_files/ugd/779fe1_a9d7928b211f4426bbda59c3d3881fba.pdf",
    2023: "https://web.archive.org/web/20250424001655/https://www.uniar.net/_files/ugd/779fe1_a9d7928b211f4426bbda59c3d3881fba.pdf",
}

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"


def find_pdf_url(year: int) -> Optional[str]:
    if year in TUMa_PDF_URLS:
        return TUMa_PDF_URLS[year]
    try:
        resp = requests.get(
            "https://uniar.net/tr/siralama/tuma",
            timeout=15,
            headers={"User-Agent": USER_AGENT},
        )
        if resp.status_code == 200:
            pdfs = re.findall(r'https?://[^"\s]+\.pdf', resp.text, re.I)
            for url in pdfs:
                if str(year) in url:
                    return url
            if pdfs:
                return pdfs[0]
    except Exception as e:
        logger.warning("Portal taraması başarısız: %s", e)
    return None


def _candidate_urls(year: int) -> List[str]:
    urls: List[str] = []
    primary = find_pdf_url(year)
    if primary:
        urls.append(primary)
    archive = WAYBACK_PDF_URLS.get(year)
    if archive and archive not in urls:
        urls.append(archive)
    return urls


def _is_valid_pdf(path: str) -> bool:
    if not os.path.exists(path) or os.path.getsize(path) < 10000:
        return False
    with open(path, "rb") as fh:
        return fh.read(5) == b"%PDF-"


def download_pdf(year: int, dest_dir: Optional[str] = None) -> Tuple[bool, str]:
    dest_dir = dest_dir or os.path.join(ROOT, "raw", "pdf")
    os.makedirs(dest_dir, exist_ok=True)
    dest_path = os.path.join(dest_dir, f"tuma_{year}.pdf")

    if _is_valid_pdf(dest_path):
        sha = hashlib.sha256(open(dest_path, "rb").read()).hexdigest()
        logger.info("PDF mevcut: %s (sha256=%s...)", dest_path, sha[:12])
        return True, dest_path

    candidates = _candidate_urls(year)
    if not candidates:
        return False, f"TÜMA {year} PDF bulunamadı"

    last_error = "indirilemedi"
    for url in candidates:
        logger.info("İndiriliyor: %s", url)
        try:
            resp = requests.get(
                url,
                timeout=300,
                stream=True,
                headers={"User-Agent": USER_AGENT},
                allow_redirects=True,
            )
            if resp.status_code != 200:
                last_error = f"HTTP {resp.status_code} ({url})"
                continue

            sha = hashlib.sha256()
            tmp_path = f"{dest_path}.part"
            with open(tmp_path, "wb") as f:
                for chunk in resp.iter_content(65536):
                    if chunk:
                        sha.update(chunk)
                        f.write(chunk)

            if not _is_valid_pdf(tmp_path):
                os.remove(tmp_path)
                last_error = f"Geçersiz PDF ({url})"
                continue

            os.replace(tmp_path, dest_path)

            meta_path = os.path.join(dest_dir, f"tuma_{year}.meta.json")
            with open(meta_path, "w", encoding="utf-8") as mf:
                json.dump(
                    {
                        "url": url,
                        "sha256": sha.hexdigest(),
                        "downloaded_at": datetime.now().isoformat(),
                        "year": year,
                        "source": "wayback" if "web.archive.org" in url else "official",
                    },
                    mf,
                    indent=2,
                )

            logger.info("PDF kaydedildi: %s (%d bytes)", dest_path, os.path.getsize(dest_path))
            return True, dest_path
        except Exception as e:
            last_error = str(e)
            logger.warning("İndirme hatası (%s): %s", url, e)

    return False, last_error


if __name__ == "__main__":
    import sys

    year = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
    ok, msg = download_pdf(year)
    print("OK" if ok else "FAIL", msg)
