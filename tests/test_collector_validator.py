# -*- coding: utf-8 -*-
"""
Collector & Registry Unit Tests
"""

import unittest
from verification.collector_validator import CollectorValidator
from matching.university_registry import UniversityRegistry, classify_score, MatchAction
from satisfaction.matcher import UniversityMatcher, classify_match_score


class TestCollectorValidator(unittest.TestCase):
    def test_yok_valid_record(self):
        records = [{
            "program_id": "12345",
            "university": "Test Üniversitesi",
            "department": "Bilgisayar Mühendisliği",
            "last_rank": 5000,
            "_traceability": {
                "publication_year": 2025,
                "retrieved_at": "2026-01-01T00:00:00",
                "sha256": "a" * 64,
            },
        }]
        report = CollectorValidator.validate_yok_batch(records, expected_year=2025)
        self.assertTrue(report["success"])
        self.assertEqual(report["passed"], 1)

    def test_yok_duplicate_rejected(self):
        records = [
            {"program_id": "1", "university": "A", "department": "X"},
            {"program_id": "1", "university": "B", "department": "Y"},
        ]
        report = CollectorValidator.validate_yok_batch(records, expected_year=2025)
        self.assertFalse(report["success"])


class TestMatchPolicy(unittest.TestCase):
    def test_score_classification(self):
        self.assertEqual(classify_score(100), MatchAction.ACCEPT)
        self.assertEqual(classify_score(98), MatchAction.ACCEPT_LOG)
        self.assertEqual(classify_score(96), MatchAction.WARNING)
        self.assertEqual(classify_score(92), MatchAction.MANUAL_REVIEW)
        self.assertEqual(classify_score(85), MatchAction.REJECT)

    def test_matcher_rejects_low_score(self):
        choices = ["AKDENİZ ÜNİVERSİTESİ", "MARMARA ÜNİVERSİTESİ"]
        match, score = UniversityMatcher.match("Bilinmeyen Kurum", choices)
        self.assertIsNone(match)
        self.assertLess(score, 90)


if __name__ == "__main__":
    unittest.main()
