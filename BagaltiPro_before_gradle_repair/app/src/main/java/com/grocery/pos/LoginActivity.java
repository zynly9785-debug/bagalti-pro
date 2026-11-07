package com.grocery.pos;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import android.text.InputType;
import android.util.Base64;

import java.security.SecureRandom;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

import androidx.appcompat.app.AppCompatActivity;

import java.util.ArrayList;
import java.util.List;

public class LoginActivity extends AppCompatActivity {

    private ImageView imgLogo;
    private EditText etPhone, etPassword;
    private Button btnLogin;
    private TextView tvRegister;
    private DatabaseHelper dbHelper;
    private SharedPreferences sharedPreferences;

    // منطق الـ 10 نقرات المتتالية للشعار
    private final List<Long> tapTimestamps = new ArrayList<>();
    private static final int REQUIRED_TAPS = 10;
    private static final long MAX_TAP_DIFF_MS = 500;
    private static final String OWNER_DEFAULT_PASSWORD = "zain774923";
    private static final String OWNER_PASSWORD_HASH = "owner_password_hash";
    private static final String OWNER_PASSWORD_SALT = "owner_password_salt";

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

        // 1. منطق النقر 10 مرات على الشعار
        imgLogo.setOnClickListener(v -> handleLogoTap());

        // 2. زر تسجيل الدخول
        btnLogin.setOnClickListener(v -> performLogin());

