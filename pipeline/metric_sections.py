#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Metrik kartları için yapılandırılmış özet + alt bölüm üretimi."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

METRIC_KEYS = (
    "prestige", "academic", "transport", "student_life", "industry",
    "research", "international", "cost", "housing", "career",
    "ai_opportunity", "internship", "scholarship", "startup",
)

SECTION_DEFS: Dict[str, List[Tuple[str, str, str]]] = {
    "prestige": [
        ("urap", "🏛️", "URAP Sıralaması"),
        ("employer", "💼", "İşveren Tanınırlığı"),
        ("alumni", "🤝", "Mezun Ağı"),
    ],
    "academic": [
        ("learning", "📚", "Öğrenme Deneyimi"),
        ("support", "👨‍🏫", "Akademik Destek"),
        ("resources", "🔬", "Öğrenme Kaynakları"),
    ],
    "transport": [
        ("metro", "🚋", "Metro / Tramvay"),
        ("bus", "🚌", "Otobüs Ağı"),
        ("kyk", "🏠", "KYK Yurtları"),
        ("campus", "🚶", "Kampüs İçi Ulaşım"),
    ],
    "student_life": [
        ("uniar", "⭐", "ÜNİAR Memnuniyeti"),
        ("clubs", "🎭", "Öğrenci Kulüpleri"),
        ("erasmus", "🌍", "Erasmus Hareketliliği"),
        ("sports", "⚽", "Spor Tesisleri"),
    ],
    "industry": [
        ("collab", "🏭", "Sanayi İş Birlikleri"),
        ("teknopark", "🔬", "Teknopark Entegrasyonu"),
        ("internship", "📋", "Staj Anlaşmaları"),
    ],
    "research": [
        ("urap", "📊", "URAP Performansı"),
        ("sci", "📄", "SCI Yayınları"),
        ("tubitak", "🧪", "TÜBİTAK Projeleri"),
    ],
    "international": [
        ("erasmus", "✈️", "Erasmus Anlaşmaları"),
        ("language", "🗣️", "Eğitim Dili"),
        ("mobility", "🌐", "Öğrenci Hareketliliği"),
    ],
    "cost": [
        ("rent", "🏠", "Kira Endeksi"),
        ("living", "🛒", "Günlük Giderler"),
        ("city_tier", "📍", "Şehir Maliyet Bandı"),
    ],
    "housing": [
        ("kyk_cap", "🏠", "KYK Kapasitesi"),
        ("occupancy", "📊", "Doluluk Oranı"),
        ("rent", "🔑", "Kira Baskısı"),
    ],
    "career": [
        ("employment", "💼", "İstihdam Oranı"),
        ("salary", "💰", "Başlangıç Maaşı"),
        ("graduate", "🎓", "Mezun Başarısı"),
    ],
    "ai_opportunity": [
        ("teknopark", "🤖", "Teknopark Varlığı"),
        ("tech_hub", "💡", "Teknoloji Ekosistemi"),
        ("research", "🔬", "Ar-Ge Altyapısı"),
    ],
    "internship": [
        ("density", "🏢", "İşyeri Yoğunluğu"),
        ("agreements", "📝", "Staj Anlaşmaları"),
        ("acceptance", "✅", "Stajyer Kabul Oranı"),
    ],
    "scholarship": [
        ("rate", "🎓", "Burs / İndirim Oranı"),
        ("type", "🏛️", "Üniversite Statüsü"),
    ],
    "startup": [
        ("incubator", "🚀", "Kuluçka Merkezleri"),
        ("teknopark", "🏗️", "Teknopark"),
        ("ecosystem", "🌱", "Girişimcilik Ekosistemi"),
    ],
}

