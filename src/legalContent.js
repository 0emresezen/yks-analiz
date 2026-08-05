import {
  BRAND_NAME,
  BRAND_HOME_URL,
  CONTACT_EMAIL,
  LEGAL_LAST_UPDATED,
} from './brand.js'

export const LEGAL_SECTIONS = [
  {
    id: 'overview',
    title: 'Hakkında',
    shortTitle: 'Hakkında',
    content: `
      <p><strong>${BRAND_NAME}</strong>, üniversite tercih döneminde programları metriklerle kıyaslamanız, ikili karşılaştırma sihirbazı ile sıralamanız ve listenizi farklı formatlarda dışa aktarmanız için hazırlanmış ücretsiz bir karar destek aracıdır.</p>
      <p>Platform; resmî kaynaklardan derlenen verileri, istatistiksel tahminleri ve (bazı metriklerde) yapay zekâ destekli değerlendirmeleri bir arada sunar. Sunulan bilgiler <strong>tavsiye niteliğindedir</strong>; nihai tercih kararı tamamen size aittir.</p>
      <h3>Önemli hatırlatmalar</h3>
      <ul>
        <li>Tercih vermeden önce <a href="https://yokatlas.yok.gov.tr/" target="_blank" rel="noopener noreferrer">YÖK Atlas</a> ve ÖSYM tercih kılavuzunu esas alın.</li>
        <li>Puan, sıralama ve kontenjan verileri değişebilir; güncelleme gecikmeleri olabilir.</li>
        <li>Listeniz yalnızca tarayıcınızda saklanır; hesap açmanız gerekmez.</li>
      </ul>
      <p class="legal-meta">Son güncelleme: ${LEGAL_LAST_UPDATED}</p>
    `,
  },
  {
    id: 'privacy',
    title: 'Gizlilik Politikası',
    shortTitle: 'Gizlilik',
    content: `
      <p>Bu Gizlilik Politikası, <strong>${BRAND_NAME}</strong> (${BRAND_HOME_URL}) üzerinden işlenen bilgileri açıklar.</p>

      <h3>Toplanan veriler</h3>
      <p>Platform, kişisel hesap veya üyelik gerektirmez. Aşağıdaki veriler yalnızca hizmetin çalışması için işlenebilir:</p>
      <ul>
        <li><strong>Tercih verileri (tarayıcıda):</strong> Oluşturduğunuz program listesi, favoriler, notlar, sıralama ve sihirbaz durumu — yalnızca cihazınızda (localStorage / sessionStorage) saklanır.</li>
        <li><strong>Erişim logları:</strong> Barındırma sağlayıcısı (Vercel) tarafından tutulan IP adresi, tarayıcı türü ve istek zamanı gibi teknik kayıtlar.</li>
      </ul>
      <p>Ad, soyad, T.C. kimlik numarası veya e-posta adresi gibi doğrudan kimlik bilgileri <strong>toplanmaz</strong>. Tercih listeniz ve notlarınız <strong>sunucuda saklanmaz</strong>.</p>

      <h3>Verilerin saklanması</h3>
      <ul>
        <li><strong>Tarayıcı:</strong> Tercih listeniz ve arayüz ayarlarınız, siz silene veya tarayıcı verilerini temizleyene kadar cihazınızda kalır.</li>
        <li><strong>Barındırma logları:</strong> Vercel erişim logları, sağlayıcının saklama politikasına tabidir.</li>
      </ul>

      <h3>Üçüncü taraf hizmetler</h3>
      <ul>
        <li><strong>Vercel</strong> — site barındırma ve CDN</li>
        <li><strong>Google Fonts</strong> — yazı tipi yükleme (IP adresiniz Google sunucularına iletilebilir)</li>
      </ul>
      <p>Google Analytics, Meta Pixel, reklam ağları veya benzeri izleme araçları <strong>kullanılmamaktadır</strong>.</p>

      <h3>Çerezler ve yerel depolama</h3>
      <p>Reklam veya analitik amaçlı çerez kullanılmaz. Hizmetin çalışması için tarayıcınızda yerel depolama kullanılır; bu veriler tercih listenizi hatırlamak içindir ve istediğiniz zaman tarayıcı ayarlarından silebilirsiniz.</p>

      <p class="legal-meta">Son güncelleme: ${LEGAL_LAST_UPDATED}</p>
    `,
  },
  {
    id: 'kvkk',
    title: 'KVKK Aydınlatma Metni',
    shortTitle: 'KVKK',
    content: `
      <p>6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) kapsamında, <strong>${BRAND_NAME}</strong> olarak kişisel verilerinizin işlenmesine ilişkin aydınlatma metni aşağıdadır.</p>

      <h3>Veri sorumlusu</h3>
      <p><strong>${BRAND_NAME}</strong><br>İletişim: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>

      <h3>İşlenen kişisel veriler</h3>
      <ul>
        <li>Tarayıcıda saklanan tercih listesi, favori durumu ve notlar (yalnızca cihazınızda)</li>
        <li>IP adresi ve erişim logları (barındırma altyapısı kapsamında)</li>
      </ul>
      <p>Tercih verileriniz sunucuya aktarılmaz ve sunucuda saklanmaz.</p>

      <h3>İşleme amaçları</h3>
      <ul>
        <li>Platform hizmetinin sunulması</li>
        <li>Hizmet güvenliği ve teknik sorunların giderilmesi</li>
        <li>Yasal yükümlülüklerin yerine getirilmesi</li>
      </ul>

      <h3>Hukuki sebep</h3>
      <p>Verileriniz; KVKK m. 5/2 (c) “bir sözleşmenin kurulması veya ifası” ve (f) “meşru menfaat” hükümlerine dayanılarak işlenmektedir.</p>

      <h3>Aktarım</h3>
      <p>Erişim logları, barındırma hizmeti (Vercel) kapsamında yurt dışında sunucu kullanılabilir.</p>

      <h3>Haklarınız (KVKK m. 11)</h3>
      <p>Kişisel verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltme, silme ve itiraz etme haklarına sahipsiniz. Başvuru: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>

      <p class="legal-meta">Son güncelleme: ${LEGAL_LAST_UPDATED}</p>
    `,
  },
  {
    id: 'terms',
    title: 'Kullanım Koşulları',
    shortTitle: 'Kullanım Koşulları',
    content: `
      <p><strong>${BRAND_NAME}</strong> web sitesini kullanarak aşağıdaki koşulları kabul etmiş sayılırsınız.</p>

      <h3>Hizmetin niteliği</h3>
      <ul>
        <li>Platform, üniversite tercih sürecinde <strong>bilgi ve karar destek</strong> amacıyla sunulmaktadır.</li>
        <li>Hizmet <strong>“olduğu gibi” (as is)</strong> sağlanır; kesintisiz veya hatasız çalışacağı garanti edilmez.</li>
        <li>Sunulan puan, sıralama tahmini ve metrikler <strong>kesin doğruluk garantisi taşımaz</strong>.</li>
      </ul>

      <h3>Kullanıcı yükümlülükleri</h3>
      <ul>
        <li>Tercih vermeden önce resmî ÖSYM kılavuzu ve YÖK Atlas ile bilgileri doğrulamak sizin sorumluluğunuzdadır.</li>
        <li>Nihai tercih kararı ve sonuçları tamamen size aittir.</li>
        <li>Platformu hukuka aykırı amaçlarla veya hizmeti bozacak şekilde kullanamazsınız.</li>
        <li>Yazdığınız notlar ve oluşturduğunuz listelerden siz sorumlusunuz.</li>
      </ul>

      <h3>Yapay zekâ ve tahminler</h3>
      <p>Bazı metrikler yapay zekâ destekli tahminlerle veya istatistiksel modellerle üretilmiştir. Bu sonuçlar hata veya eksiklik içerebilir; resmî veriler her zaman önceliklidir.</p>

      <h3>Fikri mülkiyet</h3>
      <p>Site tasarımı, yazılım, logo, metrik algoritmaları ve özgün içerikler ${BRAND_NAME}’e aittir; izinsiz kopyalanamaz veya ticari amaçla kullanılamaz. Resmî kaynak verileri ilgili kurumların kullanım koşullarına tabidir.</p>

      <h3>Hizmet değişiklikleri</h3>
      <p>Platform özellikleri, veri kaynakları ve bu koşullar önceden bildirim yapılmaksızın güncellenebilir. Güncel metinler sitenin alt kısmındaki yasal linklerde yayımlanır.</p>

      <h3>Uyuşmazlık</h3>
      <p>Bu koşullar Türkiye Cumhuriyeti hukukuna tabidir. Uyuşmazlıklarda Türkiye mahkemeleri ve icra daireleri yetkilidir.</p>

      <p class="legal-meta">Son güncelleme: ${LEGAL_LAST_UPDATED}</p>
    `,
  },
  {
    id: 'disclaimer',
    title: 'Sorumluluk Reddi',
    shortTitle: 'Sorumluluk Reddi',
    content: `
      <p>Bu platform yalnızca bilgi ve karar destek amacıyla hizmet vermektedir. Aşağıdaki hususları kabul etmiş sayılırsınız:</p>

      <ul>
        <li>Sunulan sıralama tahminleri, puanlar ve metrikler <strong>tavsiye niteliğindedir</strong>; yerleşme garantisi verilmez.</li>
        <li>Puan ve kontenjanlar yıldan yıla değişebilir; veriler resmî kaynaklardan alınsa bile güncelleme gecikmeleri olabilir.</li>
        <li>Teknik hata, veri eksikliği veya model hatası nedeniyle yanlış bilgi gösterilmesi mümkündür.</li>
        <li>Platform, üniversiteye yerleşme, burs, kontenjan veya kariyer sonucu konusunda taahhüt vermez.</li>
        <li>Nihai tercih sorumluluğu tamamen kullanıcıya aittir; tercih listesini göndermeden önce resmî kaynaklarla doğrulamalısınız.</li>
      </ul>

      <p class="legal-meta">Son güncelleme: ${LEGAL_LAST_UPDATED}</p>
    `,
  },
  {
    id: 'contact',
    title: 'İletişim',
    shortTitle: 'İletişim',
    content: `
      <p>Sorularınız ve geri bildirimleriniz için bizimle iletişime geçebilirsiniz.</p>

      <h3>E-posta</h3>
      <p><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>

      <p class="legal-meta">Son güncelleme: ${LEGAL_LAST_UPDATED}</p>
    `,
  },
]

export const getLegalSection = (id) => (
  LEGAL_SECTIONS.find((section) => section.id === id) || LEGAL_SECTIONS[0]
)
