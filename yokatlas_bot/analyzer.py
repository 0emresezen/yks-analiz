# -*- coding: utf-8 -*-
"""
5. Veri İşleme ve Trend Analizi (Analyzer)
=========================================
Çekilen son 4-5 yıllık sıralama verisinden trend analizi yapar (Yükselişte, Düşüşte, Dalgalı).
Regresyon ve kontenjan esnekliği formülleriyle tahmini başarı sırası ve güven aralığı hesaplar.
"""

from typing import List, Dict, Any, Tuple
import math

class TrendAnalyzer:
    @staticmethod
    def calculate_trend(rankings: List[int]) -> Tuple[str, float]:
        """
        Sıralama listesinden ($Y_1 \dots Y_5$) trend yönü ve ortalama değişim eğimini hesaplar.
        Sıralama sayısının küçülmesi (ör: 50.000 -> 30.000) TALEBİN YÜKSELMESİ anlamına gelir!
        """
        if not rankings or len(rankings) < 2:
            return "Yatay ➡️", 0.0

        # En son yıl ($Y_5$) ile önceki yılları kıyasla
        diffs = [rankings[i] - rankings[i-1] for i in range(1, len(rankings))]
        avg_diff = sum(diffs) / len(diffs)

        # Regresyon eğimi (Son 5 yıl yakın geçmiş ağırlıklı)
        if len(rankings) == 5:
            y1, y2, y3, y4, y5 = rankings
            m = ((2 * y5) + y4 - y2 - (2 * y1)) / 10.0
        else:
            m = avg_diff

        # Trend Yönü Belirleme (m < 0 => Sıralama öne çekiyor => Yükseliş)
        if m < -1500:
            trend_str = "Sürekli Yükselişte ⬆️"
        elif m > 1500:
            trend_str = "Düşüşte ⬇️"
        elif abs(m) <= 500:
            trend_str = "Yatay / İstikrarlı ➡️"
        else:
            trend_str = "Hafif Yükseliş ↗️" if m < 0 else "Hafif Düşüş ↘️"

        return trend_str, round(m, 2)

    @staticmethod
    def predict_future_rank(rankings: List[int], old_quota: int = 60, new_quota: int = 60) -> Dict[str, Any]:
        """
        En Küçük Kareler Regresyonu ve Kontenjan Esneklik Çarpanı Formülü.
        """
        if len(rankings) < 5:
            # Eksik yılları tamamla
            last = rankings[-1] if rankings else 50000
            rankings = [last + (5 - len(rankings) + i) * 3000 for i in range(5 - len(rankings))] + rankings

        y1, y2, y3, y4, y5 = rankings[-5:]
        y_ort = sum([y1, y2, y3, y4, y5]) / 5.0
        egim = ((2 * y5) + y4 - y2 - (2 * y1)) / 10.0

        # Baz Trend
        trend = y_ort + (3 * egim)

        # Esneklik Katsayısı (E)
        if y5 <= 20000:
            e = 0.1
        elif y5 <= 50000:
            e = 0.3
        elif y5 <= 100000:
            e = 0.5
        else:
            e = 0.8

        # Kontenjan Çarpanı
        q_change = (new_quota - old_quota) / old_quota if old_quota > 0 else 0.0
        k_carpan = 1.0 + (e * q_change)

        raw_result = trend * k_carpan

        # Plato Kontrolü
        is_plateau = False
        if raw_result <= 0:
            is_plateau = True
            tahmin = int(round(y5 * 0.85))
        else:
            tahmin = int(round(raw_result))

        alt_sinir = int(round(tahmin * 0.9))
        ust_sinir = int(round(tahmin * 1.1))

        from datetime import datetime
        return {
            "actual_rank": y5,
            "predicted_rank": tahmin,
            "prediction_model": "linear_regression_elastic_quota",
            "confidence": "high" if len(rankings) >= 5 else "medium",
            "prediction_generated_at": datetime.now().isoformat(),
            "tahmini_skor": tahmin,
            "alt_sinir": alt_sinir,
            "ust_sinir": ust_sinir,
            "egim": round(egim, 2),
            "k_carpan": round(k_carpan, 4),
            "is_plateau": is_plateau,
            "last_rank": y5
        }
