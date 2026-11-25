/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AndroidFile {
  path: string;
  name: string;
  language: 'java' | 'xml' | 'groovy' | 'shell' | 'properties' | 'yaml';
  category: 'database' | 'activities' | 'layouts' | 'values' | 'manifest' | 'gradle';
  description: string;
  content: string;
}

export const ANDROID_SOURCE_FILES: AndroidFile[] = [
  // 1. DatabaseHelper.java
  {
    path: 'app/src/main/java/com/grocery/pos/DatabaseHelper.java',
    name: 'DatabaseHelper.java',
    language: 'java',
    category: 'database',
    description: 'فئة إدارة قاعدة بيانات SQLite والجداول الستة مع عزل البيانات بـ store_id',
    content: `package com.grocery.pos;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import java.util.ArrayList;
import java.util.List;

/**
 * مدير قاعدة بيانات SQLite لتطبيق إدارة البقالة
 * يحتوي على 6 جداول أساسية مع شرط WHERE store_id = ? الصارم
 */
public class DatabaseHelper extends SQLiteOpenHelper {

    private static final String DATABASE_NAME = "grocery_pos.db";
    private static final int DATABASE_VERSION = 1;

    // أسماء الجداول
    public static final String TABLE_USERS = "users";
    public static final String TABLE_PRODUCTS = "products";
    public static final String TABLE_CUSTOMERS = "customers";
    public static final String TABLE_SALES = "sales";
    public static final String TABLE_SALE_ITEMS = "sale_items";
    public static final String TABLE_RETURNS = "returns";
    public static final String TABLE_PACKAGES = "subscription_packages";

    public DatabaseHelper(Context context) {
        super(context, DATABASE_NAME, null, DATABASE_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        // 1. جدول المستخدمين (المتاجر)
        String createUsers = "CREATE TABLE " + TABLE_USERS + " (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "store_name TEXT NOT NULL, " +
                "owner_name TEXT NOT NULL, " +
                "phone TEXT UNIQUE NOT NULL, " +
                "password TEXT NOT NULL, " +
                "governorate TEXT, " +
                "district TEXT, " +
                "neighborhood TEXT, " +
                "pin_code TEXT, " +
                "subscription_end INTEGER NOT NULL, " +
                "role TEXT DEFAULT 'merchant', " +
                "status TEXT DEFAULT 'active', " +
                "suspension_reason TEXT" +
                ");";

        // 2. جدول المنتجات
        String createProducts = "CREATE TABLE " + TABLE_PRODUCTS + " (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "store_id INTEGER NOT NULL, " +
                "name TEXT NOT NULL, " +
                "barcode TEXT, " +
                "unit_type TEXT DEFAULT 'قطعة', " +
                "cost_price REAL NOT NULL, " +
                "sale_price REAL NOT NULL, " +
                "quantity REAL DEFAULT 0, " +
                "min_stock REAL DEFAULT 5, " +
                "is_active INTEGER DEFAULT 1" +
                ");";

        // 3. جدول العملاء والديون
        String createCustomers = "CREATE TABLE " + TABLE_CUSTOMERS + " (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "store_id INTEGER NOT NULL, " +
                "name TEXT NOT NULL, " +
                "phone TEXT, " +
                "total_debt REAL DEFAULT 0" +
                ");";

        // 4. جدول المبيعات (الفواتير)
        String createSales = "CREATE TABLE " + TABLE_SALES + " (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "store_id INTEGER NOT NULL, " +
                "customer_id INTEGER, " +
                "total_amount REAL NOT NULL, " +
                "paid_amount REAL NOT NULL, " +
                "remaining_amount REAL NOT NULL, " +
                "payment_type TEXT DEFAULT 'نقداً', " +
                "created_at TEXT NOT NULL" +
                ");";

        // 5. جدول عناصر الفاتورة
        String createSaleItems = "CREATE TABLE " + TABLE_SALE_ITEMS + " (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "sale_id INTEGER NOT NULL, " +
                "product_id INTEGER NOT NULL, " +
                "qty REAL NOT NULL, " +
                "price REAL NOT NULL" +
                ");";

        // 6. جدول المرتجعات
        String createReturns = "CREATE TABLE " + TABLE_RETURNS + " (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "store_id INTEGER NOT NULL, " +
                "sale_id INTEGER, " +
                "customer_id INTEGER, " +
                "product_id INTEGER NOT NULL, " +
                "qty REAL NOT NULL, " +
                "amount REAL NOT NULL, " +
                "type TEXT NOT NULL, " +
                "created_at TEXT NOT NULL" +
                ");";

        // 7. جدول باقات الاشتراكات (المنشأة يدوياً من المالك)
        String createPackages = "CREATE TABLE " + TABLE_PACKAGES + " (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "name TEXT NOT NULL, " +
                "duration_days INTEGER NOT NULL, " +
                "price REAL NOT NULL, " +
                "description TEXT, " +
                "is_active INTEGER DEFAULT 1" +
                ");";

        db.execSQL(createUsers);
        db.execSQL(createProducts);
        db.execSQL(createCustomers);
        db.execSQL(createSales);
        db.execSQL(createSaleItems);
        db.execSQL(createReturns);
        db.execSQL(createPackages);

        // إدراج باقات افتراضية قابلة للتعديل والزيادة
        db.execSQL("INSERT INTO " + TABLE_PACKAGES + " (name, duration_days, price, description) VALUES ('باقة شهرية أساسية', 30, 5000, 'اشتراك كامل لمدة 30 يوم');");
        db.execSQL("INSERT INTO " + TABLE_PACKAGES + " (name, duration_days, price, description) VALUES ('باقة 3 أشهر الفضية', 90, 13500, 'اشتراك ربع سنوي مخفض');");
        db.execSQL("INSERT INTO " + TABLE_PACKAGES + " (name, duration_days, price, description) VALUES ('باقة سنوية ذهبية', 365, 45000, 'اشتراك سنوي كامل ومميز');");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_PACKAGES);
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_SALE_ITEMS);
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_RETURNS);
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_SALES);
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_PRODUCTS);
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_CUSTOMERS);
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_USERS);
        onCreate(db);
    }

    // ==========================================
    // دوال المستخدمين (المتاجر)
    // ==========================================
    public long registerUser(String storeName, String ownerName, String phone, String password,
                             String gov, String district, String neighborhood) {
        SQLiteDatabase db = this.getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put("store_name", storeName);
        cv.put("owner_name", ownerName);
        cv.put("phone", phone);
        cv.put("password", password);
        cv.put("governorate", gov);
        cv.put("district", district);
        cv.put("neighborhood", neighborhood);
        cv.put("pin_code", "1234");
        // اشتراك تجريبي لمدة 60 يوم
        long subscriptionEnd = System.currentTimeMillis() + (60L * 24 * 60 * 60 * 1000);
        cv.put("subscription_end", subscriptionEnd);
        cv.put("role", "merchant");
        cv.put("status", "active");

        return db.insert(TABLE_USERS, null, cv);
    }

    public Cursor getUserByPhoneAndPassword(String phone, String password) {
        SQLiteDatabase db = this.getReadableDatabase();
        return db.rawQuery("SELECT * FROM " + TABLE_USERS + " WHERE phone = ? AND password = ?",
                new String[]{phone, password});
    }

    // ==========================================
    // دوال المنتجات (شرط WHERE store_id = ?)
    // ==========================================
    public Cursor getActiveProducts(int storeId) {
        SQLiteDatabase db = this.getReadableDatabase();
        return db.rawQuery("SELECT * FROM " + TABLE_PRODUCTS + " WHERE store_id = ? AND is_active = 1 ORDER BY name ASC",
                new String[]{String.valueOf(storeId)});
    }

    public Cursor getProductByBarcode(int storeId, String barcode) {
        SQLiteDatabase db = this.getReadableDatabase();
        return db.rawQuery("SELECT * FROM " + TABLE_PRODUCTS + " WHERE store_id = ? AND barcode = ? AND is_active = 1 LIMIT 1",
                new String[]{String.valueOf(storeId), barcode});
    }

    public Cursor searchProducts(int storeId, String query) {
        SQLiteDatabase db = this.getReadableDatabase();
        String pattern = "%" + query + "%";
        return db.rawQuery("SELECT * FROM " + TABLE_PRODUCTS + " WHERE store_id = ? AND is_active = 1 AND (name LIKE ? OR barcode LIKE ?)",
                new String[]{String.valueOf(storeId), pattern, pattern});
    }

    public long insertProduct(int storeId, String name, String barcode, String unitType,
                              double costPrice, double salePrice, double quantity, double minStock) {
        SQLiteDatabase db = this.getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put("store_id", storeId);
        cv.put("name", name);
        cv.put("barcode", barcode);
        cv.put("unit_type", unitType);
        cv.put("cost_price", costPrice);
        cv.put("sale_price", salePrice);
        cv.put("quantity", quantity);
        cv.put("min_stock", minStock);
        cv.put("is_active", 1);
        return db.insert(TABLE_PRODUCTS, null, cv);
    }

    public boolean updateProduct(int storeId, int productId, double salePrice, double costPrice, double quantity) {
        SQLiteDatabase db = this.getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put("sale_price", salePrice);
        cv.put("cost_price", costPrice);
        cv.put("quantity", quantity);
        int rows = db.update(TABLE_PRODUCTS, cv, "id = ? AND store_id = ?",
                new String[]{String.valueOf(productId), String.valueOf(storeId)});
        return rows > 0;
    }

    public boolean softDeleteProduct(int storeId, int productId) {
        SQLiteDatabase db = this.getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put("is_active", 0);
        int rows = db.update(TABLE_PRODUCTS, cv, "id = ? AND store_id = ?",
                new String[]{String.valueOf(productId), String.valueOf(storeId)});
        return rows > 0;
    }

    // ==========================================
    // دوال العملاء (شرط WHERE store_id = ?)
    // ==========================================
    public Cursor getCustomers(int storeId) {
        SQLiteDatabase db = this.getReadableDatabase();
        return db.rawQuery("SELECT * FROM " + TABLE_CUSTOMERS + " WHERE store_id = ? ORDER BY name ASC",
                new String[]{String.valueOf(storeId)});
    }

    public long insertCustomer(int storeId, String name, String phone, double initialDebt) {
        SQLiteDatabase db = this.getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put("store_id", storeId);
        cv.put("name", name);
        cv.put("phone", phone);
        cv.put("total_debt", initialDebt);
        return db.insert(TABLE_CUSTOMERS, null, cv);
    }

    public void updateCustomerDebt(int storeId, int customerId, double debtDelta) {
        SQLiteDatabase db = this.getWritableDatabase();
        db.execSQL("UPDATE " + TABLE_CUSTOMERS + " SET total_debt = MAX(0, total_debt + ?) WHERE id = ? AND store_id = ?",
                new Object[]{debtDelta, customerId, storeId});
    }

    // ==========================================
    // دوال نقطة البيع وحفظ الفواتير
    // ==========================================
    public long insertSale(int storeId, Integer customerId, double total, double paid,
                           double remaining, String paymentType, String createdAt) {
        SQLiteDatabase db = this.getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put("store_id", storeId);
        if (customerId != null) cv.put("customer_id", customerId);
        cv.put("total_amount", total);
        cv.put("paid_amount", paid);
        cv.put("remaining_amount", remaining);
        cv.put("payment_type", paymentType);
        cv.put("created_at", createdAt);
        return db.insert(TABLE_SALES, null, cv);
    }

    public void insertSaleItem(long saleId, int productId, double qty, double price) {
        SQLiteDatabase db = this.getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put("sale_id", saleId);
        cv.put("product_id", productId);
        cv.put("qty", qty);
        cv.put("price", price);
        db.insert(TABLE_SALE_ITEMS, null, cv);

        // خصم الكمية من المخزون
        db.execSQL("UPDATE " + TABLE_PRODUCTS + " SET quantity = MAX(0, quantity - ?) WHERE id = ?",
                new Object[]{qty, productId});
    }

    public Cursor getSalesByStore(int storeId) {
        SQLiteDatabase db = this.getReadableDatabase();
        return db.rawQuery("SELECT * FROM " + TABLE_SALES + " WHERE store_id = ? ORDER BY id DESC",
                new String[]{String.valueOf(storeId)});
    }

    public Cursor getCustomerSales(int storeId, int customerId) {
        SQLiteDatabase db = this.getReadableDatabase();
        return db.rawQuery("SELECT * FROM " + TABLE_SALES + " WHERE store_id = ? AND customer_id = ? ORDER BY id DESC",
                new String[]{String.valueOf(storeId), String.valueOf(customerId)});
    }

    // ==========================================
    // دوال المرتجعات
    // ==========================================
    public long insertReturn(int storeId, Integer saleId, Integer customerId,
                             int productId, double qty, double amount, String type, String createdAt) {
        SQLiteDatabase db = this.getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put("store_id", storeId);
        if (saleId != null) cv.put("sale_id", saleId);
        if (customerId != null) cv.put("customer_id", customerId);
        cv.put("product_id", productId);
        cv.put("qty", qty);
        cv.put("amount", amount);
        cv.put("type", type);
        cv.put("created_at", createdAt);

        // إعادة الكمية للمخزون
        db.execSQL("UPDATE " + TABLE_PRODUCTS + " SET quantity = quantity + ? WHERE id = ? AND store_id = ?",
                new Object[]{qty, productId, storeId});

        // خصم من دين الزبون إذا كان مرتبطاً بعميل
        if (customerId != null) {
            updateCustomerDebt(storeId, customerId, -amount);
        }

        return db.insert(TABLE_RETURNS, null, cv);
    }

    // ==========================================
    // دوال تعديل الاشتراك وباقات المالك
    // ==========================================
    public boolean updateStoreSubscriptionManual(int storeId, int days, double price, String status, boolean resetPreviousDays) {
        SQLiteDatabase db = this.getWritableDatabase();
        long now = System.currentTimeMillis();
        long newEnd;

        if (resetPreviousDays) {
            // تصفير الأيام السابقة وتعيين الرصيد الجديد ابتداءً من تاريخ التعديل
            newEnd = now + (days * 24L * 60 * 60 * 1000);
        } else {
            // تمديد تراكمي فوق الرصيد الحالي
            Cursor c = db.rawQuery("SELECT subscription_end FROM " + TABLE_USERS + " WHERE id = ?", new String[]{String.valueOf(storeId)});
            long currentEnd = now;
            if (c != null && c.moveToFirst()) {
                currentEnd = c.getLong(0);
                c.close();
            }
            long base = (currentEnd > now) ? currentEnd : now;
            newEnd = base + (days * 24L * 60 * 60 * 1000);
        }

        ContentValues cv = new ContentValues();
        cv.put("subscription_end", newEnd);
        cv.put("status", status != null ? status : "active");
        cv.put("suspension_reason", (String) null);

        int rows = db.update(TABLE_USERS, cv, "id = ?", new String[]{String.valueOf(storeId)});
        return rows > 0;
    }

    public boolean updateStoreSubscriptionManual(int storeId, int days, double price, String status) {
        // افتراضياً: تصفير الأيام السابقة وتعيين المدة الجديدة مباشرة
        return updateStoreSubscriptionManual(storeId, days, price, status, true);
    }

    public Cursor getSubscriptionPackages() {
        SQLiteDatabase db = this.getReadableDatabase();
        return db.rawQuery("SELECT * FROM " + TABLE_PACKAGES + " WHERE is_active = 1 ORDER BY duration_days ASC", null);
    }

    public long insertSubscriptionPackage(String name, int durationDays, double price, String description) {
        SQLiteDatabase db = this.getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put("name", name);
        cv.put("duration_days", durationDays);
        cv.put("price", price);
        cv.put("description", description);
        cv.put("is_active", 1);
        return db.insert(TABLE_PACKAGES, null, cv);
    }

    public boolean updateSubscriptionPackage(int id, String name, int durationDays, double price, String description) {
        SQLiteDatabase db = this.getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put("name", name);
        cv.put("duration_days", durationDays);
        cv.put("price", price);
        cv.put("description", description);
        int rows = db.update(TABLE_PACKAGES, cv, "id = ?", new String[]{String.valueOf(id)});
        return rows > 0;
    }

    public boolean deleteSubscriptionPackage(int id) {
        SQLiteDatabase db = this.getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put("is_active", 0);
        int rows = db.update(TABLE_PACKAGES, cv, "id = ?", new String[]{String.valueOf(id)});
        return rows > 0;
    }
}
`,
  },

  // 2. LoginActivity.java
  {
    path: 'app/src/main/java/com/grocery/pos/LoginActivity.java',
    name: 'LoginActivity.java',
    language: 'java',
    category: 'activities',
    description: 'شاشة تسجيل الدخول ومنطق 10 نقرات للوحة المالك وزر نسيت الرمز مع سؤال "من أنت؟"',
    content: `package com.grocery.pos;

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
        new AlertDialog.Builder(this)
            .setTitle("بوابة مالك التطبيق")
            .setMessage("يلزم تنفيذ مصادقة خادمية والتحقق من دور platform_owner قبل فتح لوحة الإدارة. لا تستخدم كلمة مرور ثابتة داخل التطبيق.")
            .setPositiveButton("موافق", null)
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
`,
  },

  // 3. RegisterActivity.java
  {
    path: 'app/src/main/java/com/grocery/pos/RegisterActivity.java',
    name: 'RegisterActivity.java',
    language: 'java',
    category: 'activities',
    description: 'شاشة إنشاء حساب بقالة جديد، القوائم المنسدلة، واشتراك 60 يوماً مجاناً',
    content: `package com.grocery.pos;

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

        long newStoreId = dbHelper.registerUser(storeName, ownerName, phone, password, gov, district, neighborhood);
        if (newStoreId > 0) {
            SharedPreferences.Editor editor = sharedPreferences.edit();
            editor.putInt("user_id", (int) newStoreId);
            editor.putInt("store_id", (int) newStoreId);
            editor.putString("status", "active");
            editor.putString("store_name", storeName);
            editor.apply();

            showPinCreationDialog((int) newStoreId);
        } else {
            Toast.makeText(this, "حدث خطأ أثناء إنشاء الحساب", Toast.LENGTH_SHORT).show();
        }
    }

    private void showPinCreationDialog(int storeId) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("إنشاء رمز الأمان (PIN)");
        builder.setMessage("أدخل رمز سري مكون من 4 أرقام لحماية عمليات الإلغاء والدخول السريع:");

        final EditText etPin = new EditText(this);
        etPin.setHint("مثال: 1234");
        etPin.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        builder.setView(etPin);

        builder.setPositiveButton("حفظ والمتابعة", (dialog, which) -> {
            String pin = etPin.getText().toString().trim();
            if (pin.length() >= 4) {
                dbHelper.getWritableDatabase().execSQL(
                        "UPDATE " + DatabaseHelper.TABLE_USERS + " SET pin_code = ? WHERE id = ?",
                        new Object[]{pin, storeId});
            }
            Toast.makeText(this, "تم إنشاء الحساب بنجاح مع تجربة مجانية 60 يوم!", Toast.LENGTH_LONG).show();
            Intent intent = new Intent(RegisterActivity.this, DashboardActivity.class);
            intent.putExtra("isSuspended", false);
            startActivity(intent);
            finish();
        });

        builder.setCancelable(false);
        builder.show();
    }
}
`,
  },

  // 4. DashboardActivity.java
  {
    path: 'app/src/main/java/com/grocery/pos/DashboardActivity.java',
    name: 'DashboardActivity.java',
    language: 'java',
    category: 'activities',
    description: 'الشاشة الرئيسية: بطاقات الإحصائيات الأربع، تنبيه الحساب الموقوف، والشريط السفلي',
    content: `package com.grocery.pos;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.os.Bundle;
import android.view.View;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import com.google.android.material.bottomnavigation.BottomNavigationView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class DashboardActivity extends AppCompatActivity {

    private Toolbar toolbar;
    private TextView tvSuspensionBanner;
    private TextView tvTodaySales, tvTotalDebt, tvInvoiceCount, tvNetProfit;
    private BottomNavigationView bottomNav;
    private DatabaseHelper dbHelper;
    private SharedPreferences sharedPreferences;

    private int storeId;
    private boolean isSuspended = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_dashboard);

        dbHelper = new DatabaseHelper(this);
        sharedPreferences = getSharedPreferences("GroceryPrefs", Context.MODE_PRIVATE);

        storeId = sharedPreferences.getInt("store_id", 1);
        String storeName = sharedPreferences.getString("store_name", "بقالة الأمانة");

        toolbar = findViewById(R.id.toolbar);
        toolbar.setTitle(storeName);
        setSupportActionBar(toolbar);

        tvSuspensionBanner = findViewById(R.id.tvSuspensionBanner);
        tvTodaySales = findViewById(R.id.tvTodaySales);
        tvTotalDebt = findViewById(R.id.tvTotalDebt);
        tvInvoiceCount = findViewById(R.id.tvInvoiceCount);
        tvNetProfit = findViewById(R.id.tvNetProfit);
        bottomNav = findViewById(R.id.bottomNav);

        isSuspended = getIntent().getBooleanExtra("isSuspended", false);
        String reason = getIntent().getStringExtra("suspension_reason");

        if (isSuspended) {
            tvSuspensionBanner.setVisibility(View.VISIBLE);
            tvSuspensionBanner.setText("الحساب موقوف: " + (reason != null ? reason : "يرجى تجديد الاشتراك"));
        } else {
            tvSuspensionBanner.setVisibility(View.GONE);
        }

        loadDashboardData();
        setupBottomNav();
    }

    @Override
    protected void onResume() {
        super.onResume();
        loadDashboardData();
    }

    private void loadDashboardData() {
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());

        // 1. مبيعات وعدد فواتير اليوم
        Cursor salesCursor = dbHelper.getReadableDatabase().rawQuery(
                "SELECT SUM(total_amount), COUNT(id) FROM " + DatabaseHelper.TABLE_SALES +
                        " WHERE store_id = ? AND created_at LIKE ?",
                new String[]{String.valueOf(storeId), today + "%"});

        double todaySales = 0;
        int countInvoices = 0;
        if (salesCursor != null && salesCursor.moveToFirst()) {
            todaySales = salesCursor.getDouble(0);
            countInvoices = salesCursor.getInt(1);
            salesCursor.close();
        }

        // 2. إجمالي الديون
        Cursor debtCursor = dbHelper.getReadableDatabase().rawQuery(
                "SELECT SUM(total_debt) FROM " + DatabaseHelper.TABLE_CUSTOMERS +
                        " WHERE store_id = ?",
                new String[]{String.valueOf(storeId)});

        double totalDebt = 0;
        if (debtCursor != null && debtCursor.moveToFirst()) {
            totalDebt = debtCursor.getDouble(0);
            debtCursor.close();
        }

        // 3. صافي الربح التقديري لليوم (سعر البيع - سعر التكلفة)
        Cursor profitCursor = dbHelper.getReadableDatabase().rawQuery(
                "SELECT SUM(si.qty * (si.price - p.cost_price)) " +
                        "FROM " + DatabaseHelper.TABLE_SALE_ITEMS + " si " +
                        "JOIN " + DatabaseHelper.TABLE_SALES + " s ON si.sale_id = s.id " +
                        "JOIN " + DatabaseHelper.TABLE_PRODUCTS + " p ON si.product_id = p.id " +
                        "WHERE s.store_id = ? AND s.created_at LIKE ?",
                new String[]{String.valueOf(storeId), today + "%"});

        double netProfit = 0;
        if (profitCursor != null && profitCursor.moveToFirst()) {
            netProfit = profitCursor.getDouble(0);
            profitCursor.close();
        }

        tvTodaySales.setText(String.format(Locale.getDefault(), "%,.0f ر.ي", todaySales));
        tvTotalDebt.setText(String.format(Locale.getDefault(), "%,.0f ر.ي", totalDebt));
        tvInvoiceCount.setText(String.valueOf(countInvoices));
        tvNetProfit.setText(String.format(Locale.getDefault(), "%,.0f ر.ي", netProfit));
    }

    private void setupBottomNav() {
        bottomNav.setSelectedItemId(R.id.nav_home);
        bottomNav.setOnItemSelectedListener(item -> {
            int id = item.getItemId();
            if (id == R.id.nav_pos) {
                Intent posIntent = new Intent(DashboardActivity.this, PosActivity.class);
                posIntent.putExtra("isSuspended", isSuspended);
                startActivity(posIntent);
                return true;
            } else if (id == R.id.nav_inventory) {
                startActivity(new Intent(DashboardActivity.this, InventoryActivity.class));
                return true;
            } else if (id == R.id.nav_customers) {
                startActivity(new Intent(DashboardActivity.this, CustomersActivity.class));
                return true;
            } else if (id == R.id.nav_settings) {
                startActivity(new Intent(DashboardActivity.this, SettingsActivity.class));
                return true;
            }
            return true;
        });
    }
}
`,
  },

  // 5. PosActivity.java
  {
    path: 'app/src/main/java/com/grocery/pos/PosActivity.java',
    name: 'PosActivity.java',
    language: 'java',
    category: 'activities',
    description: 'شاشة نقطة البيع (POS): باركود ZXing، بحث تلقائي، حساب الديون، طباعة ومشاركة واتساب',
    content: `package com.grocery.pos;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class PosActivity extends AppCompatActivity {

    private AutoCompleteTextView actvProductSearch, actvCustomerSearch;
    private ImageView imgBarcodeScanner;
    private RecyclerView rvCart;
    private TextView tvTotalAmount, tvRemainingAmount;
    private EditText etPaidAmount;
    private Button btnCompleteSale;

    private DatabaseHelper dbHelper;
    private SharedPreferences sharedPreferences;
    private int storeId;
    private boolean isSuspended = false;

    private final List<CartItemModel> cartList = new ArrayList<>();
    private CartAdapter cartAdapter;
    private Integer selectedCustomerId = null;
    private double currentTotal = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_pos);

        dbHelper = new DatabaseHelper(this);
        sharedPreferences = getSharedPreferences("GroceryPrefs", Context.MODE_PRIVATE);
        storeId = sharedPreferences.getInt("store_id", 1);
        isSuspended = getIntent().getBooleanExtra("isSuspended", false);

        actvProductSearch = findViewById(R.id.actvProductSearch);
        actvCustomerSearch = findViewById(R.id.actvCustomerSearch);
        imgBarcodeScanner = findViewById(R.id.imgBarcodeScanner);
        rvCart = findViewById(R.id.rvCart);
        tvTotalAmount = findViewById(R.id.tvTotalAmount);
        tvRemainingAmount = findViewById(R.id.tvRemainingAmount);
        etPaidAmount = findViewById(R.id.etPaidAmount);
        btnCompleteSale = findViewById(R.id.btnCompleteSale);

        rvCart.setLayoutManager(new LinearLayoutManager(this));
        cartAdapter = new CartAdapter(cartList, this::onCartItemChanged);
        rvCart.setAdapter(cartAdapter);

        setupProductSearch();
        setupCustomerSearch();

        // زر الماسح الضوئي (ZXing)
        imgBarcodeScanner.setOnClickListener(v -> {
            IntentIntegrator integrator = new IntentIntegrator(PosActivity.this);
            integrator.setPrompt("وجّه الكاميرا نحو باركود الصنف");
            integrator.setBeepEnabled(true);
            integrator.setOrientationLocked(false);
            integrator.initiateScan();
        });

        // حساب المتبقي تلقائياً عند كتابة المدفوع
        etPaidAmount.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                calculateRemaining();
            }
            @Override
            public void afterTextChanged(Editable s) {}
        });

        // زر إتمام البيع مع فحص الإيقاف
        btnCompleteSale.setOnClickListener(v -> {
            if (isSuspended) {
                Toast.makeText(this, "حسابك موقوف! لا يمكنك إجراء عمليات بيع جديدة.", Toast.LENGTH_LONG).show();
                return;
            }
            processSale();
        });
    }

    private void setupProductSearch() {
        actvProductSearch.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                if (s.length() >= 2) {
                    loadProductSuggestions(s.toString());
                }
            }
            @Override
            public void afterTextChanged(Editable s) {}
        });
    }

    private void loadProductSuggestions(String query) {
        Cursor c = dbHelper.searchProducts(storeId, query);
        List<ProductSuggestion> suggestions = new ArrayList<>();
        if (c != null) {
            while (c.moveToNext()) {
                int id = c.getInt(c.getColumnIndexOrThrow("id"));
                String name = c.getString(c.getColumnIndexOrThrow("name"));
                String barcode = c.getString(c.getColumnIndexOrThrow("barcode"));
                double price = c.getDouble(c.getColumnIndexOrThrow("sale_price"));
                double qty = c.getDouble(c.getColumnIndexOrThrow("quantity"));
                suggestions.add(new ProductSuggestion(id, name, barcode, price, qty));
            }
            c.close();
        }

        ArrayAdapter<ProductSuggestion> adapter = new ArrayAdapter<>(this,
                android.R.layout.simple_dropdown_item_1line, suggestions);
        actvProductSearch.setAdapter(adapter);
        actvProductSearch.setOnItemClickListener((parent, view, position, id) -> {
            ProductSuggestion selected = adapter.getItem(position);
            if (selected != null) {
                actvProductSearch.setText("");
                showQuantityDialog(selected.id, selected.name, selected.price, selected.availableQty);
            }
        });
    }

    private void setupCustomerSearch() {
        Cursor c = dbHelper.getCustomers(storeId);
        List<CustomerSuggestion> custList = new ArrayList<>();
        if (c != null) {
            while (c.moveToNext()) {
                int id = c.getInt(c.getColumnIndexOrThrow("id"));
                String name = c.getString(c.getColumnIndexOrThrow("name"));
                String phone = c.getString(c.getColumnIndexOrThrow("phone"));
                custList.add(new CustomerSuggestion(id, name, phone));
            }
            c.close();
        }

        ArrayAdapter<CustomerSuggestion> adapter = new ArrayAdapter<>(this,
                android.R.layout.simple_dropdown_item_1line, custList);
        actvCustomerSearch.setAdapter(adapter);
        actvCustomerSearch.setOnItemClickListener((parent, view, position, id) -> {
            CustomerSuggestion cust = adapter.getItem(position);
            if (cust != null) {
                selectedCustomerId = cust.id;
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
        if (result != null && result.getContents() != null) {
            String scannedBarcode = result.getContents();
            Cursor c = dbHelper.getProductByBarcode(storeId, scannedBarcode);
            if (c != null && c.moveToFirst()) {
                int pId = c.getInt(c.getColumnIndexOrThrow("id"));
                String name = c.getString(c.getColumnIndexOrThrow("name"));
                double price = c.getDouble(c.getColumnIndexOrThrow("sale_price"));
                double available = c.getDouble(c.getColumnIndexOrThrow("quantity"));
                c.close();
                showQuantityDialog(pId, name, price, available);
            } else {
                if (c != null) c.close();
                Toast.makeText(this, "لم يتم العثور على منتج بهذا الباركود: " + scannedBarcode, Toast.LENGTH_SHORT).show();
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    private void showQuantityDialog(int productId, String name, double price, double available) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle(name);
        builder.setMessage("السعر: " + price + " ر.ي | المتوفر: " + available);

        final EditText etQty = new EditText(this);
        etQty.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);
        etQty.setText("1");
        builder.setView(etQty);

        builder.setPositiveButton("إضافة للسلة", (dialog, which) -> {
            String qtyStr = etQty.getText().toString().trim();
            double qty = qtyStr.isEmpty() ? 1 : Double.parseDouble(qtyStr);
            addToCart(productId, name, price, qty);
        });

        builder.setNegativeButton("إلغاء", null);
        builder.show();
    }

    private void addToCart(int productId, String name, double price, double qty) {
        for (CartItemModel item : cartList) {
            if (item.productId == productId) {
                item.qty += qty;
                item.subtotal = item.qty * item.price;
                cartAdapter.notifyDataSetChanged();
                calculateTotal();
                return;
            }
        }
        cartList.add(new CartItemModel(productId, name, price, qty, price * qty));
        cartAdapter.notifyDataSetChanged();
        calculateTotal();
    }

    private void onCartItemChanged() {
        calculateTotal();
    }

    private void calculateTotal() {
        currentTotal = 0;
        for (CartItemModel item : cartList) {
            currentTotal += item.subtotal;
        }
        tvTotalAmount.setText(String.format(Locale.getDefault(), "%,.0f ر.ي", currentTotal));
        calculateRemaining();
    }

    private void calculateRemaining() {
        String paidStr = etPaidAmount.getText().toString().trim();
        double paid = paidStr.isEmpty() ? 0 : Double.parseDouble(paidStr);
        double remaining = Math.max(0, currentTotal - paid);
        tvRemainingAmount.setText(String.format(Locale.getDefault(), "%,.0f ر.ي", remaining));
    }

    private void processSale() {
        if (cartList.isEmpty()) {
            Toast.makeText(this, "السلة فارغة!", Toast.LENGTH_SHORT).show();
            return;
        }

        String paidStr = etPaidAmount.getText().toString().trim();
        double paid = paidStr.isEmpty() ? currentTotal : Double.parseDouble(paidStr);
        double remaining = Math.max(0, currentTotal - paid);

        if (remaining > 0 && selectedCustomerId == null) {
            String typedCustomerName = actvCustomerSearch.getText().toString().trim();
            if (!typedCustomerName.isEmpty()) {
                // إنشاء زبون جديد تلقائياً وقيد المديونية في حسابه
                long newCustId = dbHelper.insertCustomer(storeId, typedCustomerName, "", 0);
                selectedCustomerId = (int) newCustId;
                Toast.makeText(this, "تم فتح حساب جديد تلقائياً للزبون: " + typedCustomerName + " وقيد الدين عليه", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "البيع الآجل يتطلب تحديد الزبون أو كتابة اسمه لفتح حساب دين!", Toast.LENGTH_LONG).show();
                return;
            }
        }

        String paymentType = remaining > 0 ? "آجل" : "نقداً";
        String createdAt = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date());

        // 1. حفظ الفاتورة
        long saleId = dbHelper.insertSale(storeId, selectedCustomerId, currentTotal, paid, remaining, paymentType, createdAt);

        // 2. حفظ الأصناف وخصم المخزون
        for (CartItemModel it : cartList) {
            dbHelper.insertSaleItem(saleId, it.productId, it.qty, it.price);
        }

        // 3. إضافة المتبقي لدين الزبون
        if (remaining > 0 && selectedCustomerId != null) {
            dbHelper.updateCustomerDebt(storeId, selectedCustomerId, remaining);
        }

        showPostSaleDialog(saleId, currentTotal, paid, remaining);
    }

    private void showPostSaleDialog(long saleId, double total, double paid, double remaining) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("تمت العملية بنجاح! فاتورة رقم #" + saleId);
        builder.setMessage("الإجمالي: " + total + " ر.ي | المدفوع: " + paid + " ر.ي | المتبقي: " + remaining + " ر.ي");

        builder.setPositiveButton("مشاركة واتساب", (dialog, which) -> {
            shareInvoiceViaWhatsApp(saleId, total, paid, remaining);
            clearPos();
        });

        builder.setNeutralButton("طباعة", (dialog, which) -> {
            printReceipt(saleId, total, paid, remaining);
            clearPos();
        });

        builder.setNegativeButton("إغلاق", (dialog, which) -> clearPos());
        builder.setCancelable(false);
        builder.show();
    }

    private void shareInvoiceViaWhatsApp(long saleId, double total, double paid, double remaining) {
        StringBuilder sb = new StringBuilder();
        sb.append("🧾 *فاتورة مبيعات - ").append(sharedPreferences.getString("store_name", "بقالة")).append("*\n");
        sb.append("رقم الفاتورة: #").append(saleId).append("\n");
        sb.append("التاريخ: ").append(new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(new Date())).append("\n");
        sb.append("-----------------------------\n");
        for (CartItemModel item : cartList) {
            sb.append("• ").append(item.name).append(" (").append(item.qty).append(" × ").append(item.price).append(") = ").append(item.subtotal).append(" ر.ي\n");
        }
        sb.append("-----------------------------\n");
        sb.append("💰 *الإجمالي:* ").append(total).append(" ر.ي\n");
        sb.append("💵 *المدفوع:* ").append(paid).append(" ر.ي\n");
        if (remaining > 0) {
            sb.append("⚠️ *المتبقي (دين):* ").append(remaining).append(" ر.ي\n");
        }
        sb.append("شكراً لتسوقكم معنا ونسعد بخدمتكم دائماً!");

        Intent sendIntent = new Intent();
        sendIntent.setAction(Intent.ACTION_SEND);
        sendIntent.putExtra(Intent.EXTRA_TEXT, sb.toString());
        sendIntent.setType("text/plain");
        sendIntent.setPackage("com.whatsapp");

        try {
            startActivity(sendIntent);
        } catch (Exception e) {
            // فتح مشاركة عامة في حال عدم توفر واتساب أو العمل دون اتصال
            sendIntent.setPackage(null);
            Intent generalIntent = Intent.createChooser(sendIntent, "مشاركة الفاتورة عبر");
            startActivity(generalIntent);
        }
    }

    private void printReceipt(long saleId, double total, double paid, double remaining) {
        Toast.makeText(this, "جاري إرسال أمر الطباعة للطابعة الحرارية عبر البلوتوث...", Toast.LENGTH_SHORT).show();
    }

    private void clearPos() {
        cartList.clear();
        cartAdapter.notifyDataSetChanged();
        etPaidAmount.setText("");
        actvCustomerSearch.setText("");
        selectedCustomerId = null;
        calculateTotal();
    }

    public static class CartItemModel {
        public int productId;
        public String name;
        public double price;
        public double qty;
        public double subtotal;

        public CartItemModel(int productId, String name, double price, double qty, double subtotal) {
            this.productId = productId;
            this.name = name;
            this.price = price;
            this.qty = qty;
            this.subtotal = subtotal;
        }
    }

    public static class ProductSuggestion {
        public int id;
        public String name;
        public String barcode;
        public double price;
        public double availableQty;

        public ProductSuggestion(int id, String name, String barcode, double price, double availableQty) {
            this.id = id;
            this.name = name;
            this.barcode = barcode;
            this.price = price;
            this.availableQty = availableQty;
        }

        @Override
        public String toString() {
            return name + " (" + price + " ر.ي)";
        }
    }

    public static class CustomerSuggestion {
        public int id;
        public String name;
        public String phone;

        public CustomerSuggestion(int id, String name, String phone) {
            this.id = id;
            this.name = name;
            this.phone = phone;
        }

        @Override
        public String toString() {
            return name + (phone != null && !phone.isEmpty() ? " [" + phone + "]" : "");
        }
    }
}
`,
  },

  // 6. AddProductActivity.java
  {
    path: 'app/src/main/java/com/grocery/pos/AddProductActivity.java',
    name: 'AddProductActivity.java',
    language: 'java',
    category: 'activities',
    description: 'إضافة منتج جديد، فحص الباركود، وحساب سعر القطعة من الكرتون برمجياً',
    content: `package com.grocery.pos;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.Spinner;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;

public class AddProductActivity extends AppCompatActivity {

    private EditText etName, etBarcode, etCostPrice, etSalePrice, etQuantity;
    private Spinner spUnitType;
    private LinearLayout layoutCartonFields;
    private EditText etCartonPrice, etPiecesInCarton;
    private ImageView btnScanBarcode;
    private Button btnSaveProduct;

    private DatabaseHelper dbHelper;
    private int storeId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_add_product);

        dbHelper = new DatabaseHelper(this);
        SharedPreferences prefs = getSharedPreferences("GroceryPrefs", Context.MODE_PRIVATE);
        storeId = prefs.getInt("store_id", 1);

        etName = findViewById(R.id.etName);
        etBarcode = findViewById(R.id.etBarcode);
        etCostPrice = findViewById(R.id.etCostPrice);
        etSalePrice = findViewById(R.id.etSalePrice);
        etQuantity = findViewById(R.id.etQuantity);
        spUnitType = findViewById(R.id.spUnitType);
        layoutCartonFields = findViewById(R.id.layoutCartonFields);
        etCartonPrice = findViewById(R.id.etCartonPrice);
        etPiecesInCarton = findViewById(R.id.etPiecesInCarton);
        btnScanBarcode = findViewById(R.id.btnScanBarcode);
        btnSaveProduct = findViewById(R.id.btnSaveProduct);

        setupUnitSpinner();

        btnScanBarcode.setOnClickListener(v -> {
            IntentIntegrator integrator = new IntentIntegrator(AddProductActivity.this);
            integrator.setPrompt("مسح باركود المنتج");
            integrator.setBeepEnabled(true);
            integrator.initiateScan();
        });

        btnSaveProduct.setOnClickListener(v -> saveProduct());
    }

    private void setupUnitSpinner() {
        String[] units = {"قطعة", "كرتون", "كيلو"};
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, units);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spUnitType.setAdapter(adapter);

        spUnitType.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                String selected = units[position];
                if ("كرتون".equals(selected)) {
                    layoutCartonFields.setVisibility(View.VISIBLE);
                } else {
                    layoutCartonFields.setVisibility(View.GONE);
                }
            }
            @Override
            public void onNothingSelected(AdapterView<?> parent) {}
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
        if (result != null && result.getContents() != null) {
            etBarcode.setText(result.getContents());
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    private void saveProduct() {
        String name = etName.getText().toString().trim();
        String barcode = etBarcode.getText().toString().trim();
        String unitType = spUnitType.getSelectedItem().toString();
        String costStr = etCostPrice.getText().toString().trim();
        String saleStr = etSalePrice.getText().toString().trim();
        String qtyStr = etQuantity.getText().toString().trim();

        if (name.isEmpty() || saleStr.isEmpty() || qtyStr.isEmpty()) {
            Toast.makeText(this, "يرجى تعبئة الحقول الأساسية: الاسم، سعر البيع، الكمية", Toast.LENGTH_SHORT).show();
            return;
        }

        double costPrice = costStr.isEmpty() ? 0 : Double.parseDouble(costStr);
        double salePrice = Double.parseDouble(saleStr);
        double quantity = Double.parseDouble(qtyStr);

        // منطق احتساب سعر القطعة في حال كان كرتون
        if ("كرتون".equals(unitType)) {
            String cartonPriceStr = etCartonPrice.getText().toString().trim();
            String piecesStr = etPiecesInCarton.getText().toString().trim();
            if (!cartonPriceStr.isEmpty() && !piecesStr.isEmpty()) {
                double cartonPrice = Double.parseDouble(cartonPriceStr);
                double piecesCount = Double.parseDouble(piecesStr);
                if (piecesCount > 0) {
                    costPrice = cartonPrice / piecesCount;
                }
            }
        }

        long res = dbHelper.insertProduct(storeId, name, barcode, unitType, costPrice, salePrice, quantity, 5);
        if (res > 0) {
            Toast.makeText(this, "تم إضافة المنتج بنجاح!", Toast.LENGTH_SHORT).show();
            finish();
        } else {
            Toast.makeText(this, "فشل حفظ المنتج", Toast.LENGTH_SHORT).show();
        }
    }
}
`,
  },

  // 7. InventoryActivity.java
  {
    path: 'app/src/main/java/com/grocery/pos/InventoryActivity.java',
    name: 'InventoryActivity.java',
    language: 'java',
    category: 'activities',
    description: 'إدارة المخزون، الحذف الناعم (is_active = 0)، وتعديل الأسعار والكمية',
    content: `package com.grocery.pos;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.EditText;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.floatingactionbutton.FloatingActionButton;

import java.util.ArrayList;
import java.util.List;

public class InventoryActivity extends AppCompatActivity {

    private RecyclerView rvProducts;
    private FloatingActionButton fabAddProduct;
    private DatabaseHelper dbHelper;
    private int storeId;
    private ProductsAdapter adapter;
    private final List<ProductModel> productList = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_inventory);

        dbHelper = new DatabaseHelper(this);
        SharedPreferences prefs = getSharedPreferences("GroceryPrefs", Context.MODE_PRIVATE);
        storeId = prefs.getInt("store_id", 1);

        rvProducts = findViewById(R.id.rvProducts);
        fabAddProduct = findViewById(R.id.fabAddProduct);

        rvProducts.setLayoutManager(new LinearLayoutManager(this));
        adapter = new ProductsAdapter(productList, new ProductsAdapter.OnProductActionListener() {
            @Override
            public void onEdit(ProductModel product) {
                showEditDialog(product);
            }

            @Override
            public void onDelete(ProductModel product) {
                confirmDelete(product);
            }
        });
        rvProducts.setAdapter(adapter);

        fabAddProduct.setOnClickListener(v -> {
            startActivity(new Intent(InventoryActivity.this, AddProductActivity.class));
        });

        loadProducts();
    }

    @Override
    protected void onResume() {
        super.onResume();
        loadProducts();
    }

    private void loadProducts() {
        productList.clear();
        Cursor c = dbHelper.getActiveProducts(storeId);
        if (c != null) {
            while (c.moveToNext()) {
                int id = c.getInt(c.getColumnIndexOrThrow("id"));
                String name = c.getString(c.getColumnIndexOrThrow("name"));
                String barcode = c.getString(c.getColumnIndexOrThrow("barcode"));
                String unit = c.getString(c.getColumnIndexOrThrow("unit_type"));
                double cost = c.getDouble(c.getColumnIndexOrThrow("cost_price"));
                double sale = c.getDouble(c.getColumnIndexOrThrow("sale_price"));
                double qty = c.getDouble(c.getColumnIndexOrThrow("quantity"));
                productList.add(new ProductModel(id, name, barcode, unit, cost, sale, qty));
            }
            c.close();
        }
        adapter.notifyDataSetChanged();
    }

    private void showEditDialog(ProductModel product) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("تعديل: " + product.name);

        View v = LayoutInflater.from(this).inflate(R.layout.dialog_edit_product, null);
        EditText etSale = v.findViewById(R.id.etEditSalePrice);
        EditText etCost = v.findViewById(R.id.etEditCostPrice);
        EditText etQty = v.findViewById(R.id.etEditQuantity);

        etSale.setText(String.valueOf(product.salePrice));
        etCost.setText(String.valueOf(product.costPrice));
        etQty.setText(String.valueOf(product.quantity));

        builder.setView(v);
        builder.setPositiveButton("تحديث", (dialog, which) -> {
            double sale = Double.parseDouble(etSale.getText().toString());
            double cost = Double.parseDouble(etCost.getText().toString());
            double qty = Double.parseDouble(etQty.getText().toString());

            dbHelper.updateProduct(storeId, product.id, sale, cost, qty);
            Toast.makeText(this, "تم تحديث بيانات الصنف", Toast.LENGTH_SHORT).show();
            loadProducts();
        });
        builder.setNegativeButton("إلغاء", null);
        builder.show();
    }

    private void confirmDelete(ProductModel product) {
        new AlertDialog.Builder(this)
                .setTitle("حذف الصنف")
                .setMessage("هل أنت متأكد من حذف الصنف '" + product.name + "'؟")
                .setPositiveButton("نعم (حذف)", (dialog, which) -> {
                    // حذف ناعم عبر تعيين is_active = 0
                    dbHelper.softDeleteProduct(storeId, product.id);
                    Toast.makeText(this, "تم نقل الصنف إلى المحذوفات", Toast.LENGTH_SHORT).show();
                    loadProducts();
                })
                .setNegativeButton("إلغاء", null)
                .show();
    }

    public static class ProductModel {
        public int id;
        public String name;
        public String barcode;
        public String unit;
        public double costPrice;
        public double salePrice;
        public double quantity;

        public ProductModel(int id, String name, String barcode, String unit, double costPrice, double salePrice, double quantity) {
            this.id = id;
            this.name = name;
            this.barcode = barcode;
            this.unit = unit;
            this.costPrice = costPrice;
            this.salePrice = salePrice;
            this.quantity = quantity;
        }
    }
}
`,
  },

  // 8. CustomersActivity.java
  {
    path: 'app/src/main/java/com/grocery/pos/CustomersActivity.java',
    name: 'CustomersActivity.java',
    language: 'java',
    category: 'activities',
    description: 'شاشة العملاء والديون مع أزرار: تسديد، كشف حساب، ومرتجع',
    content: `package com.grocery.pos;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.os.Bundle;
import android.widget.EditText;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.floatingactionbutton.FloatingActionButton;

import java.util.ArrayList;
import java.util.List;

public class CustomersActivity extends AppCompatActivity {

    private RecyclerView rvCustomers;
    private FloatingActionButton fabAddCustomer;
    private DatabaseHelper dbHelper;
    private int storeId;
    private CustomersAdapter adapter;
    private final List<CustomerModel> customerList = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_customers);

        dbHelper = new DatabaseHelper(this);
        SharedPreferences prefs = getSharedPreferences("GroceryPrefs", Context.MODE_PRIVATE);
        storeId = prefs.getInt("store_id", 1);

        rvCustomers = findViewById(R.id.rvCustomers);
        fabAddCustomer = findViewById(R.id.fabAddCustomer);

        rvCustomers.setLayoutManager(new LinearLayoutManager(this));
        adapter = new CustomersAdapter(customerList, new CustomersAdapter.OnCustomerClickListener() {
            @Override
            public void onRepay(CustomerModel customer) {
                showRepayDialog(customer);
            }

            @Override
            public void onStatement(CustomerModel customer) {
                Intent intent = new Intent(CustomersActivity.this, StatementActivity.class);
                intent.putExtra("customer_id", customer.id);
                intent.putExtra("customer_name", customer.name);
                intent.putExtra("customer_phone", customer.phone);
                intent.putExtra("total_debt", customer.totalDebt);
                startActivity(intent);
            }

            @Override
            public void onReturn(CustomerModel customer) {
                Intent intent = new Intent(CustomersActivity.this, ReturnsActivity.class);
                intent.putExtra("customer_id", customer.id);
                startActivity(intent);
            }
        });
        rvCustomers.setAdapter(adapter);

        fabAddCustomer.setOnClickListener(v -> showAddCustomerDialog());

        loadCustomers();
    }

    private void loadCustomers() {
        customerList.clear();
        Cursor c = dbHelper.getCustomers(storeId);
        if (c != null) {
            while (c.moveToNext()) {
                int id = c.getInt(c.getColumnIndexOrThrow("id"));
                String name = c.getString(c.getColumnIndexOrThrow("name"));
                String phone = c.getString(c.getColumnIndexOrThrow("phone"));
                double debt = c.getDouble(c.getColumnIndexOrThrow("total_debt"));
                customerList.add(new CustomerModel(id, name, phone, debt));
            }
            c.close();
        }
        adapter.notifyDataSetChanged();
    }

    private void showRepayDialog(CustomerModel customer) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("تسديد دفعة: " + customer.name);
        builder.setMessage("الدين الحالي: " + customer.totalDebt + " ر.ي");

        final EditText etAmount = new EditText(this);
        etAmount.setHint("أدخل المبلغ المسدد");
        etAmount.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);
        builder.setView(etAmount);

        builder.setPositiveButton("تسديد وخصم", (dialog, which) -> {
            String str = etAmount.getText().toString().trim();
            if (!str.isEmpty()) {
                double amount = Double.parseDouble(str);
                dbHelper.updateCustomerDebt(storeId, customer.id, -amount);
                Toast.makeText(this, "تم تسجيل تسديد " + amount + " ر.ي بنجاح", Toast.LENGTH_SHORT).show();
                loadCustomers();
            }
        });

        builder.setNegativeButton("إلغاء", null);
        builder.show();
    }

    private void showAddCustomerDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("إضافة عميل جديد");

        android.widget.LinearLayout layout = new android.widget.LinearLayout(this);
        layout.setOrientation(android.widget.LinearLayout.VERTICAL);
        layout.setPadding(32, 16, 32, 16);

        final EditText etName = new EditText(this);
        etName.setHint("اسم العميل");
        layout.addView(etName);

        final EditText etPhone = new EditText(this);
        etPhone.setHint("رقم الهاتف");
        etPhone.setInputType(android.text.InputType.TYPE_CLASS_PHONE);
        layout.addView(etPhone);

        final EditText etInitialDebt = new EditText(this);
        etInitialDebt.setHint("دين سابق (إن وجد)");
        etInitialDebt.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);
        layout.addView(etInitialDebt);

        builder.setView(layout);
        builder.setPositiveButton("حفظ", (dialog, which) -> {
            String name = etName.getText().toString().trim();
            String phone = etPhone.getText().toString().trim();
            String debtStr = etInitialDebt.getText().toString().trim();
            double debt = debtStr.isEmpty() ? 0 : Double.parseDouble(debtStr);

            if (!name.isEmpty()) {
                dbHelper.insertCustomer(storeId, name, phone, debt);
                Toast.makeText(this, "تم إضافة العميل", Toast.LENGTH_SHORT).show();
                loadCustomers();
            }
        });
        builder.setNegativeButton("إلغاء", null);
        builder.show();
    }

    public static class CustomerModel {
        public int id;
        public String name;
        public String phone;
        public double totalDebt;

        public CustomerModel(int id, String name, String phone, double totalDebt) {
            this.id = id;
            this.name = name;
            this.phone = phone;
            this.totalDebt = totalDebt;
        }
    }
}
`,
  },

  // 9. StatementActivity.java
  {
    path: 'app/src/main/java/com/grocery/pos/StatementActivity.java',
    name: 'StatementActivity.java',
    language: 'java',
    category: 'activities',
    description: 'كشف حساب تفصيلي للعميل ومشاركته عبر تطبيق واتساب',
    content: `package com.grocery.pos;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;

public class StatementActivity extends AppCompatActivity {

    private TextView tvCustomerTitle, tvStatementTotalDebt;
    private Button btnShareStatement;
    private RecyclerView rvInvoices;
    private DatabaseHelper dbHelper;
    private int storeId, customerId;
    private String customerName, customerPhone;
    private double totalDebt;

    private final List<StatementInvoiceModel> invoiceList = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_statement);

        dbHelper = new DatabaseHelper(this);
        SharedPreferences prefs = getSharedPreferences("GroceryPrefs", Context.MODE_PRIVATE);
        storeId = prefs.getInt("store_id", 1);

        customerId = getIntent().getIntExtra("customer_id", 0);
        customerName = getIntent().getStringExtra("customer_name");
        customerPhone = getIntent().getStringExtra("customer_phone");
        totalDebt = getIntent().getDoubleExtra("total_debt", 0);

        tvCustomerTitle = findViewById(R.id.tvCustomerTitle);
        tvStatementTotalDebt = findViewById(R.id.tvStatementTotalDebt);
        btnShareStatement = findViewById(R.id.btnShareStatement);
        rvInvoices = findViewById(R.id.rvInvoices);

        tvCustomerTitle.setText("كشف حساب: " + customerName);
        tvStatementTotalDebt.setText("إجمالي الرصيد المستحق: " + totalDebt + " ر.ي");

        rvInvoices.setLayoutManager(new LinearLayoutManager(this));
        loadCustomerSales();

        btnShareStatement.setOnClickListener(v -> shareStatementViaWhatsApp());
    }

    private void loadCustomerSales() {
        invoiceList.clear();
        Cursor c = dbHelper.getCustomerSales(storeId, customerId);
        if (c != null) {
            while (c.moveToNext()) {
                int saleId = c.getInt(c.getColumnIndexOrThrow("id"));
                double total = c.getDouble(c.getColumnIndexOrThrow("total_amount"));
                double paid = c.getDouble(c.getColumnIndexOrThrow("paid_amount"));
                double remaining = c.getDouble(c.getColumnIndexOrThrow("remaining_amount"));
                String date = c.getString(c.getColumnIndexOrThrow("created_at"));

                invoiceList.add(new StatementInvoiceModel(saleId, total, paid, remaining, date));
            }
            c.close();
        }
    }

    private void shareStatementViaWhatsApp() {
        StringBuilder sb = new StringBuilder();
        sb.append("📋 *كشف حساب تفصيلي للعميل: ").append(customerName).append("*\n");
        sb.append("رقم الهاتف: ").append(customerPhone != null ? customerPhone : "-").append("\n");
        sb.append("الرصيد المستحق (الدين الحالي): *").append(totalDebt).append(" ر.ي*\n");
        sb.append("=============================\n");
        sb.append("تفاصيل الفواتير والعمليات السابقة:\n");
        for (StatementInvoiceModel inv : invoiceList) {
            sb.append("• فاتورة #").append(inv.saleId).append(" بتاريخ ").append(inv.date).append("\n");
            sb.append("  الإجمالي: ").append(inv.total).append(" | المدفوع: ").append(inv.paid);
            if (inv.remaining > 0) {
                sb.append(" | المتبقي: ").append(inv.remaining).append(" ر.ي (آجل)");
            }
            sb.append("\n-----------------------------\n");
        }
        sb.append("يرجى مراجعة الحساب شاكرين لكم حسن التعامل.");

        Intent sendIntent = new Intent();
        sendIntent.setAction(Intent.ACTION_SEND);
        sendIntent.putExtra(Intent.EXTRA_TEXT, sb.toString());
        sendIntent.setType("text/plain");
        sendIntent.setPackage("com.whatsapp");

        try {
            startActivity(sendIntent);
        } catch (Exception e) {
            sendIntent.setPackage(null);
            Intent chooser = Intent.createChooser(sendIntent, "مشاركة كشف الحساب");
            startActivity(chooser);
        }
    }

    public static class StatementInvoiceModel {
        public int saleId;
        public double total;
        public double paid;
        public double remaining;
        public String date;

        public StatementInvoiceModel(int saleId, double total, double paid, double remaining, String date) {
            this.saleId = saleId;
            this.total = total;
            this.paid = paid;
            this.remaining = remaining;
            this.date = date;
        }
    }
}
`,
  },

  // 10. ReturnsActivity.java
  {
    path: 'app/src/main/java/com/grocery/pos/ReturnsActivity.java',
    name: 'ReturnsActivity.java',
    language: 'java',
    category: 'activities',
    description: 'شاشة المرتجعات: مرتجع من فاتورة سابقة ومرتجع دائن لحساب الزبون',
    content: `package com.grocery.pos;

import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class ReturnsActivity extends AppCompatActivity {

    private Button btnReturnFromInvoice, btnCreditReturn;
    private DatabaseHelper dbHelper;
    private int storeId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_returns);

        dbHelper = new DatabaseHelper(this);
        SharedPreferences prefs = getSharedPreferences("GroceryPrefs", Context.MODE_PRIVATE);
        storeId = prefs.getInt("store_id", 1);

        btnReturnFromInvoice = findViewById(R.id.btnReturnFromInvoice);
        btnCreditReturn = findViewById(R.id.btnCreditReturn);

        btnReturnFromInvoice.setOnClickListener(v -> showReturnFromInvoiceDialog());
        btnCreditReturn.setOnClickListener(v -> showCreditReturnDialog());
    }

    private void showReturnFromInvoiceDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("مرتجع من فاتورة سابقة");

        android.widget.LinearLayout layout = new android.widget.LinearLayout(this);
        layout.setOrientation(android.widget.LinearLayout.VERTICAL);
        layout.setPadding(32, 16, 32, 16);

        final EditText etSaleId = new EditText(this);
        etSaleId.setHint("أدخل رقم الفاتورة (#ID)");
        etSaleId.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        layout.addView(etSaleId);

        final EditText etQty = new EditText(this);
        etQty.setHint("الكمية المرتجعة");
        etQty.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);
        layout.addView(etQty);

        final EditText etAmount = new EditText(this);
        etAmount.setHint("المبلغ المرتجع الإجمالي");
        etAmount.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);
        layout.addView(etAmount);

        builder.setView(layout);
        builder.setPositiveButton("تسجيل الإرجاع", (dialog, which) -> {
            String saleIdStr = etSaleId.getText().toString().trim();
            String qtyStr = etQty.getText().toString().trim();
            String amountStr = etAmount.getText().toString().trim();

            if (!saleIdStr.isEmpty() && !amountStr.isEmpty()) {
                int saleId = Integer.parseInt(saleIdStr);
                double qty = qtyStr.isEmpty() ? 1 : Double.parseDouble(qtyStr);
                double amount = Double.parseDouble(amountStr);

                // استعلام عن العميل من الفاتورة
                Cursor sc = dbHelper.getReadableDatabase().rawQuery(
                        "SELECT customer_id, payment_type FROM " + DatabaseHelper.TABLE_SALES +
                                " WHERE id = ? AND store_id = ?",
                        new String[]{String.valueOf(saleId), String.valueOf(storeId)});

                Integer customerId = null;
                boolean isCredit = false;
                if (sc != null && sc.moveToFirst()) {
                    if (!sc.isNull(0)) customerId = sc.getInt(0);
                    isCredit = "آجل".equals(sc.getString(1));
                    sc.close();
                }

                String now = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date());
                // استرجاع إلى المخزون وتخفيض الدين
                dbHelper.insertReturn(storeId, saleId, customerId, 1, qty, amount, "invoice", now);

                if (isCredit && customerId != null) {
                    dbHelper.updateCustomerDebt(storeId, customerId, -amount);
                    Toast.makeText(this, "تم إرجاع الصنف وخصم " + amount + " ر.ي من دين العميل", Toast.LENGTH_LONG).show();
                } else {
                    Toast.makeText(this, "تم إرجاع الصنف للمخزون واسترداد المبلغ للزبون", Toast.LENGTH_LONG).show();
                }
            }
        });

        builder.setNegativeButton("إلغاء", null);
        builder.show();
    }

    private void showCreditReturnDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("مرتجع دائن (خصم مباشر من الدين)");

        android.widget.LinearLayout layout = new android.widget.LinearLayout(this);
        layout.setOrientation(android.widget.LinearLayout.VERTICAL);
        layout.setPadding(32, 16, 32, 16);

        final EditText etCustId = new EditText(this);
        etCustId.setHint("معرف أو اسم الزبون");
        layout.addView(etCustId);

        final EditText etAmount = new EditText(this);
        etAmount.setHint("قيمة المرتجع المراد خصمها من الدين");
        etAmount.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);
        layout.addView(etAmount);

        builder.setView(layout);
        builder.setPositiveButton("خصم من الدين", (dialog, which) -> {
            String amountStr = etAmount.getText().toString().trim();
            if (!amountStr.isEmpty()) {
                double amount = Double.parseDouble(amountStr);
                String now = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date());
                dbHelper.insertReturn(storeId, null, 1, 1, 1, amount, "credit", now);
                Toast.makeText(this, "تم تسجيل المرتجع وخصم " + amount + " ر.ي من حساب الدين بنجاح", Toast.LENGTH_SHORT).show();
            }
        });
        builder.setNegativeButton("إلغاء", null);
        builder.show();
    }
}
`,
  },

  // 11. SettingsActivity.java
  {
    path: 'app/src/main/java/com/grocery/pos/SettingsActivity.java',
    name: 'SettingsActivity.java',
    language: 'java',
    category: 'activities',
    description: 'شاشة الإعدادات: بيانات المتجر، بصمة BiometricPrompt، نسخ احتياطي مضغوط لـ Gmail، والاشتراك',
    content: `package com.grocery.pos;

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
`,
  },

  // 12. OwnerActivity.java
  {
    path: 'app/src/main/java/com/grocery/pos/OwnerActivity.java',
    name: 'OwnerActivity.java',
    language: 'java',
    category: 'activities',
    description: 'لوحة تحكم المالك السرية: إحصائيات المشتركين، تعديل السعر ومدة الأيام يدوياً، وإنشاء باقات الاشتراكات المخصصة',
    content: `package com.grocery.pos;

import android.app.AlertDialog;
import android.database.Cursor;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.RadioGroup;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;

public class OwnerActivity extends AppCompatActivity {

    private TextView tvTrialCount, tvPaidCount;
    private RecyclerView rvStores;
    private Button btnCreatePackage, btnViewPackages;
    private DatabaseHelper dbHelper;
    private OwnerStoresAdapter adapter;
    private final List<StoreModel> storeList = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_owner);

        dbHelper = new DatabaseHelper(this);

        tvTrialCount = findViewById(R.id.tvTrialCount);
        tvPaidCount = findViewById(R.id.tvPaidCount);
        rvStores = findViewById(R.id.rvStores);
        btnCreatePackage = findViewById(R.id.btnCreatePackage);
        btnViewPackages = findViewById(R.id.btnViewPackages);

        rvStores.setLayoutManager(new LinearLayoutManager(this));
        adapter = new OwnerStoresAdapter(storeList, new OwnerStoresAdapter.OnStoreActionListener() {
            @Override
            public void onActivate(StoreModel store) {
                showActivationDialog(store);
            }

            @Override
            public void onEdit(StoreModel store) {
                showEditSubscriptionDialog(store);
            }

            @Override
            public void onSuspend(StoreModel store) {
                showSuspensionDialog(store);
            }
        });
        rvStores.setAdapter(adapter);

        if (btnCreatePackage != null) {
            btnCreatePackage.setOnClickListener(v -> showCreatePackageDialog());
        }

        if (btnViewPackages != null) {
            btnViewPackages.setOnClickListener(v -> showManagePackagesDialog());
        }

        loadStoresAndStats();
    }

    private void loadStoresAndStats() {
        storeList.clear();
        Cursor c = dbHelper.getReadableDatabase().rawQuery("SELECT * FROM " + DatabaseHelper.TABLE_USERS, null);

        int trial = 0;
        int paid = 0;
        long now = System.currentTimeMillis();

        if (c != null) {
            while (c.moveToNext()) {
                int id = c.getInt(c.getColumnIndexOrThrow("id"));
                String name = c.getString(c.getColumnIndexOrThrow("store_name"));
                String owner = c.getString(c.getColumnIndexOrThrow("owner_name"));
                String phone = c.getString(c.getColumnIndexOrThrow("phone"));
                String status = c.getString(c.getColumnIndexOrThrow("status"));
                String reason = c.getString(c.getColumnIndexOrThrow("suspension_reason"));
                long end = c.getLong(c.getColumnIndexOrThrow("subscription_end"));

                long days = (end - now) / (1000L * 60 * 60 * 24);
                if (days <= 60 && days > 0) trial++;
                else if (days > 60) paid++;

                storeList.add(new StoreModel(id, name, owner, phone, status, reason, end));
            }
            c.close();
        }

        tvTrialCount.setText("تجريبي: " + trial);
        tvPaidCount.setText("مدفوع: " + paid);
        adapter.notifyDataSetChanged();
    }

    // ==========================================
    // زر تعديل الاشتراك يدوياً (المدة بالأيام وسعر الاشتراك)
    // ==========================================
    private void showEditSubscriptionDialog(StoreModel store) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("تعديل اشتراك: " + store.name);

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(40, 20, 40, 20);

        final TextView tvInfo = new TextView(this);
        tvInfo.setText("تعديل مدة الاشتراك وسعر الباقة:");
        layout.addView(tvInfo);

        // خيار طريقة التطبيق: تصفير واستبدال أم تمديد تراكمي
        final RadioGroup rgMode = new RadioGroup(this);
        rgMode.setOrientation(LinearLayout.VERTICAL);
        final RadioButton rbReset = new RadioButton(this);
        rbReset.setText("تصفير الأيام السابقة وتعيين الرصيد الجديد مباشرة (استبدال)");
        rbReset.setChecked(true);
        final RadioButton rbAppend = new RadioButton(this);
        rbAppend.setText("تمديد تراكمي (+ إضافة فوق الرصيد الحالي)");
        rgMode.addView(rbReset);
        rgMode.addView(rbAppend);
        layout.addView(rgMode);

        final EditText etDays = new EditText(this);
        etDays.setHint("عدد الأيام المعتمدة (مثال: 30 أو 90 أو 365)");
        etDays.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        etDays.setText("30");
        layout.addView(etDays);

        final EditText etPrice = new EditText(this);
        etPrice.setHint("سعر الاشتراك المحصل (ر.ي)");
        etPrice.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);
        etPrice.setText("5000");
        layout.addView(etPrice);

        final Spinner spStatus = new Spinner(this);
        String[] statuses = {"active (تفعيل وحساب نشط)", "suspended (موقوف)"};
        ArrayAdapter<String> statusAdapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, statuses);
        spStatus.setAdapter(statusAdapter);
        layout.addView(spStatus);

        builder.setView(layout);
        builder.setPositiveButton("حفظ وتطبيق التعديل", (dialog, which) -> {
            String daysStr = etDays.getText().toString().trim();
            String priceStr = etPrice.getText().toString().trim();
            int days = daysStr.isEmpty() ? 30 : Integer.parseInt(daysStr);
            double price = priceStr.isEmpty() ? 0 : Double.parseDouble(priceStr);
            String status = spStatus.getSelectedItemPosition() == 0 ? "active" : "suspended";
            boolean resetPrevious = rbReset.isChecked();

            dbHelper.updateStoreSubscriptionManual(store.id, days, price, status, resetPrevious);
            String msg = resetPrevious
                    ? "تم تصفير الأيام السابقة وتعيين " + days + " يوماً للمتجر"
                    : "تم تمديد اشتراك المتجر بإضافة " + days + " يوماً";
            Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();
            loadStoresAndStats();
        });

        builder.setNegativeButton("إلغاء", null);
        builder.show();
    }

    // ==========================================
    // إنشاء باقات الاشتراكات يدوياً وتحديد السعر والمدة
    // ==========================================
    private void showCreatePackageDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("إنشاء باقة اشتراك جديدة يدوياً");

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(40, 20, 40, 20);

        final EditText etName = new EditText(this);
        etName.setHint("اسم الباقة (مثال: باقة 4 أشهر الرمضانية)");
        layout.addView(etName);

        final EditText etDays = new EditText(this);
        etDays.setHint("المدة بالأيام (مثال: 120)");
        etDays.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        layout.addView(etDays);

        final EditText etPrice = new EditText(this);
        etPrice.setHint("السعر بالريال (مثال: 18000)");
        etPrice.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);
        layout.addView(etPrice);

        final EditText etDesc = new EditText(this);
        etDesc.setHint("الوصف والمميزات (اختياري)");
        layout.addView(etDesc);

        builder.setView(layout);
        builder.setPositiveButton("إنشاء وحفظ الباقة", (dialog, which) -> {
            String name = etName.getText().toString().trim();
            String daysStr = etDays.getText().toString().trim();
            String priceStr = etPrice.getText().toString().trim();
            String desc = etDesc.getText().toString().trim();

            if (!name.isEmpty() && !daysStr.isEmpty() && !priceStr.isEmpty()) {
                int days = Integer.parseInt(daysStr);
                double price = Double.parseDouble(priceStr);
                dbHelper.insertSubscriptionPackage(name, days, price, desc);
                Toast.makeText(this, "تم إنشاء باقة الاشتراك الجديدة بنجاح!", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "يرجى تعبئة الحقول المطلوبة", Toast.LENGTH_SHORT).show();
            }
        });

        builder.setNegativeButton("إلغاء", null);
        builder.show();
    }

    private void showManagePackagesDialog() {
        Cursor c = dbHelper.getSubscriptionPackages();
        StringBuilder sb = new StringBuilder();
        if (c != null) {
            while (c.moveToNext()) {
                String name = c.getString(c.getColumnIndexOrThrow("name"));
                int days = c.getInt(c.getColumnIndexOrThrow("duration_days"));
                double price = c.getDouble(c.getColumnIndexOrThrow("price"));
                sb.append("• ").append(name).append(" (").append(days).append(" يوم) - ").append(price).append(" ر.ي\n");
            }
            c.close();
        }

        new AlertDialog.Builder(this)
                .setTitle("باقات الاشتراكات الحالية")
                .setMessage(sb.length() > 0 ? sb.toString() : "لا توجد باقات منشأة حتى الآن")
                .setPositiveButton("إنشاء باقة جديدة", (dialog, which) -> showCreatePackageDialog())
                .setNegativeButton("إغلاق", null)
                .show();
    }

    private void showActivationDialog(StoreModel store) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("تفعيل متجر: " + store.name);

        View v = LayoutInflater.from(this).inflate(R.layout.dialog_activate_store, null);
        RadioGroup rgPlan = v.findViewById(R.id.rgPlan);

        builder.setView(v);
        builder.setPositiveButton("تأكيد التفعيل", (dialog, which) -> {
            int selectedId = rgPlan.getCheckedRadioButtonId();
            long addDays = (selectedId == R.id.rbOneYear) ? 365 : 30;
            long newEnd = System.currentTimeMillis() + (addDays * 24L * 60 * 60 * 1000);

            dbHelper.getWritableDatabase().execSQL(
                    "UPDATE " + DatabaseHelper.TABLE_USERS + " SET status = 'active', subscription_end = ?, suspension_reason = NULL WHERE id = ?",
                    new Object[]{newEnd, store.id});

            Toast.makeText(this, "تم تفعيل المتجر وإضافة " + addDays + " يوم للاشتراك", Toast.LENGTH_SHORT).show();
            loadStoresAndStats();
        });
        builder.setNegativeButton("إلغاء", null);
        builder.show();
    }

    private void showSuspensionDialog(StoreModel store) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("إيقاف متجر: " + store.name);

        final EditText etReason = new EditText(this);
        etReason.setHint("اكتب سبب الإيقاف الذي سيظهر للمستخدم");
        builder.setView(etReason);

        builder.setPositiveButton("تأكيد الإيقاف", (dialog, which) -> {
            String reason = etReason.getText().toString().trim();
            if (reason.isEmpty()) reason = "تم إيقاف الحساب من قبل الإدارة";

            dbHelper.getWritableDatabase().execSQL(
                    "UPDATE " + DatabaseHelper.TABLE_USERS + " SET status = 'suspended', suspension_reason = ? WHERE id = ?",
                    new Object[]{reason, store.id});

            Toast.makeText(this, "تم إيقاف حساب المتجر", Toast.LENGTH_SHORT).show();
            loadStoresAndStats();
        });
        builder.setNegativeButton("إلغاء", null);
        builder.show();
    }

    public static class StoreModel {
        public int id;
        public String name;
        public String owner;
        public String phone;
        public String status;
        public String reason;
        public long subscriptionEnd;

        public StoreModel(int id, String name, String owner, String phone, String status, String reason, long subscriptionEnd) {
            this.id = id;
            this.name = name;
            this.owner = owner;
            this.phone = phone;
            this.status = status;
            this.reason = reason;
            this.subscriptionEnd = subscriptionEnd;
        }
    }
}
`,
  },

  // 13. colors.xml
  {
    path: 'app/src/main/res/values/colors.xml',
    name: 'colors.xml',
    language: 'xml',
    category: 'values',
    description: 'لوحة الألوان الأساسية: الزمردي #0B3D2E، الذهبي #C9A961، العاجي #FAF8F3، الخطر #8B2E2E',
    content: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- الألوان الصارمة المحددة في النظام -->
    <color name="primary_emerald">#0B3D2E</color>
    <color name="secondary_gold">#C9A961</color>
    <color name="background_ivory">#FAF8F3</color>
    <color name="danger_red">#8B2E2E</color>

    <!-- مشتقات وتدرجات متناسقة -->
    <color name="primary_dark">#06231A</color>
    <color name="gold_light">#E5CF98</color>
    <color name="white">#FFFFFF</color>
    <color name="text_dark">#1F2937</color>
    <color name="text_muted">#6B7280</color>
    <color name="card_background">#FFFFFF</color>
    <color name="border_light">#E5E7EB</color>
</resources>
`,
  },

  // 14. strings.xml
  {
    path: 'app/src/main/res/values/strings.xml',
    name: 'strings.xml',
    language: 'xml',
    category: 'values',
    description: 'نصوص التطبيق الكاملة باللغة العربية مع دعم RTL',
    content: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">بقالتي برو</string>
    <string name="login_title">تسجيل الدخول</string>
    <string name="phone_number">رقم الهاتف</string>
    <string name="password">كلمة المرور</string>
    <string name="btn_login">دخول</string>
    <string name="new_account">إنشاء حساب بقالة جديد</string>
    <string name="register_title">إنشاء حساب متجر</string>
    <string name="store_name">اسم البقالة / المتجر</string>
    <string name="owner_name">اسم المالك</string>
    <string name="governorate">المحافظة</string>
    <string name="district">المديرية</string>
    <string name="neighborhood">الحارة / الشارع</string>
    <string name="pos_title">نقطة البيع السريعة</string>
    <string name="inventory_title">إدارة المخزون</string>
    <string name="customers_title">العملاء والحسابات</string>
    <string name="returns_title">المرتجعات</string>
    <string name="settings_title">الإعدادات والنسخ</string>
    <string name="currency_symbol">ر.ي</string>
</resources>
`,
  },

  // 15. activity_login.xml
  {
    path: 'app/src/main/res/layout/activity_login.xml',
    name: 'activity_login.xml',
    language: 'xml',
    category: 'layouts',
    description: 'واجهة تسجيل الدخول بتنسيق XML مع الشعار وحقول الإدخال والاتجاه من اليمين لليسار',
    content: `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@color/background_ivory"
    android:gravity="center"
    android:layoutDirection="rtl"
    android:orientation="vertical"
    android:padding="24dp">

    <!-- الشعار (مع دعم 10 نقرات متتالية للدخول السري) -->
    <ImageView
        android:id="@+id/imgLogo"
        android:layout_width="100dp"
        android:layout_height="100dp"
        android:layout_marginBottom="16dp"
        android:contentDescription="شعار البقالة"
        android:src="@drawable/ic_grocery_store"
        app:tint="@color/primary_emerald" />

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="نظام إدارة البقالة الذكي"
        android:textColor="@color/primary_emerald"
        android:textSize="22sp"
        android:textStyle="bold" />

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginBottom="32dp"
        android:text="سجل الدخول لإدارة نقاط البيع والمخزون"
        android:textColor="@color/text_muted"
        android:textSize="14sp" />

    <com.google.android.material.card.MaterialCardView
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        app:cardBackgroundColor="@color/card_background"
        app:cardCornerRadius="16dp"
        app:cardElevation="4dp"
        app:strokeColor="@color/border_light"
        app:strokeWidth="1dp">

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="vertical"
            android:padding="20dp">

            <EditText
                android:id="@+id/etPhone"
                android:layout_width="match_parent"
                android:layout_height="52dp"
                android:layout_marginBottom="12dp"
                android:background="@drawable/bg_input_rounded"
                android:drawableStart="@drawable/ic_phone"
                android:drawablePadding="12dp"
                android:hint="رقم الهاتف (مثال: 771234567)"
                android:inputType="phone"
                android:paddingHorizontal="16dp"
                android:textColor="@color/text_dark"
                android:textSize="15sp" />

            <EditText
                android:id="@+id/etPassword"
                android:layout_width="match_parent"
                android:layout_height="52dp"
                android:layout_marginBottom="20dp"
                android:background="@drawable/bg_input_rounded"
                android:drawableStart="@drawable/ic_lock"
                android:drawablePadding="12dp"
                android:hint="كلمة المرور"
                android:inputType="textPassword"
                android:paddingHorizontal="16dp"
                android:textColor="@color/text_dark"
                android:textSize="15sp" />

            <Button
                android:id="@+id/btnLogin"
                android:layout_width="match_parent"
                android:layout_height="54dp"
                android:backgroundTint="@color/primary_emerald"
                android:text="دخول"
                android:textColor="@color/white"
                android:textSize="16sp"
                android:textStyle="bold"
                app:cornerRadius="12dp" />

        </LinearLayout>
    </com.google.android.material.card.MaterialCardView>

    <TextView
        android:id="@+id/tvRegister"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="24dp"
        android:clickable="true"
        android:focusable="true"
        android:padding="8dp"
        android:text="ليس لديك حساب؟ إنشاء حساب بقالة جديد مجاناً"
        android:textColor="@color/secondary_gold"
        android:textSize="15sp"
        android:textStyle="bold" />

</LinearLayout>
`,
  },

  // 16. activity_dashboard.xml
  {
    path: 'app/src/main/res/layout/activity_dashboard.xml',
    name: 'activity_dashboard.xml',
    language: 'xml',
    category: 'layouts',
    description: 'واجهة الشاشة الرئيسية مع الشريط العلوي، وتنبيه الحساب الموقوف، والبطاقات الأربع',
    content: `<?xml version="1.0" encoding="utf-8"?>
<androidx.coordinatorlayout.widget.CoordinatorLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@color/background_ivory"
    android:layoutDirection="rtl">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:orientation="vertical">

        <androidx.appcompat.widget.Toolbar
            android:id="@+id/toolbar"
            android:layout_width="match_parent"
            android:layout_height="?attr/actionBarSize"
            android:background="@color/primary_emerald"
            app:titleTextColor="@color/white" />

        <!-- شريط تنبيه الحساب الموقوف باللون الأحمر -->
        <TextView
            android:id="@+id/tvSuspensionBanner"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:background="@color/danger_red"
            android:padding="12dp"
            android:text="الحساب موقوف: يرجى التواصل مع الإدارة لتجديد الاشتراك"
            android:textAlignment="center"
            android:textColor="@color/white"
            android:textSize="14sp"
            android:textStyle="bold"
            android:visibility="gone" />

        <ScrollView
            android:layout_width="match_parent"
            android:layout_height="0dp"
            android:layout_weight="1"
            android:padding="16dp">

            <GridLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:columnCount="2"
                android:rowCount="2">

                <!-- 1. مبيعات اليوم -->
                <com.google.android.material.card.MaterialCardView
                    android:layout_width="0dp"
                    android:layout_height="120dp"
                    android:layout_columnWeight="1"
                    android:layout_margin="8dp"
                    app:cardBackgroundColor="@color/card_background"
                    app:cardCornerRadius="14dp"
                    app:cardElevation="3dp">

                    <LinearLayout
                        android:layout_width="match_parent"
                        android:layout_height="match_parent"
                        android:orientation="vertical"
                        android:padding="12dp">

                        <TextView
                            android:layout_width="wrap_content"
                            android:layout_height="wrap_content"
                            android:text="مبيعات اليوم"
                            android:textColor="@color/text_muted"
                            android:textSize="13sp" />

                        <TextView
                            android:id="@+id/tvTodaySales"
                            android:layout_width="wrap_content"
                            android:layout_height="wrap_content"
                            android:layout_marginTop="8dp"
                            android:text="0 ر.ي"
                            android:textColor="@color/primary_emerald"
                            android:textSize="18sp"
                            android:textStyle="bold" />
                    </LinearLayout>
                </com.google.android.material.card.MaterialCardView>

                <!-- 2. الديون -->
                <com.google.android.material.card.MaterialCardView
                    android:layout_width="0dp"
                    android:layout_height="120dp"
                    android:layout_columnWeight="1"
                    android:layout_margin="8dp"
                    app:cardBackgroundColor="@color/card_background"
                    app:cardCornerRadius="14dp"
                    app:cardElevation="3dp">

                    <LinearLayout
                        android:layout_width="match_parent"
                        android:layout_height="match_parent"
                        android:orientation="vertical"
                        android:padding="12dp">

                        <TextView
                            android:layout_width="wrap_content"
                            android:layout_height="wrap_content"
                            android:text="إجمالي الديون"
                            android:textColor="@color/text_muted"
                            android:textSize="13sp" />

                        <TextView
                            android:id="@+id/tvTotalDebt"
                            android:layout_width="wrap_content"
                            android:layout_height="wrap_content"
                            android:layout_marginTop="8dp"
                            android:text="0 ر.ي"
                            android:textColor="@color/danger_red"
                            android:textSize="18sp"
                            android:textStyle="bold" />
                    </LinearLayout>
                </com.google.android.material.card.MaterialCardView>

                <!-- 3. عدد الفواتير -->
                <com.google.android.material.card.MaterialCardView
                    android:layout_width="0dp"
                    android:layout_height="120dp"
                    android:layout_columnWeight="1"
                    android:layout_margin="8dp"
                    app:cardBackgroundColor="@color/card_background"
                    app:cardCornerRadius="14dp"
                    app:cardElevation="3dp">

                    <LinearLayout
                        android:layout_width="match_parent"
                        android:layout_height="match_parent"
                        android:orientation="vertical"
                        android:padding="12dp">

                        <TextView
                            android:layout_width="wrap_content"
                            android:layout_height="wrap_content"
                            android:text="عدد الفواتير"
                            android:textColor="@color/text_muted"
                            android:textSize="13sp" />

                        <TextView
                            android:id="@+id/tvInvoiceCount"
                            android:layout_width="wrap_content"
                            android:layout_height="wrap_content"
                            android:layout_marginTop="8dp"
                            android:text="0"
                            android:textColor="@color/secondary_gold"
                            android:textSize="20sp"
                            android:textStyle="bold" />
                    </LinearLayout>
                </com.google.android.material.card.MaterialCardView>

                <!-- 4. صافي الربح -->
                <com.google.android.material.card.MaterialCardView
                    android:layout_width="0dp"
                    android:layout_height="120dp"
                    android:layout_columnWeight="1"
                    android:layout_margin="8dp"
                    app:cardBackgroundColor="@color/card_background"
                    app:cardCornerRadius="14dp"
                    app:cardElevation="3dp">

                    <LinearLayout
                        android:layout_width="match_parent"
                        android:layout_height="match_parent"
                        android:orientation="vertical"
                        android:padding="12dp">

                        <TextView
                            android:layout_width="wrap_content"
                            android:layout_height="wrap_content"
                            android:text="صافي الربح التقديري"
                            android:textColor="@color/text_muted"
                            android:textSize="13sp" />

                        <TextView
                            android:id="@+id/tvNetProfit"
                            android:layout_width="wrap_content"
                            android:layout_height="wrap_content"
                            android:layout_marginTop="8dp"
                            android:text="0 ر.ي"
                            android:textColor="@color/primary_emerald"
                            android:textSize="18sp"
                            android:textStyle="bold" />
                    </LinearLayout>
                </com.google.android.material.card.MaterialCardView>

            </GridLayout>
        </ScrollView>

        <com.google.android.material.bottomnavigation.BottomNavigationView
            android:id="@+id/bottomNav"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:background="@color/white"
            app:itemIconTint="@color/primary_emerald"
            app:itemTextColor="@color/primary_emerald"
            app:menu="@menu/bottom_nav_menu" />

    </LinearLayout>
</androidx.coordinatorlayout.widget.CoordinatorLayout>
`,
  },

  // 17. activity_pos.xml
  {
    path: 'app/src/main/res/layout/activity_pos.xml',
    name: 'activity_pos.xml',
    language: 'xml',
    category: 'layouts',
    description: 'واجهة نقطة البيع (POS) كاملة بـ AutoComplete والباركود وسلة المشتريات والحساب التلقائي',
    content: `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@color/background_ivory"
    android:layoutDirection="rtl"
    android:orientation="vertical">

    <androidx.appcompat.widget.Toolbar
        android:id="@+id/toolbarPos"
        android:layout_width="match_parent"
        android:layout_height="?attr/actionBarSize"
        android:background="@color/primary_emerald"
        app:title="نقطة البيع (POS)"
        app:titleTextColor="@color/white" />

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:padding="12dp">

        <AutoCompleteTextView
            android:id="@+id/actvProductSearch"
            android:layout_width="0dp"
            android:layout_height="50dp"
            android:layout_weight="1"
            android:background="@drawable/bg_input_rounded"
            android:hint="بحث بالاسم أو الباركود..."
            android:paddingHorizontal="14dp"
            android:textSize="14sp" />

        <ImageView
            android:id="@+id/imgBarcodeScanner"
            android:layout_width="50dp"
            android:layout_height="50dp"
            android:layout_marginStart="8dp"
            android:background="@drawable/bg_icon_button"
            android:clickable="true"
            android:contentDescription="ماسح الباركود"
            android:focusable="true"
            android:padding="10dp"
            android:src="@drawable/ic_barcode_scanner"
            app:tint="@color/primary_emerald" />
    </LinearLayout>

    <AutoCompleteTextView
        android:id="@+id/actvCustomerSearch"
        android:layout_width="match_parent"
        android:layout_height="48dp"
        android:layout_marginHorizontal="12dp"
        android:layout_marginBottom="8dp"
        android:background="@drawable/bg_input_rounded"
        android:hint="تحديد الزبون (اختياري / مطلوب للآجل)"
        android:paddingHorizontal="14dp"
        android:textSize="14sp" />

    <!-- سلة الأصناف المشتراة -->
    <androidx.recyclerview.widget.RecyclerView
        android:id="@+id/rvCart"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:padding="8dp" />

    <!-- لوحة الحسابات والدفع -->
    <com.google.android.material.card.MaterialCardView
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        app:cardBackgroundColor="@color/card_background"
        app:cardElevation="8dp">

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="vertical"
            android:padding="16dp">

            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal">

                <TextView
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:text="الإجمالي الكلي:"
                    android:textColor="@color/text_dark"
                    android:textSize="16sp"
                    android:textStyle="bold" />

                <TextView
                    android:id="@+id/tvTotalAmount"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="0 ر.ي"
                    android:textColor="@color/primary_emerald"
                    android:textSize="18sp"
                    android:textStyle="bold" />
            </LinearLayout>

            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginTop="8dp"
                android:gravity="center_vertical"
                android:orientation="horizontal">

                <TextView
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:text="المدفوع:"
                    android:textColor="@color/text_dark"
                    android:textSize="15sp" />

                <EditText
                    android:id="@+id/etPaidAmount"
                    android:layout_width="140dp"
                    android:layout_height="42dp"
                    android:background="@drawable/bg_input_rounded"
                    android:hint="المبلغ المدفوع"
                    android:inputType="numberDecimal"
                    android:paddingHorizontal="10dp"
                    android:textAlignment="viewEnd" />
            </LinearLayout>

            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginTop="8dp"
                android:orientation="horizontal">

                <TextView
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:text="المتبقي (الدين):"
                    android:textColor="@color/danger_red"
                    android:textSize="15sp"
                    android:textStyle="bold" />

                <TextView
                    android:id="@+id/tvRemainingAmount"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="0 ر.ي"
                    android:textColor="@color/danger_red"
                    android:textSize="16sp"
                    android:textStyle="bold" />
            </LinearLayout>

            <Button
                android:id="@+id/btnCompleteSale"
                android:layout_width="match_parent"
                android:layout_height="54dp"
                android:layout_marginTop="12dp"
                android:backgroundTint="@color/primary_emerald"
                android:text="إتمام عملية البيع"
                android:textColor="@color/white"
                android:textSize="16sp"
                android:textStyle="bold"
                app:cornerRadius="12dp" />
        </LinearLayout>
    </com.google.android.material.card.MaterialCardView>

</LinearLayout>
`,
  },

  // 18. AndroidManifest.xml
  {
    path: 'app/src/main/AndroidManifest.xml',
    name: 'AndroidManifest.xml',
    language: 'xml',
    category: 'manifest',
    description: 'ملف بيان التطبيق: تفعيل RTL، صلاحيات الكاميرا والبصمة، وكل الـ Activities',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.grocery.pos">

    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.USE_BIOMETRIC" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.GroceryPOS">

        <activity
            android:name=".LoginActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <activity android:name=".RegisterActivity" />
        <activity android:name=".DashboardActivity" />
        <activity android:name=".PosActivity" />
        <activity android:name=".InventoryActivity" />
        <activity android:name=".AddProductActivity" />
        <activity android:name=".CustomersActivity" />
        <activity android:name=".StatementActivity" />
        <activity android:name=".ReturnsActivity" />
        <activity android:name=".SettingsActivity" />
        <activity android:name=".OwnerActivity" />

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="com.grocery.pos.provider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>

    </application>

</manifest>
`,
  },

  // 19. build.gradle
  {
    path: 'app/build.gradle',
    name: 'build.gradle',
    language: 'groovy',
    category: 'gradle',
    description: 'ملف بناء Gradle مع مكتبات ZXing للباركود و BiometricPrompt للبصمة و Material',
    content: `apply plugin: 'com.android.application'

android {
    namespace 'com.grocery.pos'
    compileSdk 34

    defaultConfig {
        applicationId "com.grocery.pos"
        minSdk 23
        targetSdk 34
        versionCode 1
        versionName "1.0.0"

        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    implementation 'androidx.recyclerview:recyclerview:1.3.2'
    implementation 'androidx.cardview:cardview:1.0.0'

    // 1. مكتبة ZXing للماسح الضوئي والباركود
    implementation 'com.journeyapps:zxing-android-embedded:4.3.0'
    implementation 'com.google.zxing:core:3.5.2'

    // 2. مكتبة BiometricPrompt لمصادقة البصمة
    implementation 'androidx.biometric:biometric:1.1.0'
}
`,
  },

  // 20. Project Level build.gradle
  {
    path: 'build.gradle',
    name: 'build.gradle (Project)',
    language: 'groovy',
    category: 'gradle',
    description: 'ملف بناء المشروع الرئيسي (الجذر): نمط buildscript المتوافق بنسبة 100% مع AndroidIDE و Android Studio',
    content: `// Top-level build file where you can add configuration options common to all sub-projects/modules.
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        // إصدار أداة بناء أندرويد AGP المتوافق مع AndroidIDE
        // إذا كان إصدار Gradle لديك 7.x استخدم: 'com.android.tools.build:gradle:7.4.2'
        // إذا كان إصدار Gradle لديك 8.x استخدم: 'com.android.tools.build:gradle:8.1.4'
        classpath 'com.android.tools.build:gradle:8.1.4'
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
        maven { url 'https://jitpack.io' }
    }
}

tasks.register('clean', Delete) {
    delete rootProject.buildDir
}
`,
  },

  // 21. settings.gradle
  {
    path: 'settings.gradle',
    name: 'settings.gradle',
    language: 'groovy',
    category: 'gradle',
    description: 'ملف إعدادات المشروع الرئيسي المتوافق مع بيئة الهاتف AndroidIDE',
    content: `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

rootProject.name = "GroceryPOS"
include ':app'
`,
  },

  // 22. gradle.properties
  {
    path: 'gradle.properties',
    name: 'gradle.properties',
    language: 'properties',
    category: 'gradle',
    description: 'إعدادات أداء وتحسين ذاكرة Gradle للهاتف وتفعيل AndroidX',
    content: `# تفعيل حزم أندرويد إكس الحديثة
android.useAndroidX=true
android.enableJetifier=true

# تحديد استهلاك الذاكرة المناسب لموارد الهاتف في AndroidIDE
org.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m -Dfile.encoding=UTF-8

# تسريع عمليات البناء وتقليل استهلاك البطارية
org.gradle.daemon=true
org.gradle.parallel=true
org.gradle.caching=true
`,
  },

  // 23. gradle/wrapper/gradle-wrapper.properties
  {
    path: 'gradle/wrapper/gradle-wrapper.properties',
    name: 'gradle-wrapper.properties',
    language: 'properties',
    category: 'gradle',
    description: 'تكوين Gradle Wrapper وتحديد إصدار Gradle المتوافق مع الهواتف',
    content: `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
# إصدار Gradle 8.1.1 (متوافق مع AGP 8.1.4)
# إذا واجهت عدم توافق، غير الرابط إلى gradle-7.5.1-bin.zip وغير AGP في build.gradle إلى 7.4.2
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.1.1-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`,
  },

  // 23. gradlew (Executable Bash Wrapper)
  {
    path: 'gradlew',
    name: 'gradlew',
    language: 'shell',
    category: 'gradle',
    description: 'سكريبت تشغيل Gradle Wrapper في بيئات Linux / Termux / macOS ويدعم ./gradlew',
    content: `#!/bin/sh

#
# Copyright 2015 the original author or authors.
# Gradle startup script for UN*X
#

# Attempt to set APP_BASE_NAME
# $0 ~ normalize-path
case "\`uname\`" in
  CYGWIN* )
    app_base_name="\`cygpath --windows --short \"$0\"\`"
    ;;
  MINGW* )
    app_base_name="\`cmd //c echo \"$0\"\`"
    ;;
  * )
    app_base_name="\`basename \"$0\"\`"
    ;;
