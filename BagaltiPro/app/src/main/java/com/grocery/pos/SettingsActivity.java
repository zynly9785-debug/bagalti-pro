package com.grocery.pos;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import com.google.android.material.switchmaterial.SwitchMaterial;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.text.DateFormat;
import java.util.Date;
import java.util.concurrent.Executor;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public class SettingsActivity extends AppCompatActivity {

    private EditText etStoreNameSetting;
    private SwitchMaterial switchBiometric;
    private Button btnChangePin, btnBackupEmail, btnRestoreBackup;
    private Button btnCallSupport, btnWhatsappSupport, btnSmsSupport, btnShareSupport, btnSaveStoreName;
    private TextView tvSubscriptionExpiry;

    private SharedPreferences prefs;
    private DatabaseHelper dbHelper;
    private static final String SUPPORT_PHONE = "+967778228995";
    private static final String RENEWAL_MESSAGE = "مرحباً، أود الاستفسار عن تجديد اشتراك تطبيق بقالتي ومعرفة وسيلة الدفع المتاحة.";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_settings);

        prefs = getSharedPreferences("GroceryPrefs", Context.MODE_PRIVATE);
        dbHelper = new DatabaseHelper(this);

        etStoreNameSetting = findViewById(R.id.etStoreNameSetting);
        switchBiometric = findViewById(R.id.switchBiometric);
        btnChangePin = findViewById(R.id.btnChangePin);
        btnBackupEmail = findViewById(R.id.btnBackupEmail);
        btnRestoreBackup = findViewById(R.id.btnRestoreBackup);
        btnCallSupport = findViewById(R.id.btnCallSupport);
        btnWhatsappSupport = findViewById(R.id.btnWhatsappSupport);
        btnSmsSupport = findViewById(R.id.btnSmsSupport);
        btnShareSupport = findViewById(R.id.btnShareSupport);
        btnSaveStoreName = findViewById(R.id.btnSaveStoreName);
        tvSubscriptionExpiry = findViewById(R.id.tvSubscriptionExpiry);

        etStoreNameSetting.setText(prefs.getString("store_name", "بقالة الأمانة"));
        switchBiometric.setChecked(prefs.getBoolean("biometric_enabled", false));
        showSubscriptionInfo();

        btnSaveStoreName.setOnClickListener(v -> saveStoreName());
        switchBiometric.setOnCheckedChangeListener((buttonView, isChecked) -> {
            if (isChecked) authenticateBiometric();
            else prefs.edit().putBoolean("biometric_enabled", false).apply();
        });
        btnChangePin.setOnClickListener(v -> showChangePinDialog());
        btnBackupEmail.setOnClickListener(v -> backupDatabaseToShare());
        btnRestoreBackup.setOnClickListener(v -> new AlertDialog.Builder(this)
                .setTitle("استعادة النسخة الاحتياطية")
                .setMessage("استعادة قاعدة البيانات غير متاحة حالياً. لم يتم استيراد أي ملف أو تغيير بياناتك.")
                .setPositiveButton("حسناً", null).show());

        btnCallSupport.setOnClickListener(v -> launchIntent(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + SUPPORT_PHONE))));
        btnWhatsappSupport.setOnClickListener(v -> {
            String url = "https://api.whatsapp.com/send?phone=967778228995&text=" + Uri.encode(RENEWAL_MESSAGE);
            launchIntent(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        });
        btnSmsSupport.setOnClickListener(v -> {
            Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + SUPPORT_PHONE));
            intent.putExtra("sms_body", RENEWAL_MESSAGE);
            launchIntent(intent);
        });
        btnShareSupport.setOnClickListener(v -> {
            Intent share = new Intent(Intent.ACTION_SEND);
            share.setType("text/plain");
            share.putExtra(Intent.EXTRA_TEXT, RENEWAL_MESSAGE + "\nرقم التواصل: " + SUPPORT_PHONE);
            startActivity(Intent.createChooser(share, "التواصل بشأن تجديد الاشتراك"));
        });
    }

    private void showSubscriptionInfo() {
        int storeId = prefs.getInt("store_id", -1);
        Cursor cursor = null;
        try {
            cursor = dbHelper.getReadableDatabase().rawQuery(
                    "SELECT subscription_end, status, suspension_reason FROM " + DatabaseHelper.TABLE_USERS + " WHERE id = ?",
                    new String[]{String.valueOf(storeId)});
            if (cursor.moveToFirst()) {
                long end = cursor.getLong(cursor.getColumnIndexOrThrow("subscription_end"));
                String status = cursor.getString(cursor.getColumnIndexOrThrow("status"));
                String reason = cursor.getString(cursor.getColumnIndexOrThrow("suspension_reason"));
                String date = DateFormat.getDateInstance(DateFormat.LONG).format(new Date(end));
                String state = "active".equalsIgnoreCase(status) ? "نشط" :
                        ("suspended".equalsIgnoreCase(status) ? "موقوف" : status);
                String remaining = end >= System.currentTimeMillis()
                        ? "متبقٍ " + Math.max(0, (end - System.currentTimeMillis()) / (24L * 60 * 60 * 1000)) + " يوماً"
                        : "انتهى الاشتراك";
                tvSubscriptionExpiry.setText("حالة الاشتراك: " + state + "\nتاريخ الانتهاء: " + date + "\n" + remaining
                        + (reason == null || reason.trim().isEmpty() ? "" : "\nملاحظة: " + reason));
            } else {
                tvSubscriptionExpiry.setText("تعذر العثور على معلومات الاشتراك لهذا المتجر.");
            }
        } catch (Exception e) {
            tvSubscriptionExpiry.setText("تعذر تحميل معلومات الاشتراك حالياً.");
        } finally {
            if (cursor != null) cursor.close();
        }
    }

    private void saveStoreName() {
        String name = etStoreNameSetting.getText().toString().trim();
        if (name.isEmpty()) {
            etStoreNameSetting.setError("أدخل اسم المتجر");
            return;
        }
        int storeId = prefs.getInt("store_id", -1);
        android.content.ContentValues values = new android.content.ContentValues();
        values.put("store_name", name);
        int updated = dbHelper.getWritableDatabase().update(DatabaseHelper.TABLE_USERS, values,
                "id = ?", new String[]{String.valueOf(storeId)});
        if (updated > 0) {
            prefs.edit().putString("store_name", name).apply();
            Toast.makeText(this, "تم حفظ اسم المتجر", Toast.LENGTH_SHORT).show();
        } else {
            Toast.makeText(this, "تعذر حفظ اسم المتجر؛ لم يُعثر على سجل المتجر.", Toast.LENGTH_LONG).show();
        }
    }

    private void authenticateBiometric() {
        Executor executor = ContextCompat.getMainExecutor(this);
        BiometricPrompt biometricPrompt = new BiometricPrompt(this, executor, new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                super.onAuthenticationSucceeded(result);
                prefs.edit().putBoolean("biometric_enabled", true).apply();
                Toast.makeText(SettingsActivity.this, "تم تفعيل المصادقة بالبصمة بنجاح!", Toast.LENGTH_SHORT).show();
            }

            @Override
            public void onAuthenticationFailed() {
                super.onAuthenticationFailed();
                switchBiometric.setChecked(false);
                Toast.makeText(SettingsActivity.this, "فشل التعرف على البصمة", Toast.LENGTH_SHORT).show();
            }

            @Override
            public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                super.onAuthenticationError(errorCode, errString);
                switchBiometric.setChecked(false);
            }
        });
        BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("تأكيد البصمة").setSubtitle("ضع إصبعك على الماسح لتأكيد تفعيل الحماية البيومترية")
                .setNegativeButtonText("إلغاء").build();
        biometricPrompt.authenticate(promptInfo);
    }

    private void showChangePinDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("تغيير رمز الأمان (PIN)");
        final EditText etNewPin = new EditText(this);
        etNewPin.setHint("أدخل 4 أرقام جديدة");
        etNewPin.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        builder.setView(etNewPin);
        builder.setPositiveButton("حفظ", (dialog, which) -> {
            String newPin = etNewPin.getText().toString().trim();
            if (newPin.matches("[0-9]{4}")) {
                int storeId = prefs.getInt("store_id", -1);
                dbHelper.getWritableDatabase().execSQL("UPDATE " + DatabaseHelper.TABLE_USERS + " SET pin_code = ? WHERE id = ?",
                        new Object[]{newPin, storeId});
                Toast.makeText(this, "تم حفظ الرمز السري الجديد", Toast.LENGTH_SHORT).show();
            } else Toast.makeText(this, "أدخل أربعة أرقام بالضبط", Toast.LENGTH_SHORT).show();
        });
        builder.setNegativeButton("إلغاء", null);
        builder.show();
    }

    private void backupDatabaseToShare() {
        File dbFile = getDatabasePath("grocery_pos.db");
        if (!dbFile.isFile()) {
            Toast.makeText(this, "لم يتم العثور على قاعدة البيانات لإنشاء نسخة.", Toast.LENGTH_LONG).show();
            return;
        }
        File directory = getExternalFilesDir(null);
        if (directory == null) {
            Toast.makeText(this, "تعذر الوصول إلى مساحة التخزين لإنشاء النسخة.", Toast.LENGTH_LONG).show();
            return;
        }
        File zipFile = new File(directory, "grocery_backup.zip");
        try (FileInputStream fis = new FileInputStream(dbFile);
             ZipOutputStream zos = new ZipOutputStream(new FileOutputStream(zipFile))) {
            zos.putNextEntry(new ZipEntry(dbFile.getName()));
            byte[] buffer = new byte[8192];
            int len;
            while ((len = fis.read(buffer)) > 0) zos.write(buffer, 0, len);
            zos.closeEntry();
            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".provider", zipFile);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("application/zip");
            send.putExtra(Intent.EXTRA_SUBJECT, "نسخة احتياطية لقاعدة بيانات بقالتي");
            send.putExtra(Intent.EXTRA_TEXT, "مرفق ملف النسخة الاحتياطية المضغوطة لتطبيق البقالة.");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.setClipData(android.content.ClipData.newUri(getContentResolver(), "نسخة احتياطية", uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(send, "مشاركة النسخة الاحتياطية"));
        } catch (Exception e) {
            Toast.makeText(this, "تعذر إنشاء أو مشاركة النسخة الاحتياطية: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void launchIntent(Intent intent) {
        try { startActivity(intent); }
        catch (Exception e) { Toast.makeText(this, "لا يوجد تطبيق مناسب لهذا الإجراء.", Toast.LENGTH_SHORT).show(); }
    }
}
