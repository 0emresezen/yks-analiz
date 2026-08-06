/** Alt metrik skorlarına göre nitel açıklama cümleleri. */

const SUB_LABELS = {
  employer_reputation: 'İşveren İtibarı',
  employment_rate: 'İstihdam Oranı',
  alumni_network: 'Mezun Ağı',
  academic_reputation: 'Akademik İtibar',
  industry_collaboration: 'Sanayi İş Birliği',
  research_power: 'Araştırma Gücü',
  mudek_fedek: 'MÜDEK/FEDEK Akreditasyonu',
  professor_count: 'Profesör Sayısı',
  student_faculty_ratio: 'Öğrenci/Hoca Oranı',
  sci_publications: 'SCI Yayın Performansı',
  tubitak_projects: 'TÜBİTAK Projeleri',
  erasmus_mobility: 'Erasmus Anlaşmaları',
  lab_facilities: 'Laboratuvar Altyapısı',
  teknopark_presence: 'Teknopark Varlığı',
  metro_access: 'Metro Erişimi',
  tram_access: 'Tramvay Erişimi',
  bus_frequency: 'Otobüs Sıklığı',
  kyk_dorm_capacity: 'KYK Yurt Kapasitesi',
  kyk_occupancy_rate: 'KYK Doluluk Durumu',
  inner_campus_transit: 'Kampüs Ulaşımı',
  city_transit_integration: 'Şehir İçi Ulaşım Entegrasyonu',
  uniar_satisfaction: 'ÜNİAR Memnuniyeti',
  student_clubs: 'Öğrenci Kulüpleri',
  erasmus_mobility_rate: 'Erasmus Değişimi',
  sports_facilities: 'Spor Tesisleri',
  campus_size: 'Kampüs Genişliği',
}

