import json
V,K,Y,B="Var","Kısmi","Yok","Bilinmiyor"
comps=[
 dict(id="licits",name="Licits (biz)",url="https://licits.com",segment="Referans",pricing="199–499 RON/ay (KDV hariç)",trial="14 gün",
  headline="Public tenders, read for you.",
  value_prop="SEAP/SICAP ihalelerini izler, küçük müteahhide hangi ihaleyi gerçekten kazanabileceğini söyler ve evrakı hazırlar.",
  proof="Geri test: 27 vakada kazanılan ihale %5 dilimine girme oranı %67; invite-only beta",cta="Davetle erişim / waitlist",tone="Sade, dürüst, 'karar şirketin'",
  threat="—",threat_reason="Referans satırı (biz).",confidence="Yüksek"),
 dict(id="datadriven",name="DataDriven.ro",url="https://datadriven.ro",segment="Doğrudan",pricing="70 / 130 / 290 RON/ay (plan başına)",trial="14 gün",
  headline="Găsește mai simplu licitațiile publice",
  value_prop="10.000+ kaynağı günlük tarar; AI ile eler, yeterlilik kontrolü yapar, AI ile teklif dosyası hazırlar.",
  proof="'Peste 300 de companii'; 3 isimli referans (IT Embassy, Kostein Net, ClickEval); 2 yıllık",cta="14 zile gratuit, fără obligație",tone="Pratik, araç odaklı, kurucu (eski Microsoft) basında görünür",
  threat="Yüksek",threat_reason="Licits'in çekirdek vaadini (uygunluk kontrolü + teklif taslağı) daha düşük fiyatla zaten satıyor; MCP/API var.",confidence="Yüksek"),
 dict(id="licitatia",name="Licitatia.ro",url="http://www.licitatia.ro",segment="Doğrudan",pricing="75–175 RON/ay (12 ay, KDV hariç)",trial="Bulunamadı",
  headline="Business Intelligence pentru Monitorizarea Licitațiilor Publice din România și UE.",
  value_prop="SEAP, doğrudan alımlar, atribuiri ve AB fonlu ihaleler için e-posta alarmı ve istatistik; danışmanlık dosya hazırlığı.",
  proof="'22 de ani' deneyim; advertorial (P) haberler",cta="Creare cont / Cere Consultanță",tone="Kurumsal ('Business Intelligence')",
  threat="Orta",threat_reason="Ucuz ve köklü ama AI yeterlilik/teklif taslağı yok; fiyat sayfasında iki rakam belirsiz.",confidence="Orta"),
 dict(id="licitatiepublica",name="Licitatie-publica.ro",url="https://www.licitatie-publica.ro",segment="Doğrudan",pricing="Fiyat talep üzerine",trial="Ücretsiz deneme (süre belirtilmemiş)",
  headline="Licitatii publice din Romania si UE, intr-un singur loc",
  value_prop="3.500+ kaynağı günlük tarar; AI özet ve eligibility asistanı; benzer ihaleleri kimin hangi fiyata kazandığını gösterir; API.",
  proof="'miile de firme'; 3 referans; 2007'den beri (Tender Service SRL, Sibiu)",cta="Începeți testarea gratuită acum!",tone="Nötr, kurumsal",
  threat="Orta",threat_reason="Kazanan/fiyat verisini Licits ile aynı vaatle sunuyor, API'si var; fiyatı gizli, teklif taslağı yok.",confidence="Orta"),
 dict(id="jorpex",name="Jorpex",url="https://jorpex.com",segment="Dolaylı",pricing="€49/ay, kullanıcı başı ücret yok",trial="14 gün",
  headline="Automated tender notifications from 50+ public procurement sources including TED and SAM.gov.",
  value_prop="SEAP dahil 50+ portalı izler, AI eşleşmeli uyarıları Slack/e-posta/Teams'e yollar.",
  proof="Piyasa büyüklüğü iddiası: Romanya'da yılda €25 mlr üstü",cta="14-day free trial",tone="Uluslararası, verimlilik",
  threat="Düşük",threat_reason="Yalnızca uyarı; yeterlilik, teklif, kazanan verisi yok. Ama çok-ülke fikrini zaten satıyor.",confidence="Orta"),
 dict(id="sicapai",name="sicap.ai",url="https://sicap.ai",segment="Ücretsiz",pricing="Ücretsiz",trial="—",
  headline="Bulunamadı (site 403 verdi)",
  value_prop="Eşik altı doğrudan alımlar ve kazanan bilgisi arayüzde, ücretsiz (üçüncü taraf karşılaştırma tablosuna göre).",
  proof="Bulunamadı",cta="Bulunamadı",tone="Bulunamadı",
  threat="Orta",threat_reason="Ücretsiz seçenek fiyat çıpası kuruyor; kazanan verisi bedava.",confidence="Düşük"),
 dict(id="sicappro",name="sicap.pro",url="https://sicap.pro",segment="Doğrudan",pricing="Yıllık abonelik (fiyat bulunamadı)",trial="Bulunamadı",
  headline="Bulunamadı (site 403 verdi)",
  value_prop="E-posta uyarısı, eşik altı alımlar, kazanan bilgisi (üçüncü taraf karşılaştırma tablosuna göre).",
  proof="Bulunamadı",cta="Bulunamadı",tone="Bulunamadı",
  threat="Düşük",threat_reason="Kanıt zayıf: yalnızca ikinci el tablo.",confidence="Düşük"),
]
json.dump(comps,open("competitors.json","w"),ensure_ascii=False,indent=1)

