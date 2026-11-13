# Neo Glide — ticari yayın, telif ve mağaza kuralları incelemesi

İnceleme tarihi: **12 Kasım 2026**, Europe/Istanbul.

> Bu belge düzeltmelerden önceki bulguları kaydeder. Kullanıcı daha sonra çocukları da ve mümkün olan tüm ülkeleri hedeflediğini açıkladı. Kod, lisans paketi, canlı politika sayfaları ve Play Console taslaklarındaki düzeltmelerin güncel durumu için [uygulama kaydına](COMMERCIAL_REMEDIATION_2026-11-12.md) bakın. Aşağıdaki eski eksiklerin tamamı bugünkü durum olarak okunmamalıdır.

**Sonuç: Müziklerin ticari kullanım dayanağı doğrulandı. Dağıtılan yazılımda üçüncü taraf lisans bildirimleri eksik. Android için gizlilik metni tamamlanmadan ve hedef yaş grubu, mağaza beyanları, reklam izinleri ve marka kullanımı doğrulanmadan koşulsuz yayın onayı verilemez.**

Bu belge, yerel kod ve paket incelemesi ile güncel resmî kaynakların karşılaştırılmasıdır; avukat görüşü, marka uygunluk araştırması, vergi danışmanlığı veya sıfır risk garantisi değildir. Mağazanın uygulamayı kabul etmesi de üçüncü kişi hakları veya mevzuata uyum garantisi oluşturmaz.

## Kapsam ve kanıt sınırları

- Kullanıcı, oyunu ve görsellerini birlikte ürettiğimizi ve App Store ile Google Play'de yayınlayacağını belirtti. Hedef ülkeler ve hedef yaş grubu henüz belirlenmiş değil.
- Mevcut çalışma ağacı; Vite `dist/` çıktısı; iOS 1.3.0 (11) Release simülatör paketi; Android kaynakları; müzik ve görsel üretim kayıtları; tanıtım videosunun üretim kodu incelendi.
- Kök npm kilit dosyasında 748, backend kilit dosyasında 244 bağımlılık kaydı tarandı. Bu sayılar geliştirme/isteğe bağlı paketleri de içerir; uygulamada çalışan modüllerin veya tüm native SDK'ların kesin listesi değildir.
- iOS CocoaPods ve SwiftPM kilitleri ile Android doğrudan bağımlılıkları gözden geçirildi. Native SDK'ların bütün alt bağımlılıkları için eksiksiz hukukî lisans envanteri çıkarılmadı.
- App Store Connect, Play Console ve AdMob hesaplarının güncel beyan/mesaj/onay ekranları bu incelemede açılmadı. Eski release notları güncel durumun kanıtı sayılmadı.
- Son Google Play ürün sayfası isteği 404 döndü; bu tek başına uygulamanın hesabınızdaki veya tüm bölgelerdeki yayın durumunu belirlemez. App Store ürün sayfası web aracından okunamadı.
- Kişisel hesap veya ilerleme silinmedi; gerçek reklam/satın alma işlemi yapılmadı; uygulama kodu ve canlı site değiştirilmedi. Yalnız bu rapor ve yerel inceleme kanıtları oluşturuldu.

Kanıtlar: `release/1.3.0/checks/legal-2026-11-12/`.

## 1. Doğrulanan: üç oyun müziğinin ticari kullanım lisansı

Oyundaki **Happy Alley**, **Beach Bum** ve **The Whip**, Kevin MacLeod eserleridir. Bunlar bizim sıfırdan bestelediğimiz kayıtlar değildir; dışarıdan, atıf koşullu lisansla kullanılıyor.

Şu kontroller yapıldı:

- Sanatçının canlı kataloğunda üç kayıt ve ISRC numaraları eşleşti.
- Sanatçının mevcut parça sayfası şablonu CC BY 4.0 atıf metnini içeriyor; katalogdan ISRC ile parça seçiyor.
- Üç özgün MP3 sanatçının sunucusundan yeniden okunup SHA-256 değerleri `public/audio/music/manifest.json` ile karşılaştırıldı. **Üçü de eşleşti.** İndirilen MP3'ler bu incelemede tekrar depoya eklenmedi.
- Oyunda kullanılan işlenmiş M4A dosyalarının hash kontrolleri geçti.
- Settings içindeki Music credits bölümünde eserler, sanatçı, kaynak ve lisans bağlantıları ile yapılan değişiklik bilgisi var.
- `CREDITS.txt` ve tam `CC-BY-4.0.txt`, hem `dist/` içinde hem son iOS simülatör paketinde mevcut.
- `public/` ses envanterinde yalnız üç onaylı M4A var; Canva/Muzaic kişisel kullanım taslakları bulunmadı.
- Müzik ve reklam izin akışlarıyla ilgili toplam **16 mevcut test geçti**. Bu testler hukukî uygunluk sertifikası veya gerçek cihazdaki bölgesel izin akışı testi değildir.

