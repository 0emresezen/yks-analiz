# -*- coding: utf-8 -*-
"""
Models Module
=============
Defines the data model representing an ÜNİAR University Satisfaction record.
"""

from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional, Dict, Any
from verification.freshness_checker import FreshnessChecker

@dataclass
class UniversitySatisfaction:
    university_name: str
    year: int
    overall_score: float  # Normalized to 1-10 scale
    overall_grade: str   # E.g., A+, A, B, C, D, F
    learning_experience: Optional[float] = None
    campus_life: Optional[float] = None
    academic_support: Optional[float] = None
    management: Optional[float] = None
    career_support: Optional[float] = None
    source: str = "ÜNİAR TÜMA Raporu"
    source_url: str = ""
    retrieved_at: str = ""
    trace_id: str = ""
    freshness_score: int = 0
    source_metadata: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        if not self.retrieved_at:
            self.retrieved_at = datetime.now().isoformat()
        if not self.freshness_score:
            self.freshness_score = FreshnessChecker.calculate_freshness_score(self.year)
        if not self.trace_id:
            # Safe default fallback trace_id
            clean_uni = "".join(c for c in self.university_name if c.isalnum()).upper()
            self.trace_id = f"UNIAR_{self.year}_{clean_uni}"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "UniversitySatisfaction":
        return cls(
            university_name=data["university_name"],
            year=int(data["year"]),
            overall_score=float(data["overall_score"]),
            overall_grade=data["overall_grade"],
            learning_experience=float(data["learning_experience"]) if data.get("learning_experience") is not None else None,
            campus_life=float(data["campus_life"]) if data.get("campus_life") is not None else None,
            academic_support=float(data["academic_support"]) if data.get("academic_support") is not None else None,
            management=float(data["management"]) if data.get("management") is not None else None,
            career_support=float(data["career_support"]) if data.get("career_support") is not None else None,
            source=data.get("source", "ÜNİAR TÜMA Raporu"),
            source_url=data.get("source_url", ""),
            retrieved_at=data.get("retrieved_at", ""),
            trace_id=data.get("trace_id", ""),
            freshness_score=int(data.get("freshness_score", 0)),
            source_metadata=data.get("source_metadata")
        )