plans=[]
def P(c,cn,plan,price,hi,users,note,cur="RON",native=None):
    plans.append(dict(id=f"{c}-{plan.lower()}",competitor_id=c,competitor=cn,plan=plan,price_ron=price,price_ron_high=hi,users=users,note=note))
for pl,pr,u in [("Start",199,1),("Growth",349,3),("Pro",499,5)]:
    P("licits","Licits",pl,pr,pr,u,"RON/ay, KDV hariç (README)")
for pl,pr,u in [("Standard",70,1),("Expert",130,2),("Premium",290,5)]:
    P("datadriven","DataDriven.ro",pl,pr,pr,u,"RON/ay; sitede 'per utilizator, pe lună'; yıllıkta %18 indirim")
for pl,lo,hi,u in [("Start",75,90,1),("Business",115,133,3),("Mega",175,216,5)]:
    P("licitatia","Licitatia.ro",pl,lo,hi,u,"RON/ay, 12 aylık, KDV hariç; sayfada her plan için iki fiyat var, hangisinin indirimli olduğu yazmıyor; users = e-posta adresi sayısı")
P("jorpex","Jorpex","Tek plan",245,245,None,"€49/ay; 1 EUR = 5 RON varsayımıyla çevrildi (benim varsayımım)")
P("sicapai","sicap.ai","Ücretsiz",0,0,None,"Ücretsiz (üçüncü taraf tablosu)")
json.dump(plans,open("plans.json","w"),ensure_ascii=False,indent=1)

