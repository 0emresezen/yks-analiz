# -*- coding: utf-8 -*-
"""
YÖK Atlas Fallback Zinciri
==========================
API çalışmazsa sırayla dener:
  1. Resmî JSON endpoint
  2. Resmî HTML (başlık bazlı parse — sabit XPath yok)
  3. Playwright (yüklüyse)
  4. Selenium (yüklüyse)

Hiçbir adımda sentetik veri üretilmez.
"""

from __future__ import annotations

import json
import logging
import os
import re
from html.parser import HTMLParser
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)

CONFIG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "config",
    "yok_endpoints.json",
)


class _HeaderTableParser(HTMLParser):
    """Başlık satırına göre tablo sütunlarını eşleştirir."""

    def __init__(self):
        super().__init__()
        self.tables: List[List[List[str]]] = []
        self._current_table: List[List[str]] = []
        self._current_row: List[str] = []
        self._cell_buf: List[str] = []
        self._in_table = False
        self._in_row = False
        self._in_cell = False

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self._in_table = True
            self._current_table = []
        elif self._in_table and tag == "tr":
            self._in_row = True
            self._current_row = []
        elif self._in_row and tag in ("td", "th"):
            self._in_cell = True
            self._cell_buf = []

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._in_cell:
            self._current_row.append(" ".join(self._cell_buf).strip())
            self._in_cell = False
        elif tag == "tr" and self._in_row:
            if any(c.strip() for c in self._current_row):
                self._current_table.append(self._current_row)
            self._in_row = False
        elif tag == "table" and self._in_table:
            if self._current_table:
                self.tables.append(self._current_table)
            self._in_table = False

    def handle_data(self, data):
        if self._in_cell:
            self._cell_buf.append(data.strip())


def load_endpoints() -> Dict[str, Any]:
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _map_header_row(headers: List[str]) -> Dict[str, int]:
    mapping = {}
    for i, h in enumerate(headers):
        hl = h.lower()
        if "kilavuz" in hl and "kod" in hl:
            mapping["program_id"] = i
        elif "üniversite" in hl or "universite" in hl:
            mapping["university"] = i
        elif "birim" in hl or "program" in hl or "bölüm" in hl:
            mapping["department"] = i
        elif "başarı" in hl or "basari" in hl or "sıra" in hl:
            mapping["rank"] = i
        elif "taban" in hl:
            mapping["base_score"] = i
        elif "tavan" in hl:
            mapping["ceiling_score"] = i
        elif "kontenjan" in hl:
            mapping["quota"] = i
        elif "şehir" in hl or "il" in hl:
            mapping["city"] = i
    return mapping


def parse_html_tables(html: str, program_id: str) -> Optional[Dict[str, Any]]:
    parser = _HeaderTableParser()
    parser.feed(html)
    for table in parser.tables:
        if len(table) < 2:
            continue
        header_idx = None
        for i, row in enumerate(table):
            row_text = " ".join(row).lower()
            if any(kw in row_text for kw in ["üniversite", "kilavuz", "başarı", "basari"]):
                header_idx = i
                break
        if header_idx is None:
            continue
        col_map = _map_header_row(table[header_idx])
        if "university" not in col_map:
            continue
        for row in table[header_idx + 1:]:
            if len(row) < 2:
                continue
            pid_col = col_map.get("program_id")
            if pid_col is not None and str(row[pid_col]).strip() != str(program_id):
                continue
            record = {"program_id": program_id}
            if "university" in col_map:
                record["university"] = row[col_map["university"]]
            if "department" in col_map and col_map["department"] < len(row):
                record["department"] = row[col_map["department"]]
            if "rank" in col_map and col_map["rank"] < len(row):
                rank_val = re.sub(r"[^\d]", "", row[col_map["rank"]])
                record["last_rank"] = int(rank_val) if rank_val else None
            if "base_score" in col_map and col_map["base_score"] < len(row):
                try:
                    record["base_score_y1"] = float(row[col_map["base_score"]].replace(",", "."))
                except ValueError:
                    record["base_score_y1"] = None
            if record.get("university"):
                return record
    return None


def try_json_endpoint(session: requests.Session, program_id: str, config: Dict) -> Optional[Dict]:
    for fb in config.get("fallbacks", []):
        if fb.get("name") != "tercih_kilavuz_json":
            continue
        url = fb.get("url", "")
        try:
            resp = session.get(url, params={"kilavuzKodu": program_id}, timeout=12)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, dict) and data.get("content"):
                    return data["content"][0]
                if isinstance(data, list) and data:
                    return data[0]
        except Exception as e:
            logger.warning("JSON fallback başarısız: %s", e)
    return None


def try_html_endpoint(session: requests.Session, program_id: str, config: Dict) -> Optional[Dict]:
    for fb in config.get("fallbacks", []):
        if fb.get("parser") != "header_based_html":
            continue
        url = fb.get("url", "")
        try:
            resp = session.get(url, params={"kilavuzKodu": program_id}, timeout=15)
            if resp.status_code == 200:
                return parse_html_tables(resp.text, program_id)
        except Exception as e:
            logger.warning("HTML fallback başarısız: %s", e)
    return None


def try_playwright(program_id: str) -> Optional[Dict]:
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(
                f"https://yokatlas.yok.gov.tr/tercih-kilavuz?kilavuzKodu={program_id}",
                wait_until="networkidle",
                timeout=20000,
            )
            html = page.content()
            browser.close()
            return parse_html_tables(html, program_id)
    except ImportError:
        logger.debug("Playwright yüklü değil")
    except Exception as e:
        logger.warning("Playwright fallback başarısız: %s", e)
    return None


def try_selenium(program_id: str) -> Optional[Dict]:
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        options = Options()
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        driver = webdriver.Chrome(options=options)
        driver.get(f"https://yokatlas.yok.gov.tr/tercih-kilavuz?kilavuzKodu={program_id}")
        html = driver.page_source
        driver.quit()
        return parse_html_tables(html, program_id)
    except ImportError:
        logger.debug("Selenium yüklü değil")
    except Exception as e:
        logger.warning("Selenium fallback başarısız: %s", e)
    return None


def run_fallback_chain(
    session: requests.Session,
    program_id: str,
) -> Optional[Dict[str, Any]]:
    config = load_endpoints()
    for fn in (
        lambda: try_json_endpoint(session, program_id, config),
        lambda: try_html_endpoint(session, program_id, config),
        lambda: try_playwright(program_id),
        lambda: try_selenium(program_id),
    ):
        result = fn()
        if result:
            logger.info("Fallback başarılı (%s): program_id=%s", fn.__name__, program_id)
            return result
    return None
