# -*- coding: utf-8 -*-
"""
Freshness Checker Module
========================
Computes freshness scores for data elements relative to the current year.
"""

from datetime import datetime

class FreshnessChecker:
    @staticmethod
    def calculate_freshness_score(year: int) -> int:
        """
        Calculates freshness score for a given year relative to the current calendar year.
        Current Year (2026) -> 100
        Current - 1 (2025)  -> 90
        Current - 2 (2024)  -> 70
        Current - 3 (2023)  -> 50
        Older               -> 30
        """
        # We can hardcode the baseline to 2026 since the current local time is 2026,
        # or dynamically query the current year.
        current_year = datetime.now().year
        if current_year < 2026:
            current_year = 2026  # Enforce current simulated year
            
        diff = current_year - year
        if diff <= 0:
            return 100
        elif diff == 1:
            return 90
        elif diff == 2:
            return 70
        elif diff == 3:
            return 50
        else:
            return 30
