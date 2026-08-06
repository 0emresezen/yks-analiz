#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""string_dictionary.json içindeki İngilizce metrik açıklamalarını Türkçeye çevirir."""

from __future__ import annotations

import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DICT_PATH = os.path.join(ROOT, "data", "analysis", "2026", "string_dictionary.json")

TRANSLATIONS: dict[str, str] = {
    "Adequate dorms and apartments": "Yeterli KYK yurdu ve kiralık daire seçeneği",
    "Affordable area, many private and KYK dorms.": "Uygun fiyatlı bölge; çok sayıda özel yurt ve KYK seçeneği.",
    "Affordable housing, some yurt capacity.": "Uygun barınma; sınırlı yurt kapasitesi mevcut.",
    "Affordable housing, some yurt.": "Uygun barınma; bazı yurt imkânları var.",
    "Affordable rentals, many private yurts, some KYK.": "Uygun kira; çok özel yurt, sınırlı KYK kapasitesi.",
    "Affordable rents, KYK and private dorms available.": "Uygun kiralar; KYK ve özel yurt seçenekleri mevcut.",
    "Affordable to moderate, some yurt.": "Uygun-orta maliyet; bazı yurt imkânları var.",
    "Affordable, many private dorms and KYK yurts.": "Uygun maliyet; çok özel yurt ve KYK seçeneği.",
    "Affordable, sufficient private and KYK options.": "Uygun maliyet; yeterli özel yurt ve KYK seçeneği.",
    "Applied focus, strong local industry ties, regional career prospects.": "Uygulamalı odak; güçlü yerel sanayi bağlantıları ve bölgesel kariyer imkânları.",
    "Bus and minibus, near M2 metro station.": "Otobüs ve minibüs; M2 metro istasyonuna yakın.",
    "Bus and minibus, no metro, long commute to center.": "Otobüs ve minibüs; metro yok, merkeze uzun yolculuk.",
    "Bus lines and minibuses, no metro yet.": "Otobüs ve minibüs hatları; henüz metro yok.",
    "Central area, higher rents, some dorm options.": "Merkezi konum; kiralar yüksek, sınırlı yurt seçeneği.",
    "Developing state university in Adana with STEM focus and local industry ties.": "Adana'da gelişmekte olan devlet üniversitesi; STEM odağı ve yerel sanayi bağlantıları.",
    "Elite university, strong in all metrics, especially research, internationalization, career.": "Seçkin üniversite; araştırma, uluslararasılaşma ve kariyerde güçlü.",
    "Established regional state university with moderate local industry ties.": "Köklü bölgesel devlet üniversitesi; orta düzey yerel sanayi bağlantıları.",
    "Established regional university with moderate industry and research presence.": "Köklü bölgesel üniversite; orta düzey sanayi ve araştırma varlığı.",
    "Established technical university, strong in engineering, good regional and national reputation.": "Köklü teknik üniversite; mühendislikte güçlü, iyi bölgesel ve ulusal itibar.",
    "Expensive area, limited dorms, high rent": "Pahalı bölge; sınırlı yurt, yüksek kira",
    "Extremely high rents, few student accommodations.": "Çok yüksek kiralar; az öğrenci konaklama seçeneği.",
    "Ferry, metro, bus, Asian side hub": "Vapur, metro ve otobüs; Anadolu yakası ulaşım merkezi",
    "Few dorms, rural area, limited rental options": "Az yurt; kırsal bölge, sınırlı kiralık seçenek",
    "Few dorms, rural setting": "Az yurt; kırsal çevre",
    "Good availability, moderate rents, dorm variety.": "İyi barınma çeşitliliği; orta düzey kiralar.",
    "Good dormitory and apartment availability": "Yeterli yurt ve kiralık daire seçeneği",
    "Good dormitory and rental availability": "Yeterli yurt ve kiralık konut seçeneği",
    "Growing foundation university in industrial Kayseri, good local industry ties.": "Sanayi Kayseri'de büyüyen vakıf üniversitesi; iyi yerel sanayi bağlantıları.",
    "High rents, limited KYK, many private options.": "Yüksek kiralar; sınırlı KYK, çok özel seçenek.",
    "High rents, limited KYK, many private.": "Yüksek kiralar; sınırlı KYK, çok özel yurt.",
    "Innovative, international, strong in engineering/business, good Istanbul connections.": "Yenilikçi ve uluslararası; mühendislik/işletmede güçlü, İstanbul bağlantıları iyi.",
    "Istanbul foundation, benefits from city, average performance, not top-tier.": "İstanbul vakıf üniversitesi; şehir avantajı, orta performans.",
    "Istanbul-based foundation university with good tech and industry links.": "İstanbul merkezli vakıf üniversitesi; iyi teknoloji ve sanayi bağlantıları.",
    "KKTC university, strong international student focus, limited local industry.": "KKTC üniversitesi; uluslararası öğrenci odağı, sınırlı yerel sanayi.",
    "Large regional university in industrial Konya, good local industry ties.": "Sanayi Konya'da büyük bölgesel üniversite; iyi yerel sanayi bağlantıları.",
    "Large, established Istanbul university with strong industry and international ties.": "Köklü büyük İstanbul üniversitesi; güçlü sanayi ve uluslararası bağlantılar.",
    "Large, established state university in Antalya with strong tourism/agriculture ties.": "Antalya'da köklü devlet üniversitesi; turizm ve tarımda güçlü bağlantılar.",
    "Limited bus services, 30 km from city center, no metro": "Sınırlı otobüs; şehir merkezine 30 km, metro yok",
    "Lower rents, more affordable, some yurt.": "Daha düşük kiralar; uygun maliyet, bazı yurt imkânı.",
    "Many KYK dorms and private apartments nearby": "Yakında çok KYK yurdu ve özel daire seçeneği",
    "Marmaray and bus, but farther from center.": "Marmaray ve otobüs; merkeze görece uzak.",
    "Metro M1A, metrobus, Marmaray access.": "M1A metro, metrobüs ve Marmaray erişimi.",
    "Metro M1B and metrobus, decent city access.": "M1B metro ve metrobüs; şehir içi ulaşım yeterli.",
    "Metro M1B, metrobus, and bus lines with moderate commute.": "M1B metro, metrobüs ve otobüs; orta süreli yolculuk.",
    "Metro M2 and numerous bus lines, central location.": "M2 metro ve çok sayıda otobüs hattı; merkezi konum.",
    "Metro M2, tram, bus access; central location.": "M2 metro, tramvay ve otobüs; merkezi konum.",
    "Metro M4, Marmaray, and bus connections.": "M4 metro, Marmaray ve otobüs bağlantıları.",
    "Metro M4, Marmaray, bus connections.": "M4 metro, Marmaray ve otobüs bağlantıları.",
    "Metro M4, Marmaray, ferries, buses.": "M4 metro, Marmaray, vapur ve otobüs.",
    "Metro and bus connections, accessible": "Metro ve otobüs bağlantıları; erişilebilir",
    "Metro and bus, developing district": "Metro ve otobüs; gelişmekte olan semt",
    "Metro, tram, bus, and walking central Taksim area.": "Metro, tramvay, otobüs; merkezi Taksim bölgesi.",
    "Metro, tram, bus, central Istanbul location": "Metro, tramvay, otobüs; merkezi İstanbul konumu",
    "Metrobus and bus services, longer commute from center.": "Metrobüs ve otobüs; merkeze uzun yolculuk.",
    "Metrobus and bus, distant from city center.": "Metrobüs ve otobüs; şehir merkezine uzak.",
    "Metrobus and bus, good connectivity.": "Metrobüs ve otobüs; iyi bağlantı.",
    "Metrobus frequent, but no metro; bus supplements.": "Sık metrobüs; metro yok, otobüs destekliyor.",
    "Metrobus line, M1A metro station nearby.": "Metrobüs hattı; yakında M1A metro istasyonu.",
    "Metrobus station, bus lines, good connectivity.": "Metrobüs durağı ve otobüs hatları; iyi bağlantı.",
    "Minimal housing options": "Çok sınırlı barınma seçeneği",
    "Minimal housing, mostly rural": "Çok sınırlı barınma; çoğunlukla kırsal",
    "Mixed options, moderate rents, some privates.": "Karışık seçenekler; orta kiralar, bazı özel yurtlar.",
    "Mixed rents, some dorms but limited supply.": "Değişken kiralar; sınırlı yurt arzı.",
    "Moderate dorms, high rent in central area": "Orta düzey yurt; merkezde yüksek kira",
    "Moderate rental costs, some yurt options.": "Orta düzey kira; bazı yurt seçenekleri.",
    "Moderate rents, limited dorms near Santral.": "Orta kiralar; Santral çevresinde sınırlı yurt.",
    "Moderate rents, some yurt options.": "Orta kiralar; bazı yurt seçenekleri.",
    "Modern, English-medium, research-focused with strong industry ties.": "Modern, İngilizce eğitim; araştırma odaklı, güçlü sanayi bağlantıları.",
    "New state university, still developing, limited opportunities.": "Yeni devlet üniversitesi; gelişmekte, sınırlı fırsatlar.",
    "New university, still developing, regional focus.": "Yeni üniversite; gelişmekte, bölgesel odak.",
    "Newer state university in Alanya, strong in tourism, developing other fields.": "Alanya'da yeni devlet üniversitesi; turizmde güçlü, diğer alanlar gelişiyor.",
    "Niche university, strong in tourism, aviation, health; good regional industry links.": "Niş üniversite; turizm, havacılık ve sağlıkta güçlü, iyi bölgesel bağlantılar.",
    "Niche, strong in food/agriculture, good industry links in Konya.": "Gıda/tarımda güçlü niş üniversite; Konya'da iyi sanayi bağlantıları.",
    "Premier health sciences university with strong clinical ties in Istanbul.": "İstanbul'da önde gelen sağlık bilimleri üniversitesi; güçlü klinik bağlantılar.",
    "Prestigious arts/architecture university in Istanbul, strong creative industry ties.": "İstanbul'da prestijli sanat/mimarlık üniversitesi; güçlü yaratıcı endüstri bağları.",
    "Prominent Istanbul foundation university, strong in social sciences, tech, internationalization.": "Önde gelen İstanbul vakıf üniversitesi; sosyal bilimler, teknoloji ve uluslararasılaşmada güçlü.",
    "Rapidly growing, high international student numbers, strong local industry ties.": "Hızla büyüyen; çok uluslararası öğrenci, güçlü yerel sanayi bağları.",
    "Reasonable dorms and rental options": "Makul yurt ve kiralık seçenekler",
    "Regional focus, limited tech/industry opportunities in less developed city.": "Bölgesel odak; az gelişmiş şehirde sınırlı teknoloji/sanayi fırsatı.",
    "Regional state university with limited opportunities in a developing city.": "Gelişmekte olan şehirde bölgesel devlet üniversitesi; sınırlı fırsatlar.",
    "Regional state university with limited opportunities in a less developed city.": "Az gelişmiş şehirde bölgesel devlet üniversitesi; sınırlı fırsatlar.",
    "Regional state university, average performance, limited opportunities in tech.": "Bölgesel devlet üniversitesi; orta performans, teknolojide sınırlı fırsat.",
    "Regional university in Eastern Turkey, limited opportunities.": "Doğu Anadolu'da bölgesel üniversite; sınırlı fırsatlar.",
    "Regional university with developing infrastructure, moderate opportunities.": "Altyapısı gelişen bölgesel üniversite; orta düzey fırsatlar.",
    "Regional university with good local industry ties, developing tech focus.": "İyi yerel sanayi bağları olan bölgesel üniversite; teknoloji odağı gelişiyor.",
    "Regional university, developing infrastructure, some local industry ties.": "Bölgesel üniversite; gelişen altyapı, bazı yerel sanayi bağları.",
    "Small regional university in a less developed area, limited opportunities.": "Az gelişmiş bölgede küçük üniversite; sınırlı fırsatlar.",
    "Small regional university in an underdeveloped area, very limited opportunities.": "Gelişmemiş bölgede küçük üniversite; çok sınırlı fırsatlar.",
    "Small regional university with limited opportunities; challenging for career development.": "Küçük bölgesel üniversite; kariyer gelişimi için zorlayıcı, sınırlı fırsat.",
    "Small, new university in a developing region, limited opportunities.": "Gelişmekte olan bölgede küçük yeni üniversite; sınırlı fırsatlar.",
    "Small, new, regional university in a challenging economic environment.": "Zor ekonomik ortamda küçük yeni bölgesel üniversite.",
    "Smaller KKTC university with limited local opportunities.": "Daha küçük KKTC üniversitesi; sınırlı yerel fırsatlar.",
    "Smaller private university in Alanya, focused on local service sectors.": "Alanya'da küçük özel üniversite; yerel hizmet sektörlerine odaklı.",
    "Some dorms, moderate rental costs": "Bazı yurtlar; orta düzey kira maliyeti",
    "Specialized health sciences university with strong local clinical ties.": "Sağlık bilimleri odaklı üniversite; güçlü yerel klinik bağlantıları.",
    "Specialized in health, good local clinical ties, limited tech/startup focus.": "Sağlık odaklı; iyi klinik bağları, sınırlı teknoloji/girişimcilik odağı.",
    "Specialized in health, strong clinical ties in Ankara, growing reputation.": "Sağlık odaklı; Ankara'da güçlü klinik bağları, artan itibar.",
    "Strong in tourism, good local internship opportunities, limited tech.": "Turizmde güçlü; iyi yerel staj imkânı, sınırlı teknoloji.",
    "Strong industrial ties, good local career opportunities, benefits from Manisa OSB.": "Güçlü sanayi bağları; Manisa OSB avantajı, iyi yerel kariyer fırsatları.",
    "Strong local industry ties, practical focus, growing foundation university.": "Güçlü yerel sanayi bağları; uygulamalı odak, büyüyen vakıf üniversitesi.",
    "Technical focus, strong local industry ties, growing research potential.": "Teknik odak; güçlü yerel sanayi, artan araştırma potansiyeli.",
    "Top research university with strong industry links and excellent career prospects.": "Önde gelen araştırma üniversitesi; güçlü sanayi bağları ve mükemmel kariyer imkânları.",
    "Tram T1, metro M1A, and numerous bus connections.": "T1 tramvay, M1A metro ve çok sayıda otobüs bağlantısı.",
    "Tram T5, buses, and some metro within reach.": "T5 tramvay, otobüsler; bazı metro hatlarına erişim.",
    "Tram and bus access, near city center": "Tramvay ve otobüs; şehir merkezine yakın",
    "Tram and bus lines, central district": "Tramvay ve otobüs hatları; merkezi semt",
    "Tram line and frequent buses, central location": "Tramvay hattı ve sık otobüs; merkezi konum",
    "Tram, metro, bus, historical peninsula": "Tramvay, metro, otobüs; tarihi yarımada",
    "Very high rents, limited student housing options.": "Çok yüksek kiralar; sınırlı öğrenci konaklama seçeneği.",
    "Very high rents, scarce student housing supply.": "Çok yüksek kiralar; öğrenci konaklaması kıt.",
    "Very limited bus, 60 km from city": "Çok sınırlı otobüs; şehre 60 km",
    "Very limited bus, 80 km from city center": "Çok sınırlı otobüs; merkeze 80 km",
    "Very new university in industrial Bursa; still establishing its presence.": "Sanayi Bursa'da çok yeni üniversite; henüz yerleşiyor.",
}

