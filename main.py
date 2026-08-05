#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
YÖK Atlas Veri Çekme & Analiz Orkestratörü
==========================================
Kanıta dayalı pipeline:
  Girdi → Fuzzy Match → YÖK Atlas API → Trend (yalnızca gerçek veri) → Çıktı
Sentetik veri veya tahmin üretilmez; veri yoksa alan boş bırakılır.
"""

import sys
import os
import json
import argparse
from typing import List, Dict, Any

from yokatlas_bot.ingestion import DataIngestion
from yokatlas_bot.matcher import ProgramMatcher
from yokatlas_bot.fetcher import YOKAtlasFetcher
from yokatlas_bot.analyzer import TrendAnalyzer
from yokatlas_bot.exporter import DataExporter

NO_DATA = "Bu alan için doğrulanmış resmî veri bulunamadı."


def process_pipeline(input_filepath: str, output_excel: str, output_md: str, yok_year: int = 2025):
    print("=" * 70)
    print("YÖK ATLAS KANITA DAYALI VERİ ÇEKME BAŞLATILIYOR")
    print("=" * 70)

    print(f"[1/5] Girdi dosyası okunuyor: {input_filepath}")
    try:
        if input_filepath.endswith(".md"):
            raw_records = DataIngestion.load_from_markdown(input_filepath)
        else:
            raw_records = DataIngestion.load_from_excel_or_csv(input_filepath)
        print(f"   -> {len(raw_records)} tercih kaydı yüklendi.")
    except Exception as e:
        print(f"Girdi okuma hatası: {e}")
        sys.exit(1)

    print("\n[2/5] Fuzzy Matching ve YÖK Atlas API işlemleri...")

    program_index = []
    index_path = "data/program_index.json"
    if os.path.exists(index_path):
        try:
            with open(index_path, "r", encoding="utf-8") as f:
                program_index = json.load(f)
        except Exception as e:
            print(f"Index yükleme hatası: {e}")

    master_evals = {}
    for db_path in ("validated/yks_master_database.json", "data/yks_master_database.json"):
        if os.path.exists(db_path):
            try:
                with open(db_path, "r", encoding="utf-8") as f:
                    for item in json.load(f):
                        p_id = item.get("program_id")
                        if p_id and item.get("ai_eval"):
                            master_evals[str(p_id)] = item["ai_eval"]
            except Exception as e:
                print(f"Warning loading {db_path}: {e}")

    matcher = ProgramMatcher(program_index)
    fetcher = YOKAtlasFetcher(min_delay=0.3, max_delay=0.8, year=yok_year)
    enriched_records = []

    for idx, item in enumerate(raw_records, 1):
        dept_name = item.get("raw_name", "")
        city = item.get("city", "")
        print(f" [{idx}/{len(raw_records)}] {dept_name} ({city})")

        program_id, match_score, matched_title = matcher.find_match(dept_name)

        if not program_id:
            enriched_records.append({
                "id": item.get("id", idx),
                "program_id": None,
                "raw_name": dept_name,
                "city": city,
                "location": item.get("location", city),
                "last_rank": "-",
                "trend": "-",
                "tahmin": "-",
                "range_str": "-",
                "rating": item.get("rating", "-"),
                "notes": item.get("notes", "-"),
                "data_available": False,
                "data_note": NO_DATA,
                "match_score": match_score,
            })
            continue

        api_data = fetcher.fetch_program_data(program_id, dept_name)

        if not api_data.get("data_available", True):
            enriched_records.append({
                "id": item.get("id", idx),
                "program_id": program_id,
                "raw_name": dept_name,
                "city": api_data.get("city") or city,
                "location": item.get("location", city),
                "last_rank": "-",
                "trend": "-",
                "tahmin": "-",
                "range_str": "-",
                "rating": item.get("rating", "-"),
                "notes": item.get("notes", "-"),
                "data_available": False,
                "data_note": api_data.get("data_note", NO_DATA),
                "match_score": match_score,
            })
            continue

        rankings = api_data.get("rankings", [])
        old_q = api_data.get("old_quota") or 0
        new_q = api_data.get("new_quota") or 0

        trend_str, _ = TrendAnalyzer.calculate_trend(rankings) if rankings else ("-", 0.0)

        tahmin_val = "-"
        range_str = "-"
        last_rank_val = api_data.get("last_rank")

        if rankings and len(rankings) >= 2 and old_q and new_q:
            pred_res = TrendAnalyzer.predict_future_rank(rankings, old_q, new_q)
            last_rank_val = pred_res.get("last_rank", last_rank_val)
            tahmin_val = f"{pred_res['tahmini_skor']:,}"
            range_str = f"{pred_res['alt_sinir']:,} - {pred_res['ust_sinir']:,}"
        elif last_rank_val:
            tahmin_val = "-"
            range_str = "-"

        enriched_records.append({
            "id": item.get("id", idx),
            "program_id": program_id,
            "raw_name": dept_name,
            "city": api_data.get("city") or city,
            "location": item.get("location", city),
            "last_rank": f"{last_rank_val:,}" if last_rank_val else "-",
            "trend": trend_str,
            "tahmin": tahmin_val,
            "range_str": range_str,
            "rating": item.get("rating", "-"),
            "notes": item.get("notes", "-"),
            "ai_eval": master_evals.get(str(program_id), ""),
            "data_available": True,
            "rankings": rankings,
            "base_score_y1": api_data.get("base_score_y1"),
            "ceiling_score_y1": api_data.get("ceiling_score_y1"),
            "score_type": api_data.get("score_type"),
            "instruction_type": api_data.get("instruction_type"),
            "scholarship_rate": api_data.get("scholarship_rate"),
            "match_score": match_score,
            "matched_title": matched_title,
        })

    print("\n[5/5] Çıktı dosyaları oluşturuluyor...")
    DataExporter.export_to_excel(enriched_records, output_excel)
    DataExporter.export_to_markdown(enriched_records, output_md)

    available = sum(1 for r in enriched_records if r.get("data_available"))
    print("=" * 70)
    print(f"TAMAMLANDI — {available}/{len(enriched_records)} kayıtta resmî YÖK verisi mevcut")
    print("=" * 70)
    return enriched_records


def main():
    parser = argparse.ArgumentParser(description="YÖK Atlas Kanıta Dayalı Veri Çekme")
    parser.add_argument("--input", "-i", default="engine/lisans_tercih_analizi.md")
    parser.add_argument("--output-excel", "-o", default="yokatlas_sonuclar.xlsx")
    parser.add_argument("--output-md", "-m", default="engine/zenginlestirilmis_analiz.md")
    parser.add_argument("--yok-year", type=int, default=2025)
    args = parser.parse_args()

    if not os.path.exists(args.input):
        if os.path.exists("engine/lisans_tercih_analizi.md"):
            args.input = "engine/lisans_tercih_analizi.md"
        else:
            print(f"Girdi dosyası bulunamadı: {args.input}")
            sys.exit(1)

    process_pipeline(args.input, args.output_excel, args.output_md, yok_year=args.yok_year)


if __name__ == "__main__":
    main()
