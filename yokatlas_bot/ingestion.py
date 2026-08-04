# -*- coding: utf-8 -*-
"""
1. Girdi Modülü (Data Ingestion)
===============================
Excel (.xlsx), CSV ve Markdown (.md) formatındaki taslak tercih listelerini okur,
kolon isimlerini standartlaştırır ve temiz veri yapısı sunar.
"""

import os
import re
import pandas as pd
from typing import List, Dict, Any

class DataIngestion:
    @staticmethod
    def tr_lower(text: str) -> str:
        """Türkçe karakter duyarlı küçük harfe çevirme."""
        if not isinstance(text, str):
            return ""
        mapping = {"İ": "i", "I": "ı", "Ğ": "ğ", "Ü": "ü", "Ş": "ş", "Ö": "ö", "Ç": "ç"}
        for k, v in mapping.items():
            text = text.replace(k, v)
        return text.lower().strip()

    @classmethod
    def load_from_markdown(cls, filepath: str) -> List[Dict[str, Any]]:
        """Markdown (.md) tablosunu okuyup sözlük listesine dönüştürür."""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Markdown dosyası bulunamadı: {filepath}")

        records = []
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()

        in_table = False
        headers = []

        for line in lines:
            line_str = line.strip()
            if line_str.startswith("|") and "Veritabanı" in line_str:
                in_table = True
                headers = [h.strip().replace("**", "") for h in line_str.split("|")[1:-1]]
                continue

            if in_table:
                if line_str.startswith("|") and ":---" in line_str:
                    continue
                if not line_str.startswith("|"):
                    in_table = False
                    continue

                cols = [c.strip().replace("**", "") for c in line_str.split("|")[1:-1]]
                if len(cols) >= 2:
                    db_id = cols[0] if len(cols) > 0 else ""
                    dept_name = cols[1] if len(cols) > 1 else ""
                    city = cols[2] if len(cols) > 2 else ""
                    location = cols[3] if len(cols) > 3 else ""
                    last_rank_str = cols[4] if len(cols) > 4 else ""
                    rating_str = cols[5] if len(cols) > 5 else ""
                    notes = cols[6] if len(cols) > 6 else ""

                    records.append({
                        "id": db_id,
                        "raw_name": dept_name,
                        "city": city,
                        "location": location,
                        "last_rank": last_rank_str,
                        "rating": rating_str,
                        "notes": notes
                    })

        return records

    @classmethod
    def load_from_excel_or_csv(cls, filepath: str) -> List[Dict[str, Any]]:
        """Excel (.xlsx) veya CSV dosyasından veriyi okur."""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Girdi dosyası bulunamadı: {filepath}")

        if filepath.endswith(".xlsx") or filepath.endswith(".xls"):
            df = pd.read_excel(filepath)
        else:
            df = pd.read_csv(filepath)

        records = []
        for idx, row in df.iterrows():
            records.append({
                "id": str(row.get("Veritabanı", row.get("ID", idx + 1))),
                "raw_name": str(row.get("Üniversite & Bölüm Adı", row.get("Bölüm Adı", ""))),
                "city": str(row.get("Şehir", "")),
                "location": str(row.get("Kontenjan / Konum", "")),
                "last_rank": str(row.get("Geçen Yılki Sıralama", "")),
                "rating": str(row.get("Kişisel Puanım (1-10)", row.get("Puan", ""))),
                "notes": str(row.get("Notlar / Artılar - Eksiler", row.get("Notlar", "")))
            })

        return records
