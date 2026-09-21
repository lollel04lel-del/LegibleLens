package mn.legiblelens.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.DisplayMetrics;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;

public class ScreenCaptureService extends Service {
    public static final String ACTION_START = "mn.legiblelens.app.START_CAPTURE";
    public static final String ACTION_CAPTURE = "mn.legiblelens.app.CAPTURE_FRAME";
    public static final String EXTRA_RESULT_CODE = "resultCode";
    public static final String EXTRA_RESULT_DATA = "resultData";
    public static final String EXTRA_CAPTURE_PATH = "capturePath";
    private static final String CHANNEL_ID = "screen_capture";
    private static final int NOTIFICATION_ID = 41;

    private MediaProjection projection;
    private VirtualDisplay display;
    private ImageReader reader;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private int width;
    private int height;
    private int density;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (ACTION_START.equals(intent.getAction())) {
            startProjection(intent);
        } else if (ACTION_CAPTURE.equals(intent.getAction())) {
            captureFrame();
        }
        return START_NOT_STICKY;
    }

    private void startProjection(Intent intent) {
        createChannel();
        startForeground(NOTIFICATION_ID, notification());
        MediaProjectionManager manager = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
        projection = manager.getMediaProjection(
                intent.getIntExtra(EXTRA_RESULT_CODE, 0),
                intent.getParcelableExtra(EXTRA_RESULT_DATA));
        DisplayMetrics metrics = getResources().getDisplayMetrics();
        width = metrics.widthPixels;
        height = metrics.heightPixels;
        density = metrics.densityDpi;
        reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2);
        display = projection.createVirtualDisplay(
                "LegibleLensCapture", width, height, density,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                reader.getSurface(), null, handler);
    }

    private Notification notification() {
        Intent capture = new Intent(this, ScreenCaptureService.class).setAction(ACTION_CAPTURE);
        PendingIntent action = PendingIntent.getService(this, 42, capture,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_camera)
                .setContentTitle("LegibleLens is ready")
                .setContentText("Switch to the Japanese screen, then tap Freeze current screen")
                .setOngoing(true)
                .addAction(android.R.drawable.ic_menu_camera, "Freeze current screen", action)
                .build();
    }

    private void captureFrame() {
        handler.postDelayed(() -> {
            Image image = reader == null ? null : reader.acquireLatestImage();
            if (image == null) {
                stopSelf();
                return;
            }
            try {
                Image.Plane plane = image.getPlanes()[0];
                ByteBuffer buffer = plane.getBuffer();
                int pixelStride = plane.getPixelStride();
                int rowStride = plane.getRowStride();
                int rowPadding = rowStride - pixelStride * width;
                Bitmap full = Bitmap.createBitmap(
                        width + rowPadding / pixelStride, height, Bitmap.Config.ARGB_8888);
                full.copyPixelsFromBuffer(buffer);
                Bitmap frame = Bitmap.createBitmap(full, 0, 0, width, height);
                full.recycle();
                File target = new File(getCacheDir(), "legiblelens-screen.png");
                try (FileOutputStream output = new FileOutputStream(target)) {
                    frame.compress(Bitmap.CompressFormat.PNG, 100, output);
                }
                frame.recycle();
                openApp(target);
            } catch (Exception ignored) {
                stopSelf();
            } finally {
                image.close();
            }
        }, 450);
    }

    private void openApp(File capture) {
        Intent app = new Intent(this, MainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .putExtra(EXTRA_CAPTURE_PATH, capture.getAbsolutePath())
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(app);
        stopProjection();
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "LegibleLens screen capture", NotificationManager.IMPORTANCE_HIGH);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    private void stopProjection() {
        if (display != null) display.release();
        if (reader != null) reader.close();
        if (projection != null) projection.stop();
        display = null;
        reader = null;
        projection = null;
    }

    @Override
    public void onDestroy() {
        stopProjection();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}