import re
import os
import requests
import json
from yokatlas_py.client import YokAtlasClient

raw_text = """
1	BURSA ULUDAĞ ÜNİVERSİTESİ - Bilgisayar ve Öğretim Teknolojileri Öğretmenliği	Bursa						
2	DOKUZ EYLÜL ÜNİVERSİTESİ - Bilgisayar ve Öğretim Teknolojileri Öğretmenliği	İzmir						
3	İSTANBUL ÜNİVERSİTESİ-CERRAHPAŞA - Bilgisayar ve Öğretim Teknolojileri Öğretmenliği	İstanbul						
4	TRAKYA ÜNİVERSİTESİ - Yazılım Geliştirme	Edirne						
5	ZONGULDAK BÜLENT ECEVİT ÜNİVERSİTESİ - Yazılım Geliştirme	Zonguldak						
6	İSTANBUL ESENYURT ÜNİVERSİTESİ (Vakıf) - Yazılım Geliştirme	İstanbul						
7	İSTANBUL NİŞANTAŞI ÜNİVERSİTESİ (Vakıf) - Yazılım Geliştirme	İstanbul						
8	İSTANBUL RUMELİ ÜNİVERSİTESİ (Vakıf) - Bilgisayar Bilimleri	İstanbul						
9	DOKUZ EYLÜL ÜNİVERSİTESİ - Bilgisayar Bilimleri	İzmir						
10	BURDUR MEHMET AKİF ERSOY ÜNİVERSİTESİ - Bilişim Sistemleri Mühendisliği	Burdur						
11	İSTANBUL TOPKAPI ÜNİVERSİTESİ (Vakıf) - Bilişim Sistemleri Mühendisliği	İstanbul						
12	MUĞLA SITKI KOÇMAN ÜNİVERSİTESİ - Bilişim Sistemleri Mühendisliği	Muğla						
13	BARTIN ÜNİVERSİTESİ - Bilgisayar Teknolojisi ve Bilişim Sistemleri	Bartın						
14	MERSİN ÜNİVERSİTESİ - Bilişim Sistemleri ve Teknolojileri	Mersin						
15	Niğde Ömer Halisdemir Üniversitesi - Bilişim Sistemleri ve Teknolojileri	Niğde						
16	GÜMÜŞHANE ÜNİVERSİTESİ - Yazılım Mühendisliği	Gümüşhane						
17	IĞDIR ÜNİVERSİTESİ - Yazılım Mühendisliği	Iğdır						
18	KAHRAMANMARAŞ İSTİKLAL ÜNİVERSİTESİ - Yazılım Mühendisliği	Kahramanmaraş						
19	KÜTAHYA DUMLUPINAR ÜNİVERSİTESİ - Yazılım Mühendisliği	Kütahya						
20	BURDUR MEHMET AKİF ERSOY ÜNİVERSİTESİ - Yazılım Mühendisliği	Burdur						
21	YAKIN DOĞU ÜNİVERSİTESİ - Yazılım Mühendisliği	KKTC						
22	KARABÜK ÜNİVERSİTESİ - Yazılım Mühendisliği	Karabük						
23	KIRGIZİSTAN-TÜRKİYE MANAS ÜNİVERSİTESİ - Bilgisayar Mühendisliği	Kırgızistan						
24	TÜRK-KAZAK ÜNİVERSİTESİ - Bilgisayar Mühendisliği	Kazakistan						
25	GİRNE AMERİKAN ÜNİVERSİTESİ( Vakıf) - Bilgisayar Mühendisliği	KKTC						
26	LEFKE AVRUPA ÜNİVERSİTESİ (Vakıf) - Bilgisayar Mühendisliği	KKTC						
27	BİNGÖL ÜNİVERSİTESİ - Bilgisayar Mühendisliği	Bingöl						
28	OSMANİYE KORKUT ATA ÜNİVERSİTESİ - Bilgisayar Mühendisliği	Osmaniye						
29	HARRAN ÜNİVERSİTESİ - Bilgisayar Mühendisliği	Şanlıurfa						
30	ADIYAMAN ÜNİVERSİTESİ - Bilgisayar Mühendisliği	Adıyaman						
31	ERZİNCAN BİNALİ YILDIRIM ÜNİVERSİTESİ - Bilgisayar Mühendisliği	Erzincan						
32	ARTVİN ÇORUH ÜNİVERSİTESİ - Bilgisayar Mühendisliği	Artvin						
33	MARDİN ARTUKLU ÜNİVERSİTESİ - Bilgisayar Mühendisliği	Mardin						
34	KAHRAMANMARAŞ SÜTÇÜ İMAM ÜNİVERSİTESİ - Bilgisayar Mühendisliği	Kahramanmaraş						
35	MALATYA TURGUT ÖZAL ÜNİVERSİTESİ - Bilgisayar Mühendisliği	Malatya						
36	KARABÜK ÜNİVERSİTESİ - Bilgisayar Mühendisliği	Karabük						
37	TOKAT GAZİOSMANPAŞA ÜNİVERSİTESİ - Bilgisayar Mühendisliği	Tokat						
38	ÇANKIRI KARATEKİN ÜNİVERSİTESİ - Bilgisayar Mühendisliği	Çankırı						
39	GAZİANTEP İSLAM BİLİM VE TEKNOLOJİ ÜNİVERSİTESİ - Bilgisayar Mühendisliği	Gaziantep						
40	İSKENDERUN TEKNİK ÜNİVERSİTESİ - Bilgisayar Mühendisliği	Hatay						
41	KIRŞEHİR AHİ EVRAN ÜNİVERSİTESİ - Bilgisayar Mühendisliği	Kırşehir						
42	NİĞDE ÖMER HALİSDEMİR ÜNİVERSİTES - Bilgisayar Mühendisliği	Niğde						
43	GİRESUN ÜNİVERSİTESİ - Bilgisayar Mühendisliği	Giresun						
44	RECEP TAYYİP ERDOĞAN ÜNİVERSİTESİ - Bilgisayar Mühendisliği	Rize						
45	KASTAMONU ÜNİVERSİTESİ - Bilgisayar Mühendisliği	Kastamonu						
46	BARTIN ÜNİVERSİTESİ - Bilgisayar Mühendisliği	Bartın						
47	AMASYA ÜNİVERSİTESİ - Bilgisayar Mühendisliği	Amasya						
48	KAYSERİ ÜNİVERSİTESİ - Yapay Zeka ve Makine Öğrenmesi	Kayseri						
49	AMASYA ÜNİVERSİTESİ - Yapay Zeka ve Makine Öğrenmesi	Amasya						
50	EGE ÜNİVERSİTESİ - Bilgisayar Programcılığı	İzmir	Ana Kampüs					
51	EGE ÜNİVERSİTESİ - Ön-Yüz Yazılım Geliştirme	İzmir	Ana Kampüs					
52	EGE ÜNİVERSİTESİ - Oyun Geliştirme ve Programlama	İzmir	Ana Kampüs					
53	EGE ÜNİVERSİTESİ - Otonom Sistemler Teknikerliği 	İzmir	Ana Kampüs					
54	EGE ÜNİVERSİTESİ - Grafik Tasarımı	İzmir	Ana Kampüs					
55	BURSA ULUDAĞ ÜNİVERSİTESİ - Anestezi	Bursa	Ana Kampüs					
56	BURSA ULUDAĞ ÜNİVERSİTESİ - İlk ve Acil Yardım	Bursa	Ana Kampüs					
57	BURSA ULUDAĞ ÜNİVERSİTESİ - Bilgisayar Programcılığı	Bursa	Ana Kampüs					
58	BURSA ULUDAĞ ÜNİVERSİTESİ - Tıbbi Laboratuvar Teknikleri	Bursa	Ana Kampüs					
59	BURSA ULUDAĞ ÜNİVERSİTESİ - Tıbbi Dokümantasyon ve Sekreterlik	Bursa	Ana Kampüs					
60	BURSA ULUDAĞ ÜNİVERSİTESİ - Robotik ve Yapay Zeka	Bursa	Ana Kampüs					
61	DOKUZ EYLÜL ÜNİVERSİTESİ - Anestezi	İzmir	Ana Kampüs					
62	DOKUZ EYLÜL ÜNİVERSİTESİ - İlk ve Acil Yardım 	İzmir	Ana Kampüs					
63	DOKUZ EYLÜL ÜNİVERSİTESİ - Tıbbi Görüntüleme Teknikleri	İzmir	Ana Kampüs					
64	DOKUZ EYLÜL ÜNİVERSİTESİ - Bilgisayar Programcılığı	İzmir	Ana Kampüs					
65	DOKUZ EYLÜL ÜNİVERSİTESİ - Ağız ve Diş Sağlığı	İzmir	Ana Kampüs					
66	DOKUZ EYLÜL ÜNİVERSİTESİ - Sivil Havacılık Kabin Hizmetleri	İzmir	Ana Kampüs					
67	AKDENİZ ÜNİVERSİTESİ - İlk ve Acil Yardım	Antalya	Ana Kampüs					
68	AKDENİZ ÜNİVERSİTESİ - Tıbbi Görüntüleme Teknikleri	Antalya	Ana Kampüs					
69	AKDENİZ ÜNİVERSİTESİ - Fizyoterapi	Antalya	Ana Kampüs					
70	AKDENİZ ÜNİVERSİTESİ - Bilgisayar Programcılığı	Antalya	Ana Kampüs					
71	AKDENİZ ÜNİVERSİTESİ - Robotik ve Yapay Zeka	Antalya	Ana Kampüs					
72	ESKİŞEHİR TEKNİK ÜNİVERSİTESİ - Siber Güvenlik Analistliği ve Operatörlüğü	Eskişehir	Ana Kampüs					
73	ESKİŞEHİR TEKNİK ÜNİVERSİTESİ - Robotik ve Yapay Zeka	Eskişehir	Ana Kampüs					
74	ESKİŞEHİR TEKNİK ÜNİVERSİTESİ - İnsansız Hava Aracı Teknolojisi ve Operatörlüğü	Eskişehir	Ana Kampüs					
75	ESKİŞEHİR TEKNİK ÜNİVERSİTESİ - Bilgisayar Programcılığı	Eskişehir	Ana Kampüs					
76	ESKİŞEHİR TEKNİK ÜNİVERSİTESİ - Sivil Havacılık Kabin Hizmetleri	Eskişehir	Ana Kampüs					
77	ESKİŞEHİR TEKNİK ÜNİVERSİTESİ - Oyun Geliştirme ve Programlama	Eskişehir	Ana Kampüs					
78	ESKİŞEHİR TEKNİK ÜNİVERSİTESİ - Bulut Bilişim Operatörlüğü	Eskişehir	Ana Kampüs					
79	MARMARA ÜNİVERSİTESİ - Bilgisayar Programcılığı	İstanbul	Ana Kampüs					
80	MARMARA ÜNİVERSİTESİ - Yapay Zeka Operatörlüğü	İstanbul	Ana Kampüs					
81	MARMARA ÜNİVERSİTESİ - Anestezi	İstanbul	Ana Kampüs					
82	MARMARA ÜNİVERSİTESİ - Makine	İstanbul	Ana Kampüs					
83	MARMARA ÜNİVERSİTESİ - Diş Protez Teknolojisi	İstanbul	Ana Kampüs					
84	MARMARA ÜNİVERSİTESİ - Tıbbi Görüntüleme Teknikleri	İstanbul	Ana Kampüs					
85	MARMARA ÜNİVERSİTESİ - Kontrol ve Otomasyon Teknolojisi	İstanbul	Ana Kampüs					
86	MARMARA ÜNİVERSİTESİ - Turist Rehberliği	İstanbul	Ana Kampüs					
87	MARMARA ÜNİVERSİTESİ - Turizm ve Otel İşletmeciliği	İstanbul	Ana Kampüs					
88	MARMARA ÜNİVERSİTESİ - Ceza İnfaz ve Güvenlik Hizmetleri	İstanbul	Ana Kampüs					
89	İSTANBUL ÜNİVERSİTESİ-CERRAHPAŞA - Bilgisayar Programcılığı	İstanbul	Ana Kampüs					
90	İSTANBUL ÜNİVERSİTESİ-CERRAHPAŞA - Tıbbi Görüntüleme Teknikleri	İstanbul	Ana Kampüs					
91	İSTANBUL ÜNİVERSİTESİ-CERRAHPAŞA - Sivil Havacılık Kabin Hizmetleri	İstanbul	Ana Kampüs					
92	İSTANBUL ÜNİVERSİTESİ-CERRAHPAŞA - Diş Protez Teknolojisi	İstanbul	Ana Kampüs					
93	İSTANBUL ÜNİVERSİTESİ-CERRAHPAŞA - Ağız ve Diş Sağlığı	İstanbul	Ana Kampüs					
94	İSTANBUL ÜNİVERSİTESİ-CERRAHPAŞA - Uçak Teknolojisi	İstanbul	Ana Kampüs					
95	İSTANBUL ÜNİVERSİTESİ-CERRAHPAŞA - Sanal ve Artırılmış Gerçeklik	İstanbul	Ana Kampüs					
96	İSTANBUL ÜNİVERSİTESİ-CERRAHPAŞA - Tıbbi Dokümantasyon ve Sekreterlik	İstanbul	Ana Kampüs					
"""

