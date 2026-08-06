#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Program Arama İndeksi Oluşturucu
================================
21k program için hızlı typeahead araması — kompakt JSON.
"""

import json
import os
import re
from collections import defaultdict

ROOT = os.path.dirname(os.path.abspath(__file__))
INDEX_PATH = os.path.join(ROOT, "data", "program_index.json")
SEARCH_PATH = os.path.join(ROOT, "data", "program_search.json")
DEPT_PATH = os.path.join(ROOT, "data", "departments_index.json")


def tr_lower(s: str) -> str:
    mapping = {"İ": "i", "I": "ı", "Ğ": "ğ", "Ü": "ü", "Ş": "ş", "Ö": "ö", "Ç": "ç"}
    for k, v in mapping.items():
        s = s.replace(k, v)
    return s.lower()


def tokenize(s: str) -> list:
    s = tr_lower(s)
    s = re.sub(r"[^\w\s]", " ", s)
    return [t for t in s.split() if len(t) >= 2]


def infer_instruction_type(full_title: str) -> str:
    upper = (full_title or "").upper()
    if "AÇIKÖĞRETİM" in upper or "AÇIK ÖĞRETİM" in upper:
        return "Açıköğretim"
    if "UZAKTAN" in upper:
        return "Uzaktan Öğretim"
    if "UOLP" in upper:
        return "UOLP"
    return "Örgün"


def instruction_search_tokens(full_title: str) -> str:
    upper = (full_title or "").upper()
    tokens = []
    if "AÇIKÖĞRETİM" in upper or "AÇIK ÖĞRETİM" in upper:
        tokens.extend(["açıköğretim", "açık öğretim", "açık öğretim programı"])
    if "UZAKTAN" in upper:
        tokens.extend(["uzaktan öğretim", "uzaktan", "açık öğretim", "açıköğretim"])
    return " ".join(tokens)


def main():
    with open(INDEX_PATH, "r", encoding="utf-8") as f:
        programs = json.load(f)

    compact = []
    dept_map = defaultdict(set)

    for p in programs:
        dept = p.get("department_group") or p.get("department", "")
        full_title = p.get("full_title", "")
        instruction = infer_instruction_type(full_title)
        search_extra = instruction_search_tokens(full_title)
        entry = {
            "id": p["program_id"],
            "t": full_title,
            "u": p.get("university", ""),
            "d": p.get("department", ""),
            "g": dept,
            "c": p.get("city", ""),
            "s": p.get("score_type", ""),
            "b": p.get("scholarship_rate", ""),
            "o": instruction,
            "h": tr_lower(
                f"{full_title} {p.get('university', '')} {dept} {p.get('city', '')} {search_extra}"
            ),
        }
        compact.append(entry)
        if dept:
            dept_map[tr_lower(dept)].add(dept)

    departments = sorted(
        [{"name": names.pop() if len(names) == 1 else max(names, key=len), "key": k}
         for k, names in dept_map.items()],
        key=lambda x: x["name"],
    )

    os.makedirs(os.path.dirname(SEARCH_PATH), exist_ok=True)
    with open(SEARCH_PATH, "w", encoding="utf-8") as f:
        json.dump(compact, f, ensure_ascii=False, separators=(",", ":"))

    with open(DEPT_PATH, "w", encoding="utf-8") as f:
        json.dump(departments, f, ensure_ascii=False, indent=2)

    print(f"program_search.json: {len(compact)} program")
    print(f"departments_index.json: {len(departments)} bölüm grubu")


if __name__ == "__main__":
    main()
