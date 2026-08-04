# -*- coding: utf-8 -*-
"""
Repository Unit Tests
=====================
"""

import unittest
import sys
import os

# Add root directory to sys.path
root_dir = "/Users/hasanemresezen/Desktop/cs/yks-analiz"
if root_dir not in sys.path:
    sys.path.append(root_dir)

from satisfaction.repository import SatisfactionRepository

class TestRepository(unittest.TestCase):
    def setUp(self):
        self.repo = SatisfactionRepository.get_instance(force_reload=True)

    def test_get_score(self):
        # Match "YTÜ" -> "YILDIZ TEKNİK ÜNİVERSİTESİ"
        rec = self.repo.get_score("YTÜ", year=2024)
        self.assertIsNotNone(rec)
        self.assertEqual(rec.university_name, "YILDIZ TEKNİK ÜNİVERSİTESİ")
        self.assertEqual(rec.overall_score, 8.9)
        self.assertEqual(rec.overall_grade, "A+")

    def test_compare(self):
        comp = self.repo.compare("Koç Üniversitesi", "Yıldız Teknik", year=2024)
        self.assertEqual(comp["university_a"], "Koç Üniversitesi")
        self.assertEqual(comp["university_b"], "Yıldız Teknik")
        self.assertEqual(comp["score_a"], 9.4)
        self.assertEqual(comp["score_b"], 8.9)
        self.assertTrue("koç" in comp["comparison_text"].lower())

if __name__ == "__main__":
    unittest.main()