# Deterministik bileşik puan satırları
for src, repl in [
    ("uniar", "ÜNİAR"),
    ("scholarship", "burs"),
    ("prestige", "prestij"),
    ("trend", "trend"),
    ("yok_rank", "YÖK sıra"),
]:
    pass

DETERMINISTIC_RE = re.compile(
    r"Deterministik bileşik puan — (\d+) kaynak \(([^)]+)\)"
)


def tr_deterministic(text: str) -> str:
    m = DETERMINISTIC_RE.match(text)
    if not m:
        return text
    count, keys = m.group(1), m.group(2)
    key_map = {
        "uniar": "ÜNİAR",
        "scholarship": "burs",
        "prestige": "prestij",
        "trend": "trend",
        "yok_rank": "YÖK sıra",
    }
    tr_keys = ", ".join(key_map.get(k.strip(), k.strip()) for k in keys.split(","))
    return f"Deterministik bileşik puan — {count} kaynak ({tr_keys})"


def main() -> None:
    with open(DICT_PATH, encoding="utf-8") as f:
        sd: dict[str, str] = json.load(f)

    changed = 0
    for key, value in sd.items():
        if not isinstance(value, str):
            continue
        new_val = TRANSLATIONS.get(value)
        if new_val:
            sd[key] = new_val
            changed += 1
            continue
        if value.startswith("Deterministik bileşik puan"):
            tr = tr_deterministic(value)
            if tr != value:
                sd[key] = tr
                changed += 1

    with open(DICT_PATH, "w", encoding="utf-8") as f:
        json.dump(sd, f, ensure_ascii=False, indent=2)

    print(f"Güncellenen girdi: {changed}")


if __name__ == "__main__":
    main()
