import UIKit
import Capacitor
import CapacitorCommunityAdmob
import FirebaseCore
import FirebaseAuth
import GoogleSignIn
import GameKit
import StoreKit
import UserMessagingPlatform
import AVFAudio
import GoogleMobileAds

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let configuration = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
        configuration.delegateClass = SceneDelegate.self
        return configuration
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        if GIDSignIn.sharedInstance.handle(url) { return true }
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

// This file is already a member of the app target. Keeping the local plugin here
// avoids changing the legacy Xcode project's source-file registration.
class GameBridgeViewController: CAPBridgeViewController {
    private var startupPoster: UIView?

    override func viewDidLoad() {
        super.viewDidLoad()
        // Capacitor's first WKWebView load is transparent. Keep the native
        // launch artwork visible until React has committed its matching frame.
        let poster = UIStoryboard(name: "LaunchScreen", bundle: nil).instantiateInitialViewController()?.view
        poster?.frame = view.bounds
        poster?.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        poster?.isUserInteractionEnabled = false
        poster?.accessibilityElementsHidden = true
        if let poster { view.addSubview(poster) }
        startupPoster = poster
        // The web-ready notification uses animation frames. On a cold WKWebView
        // those frames can be delayed while this native view covers the page.
        // Never let the decorative cover prevent the underlying age/error UI
        // from becoming visible when that notification is delayed or lost.
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
            self?.revealStartupContent()
        }
    }

    func revealStartupContent() {
        startupPoster?.removeFromSuperview()
        startupPoster = nil
    }

    override func capacitorDidLoad() {
        // A concrete reference keeps the static AdMob framework in release
        // builds, and registers it even if automatic class discovery fails.
        bridge?.registerPluginInstance(AdMobPlugin())
        bridge?.registerPluginInstance(NeoGlideAuthPlugin())
        bridge?.registerPluginInstance(NeoGlideStorePlugin())
        bridge?.registerPluginInstance(NeoGlidePrivacyPlugin())
        bridge?.registerPluginInstance(NeoGlideStartupPlugin())
        bridge?.registerPluginInstance(NeoGlideAudioPlugin())
    }
}

@objc(NeoGlideAudioPlugin)
class NeoGlideAudioPlugin: CAPPlugin, CAPBridgedPlugin, AudioVideoManagerDelegate {
    let identifier = "NeoGlideAudioPlugin"
    let jsName = "NeoGlideAudio"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "captureForAd", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restoreAfterAd", returnType: CAPPluginReturnPromise)
    ]
    private var savedSession: (AVAudioSession.Category, AVAudioSession.Mode, AVAudioSession.CategoryOptions)?

    func audioVideoManagerDidStopPlayingAudio(_ audioVideoManager: AudioVideoManager) {
        notifyListeners("audioReleased", data: [:])
    }

    func audioVideoManagerDidPauseAllVideo(_ audioVideoManager: AudioVideoManager) {
        notifyListeners("audioReleased", data: [:])
    }

    @objc func captureForAd(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            // The bridge is registered at launch, but only the adult ad path
            // may touch the advertising SDK.
            MobileAds.shared.audioVideoManager.delegate = self
            let session = AVAudioSession.sharedInstance()
            self.savedSession = (session.category, session.mode, session.categoryOptions)
            call.resolve()
        }
    }

    @objc func restoreAfterAd(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard UIApplication.shared.applicationState == .active else {
                call.resolve(["restored": false])
                return
            }
            do {
                let session = AVAudioSession.sharedInstance()
                if let saved = self.savedSession,
                   session.category != saved.0 || session.mode != saved.1 || session.categoryOptions != saved.2 {
                    try session.setCategory(saved.0, mode: saved.1, options: saved.2)
                }
                try session.setActive(true)
                call.resolve(["restored": true])
            } catch {
                call.reject("Could not restore game audio", nil, error)
            }
        }
    }
}

@objc(NeoGlideStartupPlugin)
class NeoGlideStartupPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "NeoGlideStartupPlugin"
    let jsName = "NeoGlideStartup"
    let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "ready", returnType: CAPPluginReturnPromise)]

    @objc func ready(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            (self.bridge?.viewController as? GameBridgeViewController)?.revealStartupContent()
            call.resolve()
        }
    }
}

