# -*- coding: utf-8 -*-
"""
University Registry — Canonical ID & Eşleştirme
================================================
Her üniversitenin tek bir canonical ID'si vardır.
Eşleştirme sırası: tam eşleşme → alias → normalize → fuzzy.

Fuzzy skor politikası:
  100       → kabul
  98–99     → kabul + log
  95–97     → uyarı
  90–94     → manuel inceleme
  90 altı   → reddet
"""

from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Tuple

from thefuzz import fuzz, process

from satisfaction.matcher import UniversityMatcher

logger = logging.getLogger(__name__)

REGISTRY_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data",
    "university_registry.json",
)


class MatchAction(str, Enum):
    ACCEPT = "accept"
    ACCEPT_LOG = "accept_log"
    WARNING = "warning"
    MANUAL_REVIEW = "manual_review"
    REJECT = "reject"


@dataclass
class MatchResult:
    canonical_id: Optional[str]
    canonical_name: Optional[str]
    matched_name: Optional[str]
    score: int
    action: MatchAction
    message: str = ""

    @property
    def accepted(self) -> bool:
        return self.action in (
            MatchAction.ACCEPT,
            MatchAction.ACCEPT_LOG,
            MatchAction.WARNING,
            MatchAction.MANUAL_REVIEW,
        )


def classify_score(score: int) -> MatchAction:
    if score == 100:
        return MatchAction.ACCEPT
    if 98 <= score <= 99:
        return MatchAction.ACCEPT_LOG
    if 95 <= score <= 97:
        return MatchAction.WARNING
    if 90 <= score <= 94:
        return MatchAction.MANUAL_REVIEW
    return MatchAction.REJECT


def log_match_result(query: str, result: MatchResult) -> None:
    if result.action == MatchAction.ACCEPT:
        return
    if result.action == MatchAction.ACCEPT_LOG:
        logger.info(
            "Üniversite eşleşmesi kabul (log): '%s' → '%s' (skor=%d)",
            query, result.matched_name, result.score,
        )
    elif result.action == MatchAction.WARNING:
        logger.warning(
            "Üniversite eşleşmesi uyarı: '%s' → '%s' (skor=%d)",
            query, result.matched_name, result.score,
        )
    elif result.action == MatchAction.MANUAL_REVIEW:
        logger.warning(
            "Üniversite eşleşmesi manuel inceleme: '%s' → '%s' (skor=%d)",
            query, result.matched_name, result.score,
        )
    else:
        logger.error(
            "Üniversite eşleşmesi reddedildi: '%s' (skor=%d)",
            query, result.score,
        )


