# -*- coding: utf-8 -*-
"""
Program Eşleştirme Modülü
=========================
Fuzzy matching ile YÖK Atlas program_id bulur.
Sentetik ID üretmez; skor < 90 ise reddeder.
"""

import logging
from thefuzz import fuzz, process
from typing import Dict, Any, Optional, Tuple, List

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s - %(message)s")


class ProgramMatcher:
    def __init__(self, program_index: Optional[List[Dict[str, Any]]] = None):
        self.program_index = program_index or []
        self._title_to_id = {
            self.clean_title(item.get("full_title", "")): item.get("program_id")
            for item in self.program_index
            if item.get("full_title") and item.get("program_id")
        }
        self.clean_titles = list(self._title_to_id.keys())

    @staticmethod
    def clean_title(title: str) -> str:
        if not title:
            return ""
        mapping = {"İ": "i", "I": "ı", "Ğ": "ğ", "Ü": "ü", "Ş": "ş", "Ö": "ö", "Ç": "ç"}
        for k, v in mapping.items():
            title = title.replace(k, v)
        title = title.lower().strip()
        title = title.replace("(vakıf)", "").replace("(ücretsiz)", "").replace("(burslu)", "")
        return " ".join(title.split())

    def find_match(self, query_title: str, threshold: int = 90) -> Tuple[Optional[str], int, str]:
        cleaned_query = self.clean_title(query_title)

        if cleaned_query in self._title_to_id:
            return self._title_to_id[cleaned_query], 100, cleaned_query

        if not self.clean_titles:
            logging.warning("Program indeksi boş — eşleşme yapılamıyor: '%s'", query_title)
            return None, 0, ""

        match, score = process.extractOne(
            cleaned_query,
            self.clean_titles,
            scorer=fuzz.token_sort_ratio,
        )

        if score < threshold:
            match_p, score_p = process.extractOne(
                cleaned_query,
                self.clean_titles,
                scorer=fuzz.partial_ratio,
            )
            if score_p > score:
                match, score = match_p, score_p

        if score == 100:
            return self._title_to_id[match], score, match
        if 98 <= score <= 99:
            logging.info("YÖK eşleşme kabul (log): '%s' → '%s' (%d)", query_title, match, score)
            return self._title_to_id[match], score, match
        if 95 <= score <= 97:
            logging.warning("YÖK eşleşme uyarı: '%s' → '%s' (%d)", query_title, match, score)
            return self._title_to_id[match], score, match
        if 90 <= score <= 94:
            logging.warning("YÖK eşleşme manuel inceleme: '%s' → '%s' (%d)", query_title, match, score)
            return self._title_to_id[match], score, match

        logging.warning(
            "YÖK eşleşme reddedildi: '%s' (skor=%d, partial kontrol edildi)",
            query_title, score,
        )
        return None, score, ""
