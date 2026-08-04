# YKS Sıralama Tahmin Metodolojisi ve Veri Analiz Rehberi

Bu doküman, YKS tercih döneminde bölümlerin gelecekteki taban başarı sıralamalarını ($R_{\text{hedef}}$) tahmin etmek amacıyla kullanılan **En Küçük Kareler Yöntemi (Doğrusal Regresyon)** ve **Kontenjan Esnekliği Modeli**nin matematiksel altyapısını, Excel/Python uygulama kodlarını ve sonuçları doğru okumak için gerekli analitik filtreleri açıklar.

---

## 📐 1. Matematiksel Model ve Formüller

Bölümlerin son 5 yıldaki başarı sıralamaları chronolojik sırayla $Y_1, Y_2, Y_3, Y_4, Y_5$ olsun ($Y_5$ en son açıklanan geçen yılın sıralamasıdır).

### Adım 1: Aritmetik Ortalama ($\bar{Y}$)
$$\bar{Y} = \frac{Y_1 + Y_2 + Y_3 + Y_4 + Y_5}{5}$$

### Adım 2: Organik Trend Eğiminin ($m$) Hesaplanması
Son yıllardaki değişim hızına daha yüksek ağırlık veren doğrusal regresyon eğim formülü:
$$m = \frac{2Y_5 + Y_4 - Y_2 - 2Y_1}{10}$$

* **Eğer $m < 0$ ise:** Bölüm öne çekiyordur (sıralama sayısı küçülüyor, talep artıyor).
* **Eğer $m > 0$ ise:** Bölüm geriliyordur (sıralama sayısı büyüyor, talep düşüyor).

### Adım 3: Baz Trend ($R_{\text{trend}}$)
Kontenjan sabit kalsaydı bölümün organik ivmeyle geleceği tahmini nokta:
$$R_{\text{trend}} = \bar{Y} + 3m$$

### Adım 4: Kontenjan Esneklik Katsayısı ($E$)
Öğrenci tercih davranışı, başarı sırası üst kademelere yükseldikçe kontenjan değişimine daha az duyarlı hale gelir (katılaşır). Geçen yılki sıralamaya ($Y_5$) göre belirlenen esneklik katsayısı tablosu:

| Geçen Yılki Sıralama ($Y_5$) | Esneklik Katsayısı ($E$) | Esneklik Seviyesi |
| :--- | :---: | :--- |
| **0 - 20.000 arası** | `0.1` | Çok Katı (Sert) |
| **20.001 - 50.000 arası** | `0.3` | Orta Katı |
| **50.001 - 100.000 arası** | `0.5` | Esnek |
| **100.001 ve üstü** | `0.8` | Çok Esnek |

### Adım 5: Kontenjan Çarpanı ($K_{\text{çarpan}}$)
Geçen yılki kontenjan $K_{\text{eski}}$, bu yıl açıklanan kontenjan $K_{\text{yeni}}$ olmak üzere:
$$K_{\text{çarpan}} = 1 + \left( E \cdot \frac{K_{\text{yeni}} - K_{\text{eski}}}{K_{\text{eski}}} \right)$$

### Adım 6: Nihai Tahmini Sıralama ($R_{\text{hedef}}$)
$$R_{\text{hedef}} = R_{\text{trend}} \cdot K_{\text{çarpan}}$$

---

## 📊 2. Excel Tek Hücre Formülü

Aşağıdaki verileri Excel tablonuzun 2. satırına yerleştirdikten sonra formülü yapıştırabilirsiniz:

| Hücre | Veri Tanımı | Örnek Veri |
| :---: | :--- | :---: |
| `A2` | 5 Yıl Önceki Sıralama ($Y_1$) | 50000 |
| `B2` | 4 Yıl Önceki Sıralama ($Y_2$) | 46000 |
| `C2` | 3 Yıl Önceki Sıralama ($Y_3$) | 41000 |
| `D2` | 2 Yıl Önceki Sıralama ($Y_4$) | 36000 |
| `E2` | Geçen Yılın Sıralaması ($Y_5$) | 32000 |
| `F2` | Geçen Yılki Kontenjan ($K_{\text{eski}}$) | 60 |
| `G2` | Bu Yılki Kontenjan ($K_{\text{yeni}}$) | 66 |

### 🇹🇷 Türkçe Excel Formülü:
```excel
=YUVARLA((ORTALAMA(A2:E2) + 3 * (((2*E2) + D2 - B2 - (2*A2)) / 10)) * (1 + (EĞER(E2<=20000; 0,1; EĞER(E2<=50000; 0,3; EĞER(E2<=100000; 0,5; 0,8))) * ((G2-F2)/F2))); 0)
```

### 🇬🇧 İngilizce Excel Formülü:
```excel
=ROUND((AVERAGE(A2:E2) + 3 * (((2*E2) + D2 - B2 - (2*A2)) / 10)) * (1 + (IF(E2<=20000, 0.1, IF(E2<=50000, 0.3, IF(E2<=100000, 0.5, 0.8))) * ((G2-F2)/F2))), 0)
```

---

## 🐍 3. Python Hesaplama Kütüphanesi

