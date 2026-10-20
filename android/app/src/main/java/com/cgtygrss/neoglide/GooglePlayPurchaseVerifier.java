package com.cgtygrss.neoglide;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.List;
import java.util.Set;

/** Pure purchase-signature and signed-payload validation used by the bridge. */
final class GooglePlayPurchaseVerifier {
    private GooglePlayPurchaseVerifier() { }

    static PublicKey parseRsaPublicKey(byte[] encodedKey) throws Exception {
        return KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(encodedKey));
    }

    static boolean verifies(PublicKey publicKey, String originalJson, byte[] signature) {
        if (publicKey == null || originalJson == null || signature == null) return false;
        try {
            // Google Play's signed purchase payload uses RSASSA-PKCS1-v1_5.
            Signature verifier = Signature.getInstance("SHA1withRSA");
            verifier.initVerify(publicKey);
            verifier.update(originalJson.getBytes(StandardCharsets.UTF_8));
            return verifier.verify(signature);
        } catch (Exception ignored) {
            return false;
        }
    }

    /**
     * Returns the one verified supported product or null. The caller supplies
     * fields read by BillingClient too, so signed JSON and BillingClient's view
     * of the same purchase must agree before delivery or acknowledgement.
     */
    static String verifiedProductId(
        PublicKey publicKey,
        String originalJson,
        byte[] signature,
        String expectedPackageName,
        Set<String> supportedProductIds,
        int billingPurchaseState,
        String purchaseToken,
        List<String> purchaseProducts,
        int quantity
    ) {
        if (!verifies(publicKey, originalJson, signature)) return null;
        if (purchaseProducts == null || purchaseProducts.size() != 1 || quantity != 1) return null;
        String productId = purchaseProducts.get(0);
        if (!supportedProductIds.contains(productId) || purchaseToken == null || purchaseToken.isEmpty()) return null;
        try {
            JSONObject purchase = new JSONObject(originalJson);
            if (!expectedPackageName.equals(purchase.optString("packageName"))) return null;
            if (!signedStateMatchesBillingState(purchase.optInt("purchaseState", -1), billingPurchaseState)) return null;
            if (!signedJsonContainsOnlyProduct(purchase, productId)) return null;
            String signedToken = purchase.optString("purchaseToken");
            if (signedToken.isEmpty()) signedToken = purchase.optString("token");
            return purchaseToken.equals(signedToken) ? productId : null;
        } catch (JSONException ignored) {
            return null;
        }
    }

    // The signed JSON uses Play's wire values, while BillingClient exposes its
    // own PurchaseState constants. Do not compare those two representations
    // directly: only the two states we deliver have a valid correspondence.
    private static boolean signedStateMatchesBillingState(int signedPurchaseState, int billingPurchaseState) {
        return (signedPurchaseState == 0 && billingPurchaseState == 1)
            || (signedPurchaseState == 4 && billingPurchaseState == 2);
    }

    static String transactionId(String purchaseToken) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(purchaseToken.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) hex.append(String.format("%02x", b & 0xff));
            return "google:" + hex;
        } catch (Exception impossible) {
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
    }

    private static boolean signedJsonContainsOnlyProduct(JSONObject purchase, String productId) {
        String legacyProductId = purchase.optString("productId");
        if (!legacyProductId.isEmpty()) return productId.equals(legacyProductId);
        JSONArray productIds = purchase.optJSONArray("productIds");
        return productIds != null && productIds.length() == 1 && productId.equals(productIds.optString(0));
    }
}
