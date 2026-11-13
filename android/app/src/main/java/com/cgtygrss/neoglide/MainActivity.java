package com.cgtygrss.neoglide;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        // Capacitor builds its bridge in super.onCreate(), so app-local plugins
        // must be registered first.
        registerPlugin(NeoGlideStorePlugin.class);
        registerPlugin(NeoGlideAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
