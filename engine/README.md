# YKS Analiz Engine Modülü

Bu dizin (`engine/`), YKS (Yükseköğretim Kurumları Sınavı) tercih sürecinde kullanılmak üzere hazırlanan veri odaklı analiz tablolarını, tercih listelerini ve gelişmiş sıralama tahmin modellerini içerir.

---

## 📂 İçindekiler

| Dosya Adı | Açıklama |
| :--- | :--- |
| [lisans_tercih_analizi.md](file:///Users/hasanemresezen/Desktop/cs/yks-analiz/engine/lisans_tercih_analizi.md) | 4 Yıllık Lisans programlarının (Bilgisayar Müh., Yazılım Müh., Bilişim Sistemleri, BÖTE, Yapay Zeka vb.) 49 maddelik analiz tablosu ve stratejik notları. |
| [onlisans_tercih_analizi.md](file:///Users/hasanemresezen/Desktop/cs/yks-analiz/engine/onlisans_tercih_analizi.md) | 2 Yıllık Önlisans programlarının (Bilgisayar Programcılığı, Siber Güvenlik, Oyun Geliştirme, Sağlık Programları vb.) 47 maddelik analiz tablosu ve kampüs notları. |
| [siralama_tahmin_metodolojisi.md](file:///Users/hasanemresezen/Desktop/cs/yks-analiz/engine/siralama_tahmin_metodolojisi.md) | 5 yıllık zaman serisi regresyonu, kontenjan esnekliği formülleri, Excel tek-hücre formülü, Python fonksiyonu ve veri yorumlama kılavuzu. |

---

## 📊 Tablo Format Standardı

Analiz dosyalarındaki tüm tercih tabloları aşağıdaki standart kolon yapısına sahiptir:

| Kolon | Açıklama |
| :--- | :--- |
| **Veritabanı** | Üniversite ve bölümün benzersiz kayıt numarası (ID) |
| **Üniversite & Bölüm Adı** | Tercih edilecek yükseköğretim kurumu ve program ismi |
| **Şehir** | Bölümün yer aldığı şehir / lokasyon |
| **Kontenjan / Konum** | Genel/Özel kontenjan bilgisi ve yerleşleşke (Ana Kampüs / Meslek Yüksekokulu vb.) |
| **Geçen Yılki Sıralama** | Bir önceki senenin taban başarı sırası ($Y_5$) |
| **Kişisel Puanım (1-10)** | Adayın kişisel hedef ve istek derecesi |
| **Notlar / Artılar - Eksiler** | Şehir, akademisyen kadrosu, barınma, sektör imkanları ve DGS/yüksek lisans avantajları |
| **Sıralama Trendi** | Son 5 yıllık ivme yönü (Yükseliş ⬆️, Yatay ➡️, Düşüş ⬇️) |
| **Tahmini Skor** | Matematiksel regresyon ve kontenjan esnekliği modeliyle hesaplanan beklenen başarı sırası |

---

## 🧮 Tahmin Motoru Hızlı Özet

Sıralama tahminleri **En Küçük Kareler Regresyonu** ve **Kontenjan Esneklik Çarpanı** temel alınarak hesaplanır:

$$R_{\text{hedef}} = R_{\text{trend}} \times K_{\text{çarpan}}$$

Detaylı matematiksel altyapı, Excel formülleri ve Python kodları için [siralama_tahmin_metodolojisi.md](file:///Users/hasanemresezen/Desktop/cs/yks-analiz/engine/siralama_tahmin_metodolojisi.md) dosyasını inceleyebilirsiniz.
