package mn.legiblelens.app;

import android.os.Bundle;
import android.util.Base64;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileInputStream;
import java.io.ByteArrayOutputStream;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(Bundle state) {
		registerPlugin(ScreenCapturePlugin.class);
		super.onCreate(state);
		deliverCapture(getIntent());
	}

	@Override
	protected void onNewIntent(android.content.Intent intent) {
		super.onNewIntent(intent);
		setIntent(intent);
		deliverCapture(intent);
	}

	private void deliverCapture(android.content.Intent intent) {
		String path = intent == null ? null : intent.getStringExtra(ScreenCaptureService.EXTRA_CAPTURE_PATH);
		if (path == null) return;
		new Thread(() -> {
			try (FileInputStream input = new FileInputStream(new File(path));
				 ByteArrayOutputStream output = new ByteArrayOutputStream()) {
				byte[] buffer = new byte[8192];
				int count;
				while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
				String data = Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);
				runOnUiThread(() -> getBridge().getWebView().evaluateJavascript(
						"window.dispatchEvent(new CustomEvent('screenCaptured',{detail:{dataUrl:'data:image/png;base64,"
								+ data + "'}}));", null));
			} catch (Exception ignored) {
				// The web UI remains available for another capture attempt.
			}
		}).start();
	}
}