F=["alerts","filters","summary","eligibility","draft","winners","ocr","api"]
FL=dict(alerts="E-posta uyarısı",filters="CPV/il/değer filtresi",summary="AI özet",eligibility="AI yeterlilik kontrolü",draft="Teklif/DUAE taslağı",winners="Önceki kazananlar",ocr="Taranmış PDF okuma",api="API / MCP")
M={
"licits":{"alerts":(Y,"README: e-posta uyarıları 'yakında', henüz yok"),"filters":(V,"README: CPV, il, değer, son tarih"),"summary":(V,"README: EN/RO sade başlık ve özet"),"eligibility":(V,"README: ciro/deneyim aritmetikle, gerekçeli"),"draft":(V,"README: teklif ve DUAE taslağı"),"winners":(V,"README: son 5 sözleşmenin kazananı + ANAF mali veri"),"ocr":(V,"README: taranmış PDF sınırsız"),"api":(Y,"README'de API/MCP yok")},
"datadriven":{"alerts":(V,"Günlük uyarılar"),"filters":(V,"CPV, değer, idare, il"),"summary":(V,"AI ile eleme (triage)"),"eligibility":(V,"'Participă / Participă cu atenție / Nerecomandat' (Standard+)"),"draft":(K,"AI 'Atelier de oferte' dosya hazırlar; DUAE belirtilmemiş"),"winners":(V,"Rakip istatistikleri ve sözleşme geçmişi (Expert)"),"ocr":(V,"Taranmış PDF aranabilir metin (Expert)"),"api":(V,"MCP sunucusu (Premium), veri akışı/PowerBI ek hizmet")},
"licitatia":{"alerts":(V,"Günlük e-posta uyarısı"),"filters":(V,"Anahtar kelime/ID, CPV alanı"),"summary":(K,"'AI search' ve 'AI monitoring' listelenmiş, özet belirtilmemiş"),"eligibility":(Y,"Sayfada bulunamadı"),"draft":(Y,"Yazılım yok; 'Pregătire dosare' insan danışmanlığı"),"winners":(K,"'Atribuiri' ihale türü olarak var, kazanan analizi belirtilmemiş"),"ocr":(B,"'Document decryption' var, OCR belirtilmemiş"),"api":(B,"Bulunamadı")},
"licitatiepublica":{"alerts":(V,"E-posta uyarısı"),"filters":(V,"Anahtar kelime, CPV, konum"),"summary":(V,"AI özet ve açıklamalar"),"eligibility":(V,"'Asistent AI Licitatii' yeterlilik kriterlerini kontrol eder"),"draft":(Y,"Danışmanlık sunuyor, yazılım taslağı belirtilmemiş"),"winners":(V,"Benzer ihaleleri kim hangi fiyata kazandı"),"ocr":(B,"Bulunamadı"),"api":(V,"API var")},
"jorpex":{"alerts":(V,"Slack/e-posta/Teams, gerçek zamanlı"),"filters":(V,"Sektör, bölge, değer aralığı"),"summary":(K,"'AI-matched alerts'"),"eligibility":(Y,"Bulunamadı"),"draft":(Y,"Bulunamadı"),"winners":(Y,"Bulunamadı"),"ocr":(B,"Bulunamadı"),"api":(B,"Bulunamadı")},
"sicapai":{"alerts":(Y,"Apify tablosunda e-posta uyarısı yok (ikinci el)"),"filters":(B,"Bulunamadı"),"summary":(B,"Bulunamadı"),"eligibility":(B,"Bulunamadı"),"draft":(B,"Bulunamadı"),"winners":(V,"Arayüzde kazanan bilgisi (ikinci el)"),"ocr":(B,"Bulunamadı"),"api":(Y,"Kamu API yok (ikinci el)")},
"sicappro":{"alerts":(V,"E-posta uyarısı (ikinci el)"),"filters":(B,"Bulunamadı"),"summary":(B,"Bulunamadı"),"eligibility":(B,"Bulunamadı"),"draft":(B,"Bulunamadı"),"winners":(V,"Arayüzde kazanan bilgisi (ikinci el)"),"ocr":(B,"Bulunamadı"),"api":(Y,"Kamu API yok, dışa aktarma sınırlı (ikinci el)")},
}
rows=[]
src={"licits":"s1","datadriven":"s2","licitatia":"s3","licitatiepublica":"s4","jorpex":"s5","sicapai":"s6","sicappro":"s6"}
for c in comps:
    for f in F:
        lv,n=M[c["id"]][f]
        rows.append(dict(id=f'{c["id"]}-{f}',competitor_id=c["id"],competitor=c["name"],feature=f,feature_label=FL[f],level=lv,note=n,source_id=src[c["id"]]))
json.dump(rows,open("features.json","w"),ensure_ascii=False,indent=1)

T=[
("t1","DataDriven.ro","Üç seviyeli yeterlilik etiketi: 'Participă / Participă cu atenție / Nerecomandat'","Okuyan 2 saniyede karar verir.","Licits'te şart başına karşılandı/karşılanmadı/belirsiz var; üstüne tek bir genel trafik ışığı ekle.","Düşük","Yüksek"),
("t2","DataDriven.ro","Sitede isimli referans ve 'Peste 300 de companii' sayacı","Küçük müteahhit, benzer firmanın kullandığını görünce güvenir.","İlk 3–5 beta kullanıcısından isimli alıntı al; sayacı yalnızca gerçek rakamla yaz.","Düşük","Yüksek"),
("t3","DataDriven.ro","Ücretli destekli onboarding (tek seferlik)","Takılan müşteri hızlı aktive olur, gelir artar.","Profil doğrulama + ilk 3 ihale için ücretli kurulum paketi dene.","Düşük","Orta"),
("t4","DataDriven.ro","Üst planda MCP sunucusu / kendi AI'nı getir","Teknik ekipleri ve danışmanları çeker.","Pro plana API/MCP ekle; danışmanlar için kanal aç.","Orta","Orta"),
("t5","DataDriven.ro","Kurucu basında: Economedia ve Profit.ro röportajları","Güven ve SEO kazandırır, satış ekibi gerektirmez.","Kurucu hikâyesi + doğrulama sonuçları (geri test) ile 2–3 yerel iş basını hedefle.","Orta","Yüksek"),
("t6","Licitatia.ro","Ana akım sitelerde '(P)' advertorial haberler","Köklü marka algısı; arama trafiği.","Yıllık alım hacmi ve geri test verisiyle tek bir advertorial dene.","Orta","Orta"),
("t7","sicap.ai","Ücretsiz kazanan arama katmanı","Fiyat çıpasını kırar, huni tepesini doldurur.","Ücretsiz 'kim kazandı' arama (düşük kota) ile kayıt topla.","Orta","Yüksek"),
("t8","Licitatie-publica.ro","Ana vaat: 'benzer ihaleleri kim, hangi fiyata kazandı'","Sorunu somut cümleyle anlatır.","Licits zaten sunuyor (ANAF mali veri ekli); landing'de başlığa çıkar.","Düşük","Yüksek"),
("t9","Jorpex","Slack/Teams'e uyarı","Ekip içinde tetikleyici olur.","E-posta uyarıları yapılırken aynı altyapıyla Slack webhook ekle.","Düşük","Düşük"),
("t10","Tümü","'Licits vs DataDriven' alternatif sayfaları (market-competitors iskeleti)","'X alternatifi' aramaları alt hunidir.","/vs/datadriven ve /vs/licitatia sayfaları: tablo, 'nerede kazanırız', 'nerede kaybederiz'.","Düşük","Yüksek"),
]
json.dump([dict(id=a,source=b,tactic=c,why=d,for_licits=e,effort=f,impact=g) for a,b,c,d,e,f,g in T],open("tactics.json","w"),ensure_ascii=False,indent=1)

