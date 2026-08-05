# -*- coding: utf-8 -*-
"""
YÖK Atlas Fetcher — Kanıta Dayalı
==================================
YOKAtlasCollector üzerinden resmî API verisi çeker.
ASLA sentetik/tahmin veri üretmez.
"""

import logging
import os
import sys
from typing import Dict, Any, Optional

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from collectors.yok.collector import YOKAtlasCollector

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s - %(message)s")


class YOKAtlasFetcher:
    """YÖK Atlas resmî API fetcher — collector tabanlı, fallback zincirli."""

    def __init__(self, min_delay: float = 0.3, max_delay: float = 0.8, year: int = 2025):
        self._collector = YOKAtlasCollector(year=year, min_delay=min_delay, max_delay=max_delay)
        self._cache: Dict[str, Dict[str, Any]] = {}

    def fetch_program_data(self, program_id: str, dept_name: str = "") -> Dict[str, Any]:
        if not program_id or program_id in ("NA", "None"):
            return self._unavailable(program_id, dept_name, "Program ID bulunamadı")

        if program_id in self._cache:
            return self._cache[program_id]

        result = self._collector.run(program_id=program_id, dept_name=dept_name)

        if not result or not result.data_available or not result.data:
            note = result.data_note if result else "Veri alınamadı"
            payload = self._unavailable(program_id, dept_name, note)
            self._cache[program_id] = payload
            return payload

        d = result.data
        rankings = d.get("rankings") or []
        if not rankings:
            for key in ("rank_y4", "rank_y3", "rank_y2", "rank_y1"):
                v = d.get(key)
                if v:
                    rankings.append(v)

        payload = {
            "program_id": program_id,
            "title": f"{d.get('university', '')} - {d.get('department', '')}",
            "city": d.get("city", ""),
            "university": d.get("university", ""),
            "department": d.get("department", ""),
            "rankings": rankings,
            "old_quota": d.get("quota_prev") or 0,
            "new_quota": d.get("quota_current") or 0,
            "placed_students": d.get("placed_students"),
            "quota_empty": d.get("quota_empty"),
            "base_score_y1": d.get("base_score_y1"),
            "ceiling_score_y1": d.get("ceiling_score_y1"),
            "score_type": d.get("score_type"),
            "instruction_type": d.get("instruction_type"),
            "scholarship_rate": d.get("scholarship_rate"),
            "last_rank": d.get("last_rank") or (rankings[-1] if rankings else None),
            "data_available": True,
            "data_note": "",
            "trace_id": result.trace_id,
            "sha256": result.sha256,
        }
        self._cache[program_id] = payload
        return payload

    @staticmethod
    def _unavailable(program_id: str, dept_name: str, note: str) -> Dict[str, Any]:
        return {
            "program_id": program_id,
            "title": dept_name,
            "city": "",
            "university": "",
            "department": "",
            "rankings": [],
            "old_quota": None,
            "new_quota": None,
            "placed_students": None,
            "last_rank": None,
            "data_available": False,
            "data_note": note or "Bu alan için doğrulanmış resmî veri bulunamadı.",
        }