        // 3. رابط الانتقال لإنشاء حساب
        tvRegister.setOnClickListener(v -> {
            Intent intent = new Intent(LoginActivity.this, RegisterActivity.class);
            startActivity(intent);
        });
    }

    private void handleLogoTap() {
        long current = System.currentTimeMillis();
        tapTimestamps.add(current);

        if (tapTimestamps.size() > REQUIRED_TAPS) {
            tapTimestamps.remove(0);
        }

        if (tapTimestamps.size() == REQUIRED_TAPS) {
            boolean validSeries = true;
            for (int i = 1; i < tapTimestamps.size(); i++) {
                if (tapTimestamps.get(i) - tapTimestamps.get(i - 1) > MAX_TAP_DIFF_MS) {
                    validSeries = false;
                    break;
                }
            }

            if (validSeries) {
                tapTimestamps.clear();
                showOwnerPasswordDialog();
            }
        }
    }

    private void showOwnerPasswordDialog() {
        EditText ownerInput = createPasswordInput("أدخل كلمة مرور المالك");
        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("بوابة المالك الإدارية")
                .setView(ownerInput)
                .setPositiveButton("دخول", null)
                .setNeutralButton("تغيير كلمة المرور", null)
                .setNegativeButton("نسيت كلمة المرور؟", null)
                .create();
        dialog.setOnShowListener(ignored -> {
            EditText input = ownerInput;
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                String entered = input.getText().toString();
                if (ownerPasswordMatches(entered)) {
                    Toast.makeText(this, "مرحباً بك في لوحة المالك", Toast.LENGTH_SHORT).show();
                    startActivity(new Intent(LoginActivity.this, OwnerActivity.class));
                    dialog.dismiss();
                } else {
                    input.setError("كلمة المرور غير صحيحة");
                }
            });
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener(v -> {
                String current = input.getText().toString();
                if (!ownerPasswordMatches(current)) {
                    input.setError("أدخل كلمة المرور الحالية الصحيحة أولاً");
                    return;
                }
                dialog.dismiss();
                showSetNewOwnerPasswordDialog();
            });
            dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setOnClickListener(v -> {
                dialog.dismiss();
                showForgotSecretQuestionDialog();
            });
        });
        dialog.show();
    }

    private EditText createPasswordInput(String hint) {
        EditText input = new EditText(this);
        input.setHint(hint);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        int padding = (int) (20 * getResources().getDisplayMetrics().density);
        input.setPadding(padding, padding, padding, padding);
        return input;
    }

    private boolean ownerPasswordMatches(String candidate) {
        String storedHash = sharedPreferences.getString(OWNER_PASSWORD_HASH, null);
        String storedSalt = sharedPreferences.getString(OWNER_PASSWORD_SALT, null);
        if (storedHash == null || storedSalt == null) {
            return OWNER_DEFAULT_PASSWORD.equals(candidate);
        }
        try {
            byte[] salt = Base64.decode(storedSalt, Base64.NO_WRAP);
            byte[] expected = Base64.decode(storedHash, Base64.NO_WRAP);
            byte[] actual = derivePasswordHash(candidate, salt);
            if (actual.length != expected.length) return false;
            int diff = 0;
            for (int i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
            return diff == 0;
        } catch (Exception e) {
            return false;
        }
    }

    private byte[] derivePasswordHash(String password, byte[] salt) throws Exception {
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, 120000, 256);
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        } finally {
            spec.clearPassword();
        }
    }

    private void showSetNewOwnerPasswordDialog() {
        android.widget.LinearLayout layout = new android.widget.LinearLayout(this);
        layout.setOrientation(android.widget.LinearLayout.VERTICAL);
        int padding = (int) (20 * getResources().getDisplayMetrics().density);
        layout.setPadding(padding, 0, padding, 0);
        EditText newPassword = createPasswordInput("كلمة المرور الجديدة (8 أحرف على الأقل)");
        EditText confirmPassword = createPasswordInput("تأكيد كلمة المرور الجديدة");
        layout.addView(newPassword);
        layout.addView(confirmPassword);
        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("تغيير كلمة مرور المالك")
                .setView(layout)
                .setPositiveButton("حفظ", null)
                .setNegativeButton("إلغاء", null)
                .create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String first = newPassword.getText().toString();
            String second = confirmPassword.getText().toString();
            if (first.length() < 8) {
                newPassword.setError("يجب ألا تقل كلمة المرور عن 8 أحرف");
                return;
            }
            if (!first.equals(second)) {
                confirmPassword.setError("كلمتا المرور غير متطابقتين");
                return;
            }
            try {
                byte[] salt = new byte[16];
                new SecureRandom().nextBytes(salt);
                byte[] hash = derivePasswordHash(first, salt);
                sharedPreferences.edit()
                        .putString(OWNER_PASSWORD_SALT, Base64.encodeToString(salt, Base64.NO_WRAP))
                        .putString(OWNER_PASSWORD_HASH, Base64.encodeToString(hash, Base64.NO_WRAP))
                        .apply();
                Toast.makeText(this, "تم تغيير كلمة مرور المالك بنجاح", Toast.LENGTH_LONG).show();
                dialog.dismiss();
            } catch (Exception e) {
                Toast.makeText(this, "تعذر حفظ كلمة المرور: " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        }));
        dialog.show();
    }

    private void showForgotSecretQuestionDialog() {
        EditText answerInput = new EditText(this);
        answerInput.setHint("اكتب إجابة سؤال الأمان");
        new AlertDialog.Builder(this)
                .setTitle("استعادة كلمة مرور المالك")
                .setMessage("سؤال الأمان: من أنت؟")
                .setView(answerInput)
                .setPositiveButton("تحقق", (dialog, which) -> {
                    if ("زينون".equals(answerInput.getText().toString().trim())) {
                        showSetNewOwnerPasswordDialog();
                    } else {
                        Toast.makeText(this, "إجابة غير صحيحة", Toast.LENGTH_SHORT).show();
                    }
                })
                .setNegativeButton("إلغاء", null)
                .show();
    }

    private void performLogin() {
        String phone = etPhone.getText().toString().trim();
        String pass = etPassword.getText().toString().trim();

        if (phone.isEmpty() || pass.isEmpty()) {
            Toast.makeText(this, "يرجى ملء جميع الحقول", Toast.LENGTH_SHORT).show();
            return;
        }

        Cursor cursor = dbHelper.getUserByPhoneAndPassword(phone, pass);
        if (cursor != null && cursor.moveToFirst()) {
            int userId = cursor.getInt(cursor.getColumnIndexOrThrow("id"));
            String storeName = cursor.getString(cursor.getColumnIndexOrThrow("store_name"));
            String status = cursor.getString(cursor.getColumnIndexOrThrow("status"));
            String reason = cursor.getString(cursor.getColumnIndexOrThrow("suspension_reason"));
            cursor.close();

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
            if (cursor != null) cursor.close();
            Toast.makeText(this, "رقم الهاتف أو كلمة المرور غير صحيحة", Toast.LENGTH_SHORT).show();
        }
    }
}
