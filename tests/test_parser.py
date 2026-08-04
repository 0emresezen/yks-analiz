# -*- coding: utf-8 -*-
"""
Parser Unit Tests
=================
"""

import unittest
from satisfaction.parser import UNIARPDFParser

class TestParser(unittest.TestCase):
    def setUp(self):
        self.parser = UNIARPDFParser(use_ocr=False)

    def test_clean_float(self):
        self.assertEqual(self.parser._clean_float("9,25"), 9.25)
        self.assertEqual(self.parser._clean_float("8.50"), 8.5)
        self.assertEqual(self.parser._clean_float(None), 0.0)
        self.assertEqual(self.parser._clean_float("N/A"), 0.0)

    def test_process_extracted_table(self):
        mock_table = [
            ["Kurum", "Memnuniyet Puanı", "Derece", "Öğrenim Deneyimi", "Kampüs Yaşamı"],
            ["AKDENİZ ÜNİVERSİTESİ", "8.85", "A+", "8.6", "9.3"],
            ["YILDIZ TEKNİK ÜNİVERSİTESİ", "8.90", "A+", "8.8", "9.0"]
        ]
        
        parsed = self.parser._process_extracted_table(
            mock_table, year=2024, source="Mock Source", 
            retrieved_at="2026-08-04T20:00:00Z", source_metadata={}, 
            page_num=1, table_num=1
        )
        
        self.assertEqual(len(parsed), 2)
        self.assertEqual(parsed[0].university_name, "AKDENİZ ÜNİVERSİTESİ")
        self.assertEqual(parsed[0].overall_score, 8.85)
        self.assertEqual(parsed[0].overall_grade, "A+")
        self.assertEqual(parsed[0].learning_experience, 8.6)
        self.assertEqual(parsed[0].campus_life, 9.3)
        self.assertEqual(parsed[0].trace_id, "UNIAR_2024_P1_T1_R1")
        self.assertEqual(parsed[1].trace_id, "UNIAR_2024_P1_T1_R2")

if __name__ == "__main__":
    unittest.main()