class UniversityRegistry:
  """Canonical üniversite kimlikleri ve eşleştirme motoru."""

  def __init__(self, registry_path: str = REGISTRY_PATH):
    self.registry_path = registry_path
    self._entries: Dict[str, Dict] = {}
    self._alias_to_id: Dict[str, str] = {}
    self._load()

  def _load(self) -> None:
    if os.path.exists(self.registry_path):
      with open(self.registry_path, "r", encoding="utf-8") as f:
        data = json.load(f)
      for entry in data.get("universities", []):
        cid = entry["canonical_id"]
        self._entries[cid] = entry
        for alias in entry.get("aliases", []):
          norm = UniversityMatcher.normalize_name(alias)
          self._alias_to_id[norm] = cid
        norm_name = UniversityMatcher.normalize_name(entry["canonical_name"])
        self._alias_to_id[norm_name] = cid
    else:
      logger.warning("Registry dosyası bulunamadı: %s", self.registry_path)

  @property
  def canonical_names(self) -> List[str]:
    return [e["canonical_name"] for e in self._entries.values()]

  def register(self, canonical_name: str, aliases: Optional[List[str]] = None) -> str:
    """Yeni üniversite kaydı oluşturur veya mevcut ID'yi döndürür."""
    norm = UniversityMatcher.normalize_name(canonical_name)
    if norm in self._alias_to_id:
      return self._alias_to_id[norm]

    cid = self._make_id(canonical_name)
    entry = {
      "canonical_id": cid,
      "canonical_name": canonical_name,
      "aliases": aliases or [],
      "normalized": norm,
    }
    self._entries[cid] = entry
    self._alias_to_id[norm] = cid
    for alias in aliases or []:
      self._alias_to_id[UniversityMatcher.normalize_name(alias)] = cid
    return cid

  @staticmethod
  def _make_id(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", UniversityMatcher.tr_lower(name))
    slug = slug.strip("_")[:40]
    return f"uni_{slug}"

  def resolve(self, query_name: str, choices: Optional[List[str]] = None) -> MatchResult:
    """
    Üniversite adını canonical ID'ye eşleştirir.
    choices verilmezse registry'deki canonical isimler kullanılır.
    """
    if not query_name:
      return MatchResult(None, None, None, 0, MatchAction.REJECT, "Boş sorgu")

    choices = choices or self.canonical_names
    if not choices:
      return MatchResult(None, None, None, 0, MatchAction.REJECT, "Kayıt listesi boş")

    norm_query = UniversityMatcher.normalize_name(query_name)

    # 1. Tam eşleşme (registry alias dahil)
    if norm_query in self._alias_to_id:
      cid = self._alias_to_id[norm_query]
      entry = self._entries[cid]
      result = MatchResult(
        canonical_id=cid,
        canonical_name=entry["canonical_name"],
        matched_name=entry["canonical_name"],
        score=100,
        action=MatchAction.ACCEPT,
      )
      return result

    # 2. Alias sözlüğü (UniversityMatcher.ALIASES)
    if norm_query in UniversityMatcher.ALIASES:
      alias_target = UniversityMatcher.ALIASES[norm_query]
      alias_norm = UniversityMatcher.normalize_name(alias_target)
      if alias_norm in self._alias_to_id:
        cid = self._alias_to_id[alias_norm]
        entry = self._entries[cid]
        result = MatchResult(
          canonical_id=cid,
          canonical_name=entry["canonical_name"],
          matched_name=entry["canonical_name"],
          score=100,
          action=MatchAction.ACCEPT,
        )
        return result

    # 3. Normalize edilmiş tam eşleşme (choices üzerinde)
    norm_to_orig: Dict[str, str] = {}
    for c in choices:
      norm_to_orig[UniversityMatcher.normalize_name(c)] = c

    if norm_query in norm_to_orig:
      matched = norm_to_orig[norm_query]
      cid = self._alias_to_id.get(norm_query) or self.register(matched)
      entry = self._entries[cid]
      result = MatchResult(
        canonical_id=cid,
        canonical_name=entry["canonical_name"],
        matched_name=matched,
        score=100,
        action=MatchAction.ACCEPT,
      )
      return result

    # 4. Fuzzy matching
    norm_choices = list(norm_to_orig.keys())
    best_norm, score = process.extractOne(
      norm_query, norm_choices, scorer=fuzz.token_sort_ratio
    ) or (None, 0)

    if score < 90:
      best_norm_p, score_p = process.extractOne(
        norm_query, norm_choices, scorer=fuzz.partial_ratio
      ) or (None, 0)
      if score_p > score:
        best_norm, score = best_norm_p, score_p

    action = classify_score(score)
    if action == MatchAction.REJECT:
      result = MatchResult(None, None, None, score, action, "Skor 90 altı")
      log_match_result(query_name, result)
      return result

    matched = norm_to_orig[best_norm]
    cid = self._alias_to_id.get(best_norm) or self.register(matched)
    entry = self._entries[cid]
    result = MatchResult(
      canonical_id=cid,
      canonical_name=entry["canonical_name"],
      matched_name=matched,
      score=score,
      action=action,
    )
    log_match_result(query_name, result)
    return result

  def save(self) -> None:
    os.makedirs(os.path.dirname(self.registry_path), exist_ok=True)
    payload = {
      "version": "1.0.0",
      "universities": list(self._entries.values()),
    }
    with open(self.registry_path, "w", encoding="utf-8") as f:
      json.dump(payload, f, ensure_ascii=False, indent=2)

  def build_from_program_index(self, index_path: str = "data/program_index.json") -> int:
    """program_index.json'dan canonical registry oluşturur."""
    if not os.path.exists(index_path):
      logger.warning("program_index bulunamadı: %s", index_path)
      return 0
    with open(index_path, "r", encoding="utf-8") as f:
      programs = json.load(f)
    seen = set()
    count = 0
    for p in programs:
      uni = p.get("university", "").strip()
      if not uni or uni in seen:
        continue
      seen.add(uni)
      self.register(uni)
      count += 1
    self.save()
    logger.info("Registry oluşturuldu: %d üniversite", count)
    return count