lines = raw_text.strip().split("\n")
markdown_lines = []
markdown_lines.append("| Veritabanı | Üniversite & Bölüm Adı | Şehir | Kontenjan / Konum | Geçen Yılki Sıralama | Kişisel Puanım (1-10) | Notlar / Artılar - Eksiler | Sıralama Trendi | Tahmini Skor |")
markdown_lines.append("| :---: | :--- | :--- | :--- | :---: | :---: | :--- | :---: | :---: |")

departments = set()

for idx, line in enumerate(lines, 1):
    parts = line.split("\t")
    # Clean up empty spaces and fill to at least 9 columns
    cols = [p.strip() for p in parts]
    while len(cols) < 9:
        cols.append("-")
    
    # ensure it defaults to "-" if empty
    cols = [c if c else "-" for c in cols]
    
    db_id = str(idx)
    uni_dept = cols[1]
    city = cols[2]
    loc = cols[3]
    rank = cols[4]
    rating = cols[5]
    notes = cols[6]
    trend = cols[7]
    pred = cols[8]
    
    md_row = f"| **{db_id}** | {uni_dept} | {city} | {loc} | {rank} | {rating} | {notes} | {trend} | {pred} |"
    markdown_lines.append(md_row)
    
    if " - " in uni_dept:
        dept_name = uni_dept.split(" - ")[-1].strip()
        departments.add(dept_name)

