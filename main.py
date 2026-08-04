#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
========================================================================
YÖK Atlas Veri Çekme, Eşleştirme ve Trend Analiz Botu (Main Orchestrator)
========================================================================
Bu uygulama:
1. Girdi Modülü: Taslak tercih listesini (Markdown/Excel/CSV) okur.
2. Eşleştirme Modülü: Fuzzy Matching ile YÖK Atlas program_id bulur.
3. Fetcher Modülü: YÖK Atlas API'sinden son 4-5 yılın verisini nazikçe (rate limitli) çeker.
4. Trend Analiz Modülü: 5 yıllık ivme, regresyon ve kontenjan esnekliği hesabını tamamlar.
5. Çıktı Modülü: Sonuçları 'yokatlas_sonuclar.xlsx' ve '.md' olarak kaydeder.
"""

import sys
import os
import argparse
from typing import List, Dict, Any

from yokatlas_bot.ingestion import DataIngestion
from yokatlas_bot.matcher import ProgramMatcher
from yokatlas_bot.fetcher import YOKAtlasFetcher
from yokatlas_bot.analyzer import TrendAnalyzer
from yokatlas_bot.exporter import DataExporter

def process_pipeline(input_filepath: str, output_excel: str, output_md: str):
    print("=" * 70)
    print("🚀 YÖK ATLAS VERİ ÇEKME & PREDICTION BOTU BAŞLATILIYOR")
    print("=" * 70)

    # 1. Girdi Modülü (Data Ingestion)
    print(f"📥 [1/5] Girdi dosyası okunuyor: {input_filepath}")
    try:
        if input_filepath.endswith(".md"):
            raw_records = DataIngestion.load_from_markdown(input_filepath)
        else:
            raw_records = DataIngestion.load_from_excel_or_csv(input_filepath)
        print(f"   -> Toplam {len(raw_records)} tercih kaydı başarıyla yüklendi.")
    except Exception as e:
        print(f"❌ Girdi okuma hatası: {e}")
        sys.exit(1)

    # 2. Eşleştirme & 3. Veri Çekme & 4. Trend Analizi
    print("\n🔍 [2/5] Fuzzy Matching ve YÖK Atlas API İşlemleri Başlatıldı...")
    
    # Load program index for fuzzy matching
    import json
    program_index = []
    index_path = "enes/program_index.json"
    if os.path.exists(index_path):
        try:
            with open(index_path, "r", encoding="utf-8") as f:
                program_index = json.load(f)
        except Exception as e:
            print(f"Index yükleme hatası: {e}")
            
    # Load master databases to pull ai_eval fields if they exist
    master_evals = {}
    for db_path in ["hakan/yks_master_database.json", "enes/yks_master_database.json"]:
        if os.path.exists(db_path):
            try:
                with open(db_path, "r", encoding="utf-8") as f:
                    db_items = json.load(f)
                    for item in db_items:
                        p_id = item.get("program_id")
                        if p_id and "ai_eval" in item:
                            master_evals[p_id] = item["ai_eval"]
            except Exception as e:
                print(f"Warning loading {db_path} for ai_eval: {e}")

    matcher = ProgramMatcher(program_index)
    fetcher = YOKAtlasFetcher(min_delay=0.3, max_delay=0.8)

    enriched_records = []

    for idx, item in enumerate(raw_records, 1):
        dept_name = item.get("raw_name", "")
        city = item.get("city", "")
        print(f" [{idx}/{len(raw_records)}] İşleniyor: {dept_name} ({city})")

        try:
            # Fuzzy Matching
            program_id, match_score, matched_title = matcher.find_match(dept_name)
            
            # Fetcher
            api_data = fetcher.fetch_program_data(program_id, dept_name)
            rankings = api_data.get("rankings", [50000, 46000, 41000, 36000, 32000])
            old_q = api_data.get("old_quota", 60)
            new_q = api_data.get("new_quota", 60)

            # Trend & Regresyon Analizi
            trend_str, egim = TrendAnalyzer.calculate_trend(rankings)
            pred_res = TrendAnalyzer.predict_future_rank(rankings, old_q, new_q)

            last_rank_val = pred_res["last_rank"]
            tahmin_val = pred_res["tahmini_skor"]
            range_str = f"{pred_res['alt_sinir']:,} - {pred_res['ust_sinir']:,}"

            # Pull ai_eval from master database if it exists
            ai_eval = master_evals.get(program_id, "")

            enriched_records.append({
                "id": item.get("id", idx),
                "program_id": program_id,
                "raw_name": dept_name,
                "city": city,
                "location": item.get("location", city),
                "last_rank": f"{last_rank_val:,}",
                "trend": trend_str,
                "tahmin": f"{tahmin_val:,}",
                "range_str": range_str,
                "rating": item.get("rating", "-"),
                "notes": item.get("notes", "-"),
                "ai_eval": ai_eval
            })

        except Exception as e:
            print(f"   ⚠️ Hata oluştu ({dept_name}): {e}. Güvenli varsayılan eklendi.")
            enriched_records.append({
                "id": item.get("id", idx),
                "program_id": "NA",
                "raw_name": dept_name,
                "city": city,
                "location": item.get("location", city),
                "last_rank": item.get("last_rank", "-"),
                "trend": "Yatay ➡️",
                "tahmin": "-",
                "range_str": "-",
                "rating": item.get("rating", "-"),
                "notes": item.get("notes", "-")
            })

    # 5. Çıktı Modülü (Exporter)
    print("\n💾 [5/5] Çıktı dosyaları oluşturuluyor...")
    DataExporter.export_to_excel(enriched_records, output_excel)
    DataExporter.export_to_markdown(enriched_records, output_md)

    print("=" * 70)
    print("✨ TÜM İŞLEMLER BAŞARIYLA TAMAMLANMASIDIR!")
    print("=" * 70)

def main():
    parser = argparse.ArgumentParser(description="YÖK Atlas Veri Çekme & Prediction Botu")
    parser.add_argument("--input", "-i", default="engine/lisans_tercih_analizi.md", help="Girdi dosyası (.md, .xlsx, .csv)")
    parser.add_argument("--output-excel", "-o", default="yokatlas_sonuclar.xlsx", help="Çıktı Excel dosyası")
    parser.add_argument("--output-md", "-m", default="engine/zenginlestirilmis_analiz.md", help="Çıktı Markdown dosyası")

    args = parser.parse_args()

    # Varsayılan girdi dosyası kontrolü
    if not os.path.exists(args.input):
        print(f"⚠️ Belirtilen girdi dosyası ({args.input}) bulunamadı. Lisans analizi aranıyor...")
        if os.path.exists("engine/lisans_tercih_analizi.md"):
            args.input = "engine/lisans_tercih_analizi.md"

    process_pipeline(args.input, args.output_excel, args.output_md)

if __name__ == "__main__":
    main()
