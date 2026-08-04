#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
YKS Tercih Analizlerini Gemini LLM ile Zenginleştirme Scripti
============================================================
Bu script:
1. google-generativeai kütüphanesini kontrol eder, yoksa kurar.
2. GEMINI_API_KEY ortam değişkenini veya kullanıcı girişini okur.
3. hakan/yks_master_database.json ve enes/yks_master_database.json dosyalarını okur.
4. Her program için detaylı, 4 paragraflık HTML formatında analiz raporu üretir.
5. Sonuçları 'ai_eval' alanına yazar ve veritabanlarını günceller.
"""

import os
import sys
import json
import subprocess

def install_and_import(package):
    try:
        __import__(package)
    except ImportError:
        print(f"📦 '{package}' kütüphanesi bulunamadı. Kuruluyor...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])

# Google Generative AI kütüphanesini kur/içe aktar
install_and_import("google.generativeai")
import google.generativeai as genai

def get_api_key():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("🔑 GEMINI_API_KEY ortam değişkeni bulunamadı.")
        api_key = input("Lütfen Gemini API Anahtarınızı (API Key) girin: ").strip()
    return api_key

def clean_html_response(text):
    # LLM çıktısından markdown kod bloklarını temizle
    text = text.strip()
    if text.startswith("```html"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()

def generate_ai_eval(model, record):
    uni = record.get("university", "")
    dept = record.get("department", "")
    city = record.get("city", "")
    degree = record.get("degree", "")
    tuition = record.get("tuition_status", "")
    lang = record.get("language", "")
    last_rank = record.get("last_rank", "-")
    history_rankings = record.get("history_rankings", [])
    history_q    # Prediction scores
    pred = record.get("prediction", {})
    tahmin_skor = pred.get("tahmini_skor", "-")
    
    # 14 Detailed Scores & Explanations
    scores = record.get("detailed_scores", {})
    exp = record.get("explainable_details", {})
    meta = record.get("metadata", {})
    
    # Format scores text for prompt
    scores_text = "\n".join([f"- {k.capitalize()}: {v}/10 (Güven: {meta.get(k, {}).get('confidence', 0.8)*100:.0f}%, Kaynak: {meta.get(k, {}).get('source', 'YÖK Atlas')})" for k, v in scores.items()])

    prompt = f"""
Sistem Rolü: Sen profesyonel bir YKS Tercih Danışmanı ve Akademik Analistsin.
Görevin, aşağıda detayları verilen üniversite programı için çok yönlü, kanıta ve verilere dayalı, profesyonel bir tercih analiz raporu (Türkçe) yazmaktır. Kendi kafandan puan uydurma; sana verilen metrikleri, veri yıllarını ve kaynakları referans al.

Program Bilgileri:
- Üniversite: {uni}
- Bölüm: {dept}
- Şehir: {city} ({degree})
- Öğrenim Türü & Burs: {tuition}
- Eğitim Dili: {lang}
- Geçen Yılki Taban Sıralama: {last_rank}
- Yapay Zeka Tahmini Yerleşme Skoru: {tahmin_skor}
- Son 4-5 Yıl Sıralama Geçmişi: {history_rankings}
- Son 4-5 Yıl Kontenjan Geçmişi: {history_quotas}
- Adayın Özel Koşulları ve Notları: {notes}

Hesaplanan 14 Metrik Değeri (Kanıta Dayalı):
{scores_text}

Lütfen bu verileri sentezleyerek tam olarak aşağıdaki 17 bölümden oluşan bir HTML raporu hazırla. 
Her bölümü bir `<div class="ai-report-section" data-section="section-name">` içine al. Bölüm başlığını `<h4>` etiketiyle yaz. Metin içerisindeki önemli terimleri ve sayısal verileri `<strong>` ile kalınlaştır.

