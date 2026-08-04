/**
 * YKS Sıralama ve Tercih Tahmin Engine Modülü
 * En Küçük Kareler Regresyonu + Kontenjan Esnekliği Modeli
 */

export function calculateElasticity(y5) {
  if (y5 <= 20000) return 0.1;
  if (y5 <= 50000) return 0.3;
  if (y5 <= 100000) return 0.5;
  return 0.8;
}

export function predictYKSRanking(yearsList, oldQuota, newQuota) {
  if (!yearsList || yearsList.length !== 5) {
    return { error: 'Geçersiz veri (5 yıllık sıralama gerekli)' };
  }

  const [y1, y2, y3, y4, y5] = yearsList.map(v => Number(v) || 0);
  const qOld = Number(oldQuota) || 60;
  const qNew = Number(newQuota) || 60;

  if (y5 <= 0) {
    return {
      tahminiSira: '-',
      altSinir: '-',
      ustSinir: '-',
      egim: 0,
      kCarpan: 1,
      trendDirection: 'Yatay',
      isPlateau: false,
      message: 'Geçen yılki sıralama verisi eksik'
    };
  }

  // 1. Aritmetik Ortalama ve Yakın Geçmiş Ağırlıklı Regresyon Eğimi (m)
  const yOrt = (y1 + y2 + y3 + y4 + y5) / 5;
  const egim = ((2 * y5) + y4 - y2 - (2 * y1)) / 10;

  // 2. Baz Trend
  const trend = yOrt + (3 * egim);

  // 3. Esneklik Katsayısı (E)
  const e = calculateElasticity(y5);

  // 4. Kontenjan Çarpanı
  const qChange = qOld > 0 ? (qNew - qOld) / qOld : 0;
  const kCarpan = 1 + (e * qChange);

  // 5. Nihai Tahmin
  const rawResult = trend * kCarpan;

  // Trend Yönü Belirleme
  let trendDirection = 'Yatay';
  if (egim < -500) trendDirection = 'Yükseliş'; // Sıralama küçülüyor = talep yükseliyor
  else if (egim > 500) trendDirection = 'Düşüş'; // Sıralama büyüyor = talep düşüyor

  // Plato ve Anomali Kontrolü
  if (rawResult <= 0) {
    return {
      tahminiSira: Math.round(y5 * 0.85), // Doygunluk tahmini
      altSinir: Math.round(y5 * 0.75),
      ustSinir: y5,
      egim: Math.round(egim),
      kCarpan: Number(kCarpan.toFixed(3)),
      trendDirection: 'Yükseliş',
      isPlateau: true,
      message: 'Bölüm platoya ulaştı (aşırı öne çekme)'
    };
  }

  const tahminiSira = Math.round(rawResult);
  const altSinir = Math.round(rawResult * 0.9);
  const ustSinir = Math.round(rawResult * 1.1);

  return {
    tahminiSira,
    altSinir,
    ustSinir,
    egim: Math.round(egim),
    kCarpan: Number(kCarpan.toFixed(4)),
    trendDirection,
    isPlateau: false,
    message: 'İstatistiksel tahmin hesaplandı'
  };
}

export function generateExcelFormula(cellRow = 2) {
  return `=YUVARLA((ORTALAMA(A${cellRow}:E${cellRow}) + 3 * (((2*E${cellRow}) + D${cellRow} - B${cellRow} - (2*A${cellRow})) / 10)) * (1 + (EĞER(E${cellRow}<=20000; 0,1; EĞER(E${cellRow}<=50000; 0,3; EĞER(E${cellRow}<=100000; 0,5; 0,8))) * ((G${cellRow}-F${cellRow})/F${cellRow}))); 0)`;
}
