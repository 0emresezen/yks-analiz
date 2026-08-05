# -*- coding: utf-8 -*-
"""
Repository Module
=================
Exposes public APIs to query, compare, and describe university satisfaction data.
Includes fuzzy matching confidence security checks.
"""

import logging
from typing import List, Dict, Any, Optional
from satisfaction.models import UniversitySatisfaction
from satisfaction.loader import SatisfactionLoader
from satisfaction.matcher import UniversityMatcher, classify_match_score, MatchAction

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s - %(message)s")

class SatisfactionRepository:
    _instance: Optional["SatisfactionRepository"] = None

    def __init__(self):
        self.records: List[UniversitySatisfaction] = []
        self._load_data()

    def _load_data(self):
        self.records = SatisfactionLoader.load_all_satisfaction_data()
        self.universities = list(set(r.university_name for r in self.records))

    @classmethod
    def get_instance(cls, force_reload: bool = False) -> "SatisfactionRepository":
        """Singleton instance accessor."""
        if cls._instance is None or force_reload:
            cls._instance = cls()
        return cls._instance

    def get_score(self, university: str, year: Optional[int] = None) -> Optional[UniversitySatisfaction]:
        """
        Retrieves the satisfaction record for a university with confidence check.
        If year is None, returns the latest year available.
        """
        if not university or not self.records:
            return None

        # Match using fuzzy matcher
        matched_uni, score = UniversityMatcher.match(university, self.universities)
        action = classify_match_score(score)

        if not matched_uni or action == MatchAction.REJECT:
            logging.warning(f"⚠️ ÜNİAR Eşleşme REDDEDİLDİ: '{university}' benzerlik skoru {score} (<90)")
            return None

        if action == MatchAction.ACCEPT_LOG:
            logging.info(f"ℹ️ ÜNİAR Eşleşme kabul (log): '{university}' -> '{matched_uni}' (Skor: {score})")
        elif action == MatchAction.WARNING:
            logging.warning(f"⚠️ ÜNİAR Eşleşme uyarı: '{university}' -> '{matched_uni}' (Skor: {score})")
        elif action == MatchAction.MANUAL_REVIEW:
            logging.warning(f"⚠️ ÜNİAR Eşleşme manuel inceleme: '{university}' -> '{matched_uni}' (Skor: {score})")

        # Filter by matched name
        uni_records = [r for r in self.records if r.university_name == matched_uni]
        if not uni_records:
            return None

        if year is not None:
            for r in uni_records:
                if r.year == year:
                    return r
            return None
        else:
            uni_records.sort(key=lambda x: x.year, reverse=True)
            return uni_records[0]

    def get_history(self, university: str) -> List[UniversitySatisfaction]:
        """Returns all historical satisfaction records for a university, sorted by year."""
        if not university or not self.records:
            return []

        matched_uni, score = UniversityMatcher.match(university, self.universities)
        if not matched_uni or score < 90:
            return []

        uni_records = [r for r in self.records if r.university_name == matched_uni]
        uni_records.sort(key=lambda x: x.year)
        return uni_records

    def compare(self, university_a: str, university_b: str, year: Optional[int] = None) -> Dict[str, Any]:
        """Compares satisfaction of two universities."""
        score_a = self.get_score(university_a, year)
        score_b = self.get_score(university_b, year)

        result = {
            "university_a": university_a,
            "university_b": university_b,
            "year": year or (score_a.year if score_a else None) or (score_b.year if score_b else None),
            "score_a": score_a.overall_score if score_a else None,
            "grade_a": score_a.overall_grade if score_a else None,
            "score_b": score_b.overall_score if score_b else None,
            "grade_b": score_b.overall_grade if score_b else None,
            "comparison_text": ""
        }

        if score_a and score_b:
            diff = round(score_a.overall_score - score_b.overall_score, 2)
            year_used = result["year"]
            if diff > 0:
                result["comparison_text"] = f"{score_a.university_name} ({score_a.overall_score}), {score_b.university_name} ({score_b.overall_score}) kurumundan {diff} puan daha yüksektir ({year_used} ÜNİAR)."
            elif diff < 0:
                result["comparison_text"] = f"{score_b.university_name} ({score_b.overall_score}), {score_a.university_name} ({score_a.overall_score}) kurumundan {abs(diff)} puan daha yüksektir ({year_used} ÜNİAR)."
            else:
                result["comparison_text"] = f"Her iki üniversite de eşit memnuniyet puanına sahiptir ({score_a.overall_score}) ({year_used} ÜNİAR)."
        else:
            result["comparison_text"] = "Karşılaştırma için yeterli veri bulunamadı."

        return result

    def generate_description(self, university: str, year: Optional[int] = None) -> str:
        """Generates a source-backed description text based on real data."""
        score_rec = self.get_score(university, year)
        if not score_rec:
            return "ÜNİAR genel memnuniyet raporunda bu üniversite için veri kaydı bulunmamaktadır."

        desc = f"{score_rec.year} ÜNİAR (TÜMA) raporuna göre genel memnuniyet puanı {score_rec.overall_score} olup {score_rec.overall_grade} kategorisindedir."
        
        details = []
        if score_rec.campus_life is not None:
            details.append(f"kampüs yaşamı memnuniyeti {score_rec.campus_life}")
        if score_rec.learning_experience is not None:
            details.append(f"öğrenim deneyimi {score_rec.learning_experience}")
        sub_meta = score_rec.source_metadata or {}
        if sub_meta.get("learning_resources") is not None:
            details.append(f"öğrenme kaynakları {sub_meta['learning_resources']}")

        if details:
            desc += " Detaylar: " + ", ".join(details) + "."

        return desc
