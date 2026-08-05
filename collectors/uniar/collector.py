# -*- coding: utf-8 -*-
"""
ÜNİAR Collector
===============
Yıllık TÜMA PDF raporlarından üniversite memnuniyet verilerini çeker.
Pipeline: PDF → pdfplumber → Camelot → Tabula → OCR
Hiçbir veri üretilmez; kaynak bulunamazsa alan boş bırakılır.
"""

import os
import sys
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from collectors import BaseCollector, CollectorResult, compute_file_sha256

logger = logging.getLogger(__name__)


class UNIARCollector(BaseCollector):

    SOURCE_NAME = "ÜNİAR TÜMA Raporu"
    SOURCE_URL = "https://www.uniar.net/tuma"
    PARSER_VERSION = "3.0.0"

    def __init__(self, year: int = 2024):
        super().__init__()
        self.year = year

    def fetch(self, pdf_path: str, **kwargs) -> CollectorResult:
        """
        PDF dosyasını aşamalı olarak ayrıştırır.
        pdfplumber → Camelot → Tabula → OCR (her biri başarısız olursa bir sonrakine geçer).
        """
        trace_id = f"UNIAR_{self.year}_{os.path.basename(pdf_path)}"
        result = CollectorResult(
            source_name=self.SOURCE_NAME,
            source_url=self.SOURCE_URL,
            endpoint="PDF parse",
            trace_id=trace_id,
            parser_version=self.PARSER_VERSION,
            publication_year=self.year,
        )

        if not os.path.exists(pdf_path):
            return result.mark_unavailable(f"PDF dosyası bulunamadı: {pdf_path}")

        # SHA256 dosya özeti
        result.sha256 = compute_file_sha256(pdf_path)
        result.request_body = {"pdf_path": pdf_path, "year": self.year}

        # Pipeline: pdfplumber → Camelot → Tabula → OCR
        parsed_data = self._try_pdfplumber(pdf_path)
        if not parsed_data:
            logger.warning(f"pdfplumber başarısız, Camelot deneniyor...")
            parsed_data = self._try_camelot(pdf_path)
        if not parsed_data:
            logger.warning(f"Camelot başarısız, Tabula deneniyor...")
            parsed_data = self._try_tabula(pdf_path)
        if not parsed_data:
            logger.warning(f"Tabula başarısız, OCR deneniyor...")
            parsed_data = self._try_ocr(pdf_path)

        if parsed_data:
            result.data = parsed_data
            result.data_available = True
        else:
            result.mark_unavailable(
                f"TÜMA {self.year} PDF'i hiçbir yöntemle ayrıştırılamadı: {pdf_path}"
            )

        return result

    def _try_pdfplumber(self, pdf_path: str) -> Optional[List[Dict]]:
        try:
            import pdfplumber
            records = []
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    tables = page.extract_tables()
                    for table in tables:
                        parsed = self._parse_table(table)
                        if parsed:
                            records.extend(parsed)
            if records:
                logger.info(f"pdfplumber: {len(records)} kayıt çekildi")
                return records
        except ImportError:
            logger.warning("pdfplumber yüklü değil")
        except Exception as e:
            logger.warning(f"pdfplumber hatası: {e}")
        return None

    def _try_camelot(self, pdf_path: str) -> Optional[List[Dict]]:
        try:
            import camelot
            tables = camelot.read_pdf(pdf_path, pages="all", flavor="lattice")
            records = []
            for t in tables:
                parsed = self._parse_table(t.df.values.tolist())
                if parsed:
                    records.extend(parsed)
            if records:
                logger.info(f"Camelot: {len(records)} kayıt çekildi")
                return records
        except ImportError:
            logger.warning("camelot yüklü değil")
        except Exception as e:
            logger.warning(f"Camelot hatası: {e}")
        return None

    def _try_tabula(self, pdf_path: str) -> Optional[List[Dict]]:
        try:
            import tabula
            dfs = tabula.read_pdf(pdf_path, pages="all", multiple_tables=True)
            records = []
            for df in dfs:
                parsed = self._parse_table(df.values.tolist())
                if parsed:
                    records.extend(parsed)
            if records:
                logger.info(f"Tabula: {len(records)} kayıt çekildi")
                return records
        except ImportError:
            logger.warning("tabula yüklü değil")
        except Exception as e:
            logger.warning(f"Tabula hatası: {e}")
        return None

    def _try_ocr(self, pdf_path: str) -> Optional[List[Dict]]:
        """
        Son çare OCR. OCR sonucu doğrudan kabul edilmez;
        sayısal alanlar tekrar doğrulanır.
        """
        try:
            import pytesseract
            from PIL import Image
            import pdf2image

            images = pdf2image.convert_from_path(pdf_path, dpi=300)
            all_text = ""
            for img in images:
                text = pytesseract.image_to_string(img, lang="tur")
                all_text += text + "\n"

            records = self._parse_ocr_text(all_text)
            if records:
                # OCR doğrulaması: sayısal alanların geçerliliğini kontrol et
                records = self._validate_ocr_records(records)
                logger.info(f"OCR: {len(records)} kayıt çekildi ve doğrulandı")
                return records
        except ImportError:
            logger.warning("pytesseract veya pdf2image yüklü değil")
        except Exception as e:
            logger.warning(f"OCR hatası: {e}")
        return None

    def _parse_table(self, table: List) -> List[Dict]:
        """Tablo satırlarını üniversite memnuniyet kayıtlarına dönüştürür."""
        records = []
        if not table or len(table) < 2:
            return records

        # Başlık tespiti (başlık satırını bul)
        header_row = None
        for i, row in enumerate(table):
            row_str = " ".join(str(c).lower() for c in row if c)
            if any(kw in row_str for kw in ["üniversite", "university", "genel", "overall", "memnuniyet"]):
                header_row = i
                break

        if header_row is None:
            return records

        for row in table[header_row + 1:]:
            if not row or not any(row):
                continue
            try:
                uni_name = str(row[0]).strip() if row[0] else None
                if not uni_name or len(uni_name) < 3:
                    continue

                # Sayısal alanlar — sadece gerçek sayı ise kabul et
                overall = _safe_float_strict(row[1] if len(row) > 1 else None)
                learning = _safe_float_strict(row[2] if len(row) > 2 else None)
                campus = _safe_float_strict(row[3] if len(row) > 3 else None)
                academic = _safe_float_strict(row[4] if len(row) > 4 else None)
                management = _safe_float_strict(row[5] if len(row) > 5 else None)
                career = _safe_float_strict(row[6] if len(row) > 6 else None)

                if overall is None:
                    continue  # Overall skor yoksa atla

                records.append({
                    "university_name": uni_name,
                    "year": None,  # Üst seviyede set edilecek
                    "overall_score": overall,
                    "learning_experience": learning,
                    "campus_life": campus,
                    "academic_support": academic,
                    "management": management,
                    "career_support": career,
                })
            except Exception:
                continue

        return records

    def _parse_ocr_text(self, text: str) -> List[Dict]:
        """OCR çıktısından üniversite ve puan satırlarını ayrıştırır."""
        import re
        records = []
        lines = text.split("\n")
        for line in lines:
            # "ÜNİVERSİTE ADI 7.5 6.8 7.2..." formatını ara
            match = re.match(r"(.+?)\s+([\d]+[.,][\d]+)\s+([\d]+[.,][\d]+)", line)
            if match:
                uni_name = match.group(1).strip()
                overall = _safe_float_strict(match.group(2).replace(",", "."))
                if overall and 0 < overall <= 10:
                    records.append({
                        "university_name": uni_name,
                        "year": None,
                        "overall_score": overall,
                        "learning_experience": None,
                        "campus_life": None,
                        "academic_support": None,
                        "management": None,
                        "career_support": None,
                        "_ocr_parsed": True,  # OCR ile geldiğini işaretle
                    })
        return records

    def _validate_ocr_records(self, records: List[Dict]) -> List[Dict]:
        """OCR ile gelen sayısal alanları doğrula. 0–10 aralığı dışındakileri null yap."""
        validated = []
        for rec in records:
            overall = rec.get("overall_score")
            if overall is not None and not (0.0 <= overall <= 10.0):
                logger.warning(f"OCR doğrulama: {rec['university_name']} overall={overall} geçersiz, atılıyor")
                continue
            validated.append(rec)
        return validated

    def validate(self, result: CollectorResult) -> bool:
        if not result.data:
            return False
        for rec in result.data:
            if not rec.get("university_name"):
                return False
            score = rec.get("overall_score")
            if score is not None and not (0.0 <= score <= 10.0):
                logger.error(f"Geçersiz overall_score: {score}")
                return False
        return True

    def normalize(self, result: CollectorResult) -> CollectorResult:
        """Year alanını doldur ve trace_id ata."""
        for rec in result.data:
            rec["year"] = self.year
            clean_uni = "".join(c for c in rec["university_name"] if c.isalnum()).upper()
            rec["trace_id"] = f"UNIAR_{self.year}_{clean_uni}"
            rec["source"] = self.SOURCE_NAME
            rec["source_url"] = self.SOURCE_URL
            rec["retrieved_at"] = datetime.now().isoformat()
            rec["parser_version"] = self.PARSER_VERSION
            rec["sha256"] = result.sha256
        return result


def _safe_float_strict(val) -> Optional[float]:
    """Yalnızca gerçek sayısal değerleri kabul eder. Makul aralıkta değilse None döner."""
    if val is None:
        return None
    try:
        s = str(val).replace(",", ".").strip()
        f = float(s)
        return f if 0.0 <= f <= 10.0 else None
    except (ValueError, TypeError):
        return None
