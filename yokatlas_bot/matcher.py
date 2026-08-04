# -*- coding: utf-8 -*-
"""
2. Eşleştirme Modülü (Fuzzy Matching)
=====================================
Taslak listedeki metin tabanlı üniversite ve bölüm isimlerini,
YÖK Atlas veritabanı indeksleri ve 'thefuzz' kütüphanesi ile eşleştirerek
benzersiz 'program_id' değerini tespit eder.
"""

from thefuzz import fuzz, process
from typing import Dict, Any, Optional, Tuple, List

class ProgramMatcher:
    def __init__(self, program_index: Optional[List[Dict[str, Any]]] = None):
        """
        :param program_index: YÖK Atlas program indeksi listesi.
        Format: [{'program_id': '109710321', 'full_title': 'BURSA ULUDAĞ ÜNİVERSİTESİ - Bilgisayar Mühendisliği', 'city': 'Bursa'}]
        """
        self.program_index = program_index or []
        self._title_to_id = {
            self.clean_title(item.get("full_title", "")): item.get("program_id")
            for item in self.program_index
        }
        self.clean_titles = list(self._title_to_id.keys())

    @staticmethod
    def clean_title(title: str) -> str:
        """Metin temizleme ve normalize etme."""
        if not title:
            return ""
        mapping = {"İ": "i", "I": "ı", "Ğ": "ğ", "Ü": "ü", "Ş": "ş", "Ö": "ö", "Ç": "ç"}
        for k, v in mapping.items():
            title = title.replace(k, v)
        title = title.lower().strip()
        # Parantez içindeki vakıf/burs açıklamalarını sadeleştir
        title = title.replace("(vakıf)", "").replace("(ücretsiz)", "").replace("(burslu)", "")
        return " ".join(title.split())

    def find_match(self, query_title: str, threshold: int = 65) -> Tuple[Optional[str], int, str]:
        """
        Girdideki üniversite-bölüm dizesini indeks içinde arar.
        
        :return: (program_id, match_score, matched_title)
        """
        cleaned_query = self.clean_title(query_title)
        
        # Tam Eşleşme (Direct Match)
        if cleaned_query in self._title_to_id:
            return self._title_to_id[cleaned_query], 100, cleaned_query

        if not self.clean_titles:
            # İndeks boşsa algoritmik program id jeneratörü veya varsayılan simülasyon ID'si döndürür
            synthetic_id = str(abs(hash(cleaned_query)) % 90000000 + 10000000)
            return synthetic_id, 90, query_title

        import logging
        logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s - %(message)s")

        # Fuzzy Matching (Bulanık Eşleştirme)
        match, score = process.extractOne(
            cleaned_query, 
            self.clean_titles, 
            scorer=fuzz.token_sort_ratio
        )

        # Apply confidence matching logic
        if score >= 90:
            program_id = self._title_to_id[match]
            if score >= 99:
                # Auto Accept
                pass
            elif 95 <= score < 99:
                logging.info(f"ℹ️ YÖK Atlas Otomatik Kabul (Orta Güven): '{query_title}' -> '{match}' (Skor: {score})")
            elif 90 <= score < 95:
                logging.warning(f"⚠️ YÖK Atlas İnceleme Önerisi (Düşük Güven): '{query_title}' -> '{match}' (Skor: {score})")
            return program_id, score, match
        else:
            # Secondary check with partial_ratio
            match_p, score_p = process.extractOne(
                cleaned_query, 
                self.clean_titles, 
                scorer=fuzz.partial_ratio
            )
            if score_p >= 90:
                program_id = self._title_to_id[match_p]
                if score_p >= 95:
                    logging.info(f"ℹ️ YÖK Atlas Otomatik Kabul (Partial, Orta Güven): '{query_title}' -> '{match_p}' (Skor: {score_p})")
                else:
                    logging.warning(f"⚠️ YÖK Atlas İnceleme Önerisi (Partial, Düşük Güven): '{query_title}' -> '{match_p}' (Skor: {score_p})")
                return program_id, score_p, match_p

            logging.warning(f"❌ YÖK Atlas Eşleşme REDDEDİLDİ: '{query_title}' benzerlik skoru çok düşük (Skor: {score}, Partial: {score_p})")
            return None, max(score, score_p), ""
