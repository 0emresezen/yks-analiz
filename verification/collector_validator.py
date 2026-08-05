# -*- coding: utf-8 -*-
"""
Collector Validator
===================
Her collector sonunda otomatik doğrulama:
  duplicate, null, sayı aralığı, tarih, yıl, hash, schema
Başarısız olursa veri kabul edilmez.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

YOK_SCHEMA_REQUIRED = ["program_id", "university", "department"]
UNIAR_SCHEMA_REQUIRED = ["university_name", "overall_score"]


class CollectorValidator:
    VERSION = "2.1.0"

    @classmethod
    def validate_yok_batch(
        cls,
        records: List[Dict[str, Any]],
        expected_year: int,
    ) -> Dict[str, Any]:
        report = cls._empty_report("yok", len(records))
        seen_ids = set()

        for rec in records:
            if not rec:
                report["failed"] += 1
                report["errors"].append("Boş kayıt")
                continue

            pid = rec.get("program_id")
            record_ok = True

            if not pid:
                report["failed"] += 1
                report["errors"].append("program_id eksik")
                continue

            if pid in seen_ids:
                report["failed"] += 1
                report["errors"].append(f"Mükerrer program_id: {pid}")
                continue
            seen_ids.add(pid)

            for field in YOK_SCHEMA_REQUIRED:
                if not rec.get(field):
                    record_ok = False
                    report["errors"].append(f"{pid}: zorunlu alan eksik — {field}")

            for rank_field in ["rank_y1", "rank_y2", "rank_y3", "rank_y4", "last_rank"]:
                val = rec.get(rank_field)
                if val is not None and (not isinstance(val, int) or val < 1):
                    report["warnings"].append(f"{pid}: geçersiz sıralama — {rank_field}={val}")

            for score_field in ["base_score_y1", "ceiling_score_y1"]:
                val = rec.get(score_field)
                if val is not None and not (0 <= float(val) <= 600):
                    report["warnings"].append(f"{pid}: şüpheli puan — {score_field}={val}")

            trace = rec.get("_traceability", {})
            if trace.get("publication_year") and trace["publication_year"] != expected_year:
                report["warnings"].append(
                    f"{pid}: yıl uyuşmazlığı (beklenen {expected_year})"
                )

            if trace.get("retrieved_at"):
                if not cls._valid_iso_date(trace["retrieved_at"]):
                    report["warnings"].append(f"{pid}: geçersiz retrieved_at")

            if trace.get("sha256") and not re.match(r"^[a-f0-9]{64}$", trace["sha256"]):
                record_ok = False
                report["errors"].append(f"{pid}: geçersiz sha256")

            if record_ok:
                report["passed"] += 1
            else:
                report["failed"] += 1

        report["success"] = report["failed"] == 0
        report["success_rate"] = round(
            (report["passed"] / report["total"]) * 100, 1
        ) if report["total"] else 0.0
        return report

    @classmethod
    def validate_uniar_batch(cls, records: List[Dict[str, Any]], expected_year: int) -> Dict[str, Any]:
        report = cls._empty_report("uniar", len(records))
        seen = set()

        for rec in records:
            if not rec:
                report["failed"] += 1
                continue

            name = rec.get("university_name", "").strip()
            if not name:
                report["failed"] += 1
                report["errors"].append("university_name eksik")
                continue

            norm_key = re.sub(r"\s+", " ", name.lower())
            if norm_key in seen:
                report["failed"] += 1
                report["errors"].append(f"Mükerrer üniversite: {name}")
                continue
            seen.add(norm_key)

            overall = rec.get("overall_score")
            if overall is None:
                report["failed"] += 1
                report["errors"].append(f"{name}: overall_score null")
                continue

            if not (0.0 <= float(overall) <= 10.0):
                report["failed"] += 1
                report["errors"].append(f"{name}: overall_score aralık dışı ({overall})")

            year = rec.get("year")
            if year is not None and int(year) != expected_year:
                report["warnings"].append(f"{name}: yıl uyuşmazlığı ({year} != {expected_year})")

            report["passed"] += 1

        report["success"] = report["failed"] == 0
        report["success_rate"] = round(
            (report["passed"] / report["total"]) * 100, 1
        ) if report["total"] else 0.0
        return report

    @staticmethod
    def verify_hash(data: Any, expected_sha256: str) -> bool:
        serialized = json.dumps(data, ensure_ascii=False, sort_keys=True).encode("utf-8")
        actual = hashlib.sha256(serialized).hexdigest()
        return actual == expected_sha256

    @staticmethod
    def _valid_iso_date(value: str) -> bool:
        try:
            datetime.fromisoformat(value.replace("Z", "+00:00"))
            return True
        except (ValueError, TypeError):
            return False

    @staticmethod
    def _empty_report(source: str, total: int) -> Dict[str, Any]:
        return {
            "source": source,
            "validator_version": CollectorValidator.VERSION,
            "total": total,
            "passed": 0,
            "failed": 0,
            "warnings": [],
            "errors": [],
            "success": False,
            "success_rate": 0.0,
            "validated_at": datetime.now().isoformat(),
        }
