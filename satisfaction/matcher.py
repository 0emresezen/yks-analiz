# -*- coding: utf-8 -*-
"""
Matcher Module
==============
Implements advanced Turkish university name normalization and fuzzy matching
to pair ÜNİAR names with YÖK Atlas names.
"""

import re
from thefuzz import fuzz, process
from typing import Dict, List, Optional, Tuple
from enum import Enum


class MatchAction(str, Enum):
    ACCEPT = "accept"
    ACCEPT_LOG = "accept_log"
    WARNING = "warning"
    MANUAL_REVIEW = "manual_review"
    REJECT = "reject"


def classify_match_score(score: int) -> MatchAction:
    if score == 100:
        return MatchAction.ACCEPT
    if 98 <= score <= 99:
        return MatchAction.ACCEPT_LOG
    if 95 <= score <= 97:
        return MatchAction.WARNING
    if 90 <= score <= 94:
        return MatchAction.MANUAL_REVIEW
    return MatchAction.REJECT

class UniversityMatcher:
    # Common abbreviation mapping (keys should be normalized)
    ALIASES: Dict[str, str] = {
        "itü": "istanbul teknik üniversitesi",
        "odtü": "orta doğu teknik üniversitesi",
        "ytü": "yıldız teknik üniversitesi",
        "iü": "istanbul üniversitesi",
        "iü cerrahpaşa": "istanbul üniversitesi cerrahpaşa",
        "iü-cerrahpaşa": "istanbul üniversitesi cerrahpaşa",
        "deü": "dokuz eylül üniversitesi",
        "eskişehir teknik": "eskişehir teknik üniversitesi",
        "estü": "eskişehir teknik üniversitesi",
        "boun": "boğaziçi üniversitesi",
        "metu": "orta doğu teknik üniversitesi",
        "itu": "istanbul teknik üniversitesi",
        "yokatlas": "yök atlas",
        "katü": "karadeniz teknik üniversitesi",
    }

    @staticmethod
    def tr_lower(text: str) -> str:
        """Turkish-friendly lowercase normalization."""
        if not text:
            return ""
        mapping = {"İ": "i", "I": "ı", "Ğ": "ğ", "Ü": "ü", "Ş": "ş", "Ö": "ö", "Ç": "ç"}
        for k, v in mapping.items():
            text = text.replace(k, v)
        return text.lower().strip()

    @classmethod
    def normalize_name(cls, name: str) -> str:
        """
        Cleans university name by stripping common stop words, punctuation,
        and mapping known abbreviations.
        """
        if not name:
            return ""
        
        # Lowercase and clean whitespace
        name = cls.tr_lower(name)
        
        # Remove common prefix abbreviations
        name = name.replace("t.c.", "").replace("t.c ", "")
        
        # Remove parenthetical additions, e.g. "(İstanbul)", "(Vakıf)", "(Burslu)"
        name = re.sub(r"\(.*?\)", "", name)
        
        # Replace non-alphanumeric chars (except space) with empty string
        name = re.sub(r"[^\w\s]", " ", name)
        
        # Normalize multiple spaces
        name = " ".join(name.split())
        
        # Check alias map
        if name in cls.ALIASES:
            name = cls.ALIASES[name]

        # Suffix removal: remove common words at the end
        suffixes = [
            "t c", "tc", "vakıf", "devlet", "özel",
            "üniversitesi", "universitesi", "üni", "uni", "derneği", "vakfı"
        ]
        
        words = name.split()
        filtered_words = [w for w in words if w not in suffixes]
        
        # If filtering emptied it, stick to the original clean text
        cleaned = " ".join(filtered_words) if filtered_words else name
        
        # Re-check alias map after suffix removal (e.g. "yıldız teknik" -> "yıldız teknik üniversitesi")
        if cleaned in cls.ALIASES:
            cleaned = cls.ALIASES[cleaned]
            
        return cleaned

    @classmethod
    def match(cls, query_name: str, choices: List[str], threshold: int = 90) -> Tuple[Optional[str], int]:
        """
        Finds the best matching university name from a list of choices.
        Returns (matched_name, score).
        Skor < 90 → (None, score) — sessiz kabul yok.
        """
        if not query_name or not choices:
            return None, 0

        norm_query = cls.normalize_name(query_name)
        
        # Create map of normalized choices to original choices
        norm_to_orig: Dict[str, str] = {}
        for c in choices:
            norm_c = cls.normalize_name(c)
            norm_to_orig[norm_c] = c

        # 1. Direct match
        if norm_query in norm_to_orig:
            return norm_to_orig[norm_query], 100

        # 2. Alias map exact
        if norm_query in cls.ALIASES:
            alias_target = cls.normalize_name(cls.ALIASES[norm_query])
            if alias_target in norm_to_orig:
                return norm_to_orig[alias_target], 100

        # 3. Fuzzy matching using token_sort_ratio
        norm_choices_list = list(norm_to_orig.keys())
        best_norm_choice, score = process.extractOne(
            norm_query, 
            norm_choices_list, 
            scorer=fuzz.token_sort_ratio
        )

        if score < threshold:
            best_norm_choice_p, score_p = process.extractOne(
                norm_query, 
                norm_choices_list, 
                scorer=fuzz.partial_ratio
            )
            if score_p > score:
                best_norm_choice, score = best_norm_choice_p, score_p

        action = classify_match_score(score)
        if action == MatchAction.REJECT:
            return None, score

        return norm_to_orig[best_norm_choice], score