Gerekli 17 Bölüm (Sırasıyla):
1. <h4>Genel Değerlendirme</h4>
2. <h4>Öne Çıkan Güçlü Yanlar</h4> (Metin veya <ul>/<li> listesi olarak)
3. <h4>Riskler</h4> (Metin veya <ul>/<li> listesi olarak)
4. <h4>Kimler İçin Uygun</h4>
5. <h4>Kimler İçin Uygun Değil</h4>
6. <h4>Sektördeki Konumu</h4>
7. <h4>Akademik Yapı</h4>
8. <h4>Şehir Analizi</h4>
9. <h4>Kampüs</h4>
10. <h4>Staj</h4>
11. <h4>Mezuniyet Sonrası</h4>
12. <h4>Son 5 Yıl Trendi</h4>
13. <h4>Kontenjan Analizi</h4>
14. <h4>Rakip Üniversiteler</h4>
15. <h4>Alternatif Tercihler</h4>
16. <h4>Yerleşme Olasılığı</h4>
17. <h4>Son Tavsiye</h4>

Önemli Kurallar:
- Markdown kullanma! Çıktıyı direkt olarak HTML tagleri (<div>, <h4>, <p>, <strong>, <ul>, <li>) ile yapılandır.
- Çıktıyı ```html ``` gibi bloklar içine alma. Direkt HTML metni ver.
- Objektif, gerçekçi ve yapıcı bir ton kullan. Cümleleri akıcı ve profesyonel kıl.
"""

    try:
        response = model.generate_content(prompt)
        return clean_html_response(response.text)
    except Exception as e:
        print(f"❌ Gemini API Hatası ({uni} - {dept}): {e}")
        return None

def process_database(model, json_path):
    if not os.path.exists(json_path):
        print(f"⚠️ Dosya bulunamadı: {json_path}")
        return

    print(f"\n📂 Veritabanı işleniyor: {json_path}")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    updated_count = 0
    total = len(data)
    
    for idx, record in enumerate(data, 1):
        uni = record.get("university", "")
        dept = record.get("department", "")
        print(f"   [{idx}/{total}] {uni} - {dept} analiz ediliyor...")
        
        # Zaten analiz edilmişse ve boş değilse atla (isteğe bağlı, burası ezmek için kapalı tutulabilir)
        # if record.get("ai_eval"):
        #     print("     -> Zaten analiz var, atlanıyor.")
        #     continue

        ai_eval = generate_ai_eval(model, record)
        if ai_eval:
            record["ai_eval"] = ai_eval
            updated_count += 1
        else:
            # Fallback (API hatası durumunda)
            record["ai_eval"] = f"<p><strong>{uni}</strong> bünyesindeki <strong>{dept}</strong> programı için detaylı yapay zeka analiz raporu oluşturulamadı. Genel verilere göre geçen yılki sıralaması <strong>{record.get('last_rank', '-')}</strong> olan bu program, adayın <strong>{record.get('notes', '-')}</strong> notuyla listesine girmiştir.</p>"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"💾 Güncellenen veritabanı kaydedildi: {json_path} ({updated_count}/{total} kayıt zenginleştirildi)")

def main():
    print("=" * 60)
    print("🤖 GEMINI AI YKS TERCİH DETAYLANDIRMA ARACI BAŞLATILDI")
    print("=" * 60)

    api_key = get_api_key()
    if not api_key:
        print("❌ Geçersiz API anahtarı. Script sonlandırılıyor.")
        sys.exit(1)

    genai.configure(api_key=api_key)
    
    # Standard Gemini 1.5 Flash modelini kullanıyoruz
    model = genai.GenerativeModel("gemini-1.5-flash")

    # Hakan'ın 8 Tercihi
    hakan_path = "hakan/yks_master_database.json"
    process_database(model, hakan_path)

    # Enes'in 96 Tercihi
    enes_path = "enes/yks_master_database.json"
    process_database(model, enes_path)

    print("\n✨ Tüm veritabanları başarıyla zenginleştirildi!")
    print("=" * 60)

if __name__ == "__main__":
    main()
