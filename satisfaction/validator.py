# -*- coding: utf-8 -*-
"""
Validator Module
================
Validates parsed satisfaction records and generates verification reports.
"""

import os
from typing import List, Dict, Any, Tuple
from satisfaction.models import UniversitySatisfaction

class SatisfactionValidator:
    @staticmethod
    def validate_records(records: List[UniversitySatisfaction]) -> Tuple[bool, List[str], Dict[str, Any]]:
        """
        Performs several data validation checks:
        1. Range validation (score between 1 and 10).
        2. Duplicate verification (same university name + same year).
        3. Missing data validation (overall_grade must be in expected set).
        4. Category counts.

        Returns (is_valid, list_of_errors, stats_dict).
        """
        errors = []
        stats = {
            "total_records": len(records),
            "valid_records": 0,
            "invalid_records": 0,
            "duplicate_records": 0,
            "grades_distribution": {}
        }

        seen_keys = set()
        
        for idx, r in enumerate(records):
            record_is_valid = True
            
            # 1. Duplicate check
            key = (r.university_name.lower().strip(), r.year)
            if key in seen_keys:
                errors.append(f"Satır {idx+1}: '{r.university_name}' üniversitesi {r.year} yılı için tekrarlanan kayıt.")
                stats["duplicate_records"] += 1
                record_is_valid = False
            else:
                seen_keys.add(key)

            # 2. Score Range Check
            if not (0.0 <= r.overall_score <= 10.0):
                errors.append(f"Satır {idx+1}: '{r.university_name}' için geçersiz genel memnuniyet puanı: {r.overall_score}. Puan 0 ile 10 arasında olmalıdır.")
                record_is_valid = False

            # 3. Grade Format Check
            valid_grades = {"A+", "A", "B", "C", "D", "F", "FF"}
            if r.overall_grade not in valid_grades:
                errors.append(f"Satır {idx+1}: '{r.university_name}' için geçersiz memnuniyet derecesi: '{r.overall_grade}'. Geçerli dereceler: {valid_grades}")
                record_is_valid = False

            # Compile stats
            if record_is_valid:
                stats["valid_records"] += 1
                stats["grades_distribution"][r.overall_grade] = stats["grades_distribution"].get(r.overall_grade, 0) + 1
            else:
                stats["invalid_records"] += 1

        is_valid = len(errors) == 0
        return is_valid, errors, stats

    @staticmethod
    def generate_report(records: List[UniversitySatisfaction], report_path: str = "satisfaction/validation_report.md"):
        """Generates a detailed markdown validation report."""
        is_valid, errors, stats = SatisfactionValidator.validate_records(records)
        
        lines = [
            "# ÜNİAR Memnuniyet Veritabanı Doğrulama Raporu\n",
            f"**Rapor Tarihi:** {os.path.basename(report_path)}",
            f"**Durum:** {'✅ GEÇTİ' if is_valid else '❌ HATA VAR'}\n",
            "## İstatistikler",
            f"- **Toplam Okunan Kayıt:** {stats['total_records']}",
            f"- **Geçerli Kayıt Sayısı:** {stats['valid_records']}",
            f"- **Geçersiz Kayıt Sayısı:** {stats['invalid_records']}",
            f"- **Tekrarlanan Kayıt Sayısı:** {stats['duplicate_records']}\n",
            "### Derece Dağılımı (Geçerli Kayıtlar)"
        ]
        
        for g, count in sorted(stats["grades_distribution"].items()):
            lines.append(f"- **{g}:** {count} adet")
            
        if errors:
            lines.extend([
                "\n## Hatalar ve Uyumsuzluklar",
                "\nAşağıdaki satırlar doğrulama kurallarına takılmıştır:"
            ])
            for err in errors:
                lines.append(f"- {err}")
        else:
            lines.append("\n✅ Veri kümesinde hiçbir hata veya tekrarlanan kayıt tespit edilmedi.")

        os.makedirs(os.path.dirname(report_path), exist_ok=True)
        with open(report_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        
        print(f"✅ Doğrulama raporu kaydedildi: {os.path.abspath(report_path)}")
