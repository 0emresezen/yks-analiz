# -*- coding: utf-8 -*-
"""
Matcher Unit Tests
==================
"""

import unittest
from satisfaction.matcher import UniversityMatcher

class TestMatcher(unittest.TestCase):
    def test_normalize_name(self):
        self.assertEqual(UniversityMatcher.normalize_name("İSTANBUL TEKNİK ÜNİVERSİTESİ"), "istanbul teknik")
        self.assertEqual(UniversityMatcher.normalize_name("İtü"), "istanbul teknik")
        self.assertEqual(UniversityMatcher.normalize_name("Akdeniz Üniversitesi (Vakıf)"), "akdeniz")
        self.assertEqual(UniversityMatcher.normalize_name("T.C. Marmara Üniversitesi"), "marmara")

    def test_matching_confidence(self):
        choices = [
            "AKDENİZ ÜNİVERSİTESİ",
            "YILDIZ TEKNİK ÜNİVERSİTESİ",
            "MARMARA ÜNİVERSİTESİ",
            "İSTANBUL TEKNİK ÜNİVERSİTESİ"
        ]
        
        # Direct match (confidence 100)
        match, score = UniversityMatcher.match("Akdeniz Üniversitesi", choices)
        self.assertEqual(match, "AKDENİZ ÜNİVERSİTESİ")
        self.assertEqual(score, 100)
        
        # Alias match (confidence 100)
        match, score = UniversityMatcher.match("İTÜ", choices)
        self.assertEqual(match, "İSTANBUL TEKNİK ÜNİVERSİTESİ")
        self.assertEqual(score, 100)
        
        # Fuzzy match (confidence between 90 and 99)
        match, score = UniversityMatcher.match("Marmara Üni", choices)
        self.assertEqual(match, "MARMARA ÜNİVERSİTESİ")
        self.assertTrue(90 <= score <= 100)
        
        # Rejected match (confidence below 90)
        match, score = UniversityMatcher.match("Bilinmeyen Vakıf Yurdu", choices)
        self.assertTrue(score < 90)

if __name__ == "__main__":
    unittest.main()
