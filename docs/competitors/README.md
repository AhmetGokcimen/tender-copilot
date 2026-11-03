# Licits rakip analizi (2026-11-03)

Romanya kamu ihalesi izleme/teklif araçlarının rakip analizi. Sonuçlar bir claude.ai Dashboard artifact'ında yayınlandı:
https://claude.ai/artifact/5T6YR4Q7coprga1bwX7w9R (özel; sahibi Ahmet)

## Klasör
- `data/` — panelin 6 veri seti (JSON). Gerçek kaynak bunlar.
  - `competitors.json` profil, fiyat metni, başlık, vaat, kanıt, tehdit
  - `plans.json` plan fiyatları (RON/ay, KDV hariç)
  - `features.json` 7 ürün × 8 özellik (Var / Kısmi / Yok / Bilinmiyor + kanıt notu)
  - `tactics.json` kopyalanabilir taktikler
  - `insights.json` SWOT, çalışan kalıplar, boşluklar
  - `sources.json` kaynaklar ve durumları (okundu / ikinci el / engellendi / yapılmadı)
- `dashboard-page.html` — panel sayfasının HTML'i (artifact'ın `files/index.html` dosyası).
- `tools/gen.py` — `data/*.json` dosyalarını üretir. `tools/build.py` — sayfayı ve artifact yazma belgelerini üretir.
  Not: ikisi de bulut oturumunun geçici klasörüne yol veriyor ve artifact blob adreslerini içeriyor; yeniden kullanmadan önce yolları düzeltin.
- `LOCAL_SESSION_PROMPT.md` — yerel Claude Code oturumunu başlatan istem.

## Sınırlar
Reklam kütüphaneleri (Meta, LinkedIn, Google) taranmadı. sicap.ai ve sicap.pro siteleri 403 verdi, bilgiler ikinci el.
Tehdit/efor/etki puanları kaynaktan gelmez, değerlendirmedir. Panel sabit veridir, canlı değildir.