I=[
("sw1","Güçlü yön","ANAF'tan otomatik profil: CUI girince ünvan, adres, CAEN, ciro ve kazanılan sözleşmeler dolar.","README, 7 adımlı onboarding. Karşılaştırılan sitelerde böyle bir adım görmedim.","s1"),
("sw2","Güçlü yön","Yeterlilik kontrolü ciro/deneyim için aritmetikle yapılıyor ve her karar gerekçeli.","README. DataDriven etiket veriyor, gerekçesini sitede göstermiyor.","s1"),
("sw3","Güçlü yön","Kazananlar + ANAF mali veri + yenilenen alım tespiti (ödeme planı üst katmanda fiyat aralığı).","README. Yalnızca Licitatie-publica.ro benzer 'kim hangi fiyata kazandı' diyor.","s1"),
("sw4","Güçlü yön","Teklif ve DUAE taslağı; taranmış PDF okuma tüm planlarda.","README. DataDriven DUAE'yi belirtmiyor.","s1"),
("sw5","Zayıf yön","Fiyat DataDriven'ın 1,7–2,8 katı (kademe kademe).","Fiyat tablosu (hesaplanan).","s2"),
("sw6","Zayıf yön","E-posta uyarısı yok; faturalama yok, üst plan herkese açık; kotalar çoğunlukla uygulanmıyor.","README 'Status' bölümü.","s1"),
("sw7","Zayıf yön","Yalnızca SEAP/ANAF; rakipler 3.500–10.000 kaynak iddia ediyor. Yalnızca tam CPV eşleşmesi (geri testte vakaların üçte biri sıfır skor).","README + rakip siteler.","s1"),
("sw8","Zayıf yön","Sosyal kanıt yok: waitlist'te sizden başka kayıt yok, beta davetle.","Supabase waitlist tablosu (1 kayıt, sahibi).","s7"),
("sw9","Fırsat","Hiçbir rakip sayfasında her kararın dayandığı ihale paragrafını göstermiyor (okuduğum sayfalarda yok). Licits'in sıradaki işi bu.","README 'Status'; rakip sayfaları.","s1"),
("sw10","Fırsat","Şeffaf fiyat: Licitatie-publica.ro ve sicap.pro fiyat vermiyor, Licitatia.ro'da SEAP paketi fiyatsız.","Rakip siteler.","s3"),
("sw11","Fırsat","İnşaat gibi tek sektöre odak: rakipler genel dil kullanıyor, sektör sertifika listeleri yok.","Rakip ana sayfaları.","s2"),
("sw12","Fırsat","Çok ülke: Jorpex 50+ portal satıyor ama yeterlilik/teklif yok; Licits her kaynağı adapter olarak tasarlamış.","Jorpex sayfası; README.","s5"),
("sw13","Tehdit","DataDriven hızlı ilerliyor: 2 yılda 300+ firma iddiası, AI teklif atölyesi, MCP, 14 gün deneme.","DataDriven ana sayfa.","s2"),
("sw14","Tehdit","sicap.ai ücretsiz kazanan bilgisi sunuyor; ödeme isteği düşer.","Apify karşılaştırma tablosu (ikinci el).","s6"),
("sw15","Tehdit","Yeni SICAP sisteminin gecikmeleri: SEAP adaptörü değişirse veri akışı kırılabilir.","Profit.ro haberi (arama sonucu).","s8"),
("sw16","Tehdit","Sektör eleştirisi: 'AI evrak yükünü artırır' (DataDriven kurucusu). Teklif taslağı vaadi mesafeli karşılanabilir.","Economedia röportajı.","s9"),
("pt1","Çalışan kalıp","'Elle aramayı bırak' zaman tasarrufu başlığı.","DataDriven: 'Găsește mai simplu…'; Licitatia.ro (Spotmedia): 'fără să verifici zilnic SEAP'; Jorpex: 'replaces hours' .","s2"),
("pt2","Çalışan kalıp","14 gün ücretsiz deneme, kart/yükümlülük yok.","DataDriven, Jorpex, Licitatie-publica.ro.","s2"),
("pt3","Çalışan kalıp","Sayıyla kanıt: kaynak sayısı, firma sayısı, yıl.","DataDriven 10.000+ kaynak ve 300+ firma; Licitatie-publica.ro 3.500+ kaynak; Licitatia.ro 22 yıl.","s2"),
("pt4","Çalışan kalıp","Basın ve advertorial ile güven kurma.","Licitatia.ro '(P)' haberleri; DataDriven kurucu röportajları.","s3"),
("gp1","Boşluk","Kararın kaynağı olan paragrafı gösteren yeterlilik kontrolü.","Okunan rakip sayfalarında yok; Licits yol haritasında.","s1"),
("gp2","Boşluk","Sektöre göre dil ve sertifika kontrol listesi (güneş, elektrik, yol, HVAC...).","Rakip ana sayfaları genel.","s2"),
("gp3","Boşluk","DUAE'yi SEAP akışına uygun üreten Romanyalı ürün.","Aramada bulunamadı; doğrulanmadı.","s4"),
("gp4","Boşluk","Açık, herkese görünür fiyat ve kullanım kotası.","Licitatie-publica.ro, sicap.pro fiyatı gizli.","s4"),
]
json.dump([dict(id=a,kind=b,text=c,evidence=d,source_id=e) for a,b,c,d,e in I],open("insights.json","w"),ensure_ascii=False,indent=1)