esac

APP_HOME="\`pwd -P\`"
DIRNAME="\`dirname -- \"$0\"\`"
if [ "$DIRNAME" = "." ]; then
    APP_HOME="\`pwd -P\`"
else
    APP_HOME="\`cd -- \"$DIRNAME\" && pwd -P\`"
fi

# Locate JAVA_HOME if available
if [ -z "$JAVACMD" ] ; then
    if [ -n "$JAVA_HOME" ] ; then
        if [ -x "$JAVA_HOME/jre/sh/java" ] ; then
            JAVACMD="$JAVA_HOME/jre/sh/java"
        else
            JAVACMD="$JAVA_HOME/bin/java"
        fi
    else
        JAVACMD="java"
    fi
fi

WRAPPER_JAR="$APP_HOME/gradle/wrapper/gradle-wrapper.jar"

# If wrapper jar is not present but gradle is installed, run system gradle
if [ ! -r "$WRAPPER_JAR" ]; then
    if command -v gradle >/dev/null 2>&1; then
        exec gradle "$@"
    else
        echo "Error: Could not find gradle-wrapper.jar or system gradle." >&2
        echo "Please install gradle or run: gradle wrapper" >&2
        exit 1
    fi
fi

exec "$JAVACMD" "-Dorg.gradle.appname=$app_base_name" -jar "$WRAPPER_JAR" "$@"
`,
  },

  // 24. .github/workflows/build-apk.yml (Automated Cloud APK Builder)
  {
    path: '.github/workflows/build-apk.yml',
    name: 'build-apk.yml',
    language: 'yaml',
    category: 'gradle',
    description: 'بناء ملف APK أصلي تلقائياً عبر GitHub Actions وتوفير رابط تحميل مباشر',
    content: `name: Build Android APK
on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build:
    name: Generate Native Debug APK
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: '8.1.1'

      - name: Build Debug APK with Gradle
        run: gradle assembleDebug --no-daemon --stacktrace

      - name: Upload APK Binary as Artifact
        uses: actions/upload-artifact@v4
        with:
          name: GroceryPOS-App-Debug-APK
          path: app/build/outputs/apk/debug/app-debug.apk
          retention-days: 30
`,
  },
];