private actor NeoGlideStore {
    private let cosmeticIDs: Set<String> = ["cosmetic_copper_horizon", "cosmetic_arctic_pulse", "cosmetic_cyber_current", "cosmetic_jade_drift", "cosmetic_rose_circuit", "cosmetic_solar_forge", "cosmetic_pearl_comet", "cosmetic_void_pilot", "cosmetic_cobalt_storm", "cosmetic_prism_voyager", "cosmetic_mint_condition", "cosmetic_scarlet_comet", "cosmetic_amber_signal", "cosmetic_lunar_silver", "cosmetic_ocean_depth", "cosmetic_lavender_dream", "cosmetic_toxic_bloom", "cosmetic_desert_mirage", "cosmetic_ruby_eclipse", "cosmetic_glacier_blue", "cosmetic_saffron_sky", "cosmetic_midnight_gold", "cosmetic_coral_reef", "cosmetic_ultraviolet", "cosmetic_nebula_circuit", "cosmetic_aurora_pathfinder"]
    private var productIDs: Set<String> { cosmeticIDs.union(["remove_ads", "starter_pack", "credits_50000", "credits_1000", "credits_250000", "credits_5500", "credits_1000000", "credits_15000"]) }
    private var saleProductIDs: Set<String> { productIDs.subtracting(["remove_ads"]) }
    private var permanentIDs: Set<String> { cosmeticIDs.union(["remove_ads", "starter_pack"]) }
    private var pending: [String: StoreKit.Transaction] = [:]
    private var proofs: [String: String] = [:]
    private var updates: Task<Void, Never>?
    private var purchaseActive = false

    func startUpdates(notify: @escaping @MainActor ([String: Any]) -> Void) {
        guard updates == nil else { return }
        updates = Task { [weak self] in
            for await result in StoreKit.Transaction.updates {
                guard let self else { return }
                if case .verified(let transaction) = result {
                    await self.saveProof(transaction, signed: result.jwsRepresentation)
                    if let payload = await self.accept(transaction) {
                        await notify(["transaction": payload])
                    } else if transaction.revocationDate != nil {
                        await transaction.finish()
                        await notify(["entitlementsChanged": true])
                    }
                }
            }
        }
    }

    private func saveProof(_ transaction: StoreKit.Transaction, signed: String) { proofs[String(transaction.id)] = signed }

    private func accept(_ transaction: StoreKit.Transaction) -> [String: Any]? {
        guard productIDs.contains(transaction.productID) else { return nil }
        guard transaction.revocationDate == nil else {
            pending.removeValue(forKey: String(transaction.id))
            return nil
        }
        let expected: Product.ProductType = permanentIDs.contains(transaction.productID) ? .nonConsumable : .consumable
        guard transaction.productType == expected else { return nil }
        pending[String(transaction.id)] = transaction
        return ["transactionId": String(transaction.id), "productId": transaction.productID, "verified": true, "platform": "ios", "signedTransaction": proofs[String(transaction.id)] ?? ""]
    }

    func products() async throws -> [[String: Any]] {
        let products = try await Product.products(for: saleProductIDs)
        return products.filter { product in
            product.type == (permanentIDs.contains(product.id) ? .nonConsumable : .consumable)
        }.map { ["id": $0.id, "displayPrice": $0.displayPrice, "priceAmount": NSDecimalNumber(decimal: $0.price).doubleValue] }
    }

    func entitlements() async -> [String] {
        var ids: [String] = []
        for await result in StoreKit.Transaction.currentEntitlements {
            if case .verified(let transaction) = result,
               transaction.revocationDate == nil, permanentIDs.contains(transaction.productID) {
                ids.append(transaction.productID)
            }
        }
        return ids
    }

    func purchase(_ productID: String) async throws -> [String: Any] {
        guard saleProductIDs.contains(productID) else { throw failure("This product is no longer available for purchase.") }
        guard !purchaseActive else { throw failure("Another store request is still in progress.") }
        purchaseActive = true
        defer { purchaseActive = false }
        // StoreKit can return an existing non-consumable purchase. Restoring an
        // already owned Starter must never deliver its credits again.
        if permanentIDs.contains(productID), await entitlements().contains(productID) {
            return ["status": "owned", "productIds": await entitlements()]
        }
        guard let product = try await Product.products(for: [productID]).first,
              product.type == (permanentIDs.contains(productID) ? .nonConsumable : .consumable) else {
            throw failure("This product is currently unavailable in the App Store.")
        }
        switch try await product.purchase() {
        case .success(let result):
            guard case .verified(let transaction) = result else {
                throw failure("Purchase could not be verified.")
            }
            saveProof(transaction, signed: result.jwsRepresentation)
            guard let payload = accept(transaction) else {
                throw failure("Purchase could not be verified. No credits were granted.")
            }
            return ["status": "purchased", "transaction": payload]
        case .userCancelled: return ["status": "cancelled"]
        case .pending: return ["status": "pending"]
        @unknown default: throw failure("The App Store returned an unknown purchase result.")
        }
    }

    func pendingTransactions() async -> [[String: Any]] {
        // Includes purchases approved while the app was closed or terminated
        // before the JavaScript wallet could acknowledge its durable commit.
        for await result in StoreKit.Transaction.unfinished {
            if case .verified(let transaction) = result {
                saveProof(transaction, signed: result.jwsRepresentation)
                _ = accept(transaction)
                if productIDs.contains(transaction.productID), transaction.revocationDate != nil {
                    await transaction.finish()
                }
            }
        }
        return pending.values.compactMap { transaction in
            guard transaction.revocationDate == nil else { return nil }
            return ["transactionId": String(transaction.id), "productId": transaction.productID, "verified": true, "platform": "ios", "signedTransaction": proofs[String(transaction.id)] ?? ""]
        }
    }

    func entitlementTransactions() async -> [[String: Any]] {
        var receipts: [[String: Any]] = []
        for await result in StoreKit.Transaction.currentEntitlements {
            if case .verified(let transaction) = result, transaction.revocationDate == nil, permanentIDs.contains(transaction.productID) {
                receipts.append(["transactionId": String(transaction.id), "productId": transaction.productID, "verified": true, "platform": "ios", "signedTransaction": result.jwsRepresentation])
            }
        }
        return receipts
    }

    func restore() async throws -> [String: Any] {
        guard !purchaseActive else { throw failure("Another store request is still in progress.") }
        purchaseActive = true
        defer { purchaseActive = false }
        try await AppStore.sync()
        return ["productIds": await entitlements()]
    }

    func finish(_ transactionID: String, productID: String) async throws {
        if pending[transactionID] == nil { _ = await pendingTransactions() }
        guard let transaction = pending[transactionID] else { return } // A duplicate acknowledgement is harmless.
        guard transaction.productID == productID else { throw failure("Purchase transaction does not match this product.") }
        await transaction.finish()
        pending.removeValue(forKey: transactionID)
    }

    private func failure(_ message: String) -> NSError {
        NSError(domain: "NeoGlideStore", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }

    deinit { updates?.cancel() }
}

@objc(NeoGlideStorePlugin)
public class NeoGlideStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NeoGlideStorePlugin"
    public let jsName = "NeoGlideStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "products", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pendingTransactions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "currentEntitlements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finishTransaction", returnType: CAPPluginReturnPromise)
    ]
    private let store = NeoGlideStore()

    private func startUpdates() {
        let store = self.store
        Task { @MainActor [weak self] in
            await store.startUpdates { [weak self] payload in
                self?.notifyListeners("storeUpdate", data: payload)
            }
        }
    }

    @objc func products(_ call: CAPPluginCall) {
        startUpdates()
        Task {
            do { call.resolve(["products": try await store.products()]) }
            catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        startUpdates()
        guard let id = call.getString("productId") else { call.reject("A product is required."); return }
        Task {
            do { call.resolve(try await store.purchase(id)) }
            catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        startUpdates()
        Task {
            do { call.resolve(try await store.restore()) }
            catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func pendingTransactions(_ call: CAPPluginCall) {
        startUpdates()
        Task { call.resolve(["transactions": await store.pendingTransactions()]) }
    }

    @objc func currentEntitlements(_ call: CAPPluginCall) {
        startUpdates()
        Task { call.resolve(["productIds": await store.entitlements(), "transactions": await store.entitlementTransactions()]) }
    }

    @objc func finishTransaction(_ call: CAPPluginCall) {
        guard let id = call.getString("transactionId"), let productID = call.getString("productId") else {
            call.reject("A purchase transaction is required."); return
        }
        Task {
            do { try await store.finish(id, productID: productID); call.resolve() }
            catch { call.reject(error.localizedDescription) }
        }
    }
}

// Consent forms must be presentable before MobileAds.start(). The upstream AdMob
// plugin initializes its form presenter only while starting the ads SDK.
@objc(NeoGlidePrivacyPlugin)
public class NeoGlidePrivacyPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NeoGlidePrivacyPlugin"
    public let jsName = "NeoGlidePrivacy"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestConsentInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showConsentForm", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showPrivacyOptionsForm", returnType: CAPPluginReturnPromise)
    ]

    @MainActor private func consentState() -> [String: Any] {
        let info = ConsentInformation.shared
        let status: String
        switch info.consentStatus {
        case .required: status = "REQUIRED"
        case .obtained: status = "OBTAINED"
        case .notRequired: status = "NOT_REQUIRED"
        default: status = "UNKNOWN"
        }
        let privacy: String
        switch info.privacyOptionsRequirementStatus {
        case .required: privacy = "REQUIRED"
        case .notRequired: privacy = "NOT_REQUIRED"
        default: privacy = "UNKNOWN"
        }
        return ["status": status, "canRequestAds": info.canRequestAds,
                "isConsentFormAvailable": info.formStatus == .available,
                "privacyOptionsRequirementStatus": privacy]
    }

    @objc func requestConsentInfo(_ call: CAPPluginCall) {
        Task { @MainActor in
            let parameters = RequestParameters()
            parameters.isTaggedForUnderAgeOfConsent = false
            do {
                try await ConsentInformation.shared.requestConsentInfoUpdate(with: parameters)
                call.resolve(consentState())
            } catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func showConsentForm(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let presenter = bridge?.viewController else { call.reject("Privacy presenter is unavailable."); return }
            do {
                try await ConsentForm.loadAndPresentIfRequired(from: presenter)
                call.resolve(consentState())
            } catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func showPrivacyOptionsForm(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let presenter = bridge?.viewController else { call.reject("Privacy presenter is unavailable."); return }
            do {
                try await ConsentForm.presentPrivacyOptionsForm(from: presenter)
                call.resolve(consentState())
            } catch { call.reject(error.localizedDescription) }
        }
    }
}

// Account credentials stay in the native Firebase SDK/Keychain. Candidate
// sign-ins use a second Firebase app until cloud conflict resolution succeeds.
@objc(NeoGlideAuthPlugin)
public class NeoGlideAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NeoGlideAuthPlugin"
    public let jsName = "NeoGlideAuth"
    public let pluginMethods: [CAPPluginMethod] = ["restoreSession", "signInGuest", "getIdToken", "getPlayerProfile", "beginSignIn", "commitSignIn", "autoSignIn", "signOut", "deleteAccount"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private var candidate: AuthCredential?
    private func session() throws -> Auth {
        if FirebaseApp.app() == nil {
            guard Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil else { throw NSError(domain: "NeoGlideAuth", code: 1, userInfo: [NSLocalizedDescriptionKey: "Firebase configuration is unavailable."]) }
            FirebaseApp.configure()
        }
        return Auth.auth()
    }
    private func describe(_ user: FirebaseAuth.User?) -> [String: Any] {
        guard let user else { return ["user": NSNull()] }
        return ["user": ["uid": user.uid, "name": user.displayName ?? "Guest pilot", "anonymous": user.isAnonymous, "providers": user.providerData.map { $0.providerID }]]
    }
    @objc func restoreSession(_ call: CAPPluginCall) { do { call.resolve(describe(try session().currentUser)) } catch { call.reject(error.localizedDescription) } }
    @objc func getPlayerProfile(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let player = GKLocalPlayer.local
            let respond = {
                if player.isAuthenticated {
                    call.resolve(["name": player.displayName, "provider": "Game Center"])
                } else { call.resolve() }
            }
            if player.isAuthenticated { respond(); return }
            // Restore GameKit only for an already linked Game Center pilot.
            // Guests who previously declined sign-in are not prompted again.
            guard let user = try? self.session().currentUser,
                  user.providerData.contains(where: { $0.providerID == "gc.apple.com" }) else { call.resolve(); return }
            var completed = false
            player.authenticateHandler = { controller, _ in
                if completed { return }
                if let controller { self.bridge?.viewController?.present(controller, animated: true); return }
                completed = true
                respond()
            }
        }
    }
    @objc func signInGuest(_ call: CAPPluginCall) {
        do { try session().signInAnonymously { result, error in if let error { call.reject(error.localizedDescription) } else { call.resolve(self.describe(result?.user)) } } } catch { call.reject(error.localizedDescription) }
    }
    @objc func getIdToken(_ call: CAPPluginCall) {
        do { guard let user = try session().currentUser else { call.reject("Not signed in."); return }
            user.getIDToken { token, error in if let token { call.resolve(["token": token]) } else { call.reject(error?.localizedDescription ?? "Session expired.") } }
        } catch { call.reject(error.localizedDescription) }
    }
    @objc func beginSignIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                _ = try self.session()
                if call.getString("provider") == "gamecenter" { self.gameCenter(call, automatic: false); return }
                guard let clientID = FirebaseApp.app()?.options.clientID else { call.reject("Google OAuth client is not configured."); return }
                GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
                guard let controller = self.bridge?.viewController else { call.reject("No presentation window."); return }
                GIDSignIn.sharedInstance.signIn(withPresenting: controller) { result, error in
                    guard let result, let token = result.user.idToken?.tokenString else { call.reject(error?.localizedDescription ?? "Google sign-in cancelled."); return }
                    self.prepare(GoogleAuthProvider.credential(withIDToken: token, accessToken: result.user.accessToken.tokenString), call: call, automatic: false)
                }
            } catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func autoSignIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if UserDefaults.standard.bool(forKey: "neoGlideAuthAttempted") { call.resolve(); return }
            UserDefaults.standard.set(true, forKey: "neoGlideAuthAttempted")
            do { _ = try self.session(); self.gameCenter(call, automatic: true) } catch { call.reject(error.localizedDescription) }
        }
    }
    private func gameCenter(_ call: CAPPluginCall, automatic: Bool) {
        var completed = false
        GKLocalPlayer.local.authenticateHandler = { controller, error in
            if completed { return }
            if let controller { self.bridge?.viewController?.present(controller, animated: true); return }
            completed = true
            guard GKLocalPlayer.local.isAuthenticated else { call.reject(error?.localizedDescription ?? "Game Center sign-in cancelled."); return }
            GameCenterAuthProvider.getCredential { credential, error in
                guard let credential else { call.reject(error?.localizedDescription ?? "Game Center unavailable."); return }
                self.prepare(credential, call: call, automatic: automatic)
            }
        }
    }
    private func prepare(_ credential: AuthCredential, call: CAPPluginCall, automatic: Bool) {
        candidate = credential
        if automatic {
            Auth.auth().signIn(with: credential) { result, error in if let error { call.reject(error.localizedDescription) } else { call.resolve(self.describe(result?.user)) } }; return
        }
        if FirebaseApp.app(name: "candidate") == nil, let options = FirebaseApp.app()?.options { FirebaseApp.configure(name: "candidate", options: options) }
        guard let app = FirebaseApp.app(name: "candidate") else { call.reject("Account setup failed."); return }
        Auth.auth(app: app).signIn(with: credential) { result, error in
            guard let user = result?.user else { call.reject(error?.localizedDescription ?? "Sign-in failed."); return }
            user.getIDToken { token, error in
                guard let token else { call.reject(error?.localizedDescription ?? "Session expired."); return }
                var output = self.describe(user); output["token"] = token; call.resolve(output)
            }
        }
    }
    @objc func commitSignIn(_ call: CAPPluginCall) {
        guard let credential = candidate else { call.reject("Sign in again."); return }
        Auth.auth().signIn(with: credential) { result, error in if let error { call.reject(error.localizedDescription) } else { self.candidate = nil; call.resolve(self.describe(result?.user)) } }
    }
    @objc func signOut(_ call: CAPPluginCall) { do { try session().signOut(); call.resolve() } catch { call.reject(error.localizedDescription) } }
    @objc func deleteAccount(_ call: CAPPluginCall) { do { try session().currentUser?.delete { error in if let error { call.reject(error.localizedDescription) } else { call.resolve() } } } catch { call.reject(error.localizedDescription) } }
}