**Değerlendirme:** CC BY 4.0, atıf ve diğer lisans koşullarına uyulduğunda ticari kullanım ve uyarlamaya izin verir. Bu kayıtlar sırf oyun gelir elde ediyor diye yasak hale gelmez. Atıflar ve bağımsız müzik lisansı korunmalıdır. Tanıtım videolarında aynı parçalar kullanılırsa o dağıtımın da uygun atıf sağlaması gerekir. CC'nin ek kısıtlama/DRM hükümleri mağaza sözleşmeleriyle birlikte değerlendirilmelidir; kaynak bağlantılarının bulunmasını her hukukî sorunu çözen garanti saymıyoruz.

Kaynaklar: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), [sanatçının oyun atıf rehberi](https://incompetech.com/music/royalty-free/faq.html), [sanatçının lisans sayfası](https://incompetech.com/music/royalty-free/licenses/), [canlı katalog](https://incompetech.com/music/royalty-free/pieces.json).

Düzeltme: İlk taramada `music-licenses/` depo kökünde arandı. Belgenin konumuna göre doğru yol `docs/music-licenses/`; özgün katalog özeti ve sayfa şablonu burada mevcut. Arşivin eksik olduğu yönündeki ilk değerlendirme geçerli değildir. Ek canlı katalog/hash doğrulamaları da inceleme kanıtları arasında saklandı.

## 2. Yayın öncesi giderilmeli: açık kaynak lisans/telif bildirimleri

**Doğrulanmış eksik.**

React, React DOM, Scheduler, Capacitor ve AdMob köprüsünün MIT; Lucide'ın ISC ve bazı ikonlarının Feather kaynaklı MIT; Firebase bileşenlerinin Apache-2.0 lisansları mevcut. Bu lisanslar genel olarak ticari kullanımı mümkün kılar, fakat gerekli metin ve bildirimleri ortadan kaldırmaz.

`node_modules/` içindeki lisanslar teslim paketine kendiliğinden taşınmıyor. Kontrol edilen `dist/` JavaScript dosyalarında telif/lisans metinleri yok; örneğin React telif sahibi, Lucide Contributors ve MIT izin metni bulunmuyor. Son simülatör paketinde de bunlar için ayrı lisans/bildirim belgesi veya bir lisanslar ekranı tespit edilmedi. Müzik lisansının pakette olması yazılım lisanslarını karşılamaz.

**Yapılacak:** Gerçekte dağıtılan web ve native bileşenlerin sürümlerine göre lisansları, telif sahiplerini ve varsa NOTICE metinlerini derle; uygulamaya paketle; Settings üzerinden erişilebilir kıl; hem iOS hem Android teslim paketinde doğrula. Bildirimlerin yalnız geliştiricinin bilgisayarında veya GitHub'da durması yeterli kabul edilmemeli.

Taramada npm metadata'sında GPL/AGPL görülmedi. MPL-2.0 görülen Lightning CSS paketleri geliştirme bağımlılıkları olarak işaretli. `SEE LICENSE` yazan iki Trapeze paketinin ve metadata'sı eksik backend `limiter` paketinin yerel lisans metinleri ayrıca okundu ve MIT bulundu. Bu tespit native SDK'lar için eksiksiz lisans onayı değildir.

Kaynaklar: [MIT şartları](https://opensource.org/license/mit), [Lucide lisansı](https://lucide.dev/license), [Apache-2.0, özellikle dağıtım hükümleri](https://www.apache.org/licenses/LICENSE-2.0).

## 3. Yayın öncesi giderilmeli: gizlilik belgelerinin tutarlılığı ve Android kapsamı

**Doğrulanmış belge eksikleri.**

Canlı [gizlilik sayfası](https://neo-glide-live-developer.web.app/privacy.html), [destek sayfası](https://neo-glide-live-developer.web.app/support.html) ve `app-ads.txt` 200 döndü; yerel developer-site dosyalarıyla birebir eşleşti. Canlı metin Firebase, AdMob, hesaplar, bulut kayıtları ve iOS satın almalarını açıklıyor. Oyundaki bağlantı bu güncel siteye gidiyor.

Ancak:

- Kök `PRIVACY_POLICY.md` hâlâ kişisel veri toplanmadığını ve üçüncü taraf/reklam ağı kullanılmadığını söylüyor; iletişim alanı örnek adres. Mevcut uygulamayla çelişiyor. Bu dosyanın bugün mağazada kullanıldığı doğrulanmadı; kullanımdaki politika sanılmaması için kaldırılmalı veya güncel metne yönlendirmeli.
- Canlı gizlilik ve satın alma/destek açıklamaları Apple/iOS odaklı. Android'de kullanılan Google Play Billing, Android hesap sağlayıcıları ve Android reklam tercihleri aynı açıklıkla kapsanmıyor. Google Play yayını öncesinde genişletilmeli.
- KVKK/GDPR açısından veri işleme amaçlarının hangi hukukî sebeplere dayandığı, ilgili kişi haklarının uygulanması ve uluslararası aktarımların dayanağı tamamlanmalı. Mevcut genel “başka ülkelerde işlenebilir” cümlesi tek başına aktarım uygunluğunun kanıtı değildir.
- Firebase/Google ile sözleşmeler, veri saklama uygulaması ve gerekiyorsa yurt dışı aktarım düzenlemeleri koddan doğrulanamaz. Aydınlatma ve varsa açık rıza birbirine karıştırılmamalı.
- SDK privacy manifest'i ile mağaza veri etiketi farklı işler yapar. Bir SDK'nın genel beyanı, oyunun o veriyi fiilen topladığını veya hiçbir zaman toplamadığını tek başına kanıtlamaz. Gerçek akışlar ve yapılandırmalar esas alınmalı.

Kaynaklar: [Apple 5.1](https://developer.apple.com/app-store/review/guidelines/), [Google Play User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en), [KVKK aydınlatma yükümlülüğü](https://www.kvkk.gov.tr/Icerik/6765/AYDINLATMA-YUKUMLULUGUNUN-YERINE-GETIRILMESI-HAKKINDA-KAMUOYU-DUYURUSU), [KVKK yurt dışı aktarım güvenceleri](https://www.kvkk.gov.tr/Icerik/7938/Standart-Sozlesmeler-ve-Baglayici-Sirket-Kurallarina-Iliskin-Dokumanlar-Hakkinda-Kamuoyu-Duyurusu).

## 4. Koşullu yüksek risk: hedef yaş grubu ve çocuk verisi

**Çocukları hedeflediği veya çocuk mevzuatını ihlal ettiği sonucuna varılmadı. Hedef kitle henüz net değil.**

`src/services/AdMobService.js` içinde `tagForChildDirectedTreatment` ve `tagForUnderAgeOfConsent` sabit `false`. iOS `NeoGlidePrivacyPlugin` de `isTaggedForUnderAgeOfConsent = false` kullanıyor. Yaşa bağlı farklı bir akış tespit edilmedi. Reklam derecesinin PG olması çocuklara yönelik veri işleme yükümlülüklerini tek başına karşılamaz.

Çocuklar hedef kitleye dahil edilecekse veya uygulama fiilen çocuklara yönelik sayılıyorsa, mevcut yapılandırmanın yeterli olduğu kabul edilmemeli. Yaş değerlendirmesi, uygun yaş ekranı/ebeveyn işlemleri, kişiselleştirilmiş reklam kısıtları ve SDK ayarları tasarlanmalı. Yalnız mağazadan büyük yaş grubu seçmek gerçek içerik ve pazarlama çocuklara yönelikse sorunu çözmez. Genel kitle uygulamalarının sırf küçük yaş derecesi bulunması da otomatik olarak çocuklara yönelik uygulama oldukları anlamına gelmez.

Kaynaklar: [Google Play Families](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en), [FTC COPPA rehberi](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions), [Apple Kids kuralları](https://developer.apple.com/app-store/review/guidelines/).

## 5. Kısmen olumlu; gerçek cihaz ve konsol doğrulaması gerekenler

### Reklamlar

Kodda UMP durumu kontrol ediliyor; iOS'ta izin akışı reklam SDK'sından önce tamamlanıyor. Rıza yoksa reklam başlatmama ve tercihlerin geri alınmasıyla ilgili birim testleri geçti. Ödüllü reklam eylemleri kullanıcıya reklam karşılığını açıklıyor; incelenen ödüller oyun içi kredi/can hakkı/parça, nakit değil. Varsayılan `npm run build` test reklamı kullanıyor; canlı envanter özel release koşuluyla açılıyor.

Bunlar olumlu, ancak güncel AdMob onayı, ülkelere göre yayımlanmış izin mesajları ve gerçek iOS/Android cihazında izin verme/reddetme/geri çekme sonuçları bu incelemede doğrulanmadı. `app-ads.txt` dosyasının varlığı da mağazaya bağlı doğru geliştirici alan adında Google tarafından doğrulandığı anlamına gelmez. Kendi canlı reklamlarınıza tıklamayın veya gösterimleri yapay olarak artırmayın.

Kaynaklar: [Google AB izin politikası](https://www.google.com/about/company/user-consent-policy/), [CMP gereklilikleri](https://support.google.com/admob/answer/13554116?hl=en), [ödüllü reklam şartları](https://support.google.com/admob/answer/7313578?hl=en), [geçersiz trafik](https://support.google.com/admob/answer/3342099?hl=en).

### Satın almalar ve hesap silme

Kaynakta iOS StoreKit ve Android Play Billing köprüleri, yerelleştirilmiş mağaza fiyatı, bekleyen satın alma durumu ve geri yükleme mevcut. Uygulama dışına ücretli dijital ürün ödemesi yönlendirmesi incelenen akışlarda görülmedi. Android mağazası şu an yalnız kozmetik ürünlerini sunacak şekilde filtreli; iOS'taki bütün kredi paketlerinin Android'de sunulduğu varsayılmamalı.

Uygulama içi hesap silme ekranı ve sunucu tarafı silme yolu mevcut. İşlemler bu incelemede gerçek bir hesapla çalıştırılmadı. Destek sayfası erişim yoksa e-posta ile yardım öneriyor, ancak bağımsız hesap silme talebinin adımları ve doğrulaması açık değil. Google Play için bu dış talep yolunu açıkça belgele; Play Console'da doğru URL'yi göster ve uygulama kurulmadan talep edilebildiğini doğrula. Ayrı bir form tek zorunlu yöntem değildir; e-posta süreci de gereklilikleri karşılayacak açıklıkta ve işlevde olmalıdır.

Apple App Privacy, Google Play Data safety, hedef kitle, reklam içerir, uygulama içi satın alma, güncel yaş derecesi, mağaza ürün onayları ve sandbox/lisans testleri hâlâ konsoldan doğrulanacak maddeler. Simülatörde sorunsuz açılma bunların yerine geçmez.

Kaynaklar: [Apple yönergeleri](https://developer.apple.com/app-store/review/guidelines/), [Google Play ödemeler](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en), [Google Play hesap silme](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).

## 6. Görseller, ses efektleri ve tanıtım videosu

- Gemi, düşman, boss, dönüşüm, kozmetik ve galaksi çizimleri kodda vektör/Canvas geometrileriyle tanımlı. İncelenen varlıklarda harici bir sprite paketine veya açıkça adlandırılmış bir üçüncü taraf oyun serisine dayanak bulunmadı. Bu, dünya üzerindeki bütün tasarımlarla benzerlik araştırması değildir; kodla çizim de tek başına özgünlük ispatı değildir.
- İkon ve splash için ImageGen üretim tarihleri, istemleri ve hash kayıtları var (`resources/branding/1.2.0/provenance.json`). İstemler mevcut oyun gemisini referans alıyor; belirli bir tanınmış seri/markayı kopyalama talimatı içermiyor. Korunan bir üçüncü kişi girdisi kullanılmışsa yapay zekâ üretimi bunu temizlemez.
- OpenAI'nin güncel şartları kullanıcı ile OpenAI arasındaki çıktı haklarını kullanıcıya bırakıyor; benzersizlik veya üçüncü kişi haklarından arınmışlık garantisi vermiyor. Üretim tarihindeki geçerli şartların ve kaynakların da saklanması uygun olur.
- İncelenen oyun ses efektleri Web Audio senteziyle üretiliyor; dış ses örneği kullanan ayrı bir efekt paketi bulunmadı.
- App Store tanıtım videosunun müziği `scripts/app-preview/make-assets.py` içinde osilatör ve üretilen gürültüyle hazırlanmış. Üç Kevin MacLeod kaydını kullanmıyor. Çekim ve kurgu kaydı mevcut; yalnız kodu incelemek final videonun her ses örneğini bağımsız doğrulamak değildir.
- Oyunda sistem font yığını kullanılıyor; uygulama varlıklarında TTF/OTF/WOFF font dosyası tespit edilmedi. Video altyazıları sistemdeki Arial'dan PNG'ye dönüştürülmüş; font dosyası yeniden dağıtılmıyor. Tam platform/font lisansı incelemesi yapılmadı.

Kaynaklar: [OpenAI kullanım şartları, Content](https://openai.com/policies/terms-of-use/), [Apple fikrî mülkiyet ve taklit kuralları](https://developer.apple.com/app-store/review/guidelines/).

## 7. Açık kalan hukukî konu: Neo Glide adı ve marka

**Neo Glide / Neon Glide / Neoglide adı için marka kullanım uygunluğu onaylanmadı.** Sınırlı web araması ve sicil giriş sayfalarını görmek, resmî ve kapsamlı marka araştırmasının yerine geçmez. Bu incelemede oyun alanında doğrulanmış bir ihlal veya kesin kullanım serbestisi sonucu bulunmuyor.

Hedef pazarlarda kelime, benzer telaffuz/yazım, logo, ilgili mal/hizmetler ve önceki kullanım incelenmeli. Yazılım ve oyun hizmetleri için ilgili Nice sınıfları, özellikle 9 ve 41, marka vekili tarafından değerlendirilmelidir; sınıf numaraları tek başına karar ölçütü değildir. Aynı kelimenin ilgisiz bir sektörde görülmesi de otomatik yasak anlamına gelmez.

Kaynaklar: [WIPO hedef pazarda ön araştırma](https://www.wipo.int/en/web/madrid-system/how_to/search/index), [USPTO kapsamlı araştırma](https://www.uspto.gov/trademarks/search/comprehensive-clearance-search-similar-trademarks), [USPTO karıştırılma ihtimali](https://www.uspto.gov/trademarks/search/likelihood-confusion), [TÜRKPATENT araştırma](https://www.turkpatent.gov.tr/arastirma-yap).

## 8. Türkiye'de vergi mükellefiysen

Mağazanın komisyon/vergi kesmesi bütün yerel gelir vergisi yükümlülüklerinin yerine getirildiği anlamına gelmez. Mobil uygulama geliştiriciliği için GVK mükerrer 20/B kapsamındaki istisnanın koşulları bulunuyor. App Store/Google Play satışları ile AdMob reklam gelirlerinin hangi kapsamda değerlendirileceği, tahsilat hesabı ve gerekli işlemler mali müşavirle doğrulanmalı. Bu incelemede kişinin mükellefiyet durumu, istisna belgesi, banka hesabı veya yıllık had koşulları kontrol edilmedi; belirli bir vergi rejimine uygunluk sonucu verilmedi.

Kaynak: [GİB mobil uygulama geliştiriciliği ve 20/B açıklaması](https://gib.gov.tr/mevzuat/kanun/433/ozelge/38895). Özelge somut başvuruya ilişkindir; herkes için otomatik uygunluk belgesi değildir.

## Öncelikli tamamlanacak işler

1. Dağıtılan web/native bileşenlerin lisans ve NOTICE metinlerini uygulamaya dahil et; iki platform paketinde doğrula.
2. Tek güncel gizlilik kaynağı oluştur; Android hizmetlerini ekle, KVKK/GDPR hukukî dayanak ve aktarım/saklama ayrıntılarını gerçek uygulamalarla eşleştir.
3. Hedef ülkeleri ve yaş kitlesini belirle; gerekiyorsa çocuklara uygun reklam/veri akışını kur.
4. Play dış hesap silme talebini açıkça belgele; her iki platformda silme/geri yükleme/satın alma ve reklam tercihlerini test hesaplarıyla doğrula.
5. Mağaza veri beyanları, yaş ve reklam mesajlarını güncel konsol ekranlarından karşılaştır; son imzalı teslim paketini incele.
6. İsim/logo için hedef pazarlarda marka vekili incelemesini ve Türkiye'de uygulanacak vergi düzenini tamamla.

İlk iki madde somut yerel eksiklerdir. Diğerleri doğrulanmamış veya hedef kitle/pazara bağlı yayın koşullarıdır. Bu ayrım, olası bir riski gerçekleşmiş ihlal gibi sunmamak için korunmalıdır.
