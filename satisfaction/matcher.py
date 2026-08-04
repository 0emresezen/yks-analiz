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
    def match(cls, query_name: str, choices: List[str], threshold: int = 75) -> Tuple[Optional[str], int]:
        """
        Finds the best matching university name from a list of choices.
        Returns (matched_name, score).
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

        # 2. Substring matching
        for norm_c, orig in norm_to_orig.items():
            if norm_query and norm_c and (norm_query in norm_c or norm_c in norm_query):
                return orig, 90

        # 3. Fuzzy matching using token_sort_ratio
        norm_choices_list = list(norm_to_orig.keys())
        best_norm_choice, score = process.extractOne(
            norm_query, 
            norm_choices_list, 
            scorer=fuzz.token_sort_ratio
        )

        if score >= threshold:
            return norm_to_orig[best_norm_choice], score
            
        # 4. Fallback fuzzy matching using partial_ratio
        best_norm_choice_p, score_p = process.extractOne(
            norm_query, 
            norm_choices_list, 
            scorer=fuzz.partial_ratio
        )
        if score_p >= threshold + 10:
            return norm_to_orig[best_norm_choice_p], score_p

        return None, score
