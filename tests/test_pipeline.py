#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tests for deterministic pipeline scoring and transform."""

import unittest

from pipeline.scoring import (
    composite_rating,
    scholarship_score_from_yok,
    trend_score_from_rankings,
    yok_rank_score,
)
from pipeline.transform import yok_record_to_base


class TestTransform(unittest.TestCase):
    def test_yok_record_to_base(self):
        row = {
            "program_id": "123456",
            "university": "BOĞAZİÇİ ÜNİVERSİTESİ",
            "department": "Bilgisayar Mühendisliği",
            "department_group": "Bilgisayar Mühendisliği",
            "full_title": "BOĞAZİÇİ ÜNİVERSİTESİ - Bilgisayar Mühendisliği",
            "program_type": "LISANS",
            "score_type": "SAY",
            "scholarship_rate": "",
            "university_type": "DEVLET",
            "city": "İSTANBUL",
            "rank_y1": 1500,
            "rank_y2": 1600,
            "rank_y3": 1700,
            "rank_y4": 1800,
            "rankings": [1800, 1700, 1600, 1500],
            "yok_data_available": True,
            "yok_data_note": "",
        }
        base = yok_record_to_base(row)
        self.assertEqual(base["id"], "123456")
        self.assertEqual(base["program_id"], "123456")
        self.assertEqual(base["degree"], "Lisans (4Y)")
        self.assertEqual(base["tuition_status"], "Devlet (Ücretsiz)")
        self.assertEqual(len(base["history_rankings"]), 4)
        self.assertFalse(base["isFavorite"])


class TestScoring(unittest.TestCase):
    def test_scholarship_devlet(self):
        score, avail, _ = scholarship_score_from_yok("", "DEVLET")
        self.assertEqual(score, 8.0)
        self.assertTrue(avail)

    def test_scholarship_burslu(self):
        score, avail, _ = scholarship_score_from_yok("Burslu", "VAKIF")
        self.assertEqual(score, 10.0)
        self.assertTrue(avail)

    def test_trend_improving(self):
        score, avail, _ = trend_score_from_rankings([200000, 150000, 100000, 50000])
        self.assertTrue(avail)
        self.assertGreater(score, 7.0)

    def test_trend_insufficient_data(self):
        score, avail, _ = trend_score_from_rankings([50000])
        self.assertIsNone(score)
        self.assertFalse(avail)

    def test_yok_rank_score(self):
        score, avail, _ = yok_rank_score(8000)
        self.assertTrue(avail)
        self.assertGreater(score, 8.0)

    def test_composite_rating_deterministic(self):
        item = {
            "uniar_score": 8.0,
            "scholarship_score": 8.0,
            "trend_score": 7.0,
            "prestige_score": None,
            "yok_rank_score": 9.0,
        }
        rating1, _ = composite_rating(item)
        rating2, _ = composite_rating(item)
        self.assertEqual(rating1, rating2)
        self.assertIsNotNone(rating1)


class TestCampusHeuristics(unittest.TestCase):
    def test_campus_key_stable(self):
        from pipeline.campus_key import compute_campus_key

        item = {
            "university_id": "102738",
            "university": "AKDENİZ ÜNİVERSİTESİ (ANTALYA)",
            "city": "ANTALYA",
            "district": "MERKEZ",
            "faculty": "Mühendislik Fakültesi",
        }
        key1 = compute_campus_key(item)
        key2 = compute_campus_key(dict(item))
        self.assertEqual(key1, key2)
        self.assertIn("ANTALYA", key1)

    def test_campus_metrics_shared(self):
        from pipeline.campus_heuristics import compute_campus_metrics, reset_campus_cache

        reset_campus_cache()
        ctx = {
            "city": "ANTALYA",
            "district": "MERKEZ",
            "university": "AKDENİZ ÜNİVERSİTESİ",
        }
        m1 = compute_campus_metrics("test|ANTALYA|MERKEZ", ctx)
        m2 = compute_campus_metrics("test|ANTALYA|MERKEZ", ctx)
        self.assertEqual(m1["transport_score"], m2["transport_score"])
        self.assertTrue(m1["transport_data_available"])
        self.assertGreater(m1["transport_score"], 5.0)


class TestExportV2(unittest.TestCase):
    def test_compact_row_size_target(self):
        from pipeline.export import EnumRegistry, StringRegistry, to_compact_row, expand_row

        enums = EnumRegistry()
        strings = StringRegistry()
        record = {
            "program_id": "203110477",
            "university": "BOĞAZİÇİ ÜNİVERSİTESİ",
            "department": "Bilgisayar Mühendisliği",
            "department_group": "Bilgisayar Mühendisliği",
            "city": "İSTANBUL",
            "degree": "Lisans (4Y)",
            "score_type": "SAY",
            "language": "Türkçe",
            "tuition_status": "Devlet (Ücretsiz)",
            "last_rank": 1500,
            "rating": 8.4,
            "scholarship_score": 8.0,
            "trend_score": 7.0,
            "yok_rank_score": 9.0,
            "uniar_score": 7.5,
        }
        row = to_compact_row(record, enums, strings)
        import json
        row_bytes = len(json.dumps(row, ensure_ascii=False).encode("utf-8"))
        self.assertLess(row_bytes, 400)

        doc = {"enums": enums.to_json(), "strings": strings.to_json()}
        expanded = expand_row(row, doc)
        self.assertEqual(expanded["program_id"], "203110477")
        self.assertEqual(expanded["city"], "İSTANBUL")


if __name__ == "__main__":
    unittest.main()
