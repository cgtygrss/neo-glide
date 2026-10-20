package com.cgtygrss.neoglide;

import android.app.Activity;
import android.util.Base64;

import androidx.annotation.Nullable;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.security.PublicKey;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Google Play Billing bridge for the ten permanent cosmetic packs.
 *
 * The JavaScript wallet commits its durable ledger before invoking
 * finishTransaction(). Consequently this plugin exposes only verified,
 * unacknowledged PURCHASED purchases as pending transactions and only
 * acknowledges them. These products are never consumed.
 */
@CapacitorPlugin(name = "NeoGlideStore")
public class NeoGlideStorePlugin extends Plugin implements PurchasesUpdatedListener {
    private static final Set<String> PRODUCT_IDS = Collections.unmodifiableSet(new LinkedHashSet<>(Arrays.asList(
        "cosmetic_void_pilot",
        "cosmetic_solar_forge",
        "cosmetic_arctic_pulse",
        "cosmetic_cyber_current",
        "cosmetic_rose_circuit",
        "cosmetic_jade_drift",
        "cosmetic_pearl_comet",
        "cosmetic_cobalt_storm",
        "cosmetic_copper_horizon",
        "cosmetic_prism_voyager"
    )));

    private static final int MAX_CONNECTION_ATTEMPTS = 3;
    private final Map<String, ProductDetails> productDetails = new HashMap<>();
    private final Map<String, String> offerTokens = new HashMap<>();
    private final Map<String, Purchase> purchasesByTransactionId = new HashMap<>();
    private final Map<String, Purchase> unacknowledgedPurchases = new HashMap<>();
    private final Set<String> pendingProductIds = new LinkedHashSet<>();
    private final List<ConnectionRequest> waitingForConnection = new ArrayList<>();
    private final Set<String> acknowledgementsInProgress = new HashSet<>();

    private BillingClient billingClient;
    private PublicKey verificationKey;
    private String verificationKeyError;
    private boolean connecting;
    private boolean destroyed;
    private int connectionAttempts;
    private PluginCall activePurchaseCall;
    private String activeProductId;