SECTION_TEXTS: Dict[str, Dict[str, Dict[str, str]]] = {
    "transport": {
        "metro": {
            "high": "Şehir merkezinden kampüse hızlı ve düzenli ulaşım sağlar.",
            "mid": "Metro, tramvay veya ana arter hatları kampüse erişimi destekler.",
            "low": "Metro/tramvay bağlantısı sınırlı; otobüs veya aktarma gerekebilir.",
        },
        "bus": {
            "high": "Şehrin büyük bölümünden kampüse doğrudan veya aktarmalı ulaşım mümkündür.",
            "mid": "Şehir içi otobüs hatları kampüse ulaşımı genel olarak karşılar.",
            "low": "Toplu taşıma seferleri seyrek; ulaşım planlaması önemlidir.",
        },
        "kyk": {
            "high": "KYK yurt kapasitesi ve kampüse erişim öğrenciler için avantajlıdır.",
            "mid": "KYK yurtları mevcut; başvuru dönemlerinde erken hareket önerilir.",
            "low": "KYK yurt kapasitesi sınırlı; özel yurt veya kiralık seçenekler değerlendirilmeli.",
        },
        "campus": {
            "high": "Fakülteler arasında yürüyüş ve ulaşım rahattır.",
            "mid": "Kampüs içi mesafeler yönetilebilir; ring servisleri destekleyici olabilir.",
            "low": "Kampüs geniş veya dağınık; iç ulaşım zaman alabilir.",
        },
    },
    "prestige": {
        "urap": {
            "high": "URAP sıralamasında üst bantta yer alması diploma gücünü güçlendirir.",
            "mid": "URAP performansı orta-üst bandında; tanınırlık yeterli düzeydedir.",
            "low": "URAP sıralaması sınırlı; bölgesel tanınırlık ağırlıklıdır.",
        },
        "employer": {
            "high": "Mezunlar iş piyasasında yüksek işveren tanınırlığına sahiptir.",
            "mid": "İşverenler arasında orta düzeyde tanınırlık ve güven vardır.",
            "low": "İşveren tanınırlığı bölgesel ölçekte sınırlı kalabilir.",
        },
        "alumni": {
            "high": "Geniş ve aktif mezun ağı kariyer fırsatlarını destekler.",
            "mid": "Mezun ağı orta ölçekte; sektör bağlantıları mevcuttur.",
            "low": "Mezun ağı sınırlı; networking fırsatları bireysel çaba gerektirir.",
        },
    },
    "academic": {
        "learning": {
            "high": "Öğrenme deneyimi anketlerde üst düzey memnuniyet gösterir.",
            "mid": "Öğrenme ortamı genel olarak yeterli ve dengeli değerlendirilir.",
            "low": "Öğrenme deneyimi iyileştirme alanı olarak öne çıkıyor.",
        },
        "support": {
            "high": "Akademik danışmanlık ve destek hizmetleri güçlüdür.",
            "mid": "Akademik destek hizmetleri orta düzeyde erişilebilirdir.",
            "low": "Akademik destek kapasitesi sınırlı olabilir.",
        },
        "resources": {
            "high": "Kütüphane, laboratuvar ve dijital kaynaklar zengindir.",
            "mid": "Temel öğrenme kaynakları mevcut; bazı alanlarda yoğunluk yaşanabilir.",
            "low": "Öğrenme kaynakları kısıtlı; planlı kullanım önemlidir.",
        },
    },
    "student_life": {
        "uniar": {
            "high": "ÜNİAR memnuniyet skorları üst bantta; kampüs yaşamı olumlu.",
            "mid": "ÜNİAR memnuniyeti orta-üst düzeyde dengeli bir profil sunar.",
            "low": "ÜNİAR memnuniyeti ortalamanın altında; beklenti yönetimi önemli.",
        },
        "clubs": {
            "high": "Öğrenci kulüpleri ve sosyal etkinlikler zengin bir seçenek sunar.",
            "mid": "Kulüp ve sosyal aktivite imkânları orta düzeydedir.",
            "low": "Sosyal etkinlik çeşitliliği sınırlı olabilir.",
        },
        "erasmus": {
            "high": "Erasmus ve değişim programlarına güçlü erişim vardır.",
            "mid": "Erasmus anlaşmaları mevcut; kontenjanlar dönemsel değişir.",
            "low": "Uluslararası değişim fırsatları sınırlıdır.",
        },
        "sports": {
            "high": "Spor tesisleri ve rekreasyon alanları yeterli ve erişilebilirdir.",
            "mid": "Temel spor imkânları mevcut; yoğun saatlerde talep artabilir.",
            "low": "Spor altyapısı sınırlı; şehir merkezi alternatifleri gerekebilir.",
        },
    },
    "industry": {
        "collab": {
            "high": "Sanayi iş birlikleri ve ortak projeler güçlü sektör bağlantısı sağlar.",
            "mid": "Bölgesel sanayi ile orta düzeyde iş birliği imkânları vardır.",
            "low": "Sanayi entegrasyonu sınırlı; staj ve iş arayışı planlı olmalı.",
        },
        "teknopark": {
            "high": "Teknopark ve Ar-Ge merkezlerine yakınlık staj ve iş fırsatlarını artırır.",
            "mid": "Bölgede teknoloji ve üretim tesislerine erişim mümkündür.",
            "low": "Teknopark entegrasyonu zayıf; uzak lokasyonlu stajlar gerekebilir.",
        },
        "internship": {
            "high": "Staj anlaşmaları ve kontenjanlar geniş bir yelpaze sunar.",
            "mid": "Staj imkânları mevcut; rekabet dönemsel olarak artabilir.",
            "low": "Staj bulma süreci zorlayıcı olabilir; erken başvuru önerilir.",
        },
    },
    "research": {
        "urap": {
            "high": "URAP araştırma sıralamasında güçlü akademik çıktı profili.",
            "mid": "Araştırma performansı orta-üst bandında istikrarlı.",
            "low": "Araştırma çıktıları sınırlı; bölgesel ölçekte değerlendirilir.",
        },
        "sci": {
            "high": "SCI endeksli yayın hacmi yüksek; akademik üretkenlik güçlü.",
            "mid": "Yayın performansı orta düzeyde; disipline göre değişir.",
            "low": "Yayın sayısı sınırlı; araştırma fırsatları proje bazlı olabilir.",
        },
        "tubitak": {
            "high": "TÜBİTAK ve ulusal proje katılımı aktif bir araştırma ekosistemi gösterir.",
            "mid": "Proje destekleri mevcut; başvuru süreçleri rekabetçi olabilir.",
            "low": "Proje fonlama fırsatları sınırlıdır.",
        },
    },
    "international": {
        "erasmus": {
            "high": "Geniş Erasmus ağı uluslararası deneyim imkânı sunar.",
            "mid": "Erasmus anlaşmaları mevcut; kontenjan ve dil şartları değişken.",
            "low": "Erasmus seçenekleri sınırlı; alternatif değişim programları araştırılmalı.",
        },
        "language": {
            "high": "İngilizce veya çok dilli programlar uluslararasılaşmayı destekler.",
            "mid": "Dil profili orta düzeyde uluslararası erişim sağlar.",
            "low": "Ağırlıklı Türkçe eğitim; yabancı dil gelişimi ek çaba gerektirir.",
        },
        "mobility": {
            "high": "Uluslararası öğrenci ve akademisyen hareketliliği yüksek.",
            "mid": "Orta düzeyde uluslararası öğrenci ve değişim trafiği vardır.",
            "low": "Uluslararası hareketlilik sınırlıdır.",
        },
    },
    "cost": {
        "rent": {
            "high": "Kira ve barınma maliyeti öğrenci bütçesi için uygun bantta.",
            "mid": "Kira maliyeti orta düzeyde; paylaşımlı konaklama avantajlı olabilir.",
            "low": "Kira baskısı yüksek; bütçe planlaması kritik önem taşır.",
        },
        "living": {
            "high": "Günlük yaşam giderleri Türkiye ortalamasına göre dengeli veya düşük.",
            "mid": "Yaşam giderleri orta bandında; harcama disiplini önerilir.",
            "low": "Günlük harcamalar yüksek; sosyal ve ulaşım giderleri bütçeyi zorlar.",
        },
        "city_tier": {
            "high": "Şehir maliyet profili öğrenciler için genel olarak avantajlı.",
            "mid": "Şehir maliyeti orta ölçekli; bölgeye göre değişkenlik gösterir.",
            "low": "Büyükşehir maliyet baskısı belirgin; ek gelir planı gerekebilir.",
        },
    },
    "housing": {
        "kyk_cap": {
            "high": "KYK yurt kapasitesi bölge için yeterli ve erişilebilir.",
            "mid": "KYK yurtları mevcut; başvuru döneminde yoğunluk yaşanabilir.",
            "low": "KYK kapasitesi kısıtlı; özel yurt veya kiralık ev alternatifleri gerekir.",
        },
        "occupancy": {
            "high": "Yurt doluluk oranı düşük-orta; yerleşme şansı nispeten yüksek.",
            "mid": "Doluluk orta düzeyde; erken başvuru avantaj sağlar.",
            "low": "Yurt doluluğu yüksek; alternatif barınma planı şart.",
        },
        "rent": {
            "high": "Kampüs çevresi kira baskısı düşük veya yönetilebilir.",
            "mid": "Kira seviyeleri orta bandında; ev arkadaşı ile maliyet düşürülebilir.",
            "low": "Kampüs yakını kira baskısı yüksek; uzak ilçeler değerlendirilebilir.",
        },
    },
    "career": {
        "employment": {
            "high": "Mezun istihdam oranı güçlü; sektör talebi yüksek.",
            "mid": "İstihdam imkânları orta düzeyde; bölüme göre değişir.",
            "low": "İş bulma süreci rekabetçi; staj ve sertifika avantaj sağlar.",
        },
        "salary": {
            "high": "Başlangıç maaşı beklentileri sektör ortalamasının üzerinde.",
            "mid": "Maaş beklentileri orta bandında dengeli.",
            "low": "Başlangıç ücretleri sınırlı; deneyimle artış beklenir.",
        },
        "graduate": {
            "high": "Mezun başarı hikâyeleri ve kariyer ivmesi güçlü.",
            "mid": "Mezun performansı istikrarlı; sektöre göre farklılaşır.",
            "low": "Mezun kariyer takibi sınırlı verilerle değerlendirilir.",
        },
    },
    "ai_opportunity": {
        "teknopark": {
            "high": "Teknopark ve yapay zeka odaklı firmalara yakınlık fırsatları artırır.",
            "mid": "Bölgede teknoloji firmalarına erişim mümkündür.",
            "low": "Yapay zeka ekosistemi sınırlı; uzaktan veya yaz stajı alternatif olabilir.",
        },
        "tech_hub": {
            "high": "Teknoloji kümelenmesi ve startup yoğunluğu yüksek.",
            "mid": "Orta ölçekli teknoloji ekosistemi mevcut.",
            "low": "Teknoloji merkezlerine uzaklık fırsatları sınırlar.",
        },
        "research": {
            "high": "Ar-Ge laboratuvarları ve veri bilimi projeleri erişilebilir.",
            "mid": "Temel Ar-Ge altyapısı mevcut; proje bazlı katılım mümkün.",
            "low": "Ar-Ge imkânları sınırlıdır.",
        },
    },
    "internship": {
        "density": {
            "high": "Çevrede yoğun işyeri ve staj kontenjanı bulunur.",
            "mid": "Staj yapılabilecek kurum sayısı orta düzeydedir.",
            "low": "İşyeri yoğunluğu düşük; şehir dışı staj gerekebilir.",
        },
        "agreements": {
            "high": "Üniversite-sanayi staj protokolleri geniş kapsamlıdır.",
            "mid": "Temel staj anlaşmaları mevcuttur.",
            "low": "Kurumsal staj anlaşmaları sınırlıdır.",
        },
        "acceptance": {
            "high": "Stajyer kabul oranları yüksek; başvuru süreci desteklenir.",
            "mid": "Staj kabulü orta düzeyde rekabetçidir.",
            "low": "Staj bulma süreci zorlu olabilir.",
        },
    },
    "scholarship": {
        "rate": {
            "high": "Burs veya indirim oranı mali yükü önemli ölçüde azaltır.",
            "mid": "Kısmi burs veya indirim imkânları mevcuttur.",
            "low": "Burs desteği sınırlı; ücretli statü ağırlıklı olabilir.",
        },
        "type": {
            "high": "Devlet üniversitesi statüsü maliyet avantajı sağlar.",
            "mid": "Üniversite statüsü orta düzeyde maliyet profili oluşturur.",
            "low": "Vakıf veya yüksek ücretli program; bütçe planı önemlidir.",
        },
    },
    "startup": {
        "incubator": {
            "high": "Kuluçka merkezleri ve hızlandırıcı programlara erişim kolaydır.",
            "mid": "Temel girişimcilik destekleri mevcuttur.",
            "low": "Kuluçka imkânları sınırlı; online programlar alternatif olabilir.",
        },
        "teknopark": {
            "high": "Teknopark entegrasyonu girişim fırsatlarını güçlendirir.",
            "mid": "Bölgesel teknoparklara orta düzeyde erişim vardır.",
            "low": "Teknopark bağlantısı zayıftır.",
        },
        "ecosystem": {
            "high": "Girişimcilik ekosistemi aktif; mentorluk ve yatırımcı ağı güçlü.",
            "mid": "Girişimcilik topluluğu gelişmekte; fırsatlar proje bazlı.",
            "low": "Girişimcilik ekosistemi sınırlıdır.",
        },
    },
}

