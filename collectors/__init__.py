# -*- coding: utf-8 -*-
"""
Collector Base — Kanıta Dayalı Veri Toplama Altyapısı
=====================================================
Her collector bu sınıftan türetilir. Hiçbir collector veri üretmez veya tahmin etmez.
Kaynak bulunamıyorsa ilgili alan null bırakılır ve "resmî veri bulunamadı" olarak işaretlenir.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, asdict, field
from datetime import datetime
from typing import Any, Dict, List, Optional
import hashlib
import json
import os
import logging

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s - %(message)s")


def compute_sha256(data: Any) -> str:
    """JSON-serileştirilebilir veriyi SHA256 ile hash'ler."""
    serialized = json.dumps(data, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return hashlib.sha256(serialized).hexdigest()


def compute_file_sha256(filepath: str) -> str:
    """Bir dosyanın SHA256 özetini hesaplar."""
    if not os.path.exists(filepath):
        return ""
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


@dataclass
class CollectorResult:
    """Collector'ın ürettiği standart veri paketi."""
    # Veri
    data: Any = None

    # Traceability
    source_name: str = ""
    source_url: str = ""
    endpoint: str = ""
    request_body: Optional[Dict] = None
    response_status: Optional[int] = None
    response_headers: Optional[Dict] = None
    retrieved_at: str = field(default_factory=lambda: datetime.now().isoformat())
    sha256: str = ""
    trace_id: str = ""
    parser_version: str = "3.0.0"
    publication_year: Optional[int] = None

    # Doğrulama
    validated: bool = False
    validator_version: str = "2.0.0"
    data_available: bool = True
    data_note: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def compute_hash(self):
        """data alanından SHA256 hesaplar."""
        if self.data is not None:
            self.sha256 = compute_sha256(self.data)
        return self

    def mark_unavailable(self, note: str = "Bu alan için doğrulanmış resmî veri bulunamadı."):
        """Veri bulunamadığında alanı işaretler."""
        self.data = None
        self.data_available = False
        self.data_note = note
        return self


class BaseCollector(ABC):
    """
    Tüm collector'ların uyması gereken temel arayüz.
    Hiçbir alt sınıf veri tahmini veya sentetik veri üretemez.
    """

    SOURCE_NAME: str = "Bilinmeyen Kaynak"
    SOURCE_URL: str = ""
    PARSER_VERSION: str = "3.0.0"

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)

    @abstractmethod
    def fetch(self, *args, **kwargs) -> CollectorResult:
        """Kaynaktan ham veri çeker. Başarısızsa mark_unavailable() çağırır."""
        pass

    @abstractmethod
    def validate(self, result: CollectorResult) -> bool:
        """Çekilen veriyi doğrular. False dönerse veri kabul edilmez."""
        pass

    @abstractmethod
    def normalize(self, result: CollectorResult) -> CollectorResult:
        """Veriyi standart şemaya normalize eder."""
        pass

    def save_raw(self, result: CollectorResult, path: str):
        """Ham veriyi metadata ile birlikte saklar."""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        package = {
            "_meta": {
                "source_name": result.source_name,
                "source_url": result.source_url,
                "endpoint": result.endpoint,
                "request_body": result.request_body,
                "response_status": result.response_status,
                "response_headers": result.response_headers,
                "retrieved_at": result.retrieved_at,
                "sha256": result.sha256,
                "trace_id": result.trace_id,
                "parser_version": result.parser_version,
                "data_available": result.data_available,
                "data_note": result.data_note,
            },
            "data": result.data
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(package, f, ensure_ascii=False, indent=2)
        self.logger.info(f"Raw kaydedildi: {path}")

    def save_processed(self, data: Any, path: str):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if path.endswith(".parquet"):
            self._save_parquet(data, path)
        else:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        self.logger.info(f"Processed kaydedildi: {path}")

    def save_validated(self, data: Any, path: str):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if path.endswith(".parquet"):
            self._save_parquet(data, path)
        else:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        self.logger.info(f"Validated kaydedildi: {path}")

    @staticmethod
    def _save_parquet(data: Any, path: str):
        import pandas as pd
        if isinstance(data, list):
            df = pd.DataFrame(data)
        elif isinstance(data, dict):
            df = pd.DataFrame([data])
        else:
            raise ValueError(f"Parquet için desteklenmeyen veri tipi: {type(data)}")
        df.to_parquet(path, index=False)

    def run(self, *args, **kwargs) -> Optional[CollectorResult]:
        """
        fetch → validate → normalize → save_raw pipeline.
        Herhangi bir adım başarısız olursa None döner.
        """
        result = self.fetch(*args, **kwargs)
        result.compute_hash()

        if not result.data_available:
            return result  # Veri yok ama hata değil

        if not self.validate(result):
            result.mark_unavailable("Doğrulama başarısız: veri kabul edilmedi.")
            return result

        result = self.normalize(result)
        result.validated = True
        return result
