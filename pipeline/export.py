#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Layered export v2:
  Parquet → compact index + city-partitioned details + O(1) program_map
"""

from __future__ import annotations

import gzip
import json
import logging
import math
import os
import re
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from pipeline.campus_heuristics import get_campus_metrics_cache
from pipeline.config import ROOT

logger = logging.getLogger("pipeline.export")

TARGET_CHUNK_BYTES = 1_000_000  # ~1 MB per detail partition

INDEX_FIELDS = ("i", "ur", "dr", "gr", "ci", "de", "st", "ln", "tu", "lr", "or", "ss", "ts", "ys", "us")

ENUM_KEYS = ("city", "degree", "score_type", "language", "tuition_status", "scholarship_rate", "university_type")

DEDUP_SUFFIXES = (
    "_data_note", "_planned_source", "_planned_source_url",
    "_data_source", "_data_url", "_desc", "_note",
)

DETAIL_SKIP = {
    "id", "program_id", "full_name", "university", "department", "department_group",
    "city", "degree", "score_type", "language", "tuition_status",
    "scholarship_rate", "university_type", "last_rank", "base_score_y1",
    "rating", "scholarship_score", "trend_score", "yok_rank_score",
    "uniar_score", "yok_data_available", "isFavorite",
}


class EnumRegistry:
    def __init__(self) -> None:
        self._stores: Dict[str, Dict[str, int]] = {k: {} for k in ENUM_KEYS}
        self._lists: Dict[str, List[str]] = {k: [] for k in ENUM_KEYS}

    def intern(self, category: str, value: Any) -> int:
        if category not in self._stores:
            category = "city"
        text = str(value or "").strip()
        if not text:
            return 0
        store = self._stores[category]
        if text not in store:
            store[text] = len(self._lists[category])
            self._lists[category].append(text)
        return store[text]

    def to_json(self) -> Dict[str, List[str]]:
        return {k: self._lists[k] for k in ENUM_KEYS}


class StringRegistry:
    def __init__(self) -> None:
        self._list: List[str] = [""]
        self._map: Dict[str, int] = {"": 0}

    def intern(self, value: Any) -> int:
        text = str(value or "").strip()
        if text not in self._map:
            self._map[text] = len(self._list)
            self._list.append(text)
        return self._map[text]

    def to_json(self) -> List[str]:
        return self._list


class StringDictionary:
    def __init__(self) -> None:
        self._str_to_id: Dict[str, int] = {}
        self._id_to_str: Dict[int, str] = {}

    def intern(self, value: Any) -> Optional[int]:
        if value is None or value == "":
            return None
        text = str(value)
        if text not in self._str_to_id:
            new_id = len(self._str_to_id) + 1
            self._str_to_id[text] = new_id
            self._id_to_str[new_id] = text
        return self._str_to_id[text]

    def to_json(self) -> Dict[str, str]:
        return {str(k): v for k, v in sorted(self._id_to_str.items())}


def _slug_city(city: str) -> str:
    text = (city or "bilinmiyor").lower()
    text = text.replace("ı", "i").replace("ğ", "g").replace("ü", "u")
    text = text.replace("ş", "s").replace("ö", "o").replace("ç", "c").replace("İ", "i")
    text = re.sub(r"[^a-z0-9]+", "_", text).strip("_")
    return text or "bilinmiyor"


def _score10(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(round(float(value) * 10))
    except (TypeError, ValueError):
        return None


def _overall100(rating: Any) -> Optional[int]:
    if rating is None:
        return None
    try:
        return int(round(float(rating) * 10))
    except (TypeError, ValueError):
        return None


def to_compact_row(record: Dict[str, Any], enums: EnumRegistry, strings: StringRegistry) -> List[Any]:
    pid = str(record.get("program_id") or record.get("id", ""))
    return [
        pid,
        strings.intern(record.get("university", "")),
        strings.intern(record.get("department", "")),
        strings.intern(record.get("department_group", "")),
        enums.intern("city", record.get("city", "")),
        enums.intern("degree", record.get("degree", "")),
        enums.intern("score_type", record.get("score_type", "")),
        enums.intern("language", record.get("language", "")),
        enums.intern("tuition_status", record.get("tuition_status", "")),
        record.get("last_rank"),
        _overall100(record.get("rating")),
        _score10(record.get("scholarship_score")),
        _score10(record.get("trend_score")),
        _score10(record.get("yok_rank_score")),
        _score10(record.get("uniar_score")),
    ]


def expand_row(row: List[Any], index_doc: Dict[str, Any]) -> Dict[str, Any]:
    enums = index_doc.get("enums", {})
    strings = index_doc.get("strings", [])
    i, ur, dr, gr, ci, de, st, ln, tu, lr, or_, ss, ts, ys, us = row
    rating = or_ / 10 if or_ is not None else None
    return {
        "id": i,
        "program_id": i,
        "university": strings[ur] if ur < len(strings) else "",
        "department": strings[dr] if dr < len(strings) else "",
        "department_group": strings[gr] if gr < len(strings) else "",
        "full_name": f"{strings[ur]} - {strings[dr]}" if ur and dr else strings[ur] or "",
        "faculty": "",
        "city": enums.get("city", [""])[ci] if ci < len(enums.get("city", [])) else "",
        "degree": enums.get("degree", [""])[de] if de < len(enums.get("degree", [])) else "",
        "score_type": enums.get("score_type", [""])[st] if st < len(enums.get("score_type", [])) else "",
        "language": enums.get("language", [""])[ln] if ln < len(enums.get("language", [])) else "",
        "tuition_status": enums.get("tuition_status", [""])[tu] if tu < len(enums.get("tuition_status", [])) else "",
        "last_rank": lr,
        "overall_rating": or_,
        "rating": rating,
        "scholarship_score": ss / 10 if ss is not None else None,
        "trend_score": ts / 10 if ts is not None else None,
        "yok_rank_score": ys / 10 if ys is not None else None,
        "uniar_score": us / 10 if us is not None else None,
        "yok_data_available": lr is not None,
        "isFavorite": False,
        "notes": "-",
    }


def _intern_field_dict(obj: Dict[str, Any], dictionary: StringDictionary) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for key, val in obj.items():
        if isinstance(val, str) and (
            key.endswith(DEDUP_SUFFIXES) or key in ("source_name", "source_url", "parser_version")
        ):
            ref = dictionary.intern(val)
            if ref is not None:
                out[f"{key}_ref"] = ref
        elif isinstance(val, dict):
            out[key] = _intern_field_dict(val, dictionary)
        else:
            out[key] = val
    return out


def to_program_detail(record: Dict[str, Any], dictionary: StringDictionary, enums: EnumRegistry) -> Dict[str, Any]:
    detail: Dict[str, Any] = {}
    for key, val in record.items():
        if key in DETAIL_SKIP:
            continue
        if key == "_traceability" and isinstance(val, dict):
            detail["_traceability"] = _intern_field_dict(val, dictionary)
            continue
        if isinstance(val, str) and key.endswith(DEDUP_SUFFIXES):
            ref = dictionary.intern(val)
            if ref is not None:
                detail[f"{key}_ref"] = ref
            continue
        if key.endswith("_data_available"):
            detail[key] = val
            continue
        if key.endswith("_score") or key.endswith("_subcategories"):
            detail[key] = val
            continue
        if key in (
            "history_rankings", "history_quotas", "prediction",
            "rank_y1", "rank_y2", "rank_y3", "rank_y4",
            "quota_current", "quota_prev", "quota_y1", "placed_students",
            "tuition_fee", "duration_years", "district", "publication_year",
            "university_id", "instruction_type", "campus_key", "faculty",
        ):
            detail[key] = val
    detail["ci"] = enums.intern("city", record.get("city", ""))
    return detail


def _export_paths(year: int) -> Dict[str, str]:
    base = os.path.join(ROOT, "data", "analysis", str(year))
    return {
        "base": base,
        "index": os.path.join(base, "analysis_index.json"),
        "index_gz": os.path.join(base, "analysis_index.json.gz"),
        "manifest": os.path.join(base, "details_manifest.json"),
        "dictionary": os.path.join(base, "string_dictionary.json"),
        "enums": os.path.join(base, "enums.json"),
        "details_dir": os.path.join(base, "details"),
        "city_index": os.path.join(base, "city_index.json"),
        "department_index": os.path.join(base, "department_index.json"),
        "university_index": os.path.join(base, "university_index.json"),
        "meta": os.path.join(base, "meta.json"),
        "campus_metrics": os.path.join(base, "campus_metrics.json"),
    }


def _scrub_nan(value: Any) -> Any:
    """NaN/Inf değerleri None'a çevir — tarayıcı JSON.parse NaN kabul etmez."""
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {k: _scrub_nan(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_scrub_nan(v) for v in value]
    return value


def _write_json(path: str, payload: Any, compact: bool = True) -> int:
    payload = _scrub_nan(payload)
    with open(path, "w", encoding="utf-8") as f:
        if compact:
            json.dump(payload, f, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        else:
            json.dump(payload, f, ensure_ascii=False, indent=2, allow_nan=False)
    return os.path.getsize(path)


def _write_gzip(path: str, payload: Any) -> int:
    raw = json.dumps(
        _scrub_nan(payload), ensure_ascii=False, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")
    with gzip.open(path, "wb", compresslevel=6) as f:
        f.write(raw)
    return os.path.getsize(path)


def _split_city_partitions(
    city: str,
    records: List[Dict[str, Any]],
    dictionary: StringDictionary,
    enums: EnumRegistry,
    details_dir: str,
) -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
    """Split city records into ~1MB partitions. Returns partition metas + program_map entries."""
    slug = _slug_city(city)
    city_dir = os.path.join(details_dir, "cities", slug)
    os.makedirs(city_dir, exist_ok=True)

    metas: List[Dict[str, Any]] = []
    program_map: Dict[str, str] = {}

    batch: Dict[str, Any] = {}
    batch_ids: List[str] = []
    part_idx = 0

    def flush() -> None:
        nonlocal batch, batch_ids, part_idx
        if not batch:
            return
        rel = f"cities/{slug}/part_{part_idx:02d}.json"
        path = os.path.join(details_dir, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        payload = {"meta": {"city": city, "slug": slug, "part": part_idx, "count": len(batch)}, "programs": batch}
        size = _write_json(path, payload)
        metas.append({"id": f"{slug}/p{part_idx}", "file": rel, "city": city, "count": len(batch), "bytes": size})
        for pid in batch_ids:
            program_map[pid] = f"{slug}/p{part_idx}"
        part_idx += 1
        batch = {}
        batch_ids = []

    for rec in records:
        pid = str(rec.get("program_id", ""))
        detail = to_program_detail(rec, dictionary, enums)
        batch[pid] = detail
        batch_ids.append(pid)
        est = len(json.dumps(batch, ensure_ascii=False, separators=(",", ":")))
        if est >= TARGET_CHUNK_BYTES:
            flush()

    flush()
    return metas, program_map


def export_layered(records: List[Dict[str, Any]], year: int = 2026) -> Dict[str, Any]:
    paths = _export_paths(year)
    os.makedirs(paths["details_dir"], exist_ok=True)

    dictionary = StringDictionary()
    enums = EnumRegistry()
    strings = StringRegistry()

    sorted_records = sorted(records, key=lambda r: str(r.get("program_id", "")))
    rows = [to_compact_row(r, enums, strings) for r in sorted_records]

    index_doc = {
        "version": 2,
        "fields": list(INDEX_FIELDS),
        "enums": enums.to_json(),
        "strings": strings.to_json(),
        "data": rows,
    }

    index_bytes = _write_json(paths["index"], index_doc)
    gzip_bytes = _write_gzip(paths["index_gz"], index_doc)

    by_city: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    city_index: Dict[str, List[str]] = defaultdict(list)
    dept_index: Dict[str, List[str]] = defaultdict(list)
    uni_index: Dict[str, List[str]] = defaultdict(list)

    for rec in sorted_records:
        pid = str(rec.get("program_id", ""))
        city = rec.get("city") or "BİLİNMEYEN"
        by_city[city].append(rec)
        city_index[city].append(pid)
        dept_key = rec.get("department_group") or rec.get("department") or ""
        if dept_key:
            dept_index[dept_key].append(pid)
        if rec.get("university"):
            uni_index[rec["university"]].append(pid)

    all_partitions: List[Dict[str, Any]] = []
    program_map: Dict[str, str] = {}

    for city, city_records in sorted(by_city.items()):
        metas, pmap = _split_city_partitions(city, city_records, dictionary, enums, paths["details_dir"])
        all_partitions.extend(metas)
        program_map.update(pmap)

    manifest = {
        "version": 2,
        "partition": "city",
        "target_chunk_bytes": TARGET_CHUNK_BYTES,
        "total": len(sorted_records),
        "program_map": program_map,
        "partitions": all_partitions,
    }
    _write_json(paths["manifest"], manifest, compact=False)

    _write_json(paths["dictionary"], dictionary.to_json())
    _write_json(paths["enums"], enums.to_json())

    for path, index in (
        (paths["city_index"], city_index),
        (paths["department_index"], dept_index),
        (paths["university_index"], uni_index),
    ):
        _write_json(path, dict(index))

    avg_bytes = index_bytes / max(len(rows), 1)
    meta = {
        "year": year,
        "version": 2,
        "total_programs": len(rows),
        "index_bytes": index_bytes,
        "index_gzip_bytes": gzip_bytes,
        "index_mb": round(index_bytes / (1024 * 1024), 2),
        "index_gzip_mb": round(gzip_bytes / (1024 * 1024), 2),
        "avg_card_bytes": round(avg_bytes, 1),
        "partition_count": len(all_partitions),
        "dictionary_entries": len(dictionary.to_json()),
        "paths": {k: os.path.relpath(v, ROOT) for k, v in paths.items()},
    }
    _write_json(paths["meta"], meta, compact=False)

    campus_cache = get_campus_metrics_cache()
    if not campus_cache:
        for rec in sorted_records:
            key = rec.get("campus_key")
            if not key or key in campus_cache:
                continue
            campus_cache[key] = {
                k: rec.get(k)
                for k in rec
                if k.startswith(("transport_", "cost_", "housing_", "campus_key"))
                and rec.get(k) is not None
            }
    campus_doc = {
        "version": 1,
        "source": "campus_heuristics_v1",
        "campus_count": len(campus_cache),
        "metrics": campus_cache,
    }
    _write_json(paths["campus_metrics"], campus_doc, compact=False)

    logger.info("Layered export v2 → %s", paths["base"])
    logger.info("  index: %.2f MB (gzip %.2f MB, avg %.0f B/card)", meta["index_mb"], meta["index_gzip_mb"], avg_bytes)
    logger.info("  partitions: %d (city-based, ~1MB target)", len(all_partitions))
    logger.info("  program_map: %d entries (O(1) lookup)", len(program_map))

    return meta
