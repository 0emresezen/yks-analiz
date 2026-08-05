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

const padRankingsToFive = (rankings) => {
  const clean = rankings.map((v) => Number(v) || 0).filter((n) => n > 0);
  if (!clean.length) return null;
  if (clean.length >= 5) return clean.slice(-5);

  const last = clean[clean.length - 1];
  const padCount = 5 - clean.length;
  const padded = [];
  for (let i = 0; i < padCount; i++) {
    padded.push(Math.round(last + (5 - clean.length + i) * 3000));
  }
  return padded.concat(clean);
};

export function predictYKSRanking(yearsList, oldQuota, newQuota) {
  if (!yearsList || yearsList.length < 2) {
    return { error: 'Geçersiz veri (en az 2 yıllık sıralama gerekli)' };
  }

  const normalized = padRankingsToFive(yearsList);
  if (!normalized) {
    return { error: 'Geçersiz sıralama verisi' };
  }

  const [y1, y2, y3, y4, y5] = normalized;
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

  const yOrt = (y1 + y2 + y3 + y4 + y5) / 5;
  const egim = ((2 * y5) + y4 - y2 - (2 * y1)) / 10;
  const trend = yOrt + (3 * egim);
  const e = calculateElasticity(y5);
  const qChange = qOld > 0 ? (qNew - qOld) / qOld : 0;
  const kCarpan = 1 + (e * qChange);
  const rawResult = trend * kCarpan;

  let trendDirection = 'Yatay';
  if (egim < -500) trendDirection = 'Yükseliş';
  else if (egim > 500) trendDirection = 'Düşüş';

  if (rawResult <= 0) {
    return {
      tahminiSira: Math.round(y5 * 0.85),
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
  return {
    tahminiSira,
    altSinir: Math.round(rawResult * 0.9),
    ustSinir: Math.round(rawResult * 1.1),
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
