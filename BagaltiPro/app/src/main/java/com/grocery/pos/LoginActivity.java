package com.grocery.pos;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;


import androidx.appcompat.app.AppCompatActivity;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import java.util.concurrent.Executor;


public class LoginActivity extends AppCompatActivity {

    private ImageView imgLogo;
    private EditText etPhone, etPassword;
    private Button btnLogin;
    private TextView tvRegister;
    private DatabaseHelper dbHelper;
    private SharedPreferences sharedPreferences;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);

        dbHelper = new DatabaseHelper(this);
        sharedPreferences = getSharedPreferences("GroceryPrefs", Context.MODE_PRIVATE);

        imgLogo = findViewById(R.id.imgLogo);
        etPhone = findViewById(R.id.etPhone);
        etPassword = findViewById(R.id.etPassword);
        btnLogin = findViewById(R.id.btnLogin);
        tvRegister = findViewById(R.id.tvRegister);

        // زر تسجيل الدخول
        btnLogin.setOnClickListener(v -> performLogin());

        // رابط الانتقال لإنشاء حساب
        tvRegister.setOnClickListener(v -> {
            Intent intent = new Intent(LoginActivity.this, RegisterActivity.class);
            startActivity(intent);
        });
        if (sharedPreferences.getBoolean("biometric_enabled", false) && sharedPreferences.getInt("user_id", -1) > 0) {
            promptBiometricLogin();
        }
    }

    private void promptBiometricLogin() {
        if (BiometricManager.from(this).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK) != BiometricManager.BIOMETRIC_SUCCESS) {
            Toast.makeText(this, "المصادقة بالبصمة غير متاحة حالياً؛ سجّل الدخول بكلمة المرور", Toast.LENGTH_LONG).show();
            return;
        }
        Executor executor = ContextCompat.getMainExecutor(this);
        BiometricPrompt prompt = new BiometricPrompt(this, executor, new BiometricPrompt.AuthenticationCallback() {
            @Override public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                super.onAuthenticationSucceeded(result);
                openStoredUserSession();
            }
            @Override public void onAuthenticationError(int code, @NonNull CharSequence message) {
                super.onAuthenticationError(code, message);
                // يبقى نموذج كلمة المرور متاحاً كخيار بديل.
            }
        });
        BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("تسجيل الدخول إلى بقالتي برو")
                .setSubtitle("أكد هويتك للمتابعة")
                .setNegativeButtonText("استخدام كلمة المرور")
                .build();
        prompt.authenticate(info);
    }

    private void openStoredUserSession() {
        int userId = sharedPreferences.getInt("user_id", -1);
        Cursor c = null;
        try {
            c = dbHelper.getReadableDatabase().rawQuery("SELECT store_name, status, suspension_reason FROM " + DatabaseHelper.TABLE_USERS + " WHERE id = ? LIMIT 1", new String[]{String.valueOf(userId)});
            if (!c.moveToFirst()) { Toast.makeText(this, "تعذر العثور على الحساب؛ سجّل الدخول بكلمة المرور", Toast.LENGTH_LONG).show(); return; }
            String store = c.getString(0), status = c.getString(1), reason = c.getString(2);
            sharedPreferences.edit().putInt("store_id", userId).putString("store_name", store).putString("status", status).putString("suspension_reason", reason).apply();
            Intent intent = new Intent(this, DashboardActivity.class);
            intent.putExtra("isSuspended", "suspended".equalsIgnoreCase(status));
            intent.putExtra("suspension_reason", reason);
            startActivity(intent); finish();
        } catch (Exception e) { Toast.makeText(this, "تعذر فتح الحساب بالبصمة؛ استخدم كلمة المرور", Toast.LENGTH_LONG).show(); }
        finally { if (c != null) c.close(); }
    }

    private void performLogin() {
        String phone = etPhone.getText().toString().trim();
        String pass = etPassword.getText().toString().trim();

        if (phone.isEmpty() || pass.isEmpty()) {
            Toast.makeText(this, "يرجى ملء جميع الحقول", Toast.LENGTH_SHORT).show();
            return;
        }

        Cursor cursor = dbHelper.getUserByPhone(phone);
        boolean authenticated = false;
        int userId = -1;
        String storeName = null, status = null, reason = null;
        if (cursor != null && cursor.moveToFirst()) {
            userId = cursor.getInt(cursor.getColumnIndexOrThrow("id"));
            String storedPassword = cursor.getString(cursor.getColumnIndexOrThrow("password"));
            try {
                if (PasswordSecurity.isHashed(storedPassword)) {
                    authenticated = PasswordSecurity.verify(pass, storedPassword);
                } else if (PasswordSecurity.constantTimeEquals(pass, storedPassword)) {
                    String upgraded = PasswordSecurity.hash(pass);
                    authenticated = dbHelper.upgradeLegacyPassword(userId, storedPassword, upgraded);
                }
            } catch (Exception ignored) {
                authenticated = false;
            }
            if (authenticated) {
            storeName = cursor.getString(cursor.getColumnIndexOrThrow("store_name"));
            status = cursor.getString(cursor.getColumnIndexOrThrow("status"));
            reason = cursor.getString(cursor.getColumnIndexOrThrow("suspension_reason"));
            }
            cursor.close();
        }

        if (authenticated) {
            SharedPreferences.Editor editor = sharedPreferences.edit();
            editor.putInt("user_id", userId);
            editor.putInt("store_id", userId);
            editor.putString("status", status);
            editor.putString("store_name", storeName);
            editor.putString("suspension_reason", reason);
            editor.apply();

            Intent intent = new Intent(LoginActivity.this, DashboardActivity.class);
            if ("suspended".equalsIgnoreCase(status)) {
                intent.putExtra("isSuspended", true);
                intent.putExtra("suspension_reason", reason);
            } else {
                intent.putExtra("isSuspended", false);
            }
            startActivity(intent);
            finish();
        } else {
            Toast.makeText(this, "رقم الهاتف أو كلمة المرور غير صحيحة", Toast.LENGTH_SHORT).show();
        }
    }
}
