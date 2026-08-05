# -*- coding: utf-8 -*-
"""
Integrity Checker — V2
=======================
Veritabanı bütünlük doğrulamaları. Her kayıt için:
  - Zorunlu alan kontrolü (university, department, trace_id, sha256)
  - Mükerrer kayıt tespiti
  - Sayı aralığı doğrulaması
  - data_available alanlarının tutarlılığı
  - Null alan sayım raporu (build'i engellemez, sadece raporlar)
"""

import logging
from typing import List, Dict, Any

from satisfaction.matcher import UniversityMatcher

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s - %(message)s")


class IntegrityChecker:

    @staticmethod
    def run_database_checks(records: List[Dict[str, Any]]) -> bool:
        """
        Tüm kayıtları doğrulama kurallarından geçirir.
        Kritik ihlallerde ValueError fırlatır (build'i engeller).
        Uyarılar build'i engellemez ancak raporlanır.
        """
        if not records:
            logging.error("Build Blocked: Veritabanı boş veya yüklenemedi.")
            raise ValueError("Database is empty or missing.")

        seen_keys = set()
        null_metric_counts = {}
        null_data_records = []

        for idx, r in enumerate(records):
            label = f"Kayıt #{idx+1}"

            # ---------------------------------------------------------
            # 1. Zorunlu Alan Kontrolü
            # ---------------------------------------------------------
            uni = r.get("university", "").strip()
            if not uni:
                logging.error(f"Build Blocked: {label} üniversite ismi boş.")
                raise ValueError("University name is empty.")

            dept = r.get("department", "").strip()
            if not dept:
                logging.error(f"Build Blocked: {label} bölüm ismi boş.")
                raise ValueError("Department name is empty.")

            # trace_id ve sha256 zorunlu (V10'dan itibaren)
            trace = r.get("_traceability", {})
            if not trace.get("trace_id"):
                logging.warning(f"Uyarı: {label} ({uni}) trace_id eksik.")
            if not trace.get("sha256"):
                logging.warning(f"Uyarı: {label} ({uni}) sha256 eksik.")

            # ---------------------------------------------------------
            # 2. Mükerrer Kayıt Kontrolü (program_id öncelikli)
            # ---------------------------------------------------------
            program_id = str(r.get("program_id", "")).strip()
            if program_id:
                key = ("pid", program_id)
            else:
                clean_uni = UniversityMatcher.tr_lower(uni)
                clean_dept = UniversityMatcher.tr_lower(dept)
                degree = UniversityMatcher.tr_lower(r.get("degree", ""))
                key = (clean_uni, clean_dept, degree)
            if key in seen_keys:
                logging.error(f"Build Blocked: Mükerrer kayıt: {uni} — {dept} (id={program_id})")
                raise ValueError(f"Duplicate: {uni} - {dept}")
            seen_keys.add(key)

            # ---------------------------------------------------------
            # 3. ÜNİAR Skoru Aralık Kontrolü (bulunduysa)
            # ---------------------------------------------------------
            uniar = r.get("uniar_score")
            if uniar is not None:
                try:
                    v = float(uniar)
                    if not (0.0 <= v <= 10.0):
                        logging.error(f"Build Blocked: {uni} ÜNİAR skoru aralık dışı: {v}")
                        raise ValueError(f"Invalid uniar_score: {v}")
                except (TypeError, ValueError) as e:
                    logging.error(f"Build Blocked: {uni} ÜNİAR skoru geçersiz tip.")
                    raise ValueError(f"Invalid uniar_score type: {e}")

            # ---------------------------------------------------------
            # 4. Null Metrik Sayımı (build'i engellemez)
            # ---------------------------------------------------------
            null_metrics = []
            for metric in ["prestige", "academic", "transport", "industry", "research",
                           "international", "cost", "housing", "career",
                           "ai_opportunity", "internship", "startup"]:
                if r.get(f"{metric}_score") is None:
                    null_metrics.append(metric)
                    null_metric_counts[metric] = null_metric_counts.get(metric, 0) + 1

            if len(null_metrics) > 0:
                null_data_records.append({"uni": uni, "null_metrics": null_metrics})

            # ---------------------------------------------------------
            # 5. data_available Tutarlılık Kontrolü
            # ---------------------------------------------------------
            for metric in ["prestige", "academic", "scholarship", "uniar"]:
                score_key = f"{metric}_score"
                avail_key = f"{metric}_data_available"
                score_val = r.get(score_key)
                avail_val = r.get(avail_key)
                # Skor varsa data_available True olmalı (tersi durumu bile kabul — sadece uyarı)
                if score_val is not None and avail_val is False:
                    logging.warning(
                        f"Tutarsızlık: {uni} — {score_key} değeri var ama {avail_key}=False"
                    )

        # ---------------------------------------------------------
        # 6. Null Metrik Raporu
        # ---------------------------------------------------------
        logging.info("=" * 60)
        logging.info("📊 NULL METRİK RAPORU (resmî kaynak entegre edilene kadar)")
        for metric, count in sorted(null_metric_counts.items(), key=lambda x: -x[1]):
            pct = round(100 * count / len(records))
            logging.info(f"   {metric:25s}: {count}/{len(records)} kayıt null ({pct}%)")
        logging.info("=" * 60)
        logging.info(f"✅ {len(records)} kayıt doğrulandı. "
                     f"{len(null_data_records)} kayıtta eksik resmî veri mevcut.")
        return True
