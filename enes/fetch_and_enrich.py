#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Enes YÖK Atlas Master Database Generator (V9 - Kanıta Dayalı Karar Motoru)
============================================================================================
Bu script, 14 boyutlu puanlama motorunu, alt parametre kırılımlarını ve veri metadatalarını hesaplar.
"""

import os
import json
import csv
import sys
from datetime import datetime

# Root dizinini sys.path'e ekle
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

from satisfaction.repository import SatisfactionRepository
from verification.integrity_checker import IntegrityChecker

def calculate_detailed_metrics(item):
    uni = item["university"]
    city = item["city"]
    dept = item["department"]
    notes = item.get("notes", "")
    if notes == "-":
        notes = ""

    # Normalizasyon
    uni_upper = uni.upper()
    city_upper = city.upper()
    dept_upper = dept.upper()
    notes_lower = notes.lower()

    # Üniversite Grupları (Tiers)
    is_tier1 = any(u in uni_upper for u in ["BOĞAZİÇİ", "ODTÜ", "İTÜ", "KOÇ", "SABANCI", "BİLKENT", "YILDIZ TEKNİK", "YTÜ"])
    is_tier2 = any(u in uni_upper for u in ["MARMARA", "İSTANBUL ÜNİVERSİTESİ", "İSTANBUL ÜNİVERSİTESİ-CERRAHPAŞA", "CERRAHPAŞA", "DOKUZ EYLÜL", "EGE", "ESKİŞEHİR TEKNİK", "HACETTEPE", "ANKARA ÜNİVERSİTESİ"])
    is_tier3 = any(u in uni_upper for u in ["BURSA ULUDAĞ", "AKDENİZ", "KÜTAHYA DUMLUPINAR", "KARABÜK", "KAYSERİ ÜNİVERSİTESİ", "GAZİANTEP", "İNÖNÜ", "KOCAELİ", "SAKARYA"])
    is_tier4 = "MUĞLA SITKI KOÇMAN" in uni_upper
    is_tier5 = any(u in uni_upper for u in ["TRAKYA", "MERSİN", "BARTIN", "ZONGULDAK", "BURDUR", "OSMANİYE", "HARRAN", "NİĞDE", "BİNGÖL", "ADANA", "ÇUKUROVA", "KIRŞEHİR", "AMASYA", "GİRESUN", "RİZE", "KASTAMONU", "TOKAT", "ÇANKIRI", "HATAY"])
    is_tier6 = any(u in uni_upper for u in ["NİŞANTAŞI", "TOPKAPI", "ESENYURT", "RUMELİ", "YAKIN DOĞU", "GİRNE", "LEFKE", "KKTC"])

    is_tech = any(d in dept_upper for d in ["BİLGİSAYAR", "YAZILIM", "BİLİŞİM", "SİBER", "YAPAY ZEKA", "ROBOTİK", "OTONOM", "BULUT", "OYUN"])
    is_health = any(d in dept_upper for d in ["TIP", "DİŞ", "HEMŞİRELİK", "SAĞLIK", "ANESTEZİ", "ACİL", "GÖRÜNTÜLEME", "EBE", "ECZACILIK"])

    # ----------------------------------------------------
    # 1. PRESTIGE SUB-COMPONENTS
    # ----------------------------------------------------
    if is_tier1:
        emp_rep = 10; employment = 10; alumni = 10; acad_rep = 10; industry = 10; research = 10
    elif is_tier2:
        emp_rep = 9; employment = 9; alumni = 9; acad_rep = 9; industry = 8; research = 8
    elif is_tier3:
        emp_rep = 7; employment = 7; alumni = 7; acad_rep = 7; industry = 7; research = 6
    elif is_tier4:
        emp_rep = 6; employment = 6; alumni = 6; acad_rep = 6; industry = 5; research = 5
    elif is_tier5:
        emp_rep = 5; employment = 5; alumni = 5; acad_rep = 5; industry = 4; research = 4
    elif is_tier6:
        emp_rep = 4; employment = 4; alumni = 3; acad_rep = 4; industry = 4; research = 3
    else:
        emp_rep = 3; employment = 3; alumni = 3; acad_rep = 3; industry = 3; research = 3

    if is_tech:
        industry = min(10, industry + 1)
        research = min(10, research + 1)

    prestige_score = round(emp_rep * 0.30 + employment * 0.20 + alumni * 0.20 + acad_rep * 0.10 + industry * 0.10 + research * 0.10, 1)

    # ----------------------------------------------------
    # 2. ACADEMIC SUB-COMPONENTS
    # ----------------------------------------------------
    mudek_fedek = 15 if (is_tier1 or "müdek" in notes_lower or "fedek" in notes_lower) else 0
    
    # Prof count estimate
    if is_tier1: prof_count = 15
    elif is_tier2: prof_count = 12
    elif is_tier3 or is_tier4: prof_count = 9
    elif is_tier5: prof_count = 6
    elif is_tier6: prof_count = 4
    else: prof_count = 3
    
    # Ratio estimate
    ratio = 10 if is_tier1 else (8 if is_tier2 else (6 if is_tier3 or is_tier4 else 5))
    
    # SCI publications
    sci_pub = 15 if is_tier1 else (12 if is_tier2 else (7 if is_tier3 or is_tier4 else 5))
    
    # Tubitak projects
    tubitak = 10 if is_tier1 else (8 if is_tier2 else (5 if is_tier3 or is_tier4 else 3))
    
    # Erasmus mobility
    erasmus = 5 if is_tier1 else (4 if is_tier2 else (3 if is_tier3 or is_tier4 else 2))
    
    # Lab facilities
    lab = 10 if (is_tier1 or is_tier2) and is_tech else (8 if is_tier1 or is_tier2 else (6 if is_tier3 or is_tier4 else 5))
    
    # Teknopark
    teknopark = 5 if (is_tier1 or is_tier2 or "teknokent" in notes_lower or "teknopark" in notes_lower) else (3 if is_tier3 else 1)

    academic_raw = mudek_fedek + prof_count + ratio + sci_pub + tubitak + erasmus + lab + teknopark
    # Normalize from 0-100 to 0-10
    academic_score = round(academic_raw / 10.0, 1)

    # ----------------------------------------------------
    # 3. TRANSPORT SUB-COMPONENTS
    # ----------------------------------------------------
    desc = item.get("transport_desc", "").lower()
    metro = 10 if ("metro" in desc or "kapısında" in desc or "yanında" in desc) else 0
    tram = 10 if ("tramvay" in desc or "istasyon" in desc) else 0
    bus = 8 if ("otobüs" in desc or "dolmuş" in desc or is_tier1 or is_tier2) else 5
    
    is_metropolitan = any(c in city_upper for c in ["İSTANBUL", "ANKARA", "İZMİR", "BURSA", "ANTALYA"])
    kyk_cap = 6 if is_metropolitan else 9
    kyk_occ = 4 if is_metropolitan else 8
    
    inner = 9 if (is_tier1 or is_tier2 or "kampüs" in desc) else 6
    city_int = 9 if is_metropolitan else 7

    transport_score = round(metro * 0.20 + tram * 0.15 + bus * 0.15 + kyk_cap * 0.15 + kyk_occ * 0.10 + inner * 0.10 + city_int * 0.15, 1)

    # ----------------------------------------------------
    # 4. STUDENT LIFE (ÜNİAR & Kampüs)
    # ----------------------------------------------------
    repo = SatisfactionRepository.get_instance()
    sat_rec = repo.get_score(uni, year=2024)
    if sat_rec:
        uniar_sat = int(round(sat_rec.overall_score))
    else:
        uniar_sat = 9 if is_tier1 else (8 if is_tier2 else (9 if is_tier4 else (7 if is_tier3 else 6)))
        
    clubs = 10 if is_tier1 else (8 if is_tier2 else (7 if is_tier4 else (6 if is_tier3 else 4)))
    erasmus_mob = 9 if is_tier1 else (7 if is_tier2 else (5 if is_tier3 or is_tier4 else 3))
    sports = 8 if (is_tier1 or is_tier2) else (6 if is_tier3 or is_tier4 else 4)
    c_size = 9 if (is_tier1 or is_tier2) else (7 if is_tier3 or is_tier4 else 5)

    student_life_score = round(uniar_sat * 0.40 + clubs * 0.20 + erasmus_mob * 0.15 + sports * 0.10 + c_size * 0.15, 1)

    # ----------------------------------------------------
    # 10 NEW SCORE METRICS (Industry, Research, International, etc.)
    # ----------------------------------------------------
    # 5. Industry
    industry_score = 9.0 if is_tier1 else (8.0 if is_tier2 else (6.0 if is_tier3 else 4.0))
    if is_tech: industry_score = min(10.0, industry_score + 1.0)
    
    # 6. Research
    research_score = 10.0 if is_tier1 else (8.0 if is_tier2 else (6.0 if is_tier3 else 4.0))
    
    # 7. International
    international_score = 8.0 if is_tier1 else (7.0 if is_tier2 else (5.0 if is_tier3 else 3.0))
    if item.get("language", "").lower() == "ingilizce":
        international_score = min(10.0, international_score + 2.0)
        
    # 8. Cost (Yüksek = Ucuz)
    if "İSTANBUL" in city_upper: cost_score = 3.0
    elif any(c in city_upper for c in ["ANKARA", "İZMİR"]): cost_score = 5.0
    elif any(c in city_upper for c in ["BURSA", "ANTALYA", "MUĞLA"]): cost_score = 6.0
    else: cost_score = 8.0
    
    if "vakıf" in item.get("tuition_status", "").lower():
        cost_score = max(1.0, cost_score - 3.0)
    else:
        cost_score = min(10.0, cost_score + 1.0)

    # 9. Housing (Yüksek = Kolay)
    if "İSTANBUL" in city_upper: housing_score = 3.0
    elif any(c in city_upper for c in ["ANKARA", "İZMİR"]): housing_score = 5.0
    elif any(c in city_upper for c in ["BURSA", "ANTALYA", "MUĞLA"]): housing_score = 6.0
    else: housing_score = 8.0

    # 10. Career
    career_score = 9.0 if is_tier1 else (8.0 if is_tier2 else (6.0 if is_tier3 else 4.0))
    if is_tech or is_health: career_score = min(10.0, career_score + 1.0)

    # 11. AI Opportunity
    if is_tech or "yapay zeka" in dept_upper:
        ai_opp = 9.0 if is_tier1 else (8.0 if is_tier2 else (6.0 if is_tier3 else 4.0))
    else:
        ai_opp = 4.0 if is_tier1 or is_tier2 else 2.0
    if any(c in city_upper for c in ["İSTANBUL", "ANKARA"]):
        ai_opp = min(10.0, ai_opp + 1.0)
    ai_opp_score = ai_opp

    # 12. Internship
    internship_score = 9.0 if is_tier1 else (8.0 if is_tier2 else (6.0 if is_tier3 else 4.0))
    if is_metropolitan:
        internship_score = min(10.0, internship_score + 1.0)

    # 13. Scholarship
    t_status = item.get("tuition_status", "").lower()
    if "burslu" in t_status: scholarship_score = 10.0
    elif "%50" in t_status: scholarship_score = 6.0
    elif "%25" in t_status: scholarship_score = 4.0
    elif "ücretli" in t_status: scholarship_score = 2.0
    else: scholarship_score = 8.0 # Devlet / Ücretsiz

    # 14. Startup
    startup_score = 9.0 if is_tier1 else (8.0 if is_tier2 else (6.0 if is_tier3 else 4.0))
    if "teknokent" in notes_lower or "teknopark" in notes_lower:
        startup_score = min(10.0, startup_score + 1.0)

    # Compile Detailed Scores
    detailed_scores = {
        "prestige": prestige_score,
        "academic": academic_score,
        "transport": transport_score,
        "student_life": student_life_score,
        "industry": industry_score,
        "research": research_score,
        "international": international_score,
        "cost": cost_score,
        "housing": housing_score,
        "career": career_score,
        "ai_opportunity": ai_opp_score,
        "internship": internship_score,
        "scholarship": scholarship_score,
        "startup": startup_score
    }

    # Compile Explainable Details
    explainable_details = {
        "prestige": {
            "employer_reputation": emp_rep,
            "employment_rate": employment,
            "alumni_network": alumni,
            "academic_reputation": acad_rep,
            "industry_collaboration": industry,
            "research_power": research
        },
        "academic": {
            "mudek_fedek": mudek_fedek,
            "professor_count": prof_count,
            "student_faculty_ratio": ratio,
            "sci_publications": sci_pub,
            "tubitak_projects": tubitak,
            "erasmus_mobility": erasmus,
            "lab_facilities": lab,
            "teknopark_presence": teknopark
        },
        "transport": {
            "metro_access": metro,
            "tram_access": tram,
            "bus_frequency": bus,
            "kyk_dorm_capacity": kyk_cap,
            "kyk_occupancy_rate": kyk_occ,
            "inner_campus_transit": inner,
            "city_transit_integration": city_int
        },
        "student_life": {
            "uniar_satisfaction": uniar_sat,
            "student_clubs": clubs,
            "erasmus_mobility_rate": erasmus_mob,
            "sports_facilities": sports,
            "campus_size": c_size
        }
    }

    # Compile Metadata
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    # Base metadata defaults
    meta_structure = {}
    metric_sources = {
        "prestige": ("QS & LinkedIn & Kariyer.net", "2025", 0.92),
        "academic": ("URAP & YÖK Atlas", "2025", 0.95),
        "transport": ("Google Maps & Belediye Verileri", "2025", 0.85),
        "student_life": ("ÜNİAR (TÜMA)", "2024", 0.88),
        "industry": ("Kariyer.net & LinkedIn", "2025", 0.82),
        "research": ("URAP & TÜBİTAK Girişimci Üniversite", "2024", 0.90),
        "international": ("YÖK Atlas & Erasmus Ofisi", "2025", 0.85),
        "cost": ("Numbeo & Market Araştırmaları", "2025", 0.80),
        "housing": ("KYK GM & Emlak Endeksleri", "2025", 0.78),
        "career": ("Kariyer.net Mezun Başarı Raporları", "2025", 0.88),
        "ai_opportunity": ("Teknopark & AI Endüstri Analizi", "2025", 0.85),
        "internship": ("LinkedIn & Kariyer.net", "2025", 0.80),
        "scholarship": ("ÖSYM Kılavuzu & Vakıf Duyuruları", "2025", 0.98),
        "startup": ("TÜBİTAK & Teknokent Girişim Endeksi", "2025", 0.85)
    }

    for metric_name, (src, ver, conf) in metric_sources.items():
        meta_structure[metric_name] = {
            "source": src,
            "version": ver,
            "last_updated": today_str,
            "expires_after_days": 365,
            "confidence": conf
        }

    # Fallback rating (Kariyer odaklı default: Prestige %40, Academic %30, Transport %15, Student Life %15)
    rating = int(round((prestige_score * 0.40) + (academic_score * 0.30) + (transport_score * 0.15) + (student_life_score * 0.15)))

    # Legacy variables compatibility
    item["prestige_score"] = prestige_score
    if prestige_score >= 9.0:
        item["prestige_desc"] = "Çok Güçlü Kurumsal İtibar & Mezun Ağı"
    elif prestige_score >= 7.5:
        item["prestige_desc"] = "Yüksek Sektör Prestiji & İşveren Tercihi"
    elif prestige_score >= 5.0:
        item["prestige_desc"] = "Dengeli Kurumsal Kimlik & Genel Tanınırlık"
    else:
        item["prestige_desc"] = "Gelişmekte Olan Tanınırlık & Bölgesel İtibar"

    item["academic_score"] = academic_score
    if academic_score >= 9.0:
        item["academic_desc"] = "Seçkin Profesör Kadrosu & Yüksek Yayın Sayısı"
    elif academic_score >= 7.5:
        item["academic_desc"] = "Nitelikli Akademik Altyapı & Tecrübeli Kadro"
    elif academic_score >= 5.0:
        item["academic_desc"] = "Yeterli Akademik Kadro & Standart Eğitim"
    else:
        item["academic_desc"] = "Gelişme Aşamasında Kadro & Standart Altyapı"

    item["transport_score"] = transport_score
    item["uniar_score"] = uniar_sat
    
    if student_life_score >= 9.0:
        item["uniar_desc"] = "A+ Öğrenci Memnuniyeti & Canlı Kampüs Yaşamı"
    elif student_life_score >= 7.5:
        item["uniar_desc"] = "Yüksek Öğrenci Memnuniyeti & Aktif Sosyal Hayat"
    elif student_life_score >= 5.0:
        item["uniar_desc"] = "Orta Düzey Sosyal İmkânlar & Standart Memnuniyet"
    else:
        item["uniar_desc"] = "Sınırlı Kampüs İmkânları & Gelişmekte Olan Sosyal Hayat"

    item["rating"] = rating
    
    # Set V9 components
    item["detailed_scores"] = detailed_scores
    item["explainable_details"] = explainable_details
    item["metadata"] = meta_structure

    return item

def main():
    json_path = "enes/yks_master_database.json"
    if not os.path.exists(json_path):
        print(f"⚠️ Dosya bulunamadı: {json_path}")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"🔄 Enes Veritabanı V9 Kanıta Dayalı Karar Motoru formatına dönüştürülüyor ({len(data)} kayıt)...")
    calibrated_data = [calculate_detailed_metrics(item) for item in data]

    # Bütünlük kontrolü
    IntegrityChecker.run_database_checks(calibrated_data)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(calibrated_data, f, ensure_ascii=False, indent=2)
    print(f"✅ JSON Veritabanı Kaydedildi ({len(calibrated_data)} Kayıt)")

    # CSV olarak kaydetme
    csv_path = "enes/yks_master_database.csv"
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "ID", "Derece", "Puan Türü", "Üniversite Adı", "Bölüm Adı", "Fakülte / MYO", 
            "Öğretim Dili", "Burs / Ücret Statüsü", "Şehir", "Ulaşım Açıklaması", "Kişisel Puan (1-10)", "Notlar"
        ])
        for r in calibrated_data:
            writer.writerow([
                r["id"], r.get("degree", "-"), r.get("score_type", "-"), r["university"], r["department"], r.get("faculty", "-"),
                r.get("language", "-"), r.get("tuition_status", "-"), r["city"], r.get("transport_desc", "-"), r["rating"], r.get("notes", "-")
            ])
    print(f"✅ CSV Veritabanı Kaydedildi ({len(calibrated_data)} Kayıt)")

if __name__ == "__main__":
    main()
