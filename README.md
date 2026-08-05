# YKS Analiz

Üniversite tercih döneminde programları metriklerle analiz etmeniz, ikili karşılaştırma sihirbazı ile sıralamanız ve listenizi farklı formatlarda dışa aktarmanız için hazırlanmış web uygulaması.

**Canlı:** [yks-analiz.vercel.app](https://yks-analiz.vercel.app)

## Özellikler

- Ana tercih listesi ve favoriler
- İkili karşılaştırma (A/B tercih sihirbazı)
- Karşılaştırma laboratuvarı
- Sıralama tahmini (regresyon + kontenjan modeli)
- Excel ve PDF çıktı

## Geliştirme

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy (Vercel)

Proje adı: `yks-analiz`

Deploy yalnızca frontend için gerekli veriyi içerir (~100 MB). Pipeline dosyaları (`raw/`, `validated/`, `*.py`) ve kullanılmayan büyük JSON dosyaları `.vercelignore` ile hariç tutulur; tüm özellikler çalışmaya devam eder.

```bash
vercel --prod
```

Vercel dashboard üzerinden proje adını **yks-analiz** olarak ayarlayın; varsayılan domain `yks-analiz.vercel.app` olur.

## Repo

GitHub: [github.com/0emresezen/yks-analiz](https://github.com/0emresezen/yks-analiz)