    @Override
    public void load() {
        super.load();
        loadVerificationKey();
        billingClient = BillingClient.newBuilder(getContext().getApplicationContext())
            .setListener(this)
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()
            )
            .enableAutoServiceReconnection()
            .build();
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        // queryPurchasesAsync is Google's in-app reconciliation path for
        // purchases completed, cancelled, refunded, or restored while away.
        runOnUiThread(() -> {
            if (hasVerificationKey()) {
                withConnected(
                    () -> reconcilePurchases(true, null, null),
                    ignored -> { }
                );
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        destroyed = true;
        failWaitingConnections("Billing client was closed.");
        rejectActivePurchase("Billing client was closed.");
        if (billingClient != null) {
            billingClient.endConnection();
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void products(PluginCall call) {
        runOnUiThread(call, () -> productsOnUi(call));
    }

    private void productsOnUi(PluginCall call) {
        if (!requireVerificationKey(call)) return;
        withConnected(
            () -> queryProducts(call),
            call::reject
        );
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        runOnUiThread(call, () -> purchaseOnUi(call));
    }

    private void purchaseOnUi(PluginCall call) {
        String productId = call.getString("productId");
        if (!PRODUCT_IDS.contains(productId)) {
            call.reject("This product is no longer available for purchase.");
            return;
        }
        if (!requireVerificationKey(call)) return;
        if (activePurchaseCall != null) {
            call.reject("Another store request is still in progress.");
            return;
        }

        activePurchaseCall = call;
        activeProductId = productId;
        withConnected(
            () -> {
                // A Play-owned non-consumable must be represented as owned,
                // never granted a second time as a new wallet transaction.
                reconcilePurchases(false, (ownedIds, pendingIds) -> {
                    if (ownedIds.contains(productId)) {
                        resolveActivePurchase(statusResult("owned", ownedIds));
                    } else if (pendingIds.contains(productId)) {
                        resolveActivePurchase(statusResult("pending", Collections.emptySet()));
                    } else {
                        queryProductAndLaunch(productId);
                    }
                }, this::rejectActivePurchase);
            },
            this::rejectActivePurchase
        );
    }

    @PluginMethod
    public void restorePurchases(PluginCall call) {
        runOnUiThread(call, () -> restorePurchasesOnUi(call));
    }

    private void restorePurchasesOnUi(PluginCall call) {
        if (!requireVerificationKey(call)) return;
        withConnected(
            () -> reconcilePurchases(true, (ids, pendingIds) -> {
                JSArray productIds = toJSArray(ids);
                JSObject result = new JSObject();
                result.put("productIds", productIds);
                result.put("pendingProductIds", toJSArray(pendingIds));
                call.resolve(result);
            }, call::reject),
            call::reject
        );
    }

    @PluginMethod
    public void pendingTransactions(PluginCall call) {
        runOnUiThread(call, () -> pendingTransactionsOnUi(call));
    }

    private void pendingTransactionsOnUi(PluginCall call) {
        if (!requireVerificationKey(call)) return;
        withConnected(
            () -> reconcilePurchases(false, (ignored, pendingIds) -> {
                JSArray transactions = new JSArray();
                for (Purchase purchase : unacknowledgedPurchases.values()) {
                    JSObject transaction = transactionPayload(purchase);
                    if (transaction != null) transactions.put(transaction);
                }
                JSObject result = new JSObject();
                result.put("transactions", transactions);
                call.resolve(result);
            }, call::reject),
            call::reject
        );
    }

    @PluginMethod
    public void currentEntitlements(PluginCall call) {
        runOnUiThread(call, () -> currentEntitlementsOnUi(call));
    }

    private void currentEntitlementsOnUi(PluginCall call) {
        if (!requireVerificationKey(call)) return;
        withConnected(
            () -> reconcilePurchases(false, (ids, pendingIds) -> {
                JSObject result = new JSObject();
                result.put("productIds", toJSArray(ids));
                result.put("pendingProductIds", toJSArray(pendingIds));
                call.resolve(result);
            }, call::reject),
            call::reject
        );
    }

    @PluginMethod
    public void finishTransaction(PluginCall call) {
        runOnUiThread(call, () -> finishTransactionOnUi(call));
    }

    private void finishTransactionOnUi(PluginCall call) {
        String transactionId = call.getString("transactionId");
        String productId = call.getString("productId");
        if (transactionId == null || productId == null) {
            call.reject("A purchase transaction is required.");
            return;
        }
        if (!PRODUCT_IDS.contains(productId)) {
            call.reject("Purchase transaction does not match this product.");
            return;
        }
        if (!requireVerificationKey(call)) return;
        withConnected(
            () -> finishKnownTransaction(call, transactionId, productId),
            call::reject
        );
    }

    @Override
    public void onPurchasesUpdated(BillingResult billingResult, @Nullable List<Purchase> purchases) {
        runOnUiThread(() -> handlePurchasesUpdated(billingResult, purchases));
    }

    private void handlePurchasesUpdated(BillingResult billingResult, @Nullable List<Purchase> purchases) {
        int responseCode = billingResult.getResponseCode();
        if (responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
            boolean resolved = false;
            for (Purchase purchase : purchases) {
                if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
                    String pendingProductId = verifiedPendingProductId(purchase);
                    if (pendingProductId != null && pendingProductIds.add(pendingProductId)) emitEntitlementsChanged();
                    if (pendingProductId != null && pendingProductId.equals(activeProductId)) {
                        resolveActivePurchase(statusResult("pending", Collections.emptySet()));
                        resolved = true;
                    }
                    continue;
                }
                JSObject transaction = acceptPurchasedPurchase(purchase, true);
                if (transaction != null && activeProductId != null && activeProductId.equals(transaction.optString("productId"))) {
                    JSObject result = new JSObject();
                    result.put("status", "purchased");
                    result.put("transaction", transaction);
                    resolveActivePurchase(result);
                    resolved = true;
                }
            }
            if (!resolved && activePurchaseCall != null) {
                rejectActivePurchase("Purchase could not be verified. No cosmetic was granted.");
            }
            return;
        }
        if (responseCode == BillingClient.BillingResponseCode.USER_CANCELED) {
            resolveActivePurchase(statusResult("cancelled", Collections.emptySet()));
            return;
        }
        if (responseCode == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED && activeProductId != null) {
            reconcilePurchases(false, (ids, pendingIds) -> {
                if (ids.contains(activeProductId)) resolveActivePurchase(statusResult("owned", ids));
                else if (pendingIds.contains(activeProductId)) resolveActivePurchase(statusResult("pending", Collections.emptySet()));
                else rejectActivePurchase("Google Play reported this product as owned, but ownership could not be verified.");
            }, this::rejectActivePurchase);
            return;
        }
        rejectActivePurchase(billingError("Purchase failed", billingResult));
    }

    private void queryProducts(PluginCall call) {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (String productId : PRODUCT_IDS) {
            products.add(QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.INAPP)
                .build());
        }
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
            .setProductList(products)
            .build();
        billingClient.queryProductDetailsAsync(params, (billingResult, detailsResult) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                call.reject(billingError("Unable to load Google Play products", billingResult));
                return;
            }
            updateProductDetails(detailsResult);
            JSArray resultProducts = new JSArray();
            for (String id : PRODUCT_IDS) {
                ProductDetails details = productDetails.get(id);
                ProductDetails.OneTimePurchaseOfferDetails offer = firstOffer(details);
                if (details == null || offer == null || offer.getFormattedPrice() == null || offerTokens.get(id) == null) continue;
                JSObject product = new JSObject();
                product.put("id", id);
                product.put("displayPrice", offer.getFormattedPrice());
                resultProducts.put(product);
            }
            JSObject result = new JSObject();
            result.put("products", resultProducts);
            call.resolve(result);
        });
    }

