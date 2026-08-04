# -*- coding: utf-8 -*-
"""
Freshness and Integrity Checkers Unit Tests
===========================================
"""

import unittest
from verification.freshness_checker import FreshnessChecker
from verification.integrity_checker import IntegrityChecker

class TestCheckers(unittest.TestCase):
    def test_freshness_score(self):
        self.assertEqual(FreshnessChecker.calculate_freshness_score(2026), 100)
        self.assertEqual(FreshnessChecker.calculate_freshness_score(2025), 90)
        self.assertEqual(FreshnessChecker.calculate_freshness_score(2024), 70)
        self.assertEqual(FreshnessChecker.calculate_freshness_score(2023), 50)
        self.assertEqual(FreshnessChecker.calculate_freshness_score(2020), 30)

    def test_integrity_checker_success(self):
        valid_records = [
            {
                "university": "YILDIZ TEKNİK ÜNİVERSİTESİ",
                "department": "İktisat (İngilizce)",
                "degree": "Lisans (4Y)",
                "uniar_score": 8.9,
                "prediction": {
                    "tahmini_skor": 3450,
                    "model": "linear_regression_elastic_quota"
                }
            },
            {
                "university": "AKDENİZ ÜNİVERSİTESİ",
                "department": "İlk ve Acil Yardım",
                "degree": "Önlisans (2Y)",
                "uniar_score": 8.85,
                "prediction": {
                    "tahmini_skor": 150000,
                    "model": "linear_regression_elastic_quota"
                }
            }
        ]
        self.assertTrue(IntegrityChecker.run_database_checks(valid_records))

    def test_integrity_checker_fail_duplicate(self):
        duplicate_records = [
            {
                "university": "YILDIZ TEKNİK ÜNİVERSİTESİ",
                "department": "İşletme",
                "degree": "Lisans (4Y)"
            },
            {
                "university": "Yıldız Teknik Üniversitesi",
                "department": "İşletme",
                "degree": "Lisans (4Y)"
            }
        ]
        with self.assertRaises(ValueError):
            IntegrityChecker.run_database_checks(duplicate_records)

    def test_integrity_checker_fail_range(self):
        invalid_range_records = [
            {
                "university": "YILDIZ TEKNİK ÜNİVERSİTESİ",
                "department": "İşletme",
                "degree": "Lisans (4Y)",
                "uniar_score": 15.0  # Exceeds max 10.0
            }
        ]
        with self.assertRaises(ValueError):
            IntegrityChecker.run_database_checks(invalid_range_records)

if __name__ == "__main__":
    unittest.main()
