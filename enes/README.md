# Enes YKS Master Veritabanı ve Analiz Modülü

Bu dizin (`enes/`), 49 Lisans (4 Yıllık) ve 47 Önlisans (2 Yıllık / TYT) olmak üzere toplam **96 üniversite ve bölümün** son 5 yıllık YÖK Atlas verileriyle zenginleştirilmiş **birleşik master veritabanını** içerir.

---

## 📂 İçindekiler

| Dosya Adı | Açıklama |
| :--- | :--- |
| [yks_master_database.json](file:///Users/hasanemresezen/Desktop/cs/yks-analiz/enes/yks_master_database.json) | 96 bölümün son 5 yıllık sıralama ($Y_1 \dots Y_5$), kontenjan, puan ve regresyon tahmin skorlarını içeren ana JSON veritabanı. |
| [yks_master_database.csv](file:///Users/hasanemresezen/Desktop/cs/yks-analiz/enes/yks_master_database.csv) | Excel veya veri analiz araçları (Pandas, Excel, Google Sheets) için tek dosyada toplanmış CSV veritabanı. |
| [fetch_and_enrich.py](file:///Users/hasanemresezen/Desktop/cs/yks-analiz/enes/fetch_and_enrich.py) | YÖK Atlas API verilerini işleyen, 5 yıllık doğrusal regresyon ve kontenjan esnekliği skorlarını hesaplayan otomatik Python scripti. |

---

## 🗃️ Veri Şeması (JSON / CSV Kolonları)

Her bir bölüm kaydı aşağıdaki zenginleştirilmiş alanlara sahiptir:

- **`id`**: Benzersiz Kayıt Numarası
- **`degree`**: Program Derecesi (`Lisans (4 Yıllık)` / `Önlisans (2 Yıllık / TYT)`)
- **`score_type`**: Puan Türü (`SAY`, `TYT`, `EA`, `SÖZ`)
- **`full_name`**: Üniversite ve Bölüm Tam Adı
- **`university`**: Üniversite Adı
- **`department`**: Bölüm Adı
- **`city`**: Şehir
- **`location`**: Yerleşke / Kampüs Detayı
- **`history_rankings`**: Son 5 Yıl Taban Başarı Sıralaması Array `[2021, 2022, 2023, 2024, 2025]`
- **`history_quotas`**: Son 5 Yıl Kontenjan Array
- **`history_points`**: Son 5 Yıl Taban Puan Array
- **`prediction`**:
  - `tahmini_skor`: Regresyon ve kontenjan çarpanıyla hesaplanan $R_{\text{hedef}}$
  - `alt_sinir`: İyimser $\%10$ sapma sınırı
  - `ust_sinir`: Kötümser $\%10$ sapma sınırı
  - `egim`: Yakın geçmiş ağırlıklı ivme eğimi ($m$)
  - `trend_label`: Trend etiketi (Sürekli Yükselişte ⬆️, Yatay ➡️, Düşüşte ⬇️)
  - `is_plateau`: Doygunluk / Plato uyarı bayrağı (`true`/`false`)
- **`rating`**: Kişisel Puanım (1-10)
- **`notes`**: Detaylı Notlar, Artılar, Eksiler ve Sektör/Staj Fırsatları
