package eu.eulesia.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Enable edge-to-edge: WebView extends behind status bar & navigation bar
        // so CSS env(safe-area-inset-*) values work correctly
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
