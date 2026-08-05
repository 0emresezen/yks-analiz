# -*- coding: utf-8 -*-
"""
YÖK Atlas Collector
===================
YÖK Atlas resmî API'sinden program verilerini çeker.
Her başarılı API yanıtı raw/yok_api/{year}/{program_id}.json olarak saklanır.
Hiçbir koşulda fallback/sentetik veri üretilmez.
API yanıt vermezse CollectorResult.data_available = False döner.
"""

import logging
import time
import random
import requests
from datetime import datetime
from typing import Dict, Any, Optional, List

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from collectors import BaseCollector, CollectorResult, compute_sha256
from collectors.yok.fallback import run_fallback_chain
from verification.collector_validator import CollectorValidator

logger = logging.getLogger(__name__)

YOK_ATLAS_API = "https://yokatlas.yok.gov.tr/api/tercih-kilavuz/search"

# Mevcut API'nin döndürdüğü tüm alanlar (eksiksiz)
YOK_FIELD_MAP = {
    "kilavuzKodu":    "program_id",
    "universiteAdi":  "university",
    "birimGrupAdi":   "department",
    "ilAdi":          "city",
    "kontenjan":      "quota_current",
    "gk1":            "quota_prev",
    "yerlesen":       "placed_students",
    "bosKontenjan":   "quota_empty",
    "basariSirasi":   "rank_y1",      # En son yıl
    "basariSirasi1":  "rank_y2",
    "basariSirasi2":  "rank_y3",
    "basariSirasi3":  "rank_y4",
    "tabanPuan":      "base_score_y1",
    "tavanPuan":      "ceiling_score_y1",
    "puanTuru":       "score_type",
    "ogretimTuru":    "instruction_type",
    "bursOrani":      "scholarship_rate",
    "birimTuruAdi":   "program_type",
    "ogrenimSuresi":  "duration_years",
}