    private void queryProductAndLaunch(String productId) {
        QueryProductDetailsParams.Product requested = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(productId)
            .setProductType(BillingClient.ProductType.INAPP)
            .build();
        billingClient.queryProductDetailsAsync(
            QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(requested)).build(),
            (billingResult, detailsResult) -> {
                if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    rejectActivePurchase(billingError("Unable to load this Google Play product", billingResult));
                    return;
                }
                updateProductDetails(detailsResult);
                ProductDetails details = productDetails.get(productId);
                String offerToken = offerTokens.get(productId);
                if (details == null || offerToken == null || offerToken.isEmpty()) {
                    rejectActivePurchase("This product is currently unavailable in Google Play.");
                    return;
                }
                BillingFlowParams.ProductDetailsParams productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(details)
                    .setOfferToken(offerToken)
                    .build();
                Activity activity = getActivity();
                if (activity == null || activity.isFinishing()) {
                    rejectActivePurchase("Google Play purchase UI is unavailable.");
                    return;
                }
                BillingResult launchResult = billingClient.launchBillingFlow(
                    activity,
                    BillingFlowParams.newBuilder()
                        .setProductDetailsParamsList(Collections.singletonList(productParams))
                        .build()
                );
                if (launchResult.getResponseCode() == BillingClient.BillingResponseCode.OK) return;
                if (launchResult.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
                    resolveActivePurchase(statusResult("cancelled", Collections.emptySet()));
                    return;
                }
                if (launchResult.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
                    reconcilePurchases(false, (ids, pendingIds) -> {
                        if (ids.contains(productId)) resolveActivePurchase(statusResult("owned", ids));
                        else if (pendingIds.contains(productId)) resolveActivePurchase(statusResult("pending", Collections.emptySet()));
                        else rejectActivePurchase("Google Play reported this product as owned, but ownership could not be verified.");
                    }, this::rejectActivePurchase);
                    return;
                }
                rejectActivePurchase(billingError("Unable to start Google Play purchase", launchResult));
            }
        );
    }

    private void finishKnownTransaction(PluginCall call, String transactionId, String productId) {
        Purchase known = purchasesByTransactionId.get(transactionId);
        if (known != null) {
            acknowledgeIfMatching(call, transactionId, productId, known);
            return;
        }
        reconcilePurchases(false, (ignored, pendingIds) -> {
            Purchase refreshed = purchasesByTransactionId.get(transactionId);
            if (refreshed == null) {
                // The JavaScript delivery ledger is idempotent. Google may have
                // already acknowledged the purchase in another app process.
                call.resolve(new JSObject());
                return;
            }
            acknowledgeIfMatching(call, transactionId, productId, refreshed);
        }, call::reject);
    }

    private void acknowledgeIfMatching(PluginCall call, String transactionId, String productId, Purchase purchase) {
        JSObject payload = transactionPayload(purchase);
        if (payload == null || !productId.equals(payload.optString("productId")) || !transactionId.equals(payload.optString("transactionId"))) {
            call.reject("Purchase transaction does not match this product.");
            return;
        }
        if (purchase.isAcknowledged()) {
            unacknowledgedPurchases.remove(transactionId);
            call.resolve(new JSObject());
            return;
        }
        if (!acknowledgementsInProgress.add(transactionId)) {
            call.reject("Purchase acknowledgement is already in progress.");
            return;
        }
        billingClient.acknowledgePurchase(
            AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.getPurchaseToken()).build(),
            billingResult -> {
                acknowledgementsInProgress.remove(transactionId);
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    unacknowledgedPurchases.remove(transactionId);
                    call.resolve(new JSObject());
                    emitEntitlementsChanged();
                } else {
                    call.reject(billingError("Google Play could not acknowledge this purchase", billingResult));
                }
            }
        );
    }

    /** Queries all INAPP purchases, including acknowledged non-consumable owners. */
    private void reconcilePurchases(boolean notify, @Nullable EntitlementsSuccess success, @Nullable Failure failure) {
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.INAPP)
            .build();
        billingClient.queryPurchasesAsync(params, (billingResult, purchases) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                if (failure != null) failure.fail(billingError("Unable to query Google Play purchases", billingResult));
                return;
            }
            Set<String> entitlements = new LinkedHashSet<>();
            Set<String> queriedPendingProductIds = new LinkedHashSet<>();
            Set<String> presentTransactionIds = new HashSet<>();
            for (Purchase purchase : purchases) {
                if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
                    String pendingProductId = verifiedPendingProductId(purchase);
                    if (pendingProductId != null) queriedPendingProductIds.add(pendingProductId);
                    continue;
                }
                JSObject transaction = acceptPurchasedPurchase(purchase, notify);
                if (transaction != null) {
                    entitlements.add(transaction.optString("productId"));
                    presentTransactionIds.add(transaction.optString("transactionId"));
                }
            }
            purchasesByTransactionId.keySet().retainAll(presentTransactionIds);
            unacknowledgedPurchases.keySet().retainAll(presentTransactionIds);
            // Only replace this snapshot after a successful query. A transient
            // Play failure must not erase a pending-payment conflict lock.
            pendingProductIds.clear();
            pendingProductIds.addAll(queriedPendingProductIds);
            if (notify) emitEntitlementsChanged();
            if (success != null) success.success(entitlements, queriedPendingProductIds);
        });
    }

    /**
     * Returns an application transaction only after all client-side checks pass.
     * Invalid signatures, package/product mismatches, and non-PURCHASED states
     * are deliberately invisible to JS and are never acknowledged.
     */
    @Nullable
    private JSObject acceptPurchasedPurchase(Purchase purchase, boolean notify) {
        JSObject transaction = transactionPayload(purchase);
        if (transaction == null) return null;
        String transactionId = transaction.optString("transactionId");
        purchasesByTransactionId.put(transactionId, purchase);
        if (!purchase.isAcknowledged()) {
            unacknowledgedPurchases.put(transactionId, purchase);
            if (notify) {
                JSObject update = new JSObject();
                update.put("transaction", transaction);
                notifyListeners("storeUpdate", update);
            }
        } else {
            unacknowledgedPurchases.remove(transactionId);
        }
        return transaction;
    }

    @Nullable
    private JSObject transactionPayload(Purchase purchase) {
        String productId = verifiedProductId(purchase);
        if (productId == null) return null;
        String token = purchase.getPurchaseToken();
        if (token == null || token.isEmpty()) return null;
        JSObject transaction = new JSObject();
        transaction.put("transactionId", GooglePlayPurchaseVerifier.transactionId(token));
        transaction.put("productId", productId);
        transaction.put("verified", true);
        return transaction;
    }

    @Nullable
    private String verifiedProductId(Purchase purchase) {
        return verifiedProductId(purchase, Purchase.PurchaseState.PURCHASED);
    }

    @Nullable
    private String verifiedPendingProductId(Purchase purchase) {
        return verifiedProductId(purchase, Purchase.PurchaseState.PENDING);
    }

    @Nullable
    private String verifiedProductId(Purchase purchase, int expectedPurchaseState) {
        if (purchase.getPackageName() == null || !getContext().getPackageName().equals(purchase.getPackageName())) return null;
        if (purchase.getPurchaseState() != expectedPurchaseState) return null;
        try {
            return GooglePlayPurchaseVerifier.verifiedProductId(
                verificationKey,
                purchase.getOriginalJson(),
                Base64.decode(purchase.getSignature(), Base64.DEFAULT),
                getContext().getPackageName(),
                PRODUCT_IDS,
                purchase.getPurchaseState(),
                purchase.getPurchaseToken(),
                purchase.getProducts(),
                purchase.getQuantity()
            );
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private void updateProductDetails(QueryProductDetailsResult detailsResult) {
        productDetails.clear();
        offerTokens.clear();
        for (ProductDetails details : detailsResult.getProductDetailsList()) {
            if (!PRODUCT_IDS.contains(details.getProductId())) continue;
            ProductDetails.OneTimePurchaseOfferDetails offer = firstOffer(details);
            if (offer == null || offer.getOfferToken() == null || offer.getOfferToken().isEmpty()) continue;
            productDetails.put(details.getProductId(), details);
            offerTokens.put(details.getProductId(), offer.getOfferToken());
        }
    }

    @Nullable
    private ProductDetails.OneTimePurchaseOfferDetails firstOffer(@Nullable ProductDetails details) {
        if (details == null) return null;
        if (details.getOneTimePurchaseOfferDetailsList() != null && !details.getOneTimePurchaseOfferDetailsList().isEmpty()) {
            for (ProductDetails.OneTimePurchaseOfferDetails offer : details.getOneTimePurchaseOfferDetailsList()) {
                if (isPermanentOffer(offer)) return offer;
            }
        }
        // Standard one-time products can expose one offer through the legacy
        // singular accessor, while products with multiple purchase options use
        // the list above.
        ProductDetails.OneTimePurchaseOfferDetails offer = details.getOneTimePurchaseOfferDetails();
        return isPermanentOffer(offer) ? offer : null;
    }

    private boolean isPermanentOffer(@Nullable ProductDetails.OneTimePurchaseOfferDetails offer) {
        return offer != null && offer.getRentalDetails() == null && offer.getPreorderDetails() == null;
    }

    private boolean hasVerificationKey() {
        return verificationKey != null;
    }

    private void loadVerificationKey() {
        String encodedKey = BuildConfig.PLAY_BILLING_PUBLIC_KEY;
        if (encodedKey == null || encodedKey.trim().isEmpty()) {
            verificationKeyError = "Google Play billing is unavailable because the Play Billing public key is not configured.";
            return;
        }
        try {
            verificationKey = GooglePlayPurchaseVerifier.parseRsaPublicKey(
                Base64.decode(encodedKey.replaceAll("\\s", ""), Base64.DEFAULT)
            );
        } catch (Exception ignored) {
            verificationKey = null;
            verificationKeyError = "Google Play billing is unavailable because the configured Play Billing public key is malformed.";
        }
    }

    /** Serializes plugin calls and Billing callbacks onto the Activity UI thread. */
    private void runOnUiThread(PluginCall call, Runnable operation) {
        Activity activity = getActivity();
        if (activity == null || activity.isFinishing()) {
            call.reject("Google Play billing UI is unavailable.");
            return;
        }
        activity.runOnUiThread(operation);
    }

    private void runOnUiThread(Runnable operation) {
        Activity activity = getActivity();
        if (activity != null && !activity.isFinishing()) activity.runOnUiThread(operation);
    }

    private boolean requireVerificationKey(PluginCall call) {
        if (hasVerificationKey()) return true;
        call.reject(verificationKeyError == null ? "Google Play billing is unavailable because the Play Billing public key is not configured." : verificationKeyError);
        return false;
    }

    private void withConnected(ConnectionSuccess success, Failure failure) {
        if (destroyed || billingClient == null) {
            failure.fail("Billing client is unavailable.");
            return;
        }
        if (billingClient.isReady()) {
            success.run();
            return;
        }
        if (waitingForConnection.isEmpty()) connectionAttempts = 0;
        waitingForConnection.add(new ConnectionRequest(success, failure));
        if (!connecting) startConnection();
    }

    private void startConnection() {
        if (destroyed || billingClient == null || connecting) return;
        connecting = true;
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                connecting = false;
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    connectionAttempts = 0;
                    List<ConnectionRequest> requests = new ArrayList<>(waitingForConnection);
                    waitingForConnection.clear();
                    for (ConnectionRequest request : requests) request.success.run();
                    return;
                }
                retryOrFail(billingError("Could not connect to Google Play billing", billingResult));
            }

            @Override
            public void onBillingServiceDisconnected() {
                connecting = false;
                retryOrFail("Google Play billing service disconnected.");
            }
        });
    }

    private void retryOrFail(String error) {
        if (destroyed) {
            failWaitingConnections(error);
            return;
        }
        connectionAttempts++;
        if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
            failWaitingConnections(error);
            return;
        }
        long delayMillis = 500L * connectionAttempts;
        Activity activity = getActivity();
        if (activity == null) {
            failWaitingConnections(error);
            return;
        }
        activity.runOnUiThread(() -> activity.getWindow().getDecorView().postDelayed(this::startConnection, delayMillis));
    }

    private void failWaitingConnections(String error) {
        List<ConnectionRequest> requests = new ArrayList<>(waitingForConnection);
        waitingForConnection.clear();
        for (ConnectionRequest request : requests) request.failure.fail(error);
    }

    private void resolveActivePurchase(JSObject result) {
        PluginCall call = activePurchaseCall;
        clearActivePurchase();
        if (call != null) call.resolve(result);
    }

    private void rejectActivePurchase(String error) {
        PluginCall call = activePurchaseCall;
        clearActivePurchase();
        if (call != null) call.reject(error);
    }

    private void clearActivePurchase() {
        activePurchaseCall = null;
        activeProductId = null;
    }

    private JSObject statusResult(String status, Set<String> productIds) {
        JSObject result = new JSObject();
        result.put("status", status);
        if (!productIds.isEmpty()) result.put("productIds", toJSArray(productIds));
        return result;
    }

    private static JSArray toJSArray(Set<String> values) {
        JSArray result = new JSArray();
        for (String value : values) result.put(value);
        return result;
    }

    private static String billingError(String prefix, BillingResult result) {
        String detail = result.getDebugMessage();
        return detail == null || detail.isEmpty() ? prefix : prefix + ": " + detail;
    }

    private void emitEntitlementsChanged() {
        JSObject update = new JSObject();
        update.put("entitlementsChanged", true);
        update.put("pendingProductIds", toJSArray(pendingProductIds));
        notifyListeners("storeUpdate", update);
    }

    private interface ConnectionSuccess { void run(); }
    private interface Failure { void fail(String message); }
    private interface EntitlementsSuccess { void success(Set<String> productIds, Set<String> pendingProductIds); }

    private static final class ConnectionRequest {
        final ConnectionSuccess success;
        final Failure failure;

        ConnectionRequest(ConnectionSuccess success, Failure failure) {
            this.success = success;
            this.failure = failure;
        }
    }
}