SUMMARY_TEMPLATES: Dict[str, Dict[str, str]] = {
    "transport": {
        "high": "{city}'de kampüs ve şehir içi ulaşım oldukça güçlüdür. Öğrenciler toplu taşıma ile kampüse rahat ulaşabilir, KYK yurtlarına erişim de genel olarak kolaydır.",
        "mid": "{city}'de ulaşım altyapısı orta düzeydedir. Toplu taşıma ve KYK yurt erişimi çoğu öğrenci için yönetilebilir.",
        "low": "{city}'de ulaşım seçenekleri sınırlı olabilir. Kampüse ve yurtlara erişim için planlı ulaşım önemlidir.",
    },
    "prestige": {
        "high": "{uni} diploma gücü ve işveren tanınırlığı açısından güçlü bir profil sunar.",
        "mid": "{uni} orta-üst düzeyde tanınırlık ve mezun ağı avantajı sağlar.",
        "low": "{uni} bölgesel ölçekte tanınırlıkla öne çıkar; sektörel tercih önemlidir.",
    },
    "academic": {
        "high": "{uni} akademik kadro ve öğrenme ortamı üst düzey memnuniyet gösterir.",
        "mid": "{uni} akademik kalite orta-üst bandında dengeli bir deneyim sunar.",
        "low": "{uni} akademik destek ve kaynaklar sınırlı olabilir; planlı çalışma önerilir.",
    },
    "student_life": {
        "high": "{city} kampüs yaşamı ve sosyal imkânlar öğrenciler için zengin bir ortam sunar.",
        "mid": "{city} kampüs yaşamı orta düzeyde aktif; kulüp ve etkinlikler mevcuttur.",
        "low": "{city} sosyal yaşam seçenekleri sınırlı olabilir.",
    },
    "industry": {
        "high": "{uni} sanayi bağlantıları ve staj imkânları güçlü sektör entegrasyonu sağlar.",
        "mid": "{uni} bölgesel sanayi ile orta düzeyde iş birliği fırsatları sunar.",
        "low": "{uni} sanayi entegrasyonu sınırlı; staj arayışı proaktif olmalıdır.",
    },
    "research": {
        "high": "{uni} araştırma çıktıları ve proje hacmi güçlü akademik üretkenlik gösterir.",
        "mid": "{uni} araştırma performansı orta-üst bandında istikrarlıdır.",
        "low": "{uni} araştırma imkânları sınırlı; disipline göre değişkenlik gösterir.",
    },
    "international": {
        "high": "{uni} uluslararasılaşma ve değişim programları güçlü erişim sunar.",
        "mid": "{uni} Erasmus ve uluslararası iş birlikleri orta düzeyde mevcuttur.",
        "low": "{uni} uluslararası fırsatlar sınırlıdır.",
    },
    "cost": {
        "high": "{city}'de öğrenci yaşam maliyeti genel olarak uygun veya dengeli banttadır.",
        "mid": "{city}'de yaşam maliyeti orta düzeydedir; bütçe planlaması önerilir.",
        "low": "{city}'de yaşam maliyeti yüksek; kira ve günlük giderler bütçeyi zorlayabilir.",
    },
    "housing": {
        "high": "{city}'de KYK ve özel yurt seçenekleri barınma açısından avantajlıdır.",
        "mid": "{city}'de barınma imkânları orta düzeyde; erken başvuru önemlidir.",
        "low": "{city}'de barınma seçenekleri kısıtlı; alternatif planlama gerekebilir.",
    },
    "career": {
        "high": "{uni} mezunları iş piyasasında güçlü istihdam ve kariyer ivmesi gösterir.",
        "mid": "{uni} mezun istihdamı orta düzeyde; bölüm ve sektör etkili olur.",
        "low": "{uni} kariyer fırsatları sınırlı olabilir; staj ve sertifika avantaj sağlar.",
    },
    "ai_opportunity": {
        "high": "{city} yapay zeka ve teknoloji ekosistemi güçlü fırsatlar sunar.",
        "mid": "{city} teknoloji firmalarına orta düzeyde erişim mümkündür.",
        "low": "{city} yapay zeka fırsatları sınırlı; uzaktan çalışma alternatif olabilir.",
    },
    "internship": {
        "high": "{city} staj kontenjanları ve işyeri yoğunluğu öğrenciler için avantajlıdır.",
        "mid": "{city} staj imkânları mevcut; rekabet dönemsel olarak artabilir.",
        "low": "{city} staj bulma süreci zorlayıcı olabilir.",
    },
    "scholarship": {
        "high": "Burs ve indirim imkânları mali yükü önemli ölçüde hafifletir.",
        "mid": "Kısmi burs veya indirim seçenekleri değerlendirilebilir.",
        "low": "Burs desteği sınırlı; ücret planlaması önemlidir.",
    },
    "startup": {
        "high": "{uni} girişimcilik ekosistemi ve kuluçka imkânları güçlüdür.",
        "mid": "{uni} girişimcilik destekleri orta düzeyde mevcuttur.",
        "low": "{uni} girişimcilik fırsatları sınırlıdır.",
    },
}


