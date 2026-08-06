/** Metrik alt bölüm başlıkları ve skor bandına göre açıklama metinleri (pipeline ile uyumlu). */

export const METRIC_SECTION_DEFS = {
  "prestige": [
    {
      "id": "urap",
      "title": "URAP Sıralaması"
    },
    {
      "id": "employer",
      "title": "İşveren Tanınırlığı"
    },
    {
      "id": "alumni",
      "title": "Mezun Ağı"
    }
  ],
  "academic": [
    {
      "id": "learning",
      "title": "Öğrenme Deneyimi"
    },
    {
      "id": "support",
      "title": "Akademik Destek"
    },
    {
      "id": "resources",
      "title": "Öğrenme Kaynakları"
    }
  ],
  "transport": [
    {
      "id": "metro",
      "title": "Metro / Tramvay"
    },
    {
      "id": "bus",
      "title": "Otobüs Ağı"
    },
    {
      "id": "kyk",
      "title": "KYK Yurtları"
    },
    {
      "id": "campus",
      "title": "Kampüs İçi Ulaşım"
    }
  ],
  "student_life": [
    {
      "id": "uniar",
      "title": "ÜNİAR Memnuniyeti"
    },
    {
      "id": "clubs",
      "title": "Öğrenci Kulüpleri"
    },
    {
      "id": "erasmus",
      "title": "Erasmus Hareketliliği"
    },
    {
      "id": "sports",
      "title": "Spor Tesisleri"
    }
  ],
  "industry": [
    {
      "id": "collab",
      "title": "Sanayi İş Birlikleri"
    },
    {
      "id": "teknopark",
      "title": "Teknopark Entegrasyonu"
    },
    {
      "id": "internship",
      "title": "Staj Anlaşmaları"
    }
  ],
  "research": [
    {
      "id": "urap",
      "title": "URAP Performansı"
    },
    {
      "id": "sci",
      "title": "SCI Yayınları"
    },
    {
      "id": "tubitak",
      "title": "TÜBİTAK Projeleri"
    }
  ],
  "international": [
    {
      "id": "erasmus",
      "title": "Erasmus Anlaşmaları"
    },
    {
      "id": "language",
      "title": "Eğitim Dili"
    },
    {
      "id": "mobility",
      "title": "Öğrenci Hareketliliği"
    }
  ],
  "cost": [
    {
      "id": "rent",
      "title": "Kira Endeksi"
    },
    {
      "id": "living",
      "title": "Günlük Giderler"
    },
    {
      "id": "city_tier",
      "title": "Şehir Maliyet Bandı"
    }
  ],
  "housing": [
    {
      "id": "kyk_cap",
      "title": "KYK Kapasitesi"
    },
    {
      "id": "occupancy",
      "title": "Doluluk Oranı"
    },
    {
      "id": "rent",
      "title": "Kira Baskısı"
    }
  ],
  "career": [
    {
      "id": "employment",
      "title": "İstihdam Oranı"
    },
    {
      "id": "salary",
      "title": "Başlangıç Maaşı"
    },
    {
      "id": "graduate",
      "title": "Mezun Başarısı"
    }
  ],
  "ai_opportunity": [
    {
      "id": "teknopark",
      "title": "Teknopark Varlığı"
    },
    {
      "id": "tech_hub",
      "title": "Teknoloji Ekosistemi"
    },
    {
      "id": "research",
      "title": "Ar-Ge Altyapısı"
    }
  ],
  "internship": [
    {
      "id": "density",
      "title": "İşyeri Yoğunluğu"
    },
    {
      "id": "agreements",
      "title": "Staj Anlaşmaları"
    },
    {
      "id": "acceptance",
      "title": "Stajyer Kabul Oranı"
    }
  ],
  "scholarship": [
    {
      "id": "rate",
      "title": "Burs / İndirim Oranı"
    },
    {
      "id": "type",
      "title": "Üniversite Statüsü"
    }
  ],
  "startup": [
    {
      "id": "incubator",
      "title": "Kuluçka Merkezleri"
    },
    {
      "id": "teknopark",
      "title": "Teknopark"
    },
    {
      "id": "ecosystem",
      "title": "Girişimcilik Ekosistemi"
    }
  ]
}

