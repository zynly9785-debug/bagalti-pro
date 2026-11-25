package com.grocery.pos;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Switch;
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
import java.util.concurrent.Executor;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public class SettingsActivity extends AppCompatActivity {

    private EditText etStoreNameSetting;
    private Switch switchBiometric;
    private Button btnChangePin, btnBackupEmail, btnRestoreBackup;
    private Button btnCallSupport, btnWhatsappSupport, btnSmsSupport;
    private TextView tvSubscriptionExpiry;

    private SharedPreferences prefs;
    private DatabaseHelper dbHelper;
    private static final String SUPPORT_PHONE = "+967778228995";

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
        tvSubscriptionExpiry = findViewById(R.id.tvSubscriptionExpiry);

        etStoreNameSetting.setText(prefs.getString("store_name", "بقالة الأمانة"));
        switchBiometric.setChecked(prefs.getBoolean("biometric_enabled", false));

        // تبديل البصمة عبر BiometricPrompt
        switchBiometric.setOnCheckedChangeListener((buttonView, isChecked) -> {
            if (isChecked) {
                authenticateBiometric();
            } else {
                prefs.edit().putBoolean("biometric_enabled", false).apply();
            }
        });

        // تغيير رمز PIN
        btnChangePin.setOnClickListener(v -> showChangePinDialog());

        // نسخ احتياطي SQLite إلى zip وإرساله لـ Gmail
        btnBackupEmail.setOnClickListener(v -> backupDatabaseToEmail());

        // استرجاع من البريد
        btnRestoreBackup.setOnClickListener(v -> {
            Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
            intent.setType("application/zip");
            startActivityForResult(intent, 1001);
        });

        // أزرار الدعم والاشتراك
        btnCallSupport.setOnClickListener(v -> {
            Intent intent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + SUPPORT_PHONE));
            startActivity(intent);
        });

        btnWhatsappSupport.setOnClickListener(v -> {
            String url = "https://api.whatsapp.com/send?phone=" + SUPPORT_PHONE + "&text=أهلاً%20أريد%20تجديد%20اشتراك%20تطبيق%20البقالة";
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        });

        btnSmsSupport.setOnClickListener(v -> {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("sms:" + SUPPORT_PHONE));
            intent.putExtra("sms_body", "طلب تجديد اشتراك تطبيق إدارة البقالة");
            startActivity(intent);
        });
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
        });

        BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("تأكيد البصمة")
                .setSubtitle("ضع إصبعك على الماسح لتأكيد تفعيل الحماية البيومترية")
                .setNegativeButtonText("إلغاء")
                .build();

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
            if (newPin.length() >= 4) {
                int storeId = prefs.getInt("store_id", 1);
                dbHelper.getWritableDatabase().execSQL(
                        "UPDATE " + DatabaseHelper.TABLE_USERS + " SET pin_code = ? WHERE id = ?",
                        new Object[]{newPin, storeId});
                Toast.makeText(this, "تم حفظ الرمز السري الجديد", Toast.LENGTH_SHORT).show();
            }
        });
        builder.setNegativeButton("إلغاء", null);
        builder.show();
    }

    private void backupDatabaseToEmail() {
        try {
            File dbFile = getDatabasePath("grocery_pos.db");
            File zipFile = new File(getExternalFilesDir(null), "grocery_backup.zip");

            // ضغط ملف SQLite في ZIP
            ZipOutputStream zos = new ZipOutputStream(new FileOutputStream(zipFile));
            FileInputStream fis = new FileInputStream(dbFile);
            zos.putNextEntry(new ZipEntry(dbFile.getName()));

            byte[] buffer = new byte[1024];
            int len;
            while ((len = fis.read(buffer)) > 0) {
                zos.write(buffer, 0, len);
            }
            zos.closeEntry();
            fis.close();
            zos.close();

            // فتح تطبيق Gmail عبر Intent
            Uri fileUri = FileProvider.getUriForFile(this, getPackageName() + ".provider", zipFile);
            Intent emailIntent = new Intent(Intent.ACTION_SEND);
            emailIntent.setType("application/zip");
            emailIntent.putExtra(Intent.EXTRA_SUBJECT, "نسخة احتياطية لقاعدة بيانات بقالتي");
            emailIntent.putExtra(Intent.EXTRA_TEXT, "مرفق ملف النسخة الاحتياطية المضغوطة لتطبيق البقالة.");
            emailIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
            emailIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            emailIntent.setPackage("com.google.android.gm");

            startActivity(emailIntent);
        } catch (Exception e) {
            Toast.makeText(this, "حدث خطأ أثناء ضغط قاعدة البيانات: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }
}
