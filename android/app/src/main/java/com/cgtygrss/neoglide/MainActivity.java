package com.cgtygrss.neoglide;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Capacitor builds its bridge in super.onCreate(), so app-local plugins
        // must be registered first.
        registerPlugin(NeoGlideStorePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