```python
def yks_siralama_tahmin(yillar_listesi: list, eski_kontenjan: int, yeni_kontenjan: int) -> dict:
    """
    YKS 5 yıllık taban sıralama ve kontenjan değişimine göre gelecekteki sıralamayı tahmin eder.
    
    :param yillar_listesi: [Yıl_1, Yıl_2, Yıl_3, Yıl_4, Yıl_5 (Geçen Yıl)] (Eskiden yeniye kronolojik)
    :param eski_kontenjan: Geçen yılki kontenjan
    :param yeni_kontenjan: Bu yıl açıklanan kılavuz kontenjanı
    :return: Tahmin sözlüğü (Nokta Tahmin, Alt Sınır, Üst Sınır)
    """
    if len(yillar_listesi) != 5:
        raise ValueError("Yıllar listesi tam olarak 5 eleman içermelidir.")
        
    y1, y2, y3, y4, y5 = yillar_listesi
    
    # 1. Aritmetik Ortalama ve Yakın Geçmiş Ağırlıklı Eğim (İvme)
    y_ort = sum(yillar_listesi) / 5.0
    egim = ((2 * y5) + y4 - y2 - (2 * y1)) / 10.0
    
    # 2. Baz Trend (Kontenjan Sabitken)
    trend = y_ort + (3 * egim)
    
    # 3. Sıralama Bandına Göre Esneklik Katsayısı
    if y5 <= 20000:
        e = 0.1
    elif y5 <= 50000:
        e = 0.3
    elif y5 <= 100000:
        e = 0.5
    else:
        e = 0.8
        
    # 4. Kontenjan Çarpanı
    k_degisim = (yeni_kontenjan - eski_kontenjan) / eski_kontenjan
    k_carpan = 1.0 + (e * k_degisim)
    
    # 5. Nihai Hesaplama
    sonuc = trend * k_carpan
    
    # Anomali / Plato Kontrolü
    if sonuc <= 0:
        return {
            "Durum": "Hata / Plato Etkisi",
            "Mesaj": "Formül sıfırın altında bir değer üretti. Bölüm doygunluğa (platoya) ulaştığı için lineer regresyon uygulanamaz."
        }
        
    return {
        "Tahmini Sıralama": int(round(sonuc)),
        "Alt Sınır (İyimser - %10)": int(round(sonuc * 0.9)),
        "Üst Sınır (Kötümser + %10)": int(round(sonuc * 1.1)),
        "Eğim (İvme)": round(egim, 2),
        "Kontenjan Çarpanı": round(k_carpan, 4)
    }

# Örnek Test Kullanımı:
# Son 5 yıl sıralamaları: 50.000, 46.000, 41.000, 36.000, 32.000. Kontenjan 60 -> 66 (%10 artış)
sonuc = yks_siralama_tahmin([50000, 46000, 41000, 36000, 32000], 60, 66)
print(sonuc)
# Çıktı: {'Tahmini Sıralama': 28016, 'Alt Sınır (İyimser - %10)': 25214, 'Üst Sınır (Kötümser + %10)': 30818, ...}
```

---

## 🔍 4. Sayısal Veri Okuma Kılavuzu ve 4 Analitik Filtre

Hesaplanan değer bir **nokta tahmini (point estimate)** olup, tercih listesi oluştururken 4 ana filtre üzerinden yorumlanmalıdır:

### 1️⃣ Güven Aralığı (Margin of Error) Bandı
* Sıralamalar tek bir sayı olarak değerlendirilmemeli, etrafında **%10 sapma bandı (çan eğrisi)** oluşturulmalıdır.
* *Örnek:* Tahmin `28.000` çıktıysa, beklenti **`25.200 - 30.800`** bandı olmalıdır.
* Tercih listenizde bu bandın hem üstünü (riskli/sürpriz) hem altını (güvenli/garanti) kapsayacak esneklik bırakılmalıdır.

### 2️⃣ Momentum (İvme) Yönü
* **Tahmin < Geçen Yıl ($R_{\text{hedef}} < Y_5$):** Güçlü pozitif momentum var. Kontenjan artmış olsa dahi talep arzı aşıyordur. Bölüme girmek zorlaşacaktır (Yüksek rekabet).
* **Tahmin > Geçen Yıl ($R_{\text{hedef}} > Y_5$):** Bölüm talebi soğuyor veya kontenjan artışı ivmeyi kırdı. Sıralaması sınırda olan adaylar için ideal bir "güvenli liman" tercihidir.

### 3️⃣ Anomali ve Plato (Doygunluk) Kontrolü
* Lineer regresyon modelleri trendin sonsuza dek süreceğini varsayar.
* *Örnek:* Bir bölüm `150k -> 100k -> 50k -> 20k` şeklinde yükseldiyse formül eksi değerler üretebilir.
* İlk 20.000 bandında sıralama atlamak fiziksel olarak zorlaştığı için bu bölümler **Platoya (Doygunluk Noktasına)** çarpar. Bu durumlarda sayısal sonuca değil, yalnızca "bölümün sınırlı miktarda öne çekeceği" eğilimine güvenilmelidir.

### 4️⃣ "Rüzgar" (Sosyolojik Trend) Faktörü
* Yapay Zeka, Siber Güvenlik, Yazılım gibi yükselen disiplinler geçmiş verilerin de ötesinde bir talep dalgası (rüzgar) yakalayabilir.
* Popüler teknoloji alanlarında hesaplanan değerden **daha agresif bir öne çekme** (daha küçük sıralama) ihtimali göz önünde bulundurulmalıdır.