export const METRIC_SECTION_TEXTS = {
  "transport": {
    "metro": {
      "high": "Şehir merkezinden kampüse hızlı ve düzenli ulaşım sağlar.",
      "mid": "Metro, tramvay veya ana arter hatları kampüse erişimi destekler.",
      "low": "Metro/tramvay bağlantısı sınırlı; otobüs veya aktarma gerekebilir."
    },
    "bus": {
      "high": "Şehrin büyük bölümünden kampüse doğrudan veya aktarmalı ulaşım mümkündür.",
      "mid": "Şehir içi otobüs hatları kampüse ulaşımı genel olarak karşılar.",
      "low": "Toplu taşıma seferleri seyrek; ulaşım planlaması önemlidir."
    },
    "kyk": {
      "high": "KYK yurt kapasitesi ve kampüse erişim öğrenciler için avantajlıdır.",
      "mid": "KYK yurtları mevcut; başvuru dönemlerinde erken hareket önerilir.",
      "low": "KYK yurt kapasitesi sınırlı; özel yurt veya kiralık seçenekler değerlendirilmeli."
    },
    "campus": {
      "high": "Fakülteler arasında yürüyüş ve ulaşım rahattır.",
      "mid": "Kampüs içi mesafeler yönetilebilir; ring servisleri destekleyici olabilir.",
      "low": "Kampüs geniş veya dağınık; iç ulaşım zaman alabilir."
    }
  },
  "prestige": {
    "urap": {
      "high": "URAP sıralamasında üst bantta yer alması diploma gücünü güçlendirir.",
      "mid": "URAP performansı orta-üst bandında; tanınırlık yeterli düzeydedir.",
      "low": "URAP sıralaması sınırlı; bölgesel tanınırlık ağırlıklıdır."
    },
    "employer": {
      "high": "Mezunlar iş piyasasında yüksek işveren tanınırlığına sahiptir.",
      "mid": "İşverenler arasında orta düzeyde tanınırlık ve güven vardır.",
      "low": "İşveren tanınırlığı bölgesel ölçekte sınırlı kalabilir."
    },
    "alumni": {
      "high": "Geniş ve aktif mezun ağı kariyer fırsatlarını destekler.",
      "mid": "Mezun ağı orta ölçekte; sektör bağlantıları mevcuttur.",
      "low": "Mezun ağı sınırlı; networking fırsatları bireysel çaba gerektirir."
    }
  },
  "academic": {
    "learning": {
      "high": "Öğrenme deneyimi anketlerde üst düzey memnuniyet gösterir.",
      "mid": "Öğrenme ortamı genel olarak yeterli ve dengeli değerlendirilir.",
      "low": "Öğrenme deneyimi iyileştirme alanı olarak öne çıkıyor."
    },
    "support": {
      "high": "Akademik danışmanlık ve destek hizmetleri güçlüdür.",
      "mid": "Akademik destek hizmetleri orta düzeyde erişilebilirdir.",
      "low": "Akademik destek kapasitesi sınırlı olabilir."
    },
    "resources": {
      "high": "Kütüphane, laboratuvar ve dijital kaynaklar zengindir.",
      "mid": "Temel öğrenme kaynakları mevcut; bazı alanlarda yoğunluk yaşanabilir.",
      "low": "Öğrenme kaynakları kısıtlı; planlı kullanım önemlidir."
    }
  },
  "student_life": {
    "uniar": {
      "high": "ÜNİAR memnuniyet skorları üst bantta; kampüs yaşamı olumlu.",
      "mid": "ÜNİAR memnuniyeti orta-üst düzeyde dengeli bir profil sunar.",
      "low": "ÜNİAR memnuniyeti ortalamanın altında; beklenti yönetimi önemli."
    },
    "clubs": {
      "high": "Öğrenci kulüpleri ve sosyal etkinlikler zengin bir seçenek sunar.",
      "mid": "Kulüp ve sosyal aktivite imkânları orta düzeydedir.",
      "low": "Sosyal etkinlik çeşitliliği sınırlı olabilir."
    },
    "erasmus": {
      "high": "Erasmus ve değişim programlarına güçlü erişim vardır.",
      "mid": "Erasmus anlaşmaları mevcut; kontenjanlar dönemsel değişir.",
      "low": "Uluslararası değişim fırsatları sınırlıdır."
    },
    "sports": {
      "high": "Spor tesisleri ve rekreasyon alanları yeterli ve erişilebilirdir.",
      "mid": "Temel spor imkânları mevcut; yoğun saatlerde talep artabilir.",
      "low": "Spor altyapısı sınırlı; şehir merkezi alternatifleri gerekebilir."
    }
  },
  "industry": {
    "collab": {
      "high": "Sanayi iş birlikleri ve ortak projeler güçlü sektör bağlantısı sağlar.",
      "mid": "Bölgesel sanayi ile orta düzeyde iş birliği imkânları vardır.",
      "low": "Sanayi entegrasyonu sınırlı; staj ve iş arayışı planlı olmalı."
    },
    "teknopark": {
      "high": "Teknopark ve Ar-Ge merkezlerine yakınlık staj ve iş fırsatlarını artırır.",
      "mid": "Bölgede teknoloji ve üretim tesislerine erişim mümkündür.",
      "low": "Teknopark entegrasyonu zayıf; uzak lokasyonlu stajlar gerekebilir."
    },
    "internship": {
      "high": "Staj anlaşmaları ve kontenjanlar geniş bir yelpaze sunar.",
      "mid": "Staj imkânları mevcut; rekabet dönemsel olarak artabilir.",
      "low": "Staj bulma süreci zorlayıcı olabilir; erken başvuru önerilir."
    }
  },
  "research": {
    "urap": {
      "high": "URAP araştırma sıralamasında güçlü akademik çıktı profili.",
      "mid": "Araştırma performansı orta-üst bandında istikrarlı.",
      "low": "Araştırma çıktıları sınırlı; bölgesel ölçekte değerlendirilir."
    },
    "sci": {
      "high": "SCI endeksli yayın hacmi yüksek; akademik üretkenlik güçlü.",
      "mid": "Yayın performansı orta düzeyde; disipline göre değişir.",
      "low": "Yayın sayısı sınırlı; araştırma fırsatları proje bazlı olabilir."
    },
    "tubitak": {
      "high": "TÜBİTAK ve ulusal proje katılımı aktif bir araştırma ekosistemi gösterir.",
      "mid": "Proje destekleri mevcut; başvuru süreçleri rekabetçi olabilir.",
      "low": "Proje fonlama fırsatları sınırlıdır."
    }
  },
  "international": {
    "erasmus": {
      "high": "Geniş Erasmus ağı uluslararası deneyim imkânı sunar.",
      "mid": "Erasmus anlaşmaları mevcut; kontenjan ve dil şartları değişken.",
      "low": "Erasmus seçenekleri sınırlı; alternatif değişim programları araştırılmalı."
    },
    "language": {
      "high": "İngilizce veya çok dilli programlar uluslararasılaşmayı destekler.",
      "mid": "Dil profili orta düzeyde uluslararası erişim sağlar.",
      "low": "Ağırlıklı Türkçe eğitim; yabancı dil gelişimi ek çaba gerektirir."
    },
    "mobility": {
      "high": "Uluslararası öğrenci ve akademisyen hareketliliği yüksek.",
      "mid": "Orta düzeyde uluslararası öğrenci ve değişim trafiği vardır.",
      "low": "Uluslararası hareketlilik sınırlıdır."
    }
  },
  "cost": {
    "rent": {
      "high": "Kira ve barınma maliyeti öğrenci bütçesi için uygun bantta.",
      "mid": "Kira maliyeti orta düzeyde; paylaşımlı konaklama avantajlı olabilir.",
      "low": "Kira baskısı yüksek; bütçe planlaması kritik önem taşır."
    },
    "living": {
      "high": "Günlük yaşam giderleri Türkiye ortalamasına göre dengeli veya düşük.",
      "mid": "Yaşam giderleri orta bandında; harcama disiplini önerilir.",
      "low": "Günlük harcamalar yüksek; sosyal ve ulaşım giderleri bütçeyi zorlar."
    },
    "city_tier": {
      "high": "Şehir maliyet profili öğrenciler için genel olarak avantajlı.",
      "mid": "Şehir maliyeti orta ölçekli; bölgeye göre değişkenlik gösterir.",
      "low": "Büyükşehir maliyet baskısı belirgin; ek gelir planı gerekebilir."
    }
  },
  "housing": {
    "kyk_cap": {
      "high": "KYK yurt kapasitesi bölge için yeterli ve erişilebilir.",
      "mid": "KYK yurtları mevcut; başvuru döneminde yoğunluk yaşanabilir.",
      "low": "KYK kapasitesi kısıtlı; özel yurt veya kiralık ev alternatifleri gerekir."
    },
    "occupancy": {
      "high": "Yurt doluluk oranı düşük-orta; yerleşme şansı nispeten yüksek.",
      "mid": "Doluluk orta düzeyde; erken başvuru avantaj sağlar.",
      "low": "Yurt doluluğu yüksek; alternatif barınma planı şart."
    },
    "rent": {
      "high": "Kampüs çevresi kira baskısı düşük veya yönetilebilir.",
      "mid": "Kira seviyeleri orta bandında; ev arkadaşı ile maliyet düşürülebilir.",
      "low": "Kampüs yakını kira baskısı yüksek; uzak ilçeler değerlendirilebilir."
    }
  },
  "career": {
    "employment": {
      "high": "Mezun istihdam oranı güçlü; sektör talebi yüksek.",
      "mid": "İstihdam imkânları orta düzeyde; bölüme göre değişir.",
      "low": "İş bulma süreci rekabetçi; staj ve sertifika avantaj sağlar."
    },
    "salary": {
      "high": "Başlangıç maaşı beklentileri sektör ortalamasının üzerinde.",
      "mid": "Maaş beklentileri orta bandında dengeli.",
      "low": "Başlangıç ücretleri sınırlı; deneyimle artış beklenir."
    },
    "graduate": {
      "high": "Mezun başarı hikâyeleri ve kariyer ivmesi güçlü.",
      "mid": "Mezun performansı istikrarlı; sektöre göre farklılaşır.",
      "low": "Mezun kariyer takibi sınırlı verilerle değerlendirilir."
    }
  },
  "ai_opportunity": {
    "teknopark": {
      "high": "Teknopark ve yapay zeka odaklı firmalara yakınlık fırsatları artırır.",
      "mid": "Bölgede teknoloji firmalarına erişim mümkündür.",
      "low": "Yapay zeka ekosistemi sınırlı; uzaktan veya yaz stajı alternatif olabilir."
    },
    "tech_hub": {
      "high": "Teknoloji kümelenmesi ve startup yoğunluğu yüksek.",
      "mid": "Orta ölçekli teknoloji ekosistemi mevcut.",
      "low": "Teknoloji merkezlerine uzaklık fırsatları sınırlar."
    },
    "research": {
      "high": "Ar-Ge laboratuvarları ve veri bilimi projeleri erişilebilir.",
      "mid": "Temel Ar-Ge altyapısı mevcut; proje bazlı katılım mümkün.",
      "low": "Ar-Ge imkânları sınırlıdır."
    }
  },
  "internship": {
    "density": {
      "high": "Çevrede yoğun işyeri ve staj kontenjanı bulunur.",
      "mid": "Staj yapılabilecek kurum sayısı orta düzeydedir.",
      "low": "İşyeri yoğunluğu düşük; şehir dışı staj gerekebilir."
    },
    "agreements": {
      "high": "Üniversite-sanayi staj protokolleri geniş kapsamlıdır.",
      "mid": "Temel staj anlaşmaları mevcuttur.",
      "low": "Kurumsal staj anlaşmaları sınırlıdır."
    },
    "acceptance": {
      "high": "Stajyer kabul oranları yüksek; başvuru süreci desteklenir.",
      "mid": "Staj kabulü orta düzeyde rekabetçidir.",
      "low": "Staj bulma süreci zorlu olabilir."
    }
  },
  "scholarship": {
    "rate": {
      "high": "Burs veya indirim oranı mali yükü önemli ölçüde azaltır.",
      "mid": "Kısmi burs veya indirim imkânları mevcuttur.",
      "low": "Burs desteği sınırlı; ücretli statü ağırlıklı olabilir."
    },
    "type": {
      "high": "Devlet üniversitesi statüsü maliyet avantajı sağlar.",
      "mid": "Üniversite statüsü orta düzeyde maliyet profili oluşturur.",
      "low": "Vakıf veya yüksek ücretli program; bütçe planı önemlidir."
    }
  },
  "startup": {
    "incubator": {
      "high": "Kuluçka merkezleri ve hızlandırıcı programlara erişim kolaydır.",
      "mid": "Temel girişimcilik destekleri mevcuttur.",
      "low": "Kuluçka imkânları sınırlı; online programlar alternatif olabilir."
    },
    "teknopark": {
      "high": "Teknopark entegrasyonu girişim fırsatlarını güçlendirir.",
      "mid": "Bölgesel teknoparklara orta düzeyde erişim vardır.",
      "low": "Teknopark bağlantısı zayıftır."
    },
    "ecosystem": {
      "high": "Girişimcilik ekosistemi aktif; mentorluk ve yatırımcı ağı güçlü.",
      "mid": "Girişimcilik topluluğu gelişmekte; fırsatlar proje bazlı.",
      "low": "Girişimcilik ekosistemi sınırlıdır."
    }
  }
}

const GENERIC_FILLER = /değerlendirmeye dahil|değerlendirme yapıldı|katılmıştır|katkı sağlıyor|değerlendirmeye alındı/i

export const getMetricSectionBand = (scorePercent, metricKey = '') => {
  if (metricKey === 'cost') {
    if (scorePercent >= 80) return 'high'
    if (scorePercent >= 45) return 'mid'
    return 'low'
  }
  if (scorePercent >= 75) return 'high'
  if (scorePercent >= 45) return 'mid'
  return 'low'
}

export const getSectionText = (metricKey, sectionId, band) => {
  const texts = METRIC_SECTION_TEXTS[metricKey]?.[sectionId] || {}
  return texts[band] || texts.mid || ''
}

export const buildMetricSectionsFromScore = (metricKey, score) => {
  if (score == null || score === '') return []
  const scorePercent = Math.max(0, Math.min(100, Math.round(Number(score) * 10)))
  const band = getMetricSectionBand(scorePercent, metricKey)
  const defs = METRIC_SECTION_DEFS[metricKey] || []
  return defs
    .map(({ id, title }) => {
      const text = getSectionText(metricKey, id, band)
      if (!text || GENERIC_FILLER.test(text)) return null
      return { title, text }
    })
    .filter(Boolean)
}