S=[
("s1","Licits README ve docs","https://github.com/ahmetgokcimen/tender-copilot","Licits özellikleri, fiyatları, doğrulama","okundu"),
("s2","DataDriven.ro ana sayfa","https://datadriven.ro","Başlık, planlar, fiyatlar, referanslar","okundu"),
("s3","Licitatia.ro ana sayfa ve abonamentler","http://www.licitatia.ro/abonamente.html","Başlık, planlar, özellikler","okundu"),
("s4","Licitatie-publica.ro ana sayfa","https://www.licitatie-publica.ro","Başlık, hizmetler, kanıt","okundu"),
("s5","Jorpex Romania rehberi","https://jorpex.com/guides/find-tenders-romania/","Fiyat, özellikler","okundu"),
("s6","Apify SEAP/SICAP karşılaştırma tablosu","https://apify.com/apnoda/seap-sicap-tenders.md","sicap.ai ve sicap.pro (sitelerin kendisi 403 verdi)","ikinci el"),
("s7","Supabase waitlist tablosu","(özel)","Waitlist sayısı","okundu"),
("s8","Profit.ro: SICAP gecikmesi","https://profit.ro/povesti-cu-profit/it-c/ministrul-comunicatiilor-sicap-noul-sistem-de-licitatii-publice-are-intarzieri-din-cauza-furnizorului-15566143","Yeni SICAP riski","yalnızca arama sonucu"),
("s9","Economedia: DataDriven kurucusu röportajı","https://economedia.ro/?p=304493","AI ve evrak yükü görüşü","okundu"),
("s10","G2: Tender Service SRL","https://www.g2.com/products/tender-service-srl","Ek doğrulama","engellendi (403)"),
("s11","Meta Reklam Kütüphanesi","https://www.facebook.com/ads/library","Rakip reklamları","yapılmadı"),
("s12","LinkedIn Reklam Kütüphanesi","https://www.linkedin.com/ad-library","Rakip reklamları","yapılmadı"),
("s13","Google Ads Şeffaflık Merkezi","https://adstransparency.google.com","Rakip reklamları","yapılmadı"),
]
json.dump([dict(id=a,title=b,url=c,used_for=d,status=e) for a,b,c,d,e in S],open("sources.json","w"),ensure_ascii=False,indent=1)
print("ok")
