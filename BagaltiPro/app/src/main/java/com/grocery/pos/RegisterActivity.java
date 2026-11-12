package com.grocery.pos;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.os.Bundle;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Spinner;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

public class RegisterActivity extends AppCompatActivity {

    private EditText etStoreName, etOwnerName, etPhone, etPassword;
    private Spinner spGovernorate, spDistrict, spNeighborhood;
    private Button btnRegister;
    private DatabaseHelper dbHelper;
    private SharedPreferences sharedPreferences;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_register);

        dbHelper = new DatabaseHelper(this);
        sharedPreferences = getSharedPreferences("GroceryPrefs", Context.MODE_PRIVATE);

        etStoreName = findViewById(R.id.etStoreName);
        etOwnerName = findViewById(R.id.etOwnerName);
        etPhone = findViewById(R.id.etPhone);
        etPassword = findViewById(R.id.etPassword);
        spGovernorate = findViewById(R.id.spGovernorate);
        spDistrict = findViewById(R.id.spDistrict);
        spNeighborhood = findViewById(R.id.spNeighborhood);
        btnRegister = findViewById(R.id.btnRegister);

        setupSpinners();

        btnRegister.setOnClickListener(v -> handleRegistration());
    }

    private void setupSpinners() {
        String[] govs = {"صنعاء", "عدن", "تعز", "إب", "حضرموت", "الحديدة", "ذمار"};
        String[] districts = {"معين", "السبعين", "التحرير", "كريتر", "المنصورة", "القاهرة", "المظفر"};
        String[] neighborhoods = {"شارع الرباط", "حي الأصبحي", "حدة", "المعلا", "حافة القاضي", "المسبح", "شارع جمال"};

        ArrayAdapter<String> govAdapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, govs);
        govAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spGovernorate.setAdapter(govAdapter);

        ArrayAdapter<String> distAdapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, districts);
        distAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spDistrict.setAdapter(distAdapter);

        ArrayAdapter<String> neighAdapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, neighborhoods);
        neighAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spNeighborhood.setAdapter(neighAdapter);
    }

    private void handleRegistration() {
        String storeName = etStoreName.getText().toString().trim();
        String ownerName = etOwnerName.getText().toString().trim();
        String phone = etPhone.getText().toString().trim();
        String password = etPassword.getText().toString().trim();
        String gov = spGovernorate.getSelectedItem().toString();
        String district = spDistrict.getSelectedItem().toString();
        String neighborhood = spNeighborhood.getSelectedItem().toString();

        if (storeName.isEmpty() || ownerName.isEmpty() || phone.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, "يرجى تعبئة جميع الحقول المطلوبة", Toast.LENGTH_SHORT).show();
            return;
        }

        // التحقق من رقم الهاتف مسبقاً
        Cursor checkCursor = dbHelper.getReadableDatabase().rawQuery(
                "SELECT id FROM " + DatabaseHelper.TABLE_USERS + " WHERE phone = ?", new String[]{phone});
        if (checkCursor != null && checkCursor.moveToFirst()) {
            checkCursor.close();
            Toast.makeText(this, "رقم الهاتف مسجل مسبقاً، يرجى تسجيل الدخول", Toast.LENGTH_LONG).show();
            return;
        }
        if (checkCursor != null) checkCursor.close();

        showPinCreationDialog(storeName, ownerName, phone, password, gov, district, neighborhood);
    }

    private void showPinCreationDialog(String storeName, String ownerName, String phone, String password,
                                       String gov, String district, String neighborhood) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("إنشاء رمز الأمان (PIN)");
        builder.setMessage("أدخل رمز سري مكون من 4 أرقام لحماية عمليات الإلغاء والدخول السريع:");

        final EditText etPin = new EditText(this);
        etPin.setHint("أدخل 4 أرقام");
        etPin.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        builder.setView(etPin);

        AlertDialog dialog = builder.setPositiveButton("حفظ والمتابعة", null).setCancelable(false).create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String pin = etPin.getText().toString();
            if (!pin.matches("[0-9]{4}")) {
                etPin.setError("يجب إدخال أربعة أرقام بالضبط");
                return;
            }
            long newStoreId = dbHelper.registerUser(storeName, ownerName, phone, password, pin, gov, district, neighborhood);
            if (newStoreId <= 0) {
                Toast.makeText(this, "حدث خطأ أثناء إنشاء الحساب", Toast.LENGTH_SHORT).show();
                return;
            }
            SharedPreferences.Editor editor = sharedPreferences.edit();
            editor.putInt("user_id", (int) newStoreId);
            editor.putInt("store_id", (int) newStoreId);
            editor.putString("status", "active");
            editor.putString("store_name", storeName);
            editor.apply();
            Toast.makeText(this, "تم إنشاء الحساب بنجاح مع تجربة مجانية 60 يوم!", Toast.LENGTH_LONG).show();
            Intent intent = new Intent(RegisterActivity.this, DashboardActivity.class);
            intent.putExtra("isSuspended", false);
            startActivity(intent);
            finish();
        }));
        dialog.show();
    }
}
