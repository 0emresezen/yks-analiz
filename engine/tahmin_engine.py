#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
YKS Sıralama ve Tercih Tahmin Motoru (Engine Module)
===================================================
Bu modül, 5 yıllık taban sıralama zaman serisi verileri ve kontenjan değişimleri
üzerinden En Küçük Kareler Regresyonu (Ordinary Least Squares) ve Kontenjan
Esnekliği (Quota Elasticity) modellerini kullanarak tahmini YKS başarı sırasını hesaplar.
"""

from typing import List, Dict, Union

def yks_siralama_tahmin(
    yillar_listesi: List[Union[int, float]], 
    eski_kontenjan: int, 
    yeni_kontenjan: int
) -> Dict[str, Union[int, float, str]]:
    """
    YKS 5 yıllık taban sıralama ve kontenjan değişimine göre gelecekteki sıralamayı tahmin eder.
    
    :param yillar_listesi: [Yıl_1, Yıl_2, Yıl_3, Yıl_4, Yıl_5 (Geçen Yıl)]
    :param eski_kontenjan: Geçen yılki kontenjan
    :param yeni_kontenjan: Bu yıl açıklanan kılavuz kontenjanı
    :return: Tahmin sonuçlarını içeren sözlük
    """
    if len(yillar_listesi) != 5:
        raise ValueError("yillar_listesi tam olarak 5 yıllık veri içermelidir (eskiden yeniye).")

    y1, y2, y3, y4, y5 = yillar_listesi

    # 1. Aritmetik Ortalama ve Regresyon Eğimi (İvme)
    y_ort = sum(yillar_listesi) / 5.0
    egim = ((2 * y5) + y4 - y2 - (2 * y1)) / 10.0

    # 2. Baz Trend
    trend = y_ort + (3 * egim)

    # 3. Kontenjan Esneklik Katsayısı (E)
    if y5 <= 20000:
        e = 0.1
    elif y5 <= 50000:
        e = 0.3
    elif y5 <= 100000:
        e = 0.5
    else:
        e = 0.8

    # 4. Kontenjan Çarpanı
    k_degisim = (yeni_kontenjan - eski_kontenjan) / eski_kontenjan if eski_kontenjan > 0 else 0
    k_carpan = 1.0 + (e * k_degisim)

    # 5. Nihai Tahmin
    sonuc = trend * k_carpan

    # Plato ve Anomali Kontrolü
    if sonuc <= 0:
        return {
            "Durum": "Hata / Plato Etkisi",
            "Mesaj": "Formül sıfırın altında bir değer üretti. Bölüm doygunluğa ulaştığı için manuel değerlendirme gerekir.",
            "Eğim": round(egim, 2)
        }

    tahmini_sira = int(round(sonuc))
    alt_sinir = int(round(sonuc * 0.9))   # İyimser (%10 öne çekme)
    ust_sinir = int(round(sonuc * 1.1))   # Kötümser (%10 gerileme)

    return {
        "Tahmini Sıralama": tahmini_sira,
        "Alt Sınır (İyimser - %10)": alt_sinir,
        "Üst Sınır (Kötümser + %10)": ust_sinir,
        "Eğim (İvme)": round(egim, 2),
        "Kontenjan Çarpanı": round(k_carpan, 4),
        "Geçen Yılki Sıralama": y5
    }

if __name__ == "__main__":
    print("=== YKS Sıralama Tahmin Motoru ===")
    ornek = yks_siralama_tahmin([50000, 46000, 41000, 36000, 32000], 60, 66)
    print("Örnek Hesaplama (50k -> 32k, Kontenjan 60 -> 66):")
    for k, v in ornek.items():
        print(f"  {k}: {v}")