export const getQualitativeReason = (subKey, value) => {
  switch (subKey) {
    case 'employer_reputation':
      if (value >= 9) return "İşveren saygınlığı ve diploma değeri zirve seviyede.";
      if (value >= 7) return "Sektörde yüksek tanınırlık ve kurumsal marka gücü.";
      if (value >= 5) return "Ortalama sektör tanınırlığına sahip diploma.";
      return "Sektör tanınırlığı sınırlı, bireysel portfolyo daha önemli.";
    case 'employment_rate':
      if (value >= 9) return "Mezunların ilk 3-6 ayda işe yerleşme oranı çok yüksek.";
      if (value >= 7) return "İstihdam oranları ve iş bulma hızı tatmin edici seviyede.";
      if (value >= 5) return "Ortalama işe yerleşme hızı, staj tecrübesi gerektirir.";
      return "İstihdam süreleri uzun, adayların kendilerini geliştirmesi şart.";
    case 'alumni_network':
      if (value >= 9) return "Çok güçlü ve sektörü domine eden mezun ağı.";
      if (value >= 7) return "Geniş mezun ağı ve aktif dayanışma platformları.";
      if (value >= 5) return "Standart mezun ilişkileri ve bölgesel iş birlikleri.";
      return "Gelişmekte olan, sınırlı mezun ağı gücü.";
    case 'academic_reputation':
      if (value >= 9) return "Ulusal ve uluslararası akademik çevrelerde yüksek saygınlık.";
      if (value >= 7) return "Köklü akademik gelenek ve bilimsel tanınırlık.";
      if (value >= 5) return "Temel akademik standartları karşılayan saygınlık.";
      return "Akademik bilinirliği ve yayın performansı sınırlı.";
    case 'industry_collaboration':
      if (value >= 8) return "Sanayi projeleri (TÜBİTAK vb.) ve ortaklıklar çok güçlü.";
      if (value >= 6) return "Düzenli sanayi iş birlikleri ve staj anlaşmaları mevcut.";
      if (value >= 4) return "Temel düzeyde sanayi entegrasyonu var.";
      return "Sanayi iş birlikleri ve sektör bağlantıları zayıf.";
    case 'research_power':
      if (value >= 8) return "Bilimsel araştırma altyapısı ve laboratuvar olanakları üst düzey.";
      if (value >= 6) return "Aktif araştırma projeleri ve araştırma merkezleri var.";
      if (value >= 4) return "Temel araştırma ve proje faaliyetleri yürütülüyor.";
      return "Araştırma ve geliştirme (Ar-Ge) altyapısı sınırlı.";
    case 'mudek_fedek':
      return value > 0 ? "MÜDEK/FEDEK akreditasyonuna sahip, müfredat onaylı." : "Akreditasyon süreci henüz tamamlanmamış.";
    case 'professor_count':
      if (value >= 12) return "Çok zengin profesör kadrosu ve köklü anabilim dalı.";
      if (value >= 8) return "Yeterli sayıda profesör ve deneyimli öğretim kadrosu.";
      if (value >= 5) return "Standart profesör kadrosu ve genç akademisyenler.";
      return "Profesör sayısı kısıtlı, kadro gelişme aşamasında.";
    case 'student_faculty_ratio':
      if (value >= 8) return "Hoca-öğrenci oranı çok iyi (birebir iletişim kolay).";
      if (value >= 6) return "Hoca-öğrenci oranı standart ve dengeli.";
      return "Hoca başına düşen öğrenci sayısı yüksek (kalabalık sınıflar).";
    case 'sci_publications':
      if (value >= 12) return "Uluslararası SCI indeksli yayın performansı mükemmel.";
      if (value >= 7) return "Akademisyenlerin SCI dergilerindeki yayın sayısı iyi.";
      return "Akademik kadronun SCI yayın üretkenliği geliştirilmeli.";
    case 'tubitak_projects':
      if (value >= 8) return "Çok sayıda aktif TÜBİTAK ve AR-GE projesi barındırıyor.";
      if (value >= 5) return "Yürütülen TÜBİTAK ve bilimsel araştırma projeleri mevcut.";
      return "Proje üretkenliği ve fonlama performansı düşük.";
    case 'erasmus_mobility':
      if (value >= 4) return "Avrupa'nın seçkin üniversiteleriyle çok yönlü Erasmus anlaşmaları.";
      if (value >= 3) return "Yeterli sayıda kontenjan ve Erasmus değişim imkanı.";
      return "Uluslararası değişim ve Erasmus olanakları sınırlı.";
    case 'lab_facilities':
      if (value >= 8) return "Gelişmiş donanımlı laboratuvarlar ve AR-GE altyapısı var.";
      if (value >= 6) return "Öğrencilerin kullanımı için yeterli bilgisayar/laboratuvar ortamı.";
      return "Laboratuvar olanakları temel standartlarda.";
    case 'teknopark_presence':
      if (value >= 5) return "Üniversite bünyesinde çok güçlü bir Teknoloji Geliştirme Bölgesi var.";
      if (value >= 3) return "Teknokent/Teknopark iş birlikleri ve staj imkanları mevcut.";
      return "Bünyesinde teknopark bulunmuyor veya pasif durumda.";
    case 'metro_access':
      return value >= 8 ? "Metro istasyonuna yürüme mesafesinde kolay erişim var." : "Doğrudan metro durağı veya hattı bulunmuyor.";
    case 'tram_access':
      return value >= 8 ? "Tramvay istasyonuna yürüme mesafesinde kolay erişim var." : "Doğrudan tramvay bağlantısı bulunmuyor.";
    case 'bus_frequency':
      if (value >= 8) return "Çok sık kalkan otobüs ve dolmuş hatları kampüse ulaşıyor.";
      if (value >= 6) return "Otobüs sefer sıklığı yeterli, ulaşım sorunu yaşanmıyor.";
      return "Toplu taşıma sefer sıklığı seyrek, ulaşım planlanmalı.";
    case 'kyk_dorm_capacity':
      if (value >= 8) return "KYK yurt kapasitesi bölge için oldukça yüksek.";
      if (value >= 6) return "Yurt sayısı ve kapasitesi dengeli.";
      return "KYK yurt kapasitesi kısıtlı veya yoğun talep var.";
    case 'kyk_occupancy_rate':
      if (value >= 8) return "KYK yurdu bulma ve yerleşme ihtimali yüksek (düşük yoğunluk).";
      if (value >= 5) return "KYK yurt doluluk oranları orta seviyede.";
      return "Yurt doluluk oranları çok yüksek (yedek sırası beklenebilir).";
    case 'inner_campus_transit':
      if (value >= 8) return "Kampüs içi ring, servis ve ulaşım imkanları çok düzenli.";
      return "Kampüs içi ulaşım yürüyerek veya temel araçlarla yapılıyor.";
    case 'city_transit_integration':
      if (value >= 8) return "Büyükşehir toplu taşıma kartları ve entegrasyonu çok gelişmiş.";
      return "Şehir içi ulaşım entegrasyonu temel düzeyde.";
    case 'uniar_satisfaction':
      if (value >= 9) return "ÜNİAR genel öğrenci memnuniyeti puanı zirve (A+) grupta.";
      if (value >= 7) return "Öğrencilerin genel üniversite memnuniyeti yüksek derecede.";
      if (value >= 5) return "Orta seviyede öğrenci memnuniyeti raporlanmış.";
      return "Öğrenci memnuniyet oranları düşük seviyede seyrediyor.";
    case 'student_clubs':
      if (value >= 8) return "Çok aktif öğrenci kulüpleri ve zengin sosyal etkinlikler.";
      if (value >= 6) return "Yeterli sayıda kulüp faaliyeti ve topluluk mevcut.";
      return "Öğrenci kulüpleri ve kampüs sosyal yaşamı durağan.";
    case 'erasmus_mobility_rate':
      if (value >= 7) return "Yurt dışına giden ve gelen Erasmus öğrenci yoğunluğu yüksek.";
      if (value >= 5) return "Erasmus programıyla yurt dışı değişim oranları dengeli.";
      return "Uluslararası öğrenci hareketliliği düşük seviyede.";
    case 'sports_facilities':
      if (value >= 8) return "Gelişmiş spor salonları, sahalar ve yüzme havuzları mevcut.";
      if (value >= 6) return "Öğrencilerin yararlanabileceği spor tesisleri bulunuyor.";
      return "Spor tesisleri ve rekreasyon alanları sınırlı.";
    case 'campus_size':
      if (value >= 8) return "Çok geniş, yeşil alanları bol ve modern bir kampüs.";
      if (value >= 6) return "Standart genişlikte ve sosyal alanları olan bir yerleşke.";
      return "Sınırlı alana sahip şehir veya bina kampüsü.";
    default:
      return ''
  }
}
