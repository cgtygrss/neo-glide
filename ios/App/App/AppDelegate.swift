import UIKit
import Capacitor
import StoreKit
import UserMessagingPlatform

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
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(NeoGlideStorePlugin())
        bridge?.registerPluginInstance(NeoGlidePrivacyPlugin())
    }
}

private actor NeoGlideStore {
    private let cosmeticIDs: Set<String> = ["cosmetic_void_pilot", "cosmetic_solar_forge", "cosmetic_arctic_pulse", "cosmetic_cyber_current", "cosmetic_rose_circuit", "cosmetic_jade_drift", "cosmetic_pearl_comet", "cosmetic_cobalt_storm", "cosmetic_copper_horizon", "cosmetic_prism_voyager"]
    private let productIDs: Set<String> = ["remove_ads", "starter_pack", "credits_1000", "credits_5500", "credits_15000", "cosmetic_void_pilot", "cosmetic_solar_forge", "cosmetic_arctic_pulse", "cosmetic_cyber_current", "cosmetic_rose_circuit", "cosmetic_jade_drift", "cosmetic_pearl_comet", "cosmetic_cobalt_storm", "cosmetic_copper_horizon", "cosmetic_prism_voyager"]
    private let saleProductIDs: Set<String> = ["starter_pack", "credits_1000", "credits_5500", "credits_15000", "cosmetic_void_pilot", "cosmetic_solar_forge", "cosmetic_arctic_pulse", "cosmetic_cyber_current", "cosmetic_rose_circuit", "cosmetic_jade_drift", "cosmetic_pearl_comet", "cosmetic_cobalt_storm", "cosmetic_copper_horizon", "cosmetic_prism_voyager"]
    private let permanentIDs: Set<String> = ["remove_ads", "starter_pack", "cosmetic_void_pilot", "cosmetic_solar_forge", "cosmetic_arctic_pulse", "cosmetic_cyber_current", "cosmetic_rose_circuit", "cosmetic_jade_drift", "cosmetic_pearl_comet", "cosmetic_cobalt_storm", "cosmetic_copper_horizon", "cosmetic_prism_voyager"]
    private var pending: [String: StoreKit.Transaction] = [:]
    private var updates: Task<Void, Never>?
    private var purchaseActive = false

    func startUpdates(notify: @escaping @MainActor ([String: Any]) -> Void) {
        guard updates == nil else { return }
        updates = Task { [weak self] in
            for await result in StoreKit.Transaction.updates {
                guard let self else { return }
                if case .verified(let transaction) = result {
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

    private func accept(_ transaction: StoreKit.Transaction) -> [String: Any]? {
        guard productIDs.contains(transaction.productID) else { return nil }
        guard transaction.revocationDate == nil else {
            pending.removeValue(forKey: String(transaction.id))
            return nil
        }
        let expected: Product.ProductType = permanentIDs.contains(transaction.productID) ? .nonConsumable : .consumable
        guard transaction.productType == expected else { return nil }
        pending[String(transaction.id)] = transaction
        return ["transactionId": String(transaction.id), "productId": transaction.productID, "verified": true]
    }

    func products() async throws -> [[String: Any]] {
        let products = try await Product.products(for: saleProductIDs)
        return products.filter { product in
            product.type == (permanentIDs.contains(product.id) ? .nonConsumable : .consumable)
        }.map { ["id": $0.id, "displayPrice": $0.displayPrice] }
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
            guard case .verified(let transaction) = result, let payload = accept(transaction) else {
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
                _ = accept(transaction)
                if productIDs.contains(transaction.productID), transaction.revocationDate != nil {
                    await transaction.finish()
                }
            }
        }
        return pending.values.compactMap { transaction in
            guard transaction.revocationDate == nil else { return nil }
            return ["transactionId": String(transaction.id), "productId": transaction.productID, "verified": true]
        }
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

    public override func load() {
        let store = self.store
        Task { @MainActor [weak self] in
            await store.startUpdates { [weak self] payload in
                self?.notifyListeners("storeUpdate", data: payload)
            }
        }
    }

    @objc func products(_ call: CAPPluginCall) {
        Task {
            do { call.resolve(["products": try await store.products()]) }
            catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("productId") else { call.reject("A product is required."); return }
        Task {
            do { call.resolve(try await store.purchase(id)) }
            catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do { call.resolve(try await store.restore()) }
            catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func pendingTransactions(_ call: CAPPluginCall) {
        Task { call.resolve(["transactions": await store.pendingTransactions()]) }
    }

    @objc func currentEntitlements(_ call: CAPPluginCall) {
        Task { call.resolve(["productIds": await store.entitlements()]) }
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
