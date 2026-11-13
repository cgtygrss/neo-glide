# Neo Glide — ticari yayın düzeltme kaydı

13 Kasım 2026 güncellemesi. Yerel aday: **1.3.0; iOS build 12, Android versionCode 5**.
Kullanıcı hedefi: çocuklar dahil karma kitle, mümkün olan tüm ülkeler; App Store ve Google Play.
Bu kayıt, [ilk incelemenin](COMMERCIAL_RIGHTS_AUDIT_2026-11-12.md) ardından yapılanları ayırır. Tüm ülkeler için hukukî uygunluk veya cezasızlık garantisi değildir.

Google Play'in son durumu: dahili testte 1.3.0 (5) kullanılabilir; güncel kapalı
test ve mağaza beyanları incelemeye gönderildi. Üretim erişimi hâlâ kapalı, Play
sayacında 0 testçi. Ayrıntılar ve sonraki adımlar: [13 Kasım yayın kaydı](../release/1.3.0/GOOGLE_PLAY_LAUNCH_STATUS_2026-11-13.md).

## Uygulanan düzeltmeler

- Yerelde saklanan tarafsız yaş seçimi; doğum tarihi veya yaş grubu sunucuya gönderilmiyor. Eksik/bozuk/erişilemeyen tercih aile moduna düşüyor. Küçük yaş seçimi oyun içinden büyütülemiyor.
- 18 yaş altı ve yaşı belirtilmeyen oyuncular için hesap, Firebase oturumu, bulut eşitleme, çevrimiçi etkinlik, GitHub sürüm isteği, reklam/izleme istemi ve gerçek para alışverişi kapalı. Yerel oyun ve oyun içinden kazanılan krediler korunuyor. Native reklam ölçümü ve otomatik kimlik/mağaza başlangıçları ertelendi.
- Oyun içi gizlilik, ebeveyn/destek, hesap silme ve tam lisans ekranları var. Aile sürümleri çevrimdışı, dış bağlantısız ve sandbox iframe içinde.
- Web, CocoaPods, SwiftPM ve çözümlenen Android bağımlılıklarının özgün LICENSE/NOTICE metinleri ile müzik atıfları pakete eklendi: **994 bildirim girdisi, 133 farklı metin grubu**. Bu sayılar lisans veya bağımsız ürün sayısı değildir; SDK'ların birleştirilmiş atıflarını da içerir. Yerel bağımlılık girdileri değişirse eski envanterle derleme durur.
- Native SDK atıflarında GPL + Classpath exception ve Kotlin derleyici bileşenleriyle ilgili LGPL metinleri de bulunuyor. Bunları silmedik; yalnız npm metadata taramasından bütün ürünün copyleft içermediği sonucu çıkarılamaz. Nihai dağıtımda ilgili istisna/kaynak yükümlülükleri ayrıca değerlendirilmeli.
- Tek kaynaklı gizlilik metni Android Billing/Google hesapları, yetişkin AdMob, hukukî sebepler, saklama, haklar ve sağlayıcı/aktarım açıklamalarını içeriyor. Gerçekte imzalanmış KVKK aktarım sözleşmesi olduğu iddia edilmiyor.
- Uygulama olmadan e-posta ile hesap silme talebi, hesabı belirleme ve ölçülü sahiplik doğrulaması açıklandı. Yetişkin hesap ekranında Account reference gösteriliyor. [Destek işleyişi](PRIVACY_SUPPORT_RUNBOOK.md) işletilmeli.
- Android hedef/derleme API'si **36**, minimum API **24**, AGP **8.9.3**. Mevcut Gradle **8.11.1**, yerel JDK **21**. Kullanıcı SDK sözleşmesini açıkça kabul etti; resmî Mac ARM araçları checksum doğrulamasıyla kuruldu. Kotlin 2.4 metadata kullanan Google kimlik/Firebase bağımlılıkları için D8/R8 **9.1.57**, yeni metadata'yı analiz edebilmek için bağımsız Android Lint **9.1.1** sabitlendi. İlk taramadaki `Iterable.forEach` uyumsuzluğu normal döngüyle düzeltildi. Şifresiz HTTP, Capacitor yapılandırması ve Android manifestinde kapatıldı. Kullanılmayan Vite şablon logosu dağıtılan varlıklardan çıkarıldı. Son imzalı API 24 AAB Google Play tarafından kabul edildi ve Dahili test taslağına kaydedildi.