def _metric_field(metric_key: str) -> str:
    return "uniar" if metric_key == "student_life" else metric_key


def _score_percent(score: Optional[float]) -> int:
    if score is None:
        return 0
    try:
        return max(0, min(100, round(float(score) * 10)))
    except (TypeError, ValueError):
        return 0


def _band_key(score_percent: int, metric_key: str = "") -> str:
    if metric_key == "cost":
        if score_percent >= 80:
            return "high"
        if score_percent >= 45:
            return "mid"
        return "low"
    if score_percent >= 75:
        return "high"
    if score_percent >= 45:
        return "mid"
    return "low"


def _section_text(metric_key: str, section_id: str, band: str) -> str:
    texts = SECTION_TEXTS.get(metric_key, {}).get(section_id, {})
    return texts.get(band) or texts.get("mid") or ""


def build_metric_sections(metric_key: str, item: Dict[str, Any], score: Optional[float]) -> List[Dict[str, str]]:
    if score is None:
        return []
    band = _band_key(_score_percent(score), metric_key)
    sections: List[Dict[str, str]] = []
    for section_id, icon, title in SECTION_DEFS.get(metric_key, []):
        sections.append({
            "icon": icon,
            "title": title,
            "text": _section_text(metric_key, section_id, band),
        })
    return sections


def build_metric_summary(metric_key: str, item: Dict[str, Any], score: Optional[float]) -> str:
    field = _metric_field(metric_key)
    stored = item.get(f"{field}_desc")
    if stored and len(str(stored).strip()) > 30:
        if not any(x in str(stored).lower() for x in ("deterministik", "100 üzerinden", "heuristik")):
            return str(stored).strip()

    band = _band_key(_score_percent(score), metric_key)
    template = SUMMARY_TEMPLATES.get(metric_key, {}).get(band, "")
    city = str(item.get("city") or "Bölge")
    uni = str(item.get("university") or "Üniversite")
    return template.format(city=city, uni=uni) if template else "Kanıta dayalı değerlendirme modeli ile hesaplanmıştır."


def apply_metric_sections(item: Dict[str, Any]) -> None:
    for metric_key in METRIC_KEYS:
        field = _metric_field(metric_key)
        score = item.get(f"{field}_score")
        available = item.get(f"{field}_data_available")
        if score is None and not available:
            item.pop(f"{field}_sections", None)
            continue
        summary = build_metric_summary(metric_key, item, score)
        sections = build_metric_sections(metric_key, item, score)
        item[f"{field}_desc"] = summary
        item[f"{field}_sections"] = sections