md_content = "\n".join(markdown_lines)
with open("engine/lisans_tercih_analizi.md", "w", encoding="utf-8") as f:
    f.write(md_content)

print(f"Written markdown file with {len(lines)} records.")
print(f"Found {len(departments)} unique departments.")

# Update program_index
print("Updating program index...")
client = YokAtlasClient()
client._ensure_lookups()

group_ids = []
for g in client._lookups.program_groups:
    if g.birim_grup_adi in departments:
        group_ids.append(g.birim_grup_id)

payload = {
    "filters": {
        "puanTuru": None, "universiteId": [], "birimGrupId": group_ids, "ilKodu": [],
        "birimTuruId": None, "universiteTuru": None, "bursOraniId": None, "ogrenimTuruId": None,
        "kilavuzKodu": None, "minBasariSirasi": None, "maxBasariSirasi": None
    },
    "page": 0, "size": 3000, "sortBy": "basariSirasi", "direction": "ASC"
}

resp = requests.post("https://yokatlas.yok.gov.tr/api/tercih-kilavuz/search", json=payload, headers={"User-Agent": "Mozilla/5.0"})
data = resp.json().get("content", [])

program_index = []
for p in data:
    uni = p.get("universiteAdi")
    dept = p.get("birimGrupAdi")
    city = p.get("ilAdi")
    program_id = str(p.get("kilavuzKodu", ""))
    if not program_id:
        continue
        
    full_title = f"{uni} - {dept}"
    program_index.append({
        "program_id": program_id,
        "full_title": full_title,
        "city": city
    })

os.makedirs("data", exist_ok=True)
with open("data/program_index.json", "w", encoding="utf-8") as f:
    json.dump(program_index, f, ensure_ascii=False, indent=2)

print(f"Created data/program_index.json with {len(program_index)} entries.")
