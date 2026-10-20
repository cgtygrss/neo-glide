package com.cgtygrss.neoglide;

import com.android.billingclient.api.Purchase;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.Base64;

import org.junit.Before;
import org.junit.Test;

public class GooglePlayPurchaseVerifierTest {
    private static final String PACKAGE_NAME = "com.cgtygrss.neoglide";
    private static final String PRODUCT_ID = "cosmetic_void_pilot";
    private static final String TOKEN = "purchase-token-123";
    private static final Set<String> PRODUCTS = Collections.unmodifiableSet(new HashSet<>(Collections.singletonList(PRODUCT_ID)));
    private KeyPair keyPair;

    @Before
    public void setUp() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        keyPair = generator.generateKeyPair();
    }

    @Test
    public void parsesKeyAndAcceptsCorrectPurchasedPayload() throws Exception {
        String json = purchaseJson(PACKAGE_NAME, PRODUCT_ID, TOKEN, 0, false);
        assertEquals(PRODUCT_ID, verify(json, TOKEN));
        assertEquals("google:6fd6f0ecd86b39195426b1cc066b13ca383b6aa32acd509b73e818f8796604c8", GooglePlayPurchaseVerifier.transactionId(TOKEN));
    }

    @Test
    public void rejectsTamperingAndMalformedPublicKey() throws Exception {
        String json = purchaseJson(PACKAGE_NAME, PRODUCT_ID, TOKEN, 0, false);
        assertFalse(GooglePlayPurchaseVerifier.verifies(keyPair.getPublic(), json + " ", sign(json)));
        try {
            GooglePlayPurchaseVerifier.parseRsaPublicKey(new byte[] { 1, 2, 3 });
            throw new AssertionError("Expected malformed key rejection");
        } catch (Exception expected) {
            // A malformed configured public key fails before a catalog is shown.
        }
    }

    @Test
    public void rejectsWrongSignedFieldsAndOnlyAcceptsPendingAsPending() throws Exception {
        assertNull(verify(purchaseJson("com.example.other", PRODUCT_ID, TOKEN, 0, false), TOKEN));
        assertNull(verify(purchaseJson(PACKAGE_NAME, "cosmetic_not_supported", TOKEN, 0, false), TOKEN));
        assertNull(verify(purchaseJson(PACKAGE_NAME, PRODUCT_ID, "different-token", 0, false), TOKEN));

        String pending = purchaseJson(PACKAGE_NAME, PRODUCT_ID, TOKEN, 4, true);
        assertNull(verify(pending, "different-token"));
        assertEquals(PRODUCT_ID, verify(pending, TOKEN));

        // BillingClient may coerce unfamiliar raw values; only the documented
        // raw 0/4 states are valid for the BillingClient state it exposes.
        assertNull(verify(purchaseJson(PACKAGE_NAME, PRODUCT_ID, TOKEN, 2, true), TOKEN));
    }

    private String verify(String json, String token) throws Exception {
        Purchase purchase = new Purchase(json, Base64.getEncoder().encodeToString(sign(json)));
        return GooglePlayPurchaseVerifier.verifiedProductId(
            GooglePlayPurchaseVerifier.parseRsaPublicKey(keyPair.getPublic().getEncoded()),
            json,
            sign(json),
            PACKAGE_NAME,
            PRODUCTS,
            purchase.getPurchaseState(),
            token,
            purchase.getProducts(),
            purchase.getQuantity()
        );
    }

    private byte[] sign(String json) throws Exception {
        Signature signer = Signature.getInstance("SHA1withRSA");
        signer.initSign(keyPair.getPrivate());
        signer.update(json.getBytes(StandardCharsets.UTF_8));
        return signer.sign();
    }

    private static String purchaseJson(String packageName, String productId, String token, int purchaseState, boolean productIdsArray) {
        String product = productIdsArray ? "\"productIds\":[\"" + productId + "\"]" : "\"productId\":\"" + productId + "\"";
        String tokenField = productIdsArray ? "token" : "purchaseToken";
        return "{\"packageName\":\"" + packageName + "\"," + product + ",\"purchaseState\":" + purchaseState + ",\"" + tokenField + "\":\"" + token + "\"}";
    }
}
