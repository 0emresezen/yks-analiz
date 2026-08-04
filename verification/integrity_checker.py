# -*- coding: utf-8 -*-
"""
Integrity Checker Module
========================
Runs consistency tests on the processed datasets and enforces build-blocking rules.
"""

import logging
from typing import List, Dict, Any
from satisfaction.matcher import UniversityMatcher

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s - %(message)s")

class IntegrityChecker:
    @staticmethod
    def run_database_checks(records: List[Dict[str, Any]]) -> bool:
        """
        Runs automated assertions on the university preference database.
        Raises ValueError if any critical integrity rule is violated.
        """
        if not records:
            logging.error("Build Blocked: Veritabanı boş veya yüklenemedi.")
            raise ValueError("Database is empty or missing.")

        seen_keys = set()
        for idx, r in enumerate(records):
            # 1. Null Checks
            uni = r.get("university", "").strip()
            if not uni:
                logging.error(f"Build Blocked: Satır #{idx+1} üniversite ismi boş.")
                raise ValueError("University name is empty.")

            dept = r.get("department", "").strip()
            if not dept:
                logging.error(f"Build Blocked: Satır #{idx+1} bölüm ismi boş.")
                raise ValueError("Department name is empty.")

            # 2. Duplicate Check (university name + department name + degree)
            # Use Turkish tr_lower to handle dotted-i vs dotless-ı normalization issues
            clean_uni = UniversityMatcher.tr_lower(uni)
            clean_dept = UniversityMatcher.tr_lower(dept)
            degree = UniversityMatcher.tr_lower(r.get("degree", ""))
            
            key = (clean_uni, clean_dept, degree)
            if key in seen_keys:
                logging.error(f"Build Blocked: Mükerrer kayıt bulundu: {uni} - {dept}")
                raise ValueError(f"Duplicate preference found: {uni} - {dept}")
            seen_keys.add(key)

            # 3. Value Range Checks
            uniar_score = r.get("uniar_score")
            if uniar_score is not None:
                try:
                    score_val = float(uniar_score)
                    if not (0.0 <= score_val <= 10.0):
                        logging.error(f"Build Blocked: '{uni}' için geçersiz ÜNİAR memnuniyet skoru: {score_val}")
                        raise ValueError(f"Invalid satisfaction score: {score_val}")
                except (TypeError, ValueError) as e:
                    logging.error(f"Build Blocked: ÜNİAR memnuniyet skoru geçersiz tip: {uniar_score}")
                    raise ValueError(f"Invalid satisfaction score type: {e}")

            # 4. Predict data separation check
            prediction = r.get("prediction", {})
            if prediction:
                if "tahmini_skor" not in prediction:
                    logging.error(f"Build Blocked: Tahmin bloğunda 'tahmini_skor' bulunamadı.")
                    raise ValueError("Prediction score missing in prediction object.")
                if "model" not in prediction:
                    logging.error(f"Build Blocked: Tahmin bloğunda 'model' adı belirtilmemiş.")
                    raise ValueError("Prediction model missing in prediction object.")

        logging.info("✅ Tüm veritabanı bütünlük doğrulamaları başarıyla geçti.")
        return True