## Canlı belgeler ve Google Play

Canlı dosyaların her biri HTTP 200 ve yerel dosyayla birebir SHA-256 eşleşmesiyle doğrulandı:

- [Gizlilik](https://neo-glide-live-developer.web.app/privacy.html)
- [Destek](https://neo-glide-live-developer.web.app/support.html)
- [Hesap silme](https://neo-glide-live-developer.web.app/delete-account.html)
- [Tam lisanslar](https://neo-glide-live-developer.web.app/notices.html)

Google Play Console'da `com.cgtygrss.neoglide` için:

- Eski gizlilik URL'si güncel canlı URL ile değiştirildi ve kaydedildi.
- Yanlış “veri toplanmıyor” beyanı düzeltildi. İsteğe bağlı yetişkin hesap, satın alma, yaklaşık konum, reklam etkileşimleri, tanılama ve cihaz/hesap kimlikleri; şifreli aktarım ve dış hesap silme URL'si işlendi. Son önizleme kontrol edildi ve kaydedildi.
- Yanlış “reklam içermiyor” beyanı **reklam içerir** yapıldı ve kaydedildi. Ardından hedef kitle anketi yenilendi; tarafsız yaş ekranıyla çocuklara reklam gösterilmeyen karma kitle bildirildi.
- Yanlış “reklam kimliği kullanılmıyor” beyanı düzeltildi; analiz, reklam/pazarlama ve sahtekârlık önleme amaçları kaydedildi. Manifest hatalarını devre dışı bırakma seçeneği işaretlenmedi.
- Hedef kitle 6–8, 9–12, 13–15, 16–17 ve 18+ olarak kaydedildi; çocuk mevzuatı geliştirici beyanı kullanıcı tarafından açıkça onaylandı. Okul öncesi yaş seçilmedi. Native gerçek cihaz testleri ayrıca bekliyor.
- Kullanıcı IARC sözleşmesi ve anketini elle tamamladı. 12 Kasım 16:41 kaydı, doğru destek e-postası, PEGI 3 / USK 6 / Brezilya 14+ dahil bölgesel sonuçlar görüldü. Derece, yaş ekranı veya ebeveyn izniyle aynı şey değildir.
- Bu beyanlar, kapalı test sürümü, test grubu ve geri bildirim kanalıyla birlikte 13 Kasım'da incelemeye gönderildi; onaylanmış/üretimde olduğu iddia edilmiyor.
- Hesapta eski kapalı test var, görünür katılımcı sayısı **0**. Üretim erişimi için **12 katılımcının kesintisiz 14 günlük kapalı testi** isteniyor. Bu koşul bugün sağlanmış değil.
- Kullanıcı, herkese açık adres/telefon açıklamasını ve SMS doğrulamasını kendi tamamladı; hesapta **Tacir** görüldü. Neo Glide bu statüyü devralacak şekilde uygulama beyanı da kaydedilip inceleme gönderimine eklendi. Özel adres ve telefon bu depoya kopyalanmadı. Vergi ve ödeme hesabının tüm gereklilikleri ayrıca doğrulanmalı.
- Yalnız sahibin bulunduğu, katılıma açık `neo-glide-play-test` Google Grubu kuruldu. Üye listesini ve ileti göndermeyi yalnız sahip görebilir/yapabilir. Grup kapalı test kanalına bağlandı; bu değişiklik incelemede. [Katılım rehberi](https://neo-glide-live-developer.web.app/android-test.html) yayımlandı; [duyuru taslakları](../release/1.3.0/GOOGLE_PLAY_TEST_RECRUITMENT.md) hazır. Sonraki açık kullanıcı talebi üzerine AndroidClosedTesting Google Grubu'nda bir çağrı yayımlandı; Reddit çağrısı otomatik filtreye takıldı. [Davet kaydı](../release/1.3.0/GOOGLE_PLAY_TEST_OUTREACH_2026-11-13.md). Yeni gönüllü henüz doğrulanmadı.
- 26 kalıcı kozmetik ürününün `buy` seçenekleri, USD taban fiyatları ve 174 bölgeye dönüştürülen fiyatları **taslak** olarak kuruldu; etkin ürün/satın alma testi yok.

## Doğrulananlar

- Oyun testleri: **382 geçti, 0 hata**; backend: **20 geçti, 1 emulator testi atlandı**.
- Lint, web derlemesi, iki platforma Capacitor sync ve iOS Release simülatör derlemesi geçti.
- Son iOS paketi 1.3.0(12): bütün web çıktılarıyla eşleşti; reklam ölçümünü geciktirme açık, Firebase Analytics kapalı. Mevcut iPhone simülatörüne ilerlemeyi silmeden kuruldu ve yaş ekranında açıldı.
- İzole tarayıcı profilinde çocuk seçimi, ana ekran/ayarlar/lisanslar/garaj ve yatay düzen kontrol edildi; gözlenen ağ kayıtlarında dış istek yoktu. Hizmet entegrasyon testi de kısıtlı/eksik yaş durumlarında sıfır ağ çağrısı doğruladı. Bunlar native SDK ağ trafiğinin gerçek cihaz testi değildir.
- Android bağımlılıkları çözüldü (126 dış runtime artifact). Önceki SDK engeli giderildi; native debug/release derlemeleri ve **3 satın alma imza doğrulama testi** geçti. Son paketin manifesti, lisans/web dosyaları ve 16 KB native hizalaması kontrol edildi; ayrıntılar [Android hazırlık kaydında](../release/1.3.0/ANDROID_PREPARATION_2026-11-12.md).
- Play Console'un lisans ortak anahtarı, git dışı yerel Billing özelliği ve imzalı API24 AAB'nin DEX içeriğiyle eşleşti. Bu yalnız anahtarı doğrular; backend Play API erişimi ve gerçek Play alışverişi henüz başarıyla sınanmış değildir.
- 13 Kasım'da kullanıcının açık onayıyla, mevcut sunucu servis hesabına yalnız Neo Glide'ın uygulama/kalite/finansal veri okuma izinleri verildi; Console'da Etkin olduğu doğrulandı. Hesap çapında/yönetici/yayınlama/sipariş yönetimi yetkileri verilmedi. Google Cloud Play Developer API, yeni API sözleşmeleri için alınan ayrı açık onaydan sonra etkinleştirildi; `neo-glide-live` projesinde **Enabled** görüldü. Uçtan uca satın alma başarısı henüz kanıtlanmadı.
- İlk AAB kullanıcı tarafından imzalandı; imza, upload sertifikası ve değişmeyen içerik doğrulandı. Kullanıcı dahili test taslağına yüklemeyi açıkça onayladı. Google Play'deki etkin **yükleyici kontrolü** ilk yüklemeyi min API 23 nedeniyle reddetti: otomatik koruma API 24+ istiyor. Koruma korunarak minimum Android sürümü **7.0 / API 24** yapıldı; yeni `api24` adayının yeniden imzalanması gerekiyor. İlk dosya kabul edilmiş bir Play yapısı değildir. Platformun dönemsel bağlantı gerektirebilen yükleyici kontrolü gizlilik metnine açıkça eklendi.
- Kullanıcı yeni API 24 adayını da imzaladı. İmza/içerik doğrulandı; **Google Play sürüm 1.3.0 (5), minimum API 24 ve hedef API 36 yapısını kabul etti**. Upload anahtarı ve sürüm kodu doğrulaması geçti. 12 Kasım'da dahili testçilere açıldı; 13 Kasım'da yeni kapalı Alpha sürümü incelemeye gönderildi. Dahili sürümde eski code 3'ün AD_ID eksikliği için yalnız sürüm bazlı istisna kullanıldı; genel manifest kontrolü kapatılmadı. İlk dosyanın eski hata kaydı temizlendi.
- Play uygulama erişimi “Evet” olarak güncellendi. İngilizce yönergeler yaş seçimini, otomatik misafir erişimini, aile modunu, ücretsiz oyunu, Garage kozmetik önizlemelerini ve krediyle açmayı açıklıyor; ücretli satın almaların önceden açılmadığı açıkça belirtiliyor. Tam erişim kutusu kullanıcı tarafından işaretlendikten sonra kayıt tamamlandı. Ayrı bir önceden açılmış demo hesabı oluşturulmadı; mağaza üzerinden gerçek incelemeci erişimi hâlâ doğrulanmalı.

Kanıtlar: `release/1.3.0/checks/commercial-remediation-2026-11-12/`.

## Yayın öncesi açık kalanlar

1. SDK kurulumu, debug/release derlemesi, hedef API 36, manifest, lisans ve 16 KB kitaplık kontrolleri tamamlandı. Android emülatöründe süreç/foreground başlangıcı doğrulandı; ekran etkileşimleri ve gerçek cihaz kontrolleri hâlâ tamamlanmalı.
2. Yerel imzalama, imza/içerik kontrolü, Play upload anahtarı/versionCode kontrolü, dahili dağıtım ve kapalı test inceleme gönderimi tamamlandı. Google onayı ve gerçek kapalı test katılımı bekliyor. Yeni upload anahtarı üretme/sıfırlama yapılmadı.
3. Gerçek Android/iOS cihazında çocuk ve bilinmeyen yaş için native ağ/SDK başlangıç testi; yetişkin UMP/ATT izin verme, reddetme ve geri çekme; mağazadan kurulmuş lisans/sandbox satın alma, bekleyen/iptal/geri yükleme ve ayrı test hesabıyla silme testi.
4. Google Play beyanlarının inceleme sonucu, incelemeci erişiminin gerçek denemesi, Apple App Privacy ve ülkelere göre AdMob mesajlarının doğrulanması. Çocuklara yönelik Apple Kids kategorisi seçilirse bu ayrı kurallar ayrıca uygulanmalı.
   Android AdMob hâlâ örnek uygulama kimliğini kullanıyor; canlı Android reklam birimleri yapılandırılmamış. Play'deki 26 kalıcı ürün taslağının etkinleştirilmesi, doğru sunucu API yetkisi ve Play lisans testleri tamamlanmalı. Test reklamı kullanılması canlı reklam geliri hazır olduğu anlamına gelmez.
5. Kapalı test grubuna gerçek gönüllülerin katılması ve Play test kaydının tamamlanması; gerekli süre sonunda üretim erişimi başvurusu. Grup/rehber ve yayımlanan topluluk çağrısı hazır; doğrulanan yeni testçi sayısı 0.
6. Satıcı bilgileri, ülkeye özgü derecelendirme/oyun izni, tüketici ve veri aktarımı şartları, marka araştırması ve gelir/vergi düzeni. Uygun olmayan ülkeler gerekirse dağıtım dışında bırakılmalı; bütün ülkeler otomatik seçilmedi.

Resmî dayanaklar: [Play aile politikası](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en), [AdMob veri açıklaması](https://developers.google.com/admob/android/privacy/play-data-disclosure), [Firebase veri açıklaması](https://firebase.google.com/docs/android/play-data-disclosure), [hesap silme](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en), [hedef API koşulu](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en), [SDK sözleşmesi](https://developer.android.com/studio/terms). İlk inceleme marka, müzik, KVKK ve vergi kaynaklarını ayrıca içerir.