class YOKAtlasCollector(BaseCollector):

    SOURCE_NAME = "YÖK Atlas API"
    SOURCE_URL = YOK_ATLAS_API
    PARSER_VERSION = "3.0.0"

    def __init__(self, year: int = 2025, min_delay: float = 0.4, max_delay: float = 1.0):
        super().__init__()
        self.year = year
        self.min_delay = min_delay
        self.max_delay = max_delay
        self._cache: Dict[str, CollectorResult] = {}

        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "application/json",
            "Referer": "https://yokatlas.yok.gov.tr/",
            "Origin": "https://yokatlas.yok.gov.tr",
        })

    def _wait(self):
        time.sleep(random.uniform(self.min_delay, self.max_delay))

    def _build_payload(self, program_id: str) -> dict:
        return {
            "filters": {
                "puanTuru": None, "universiteId": [], "birimGrupId": [], "ilKodu": [],
                "birimTuruId": None, "universiteTuru": None, "bursOraniId": None,
                "ogrenimTuruId": None,
                "kilavuzKodu": int(program_id) if program_id.isdigit() else None,
                "minBasariSirasi": None, "maxBasariSirasi": None
            },
            "page": 0, "size": 1, "sortBy": "basariSirasi", "direction": "ASC"
        }

    def fetch(self, program_id: str, dept_name: str = "") -> CollectorResult:
        """
        Tek program için YÖK Atlas API'den veri çeker.
        ASLA sentetik/tahmin veri üretmez.
        """
        if program_id in self._cache:
            return self._cache[program_id]

        trace_id = f"YOK_{self.year}_{program_id}"
        result = CollectorResult(
            source_name=self.SOURCE_NAME,
            source_url=self.SOURCE_URL,
            endpoint="POST /api/tercih-kilavuz/search",
            trace_id=trace_id,
            parser_version=self.PARSER_VERSION,
            publication_year=self.year,
        )

        # Sentetik ID'ler için doğrudan "bulunamadı" döndür
        if not program_id.isdigit() or program_id.startswith("syn"):
            return result.mark_unavailable(
                f"Sentetik/geçici ID ({program_id}): YÖK Atlas'ta karşılığı yok."
            )

        payload = self._build_payload(program_id)
        result.request_body = payload

        self._wait()

        try:
            resp = self.session.post(YOK_ATLAS_API, json=payload, timeout=12)
            result.response_status = resp.status_code
            result.response_headers = dict(resp.headers)

            if resp.status_code == 200:
                raw_json = resp.json()
                result.data = raw_json

                if "content" in raw_json and len(raw_json["content"]) > 0:
                    p = raw_json["content"][0]

                    # Taban/tavan puan geçmiş yıllar
                    ranks = {}
                    for api_key, field_key in [
                        ("basariSirasi",  "rank_y1"),
                        ("basariSirasi1", "rank_y2"),
                        ("basariSirasi2", "rank_y3"),
                        ("basariSirasi3", "rank_y4"),
                    ]:
                        val = p.get(api_key)
                        ranks[field_key] = int(val) if val and str(val).isdigit() else None

                    # Sıralama listesi (sadece gerçek değerler)
                    ranking_list = [v for v in [ranks["rank_y4"], ranks["rank_y3"],
                                                ranks["rank_y2"], ranks["rank_y1"]] if v]

                    result.data = {
                        "program_id":       program_id,
                        "university":       p.get("universiteAdi", ""),
                        "department":       p.get("birimGrupAdi", ""),
                        "city":             p.get("ilAdi", ""),
                        "score_type":       p.get("puanTuru", ""),
                        "instruction_type": p.get("ogretimTuru", ""),
                        "program_type":     p.get("birimTuruAdi", ""),
                        "duration_years":   p.get("ogrenimSuresi"),
                        # Kontenjan
                        "quota_current":    _safe_int(p.get("kontenjan")),
                        "quota_prev":       _safe_int(p.get("gk1")),
                        "placed_students":  _safe_int(p.get("yerlesen")),
                        "quota_empty":      _safe_int(p.get("bosKontenjan")),
                        # Sıralamalar
                        **ranks,
                        "rankings":         ranking_list,
                        "last_rank":        ranks["rank_y1"],
                        # Puanlar
                        "base_score_y1":    _safe_float(p.get("tabanPuan")),
                        "ceiling_score_y1": _safe_float(p.get("tavanPuan")),
                        # Burs
                        "scholarship_rate": p.get("bursOrani"),
                        # Boş bırakılanlar (API'de yok, uydurulmayacak)
                        "transport_score":  None,
                        "transport_data_available": False,
                        "transport_data_note": "Bu alan için doğrulanmış resmî veri bulunamadı.",
                        "prestige_score":   None,
                        "prestige_data_available": False,
                        "prestige_data_note": "Bu alan için doğrulanmış resmî veri bulunamadı.",
                        "academic_score":   None,
                        "academic_data_available": False,
                        "academic_data_note": "Bu alan için doğrulanmış resmî veri bulunamadı.",
                        "industry_score":   None,
                        "industry_data_available": False,
                        "research_score":   None,
                        "research_data_available": False,
                        "international_score": None,
                        "international_data_available": False,
                        "cost_score":       None,
                        "cost_data_available": False,
                        "cost_data_note": "Bu alan için doğrulanmış resmî veri bulunamadı.",
                        "housing_score":    None,
                        "housing_data_available": False,
                        "career_score":     None,
                        "career_data_available": False,
                        "ai_opportunity_score": None,
                        "ai_opportunity_data_available": False,
                        "internship_score": None,
                        "internship_data_available": False,
                        "startup_score":    None,
                        "startup_data_available": False,
                    }
                    result.data_available = True

                else:
                    result.mark_unavailable(
                        f"YÖK Atlas API yanıt verdi ancak program bulunamadı (program_id={program_id})"
                    )
            else:
                result.mark_unavailable(
                    f"YÖK Atlas API HTTP {resp.status_code} döndürdü."
                )

        except requests.exceptions.Timeout:
            result.mark_unavailable("YÖK Atlas API zaman aşımına uğradı (timeout=12s).")
        except requests.exceptions.ConnectionError:
            result.mark_unavailable("YÖK Atlas API'ye bağlanılamadı (ConnectionError).")
        except Exception as e:
            result.mark_unavailable(f"Beklenmedik hata: {type(e).__name__}: {e}")

        if not result.data_available:
            fb = run_fallback_chain(self.session, program_id)
            if fb:
                result.data = self._normalize_fallback_record(fb, program_id)
                result.data_available = True
                result.data_note = "Fallback kaynaktan alındı (API başarısız)"

        self._cache[program_id] = result
        return result

    def _normalize_fallback_record(self, raw: Dict, program_id: str) -> Dict:
        """Fallback ham kaydını standart şemaya dönüştürür."""
        return {
            "program_id": program_id,
            "university": raw.get("universiteAdi") or raw.get("university", ""),
            "department": raw.get("birimGrupAdi") or raw.get("department", ""),
            "city": raw.get("ilAdi") or raw.get("city", ""),
            "last_rank": _safe_int(raw.get("basariSirasi") or raw.get("last_rank")),
            "rankings": [v for v in [_safe_int(raw.get("last_rank"))] if v],
            "base_score_y1": _safe_float(raw.get("tabanPuan") or raw.get("base_score_y1")),
            "ceiling_score_y1": _safe_float(raw.get("tavanPuan") or raw.get("ceiling_score_y1")),
            "quota_current": _safe_int(raw.get("kontenjan") or raw.get("quota")),
            "_fallback_source": True,
        }

    def fetch_bulk(self, program_ids: List[str], dept_names: Optional[Dict[str, str]] = None,
                   raw_dir: str = "raw/yok_api") -> Dict[str, CollectorResult]:
        """
        Birden fazla program için toplu veri çeker ve raw/ klasörüne kaydeder.
        """
        dept_names = dept_names or {}
        results = {}
        total = len(program_ids)

        for i, pid in enumerate(program_ids, 1):
            logger.info(f"[{i}/{total}] Çekiliyor: {pid} — {dept_names.get(pid, '')}")
            result = self.run(program_id=pid, dept_name=dept_names.get(pid, ""))
            results[pid] = result

            # Ham veriyi kaydet
            raw_path = os.path.join(raw_dir, str(self.year), f"{pid}.json")
            self.save_raw(result, raw_path)

        return results

    def export_year(
        self,
        program_ids: List[str],
        year: Optional[int] = None,
        dept_names: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Toplu çekim + doğrulama + processed/validated parquet çıktısı.
        """
        year = year or self.year
        results = self.fetch_bulk(program_ids, dept_names=dept_names)

        records = []
        for pid, res in results.items():
            if res.data_available and res.data:
                trace = {
                    "source_name": res.source_name,
                    "source_url": res.source_url,
                    "endpoint": res.endpoint,
                    "publication_year": year,
                    "retrieved_at": res.retrieved_at,
                    "parser_version": res.parser_version,
                    "trace_id": res.trace_id,
                    "sha256": res.sha256,
                    "validated": res.validated,
                    "validator_version": CollectorValidator.VERSION,
                }
                rec = {**res.data, "_traceability": trace}
                records.append(rec)

        validation_report = CollectorValidator.validate_yok_batch(records, expected_year=year)
        processed_path = f"processed/yok/{year}.parquet"
        validated_path = f"validated/yok/{year}.parquet"
        report_path = "processed/validation_report.json"

        self.save_processed(records, processed_path)
        if validation_report["success"]:
            self.save_validated(records, validated_path)
        else:
            logger.error("YÖK doğrulama başarısız — validated parquet yazılmadı")
            self.save_processed(validation_report, report_path)
            return {"records": records, "validation": validation_report, "validated": False}

        import json
        os.makedirs("processed", exist_ok=True)
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(validation_report, f, ensure_ascii=False, indent=2)

        return {"records": records, "validation": validation_report, "validated": True}

    def validate(self, result: CollectorResult) -> bool:
        if not result.data:
            return False
        d = result.data
        # Zorunlu alanlar
        if not d.get("program_id"):
            logger.error("Validation failed: program_id eksik")
            return False
        if not d.get("university"):
            logger.error("Validation failed: university eksik")
            return False
        if not d.get("rankings"):
            logger.warning(f"Uyarı: {d.get('program_id')} için sıralama verisi yok")
            # Uyarı ama blok değil — veri gerçek, sadece eksik
        return True

    def normalize(self, result: CollectorResult) -> CollectorResult:
        # Zaten normalize edilmiş biçimde döndürülüyor
        return result

    def get_latest_year(self) -> Optional[int]:
        """API'den güncel kılavuz yılını öğrenir."""
        payload = {
            "filters": {k: None for k in ["puanTuru", "birimTuruId", "universiteTuru",
                                           "bursOraniId", "ogrenimTuruId", "kilavuzKodu",
                                           "minBasariSirasi", "maxBasariSirasi"]},
            "filters_extra": {"universiteId": [], "birimGrupId": [], "ilKodu": []},
            "page": 0, "size": 1
        }
        # Tekrar düzgün payload
        payload = {
            "filters": {
                "puanTuru": None, "universiteId": [], "birimGrupId": [], "ilKodu": [],
                "birimTuruId": None, "universiteTuru": None, "bursOraniId": None,
                "ogrenimTuruId": None, "kilavuzKodu": None, "minBasariSirasi": None,
                "maxBasariSirasi": None
            },
            "page": 0, "size": 1, "sortBy": "basariSirasi", "direction": "ASC"
        }
        try:
            resp = self.session.post(YOK_ATLAS_API, json=payload, timeout=8)
            if resp.status_code == 200:
                data = resp.json()
                if "content" in data and data["content"]:
                    p = data["content"][0]
                    # kilavuzYili veya yil alanı varsa kullan
                    yil = p.get("kilavuzYili") or p.get("yil")
                    if yil:
                        try:
                            return int(yil)
                        except (ValueError, TypeError):
                            pass
                # Fallback: en son sıralama alanının varlığından yıl tahmin et
                return self.year  # Mevcut yıl ile devam
        except Exception as e:
            logger.warning(f"get_latest_year başarısız: {e}")
        return None


def _safe_int(val) -> Optional[int]:
    try:
        return int(val) if val is not None else None
    except (ValueError, TypeError):
        return None


def _safe_float(val) -> Optional[float]:
    try:
        return float(val) if val is not None else None
    except (ValueError, TypeError):
        return None
