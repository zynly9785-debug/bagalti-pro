package com.grocery.pos;

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
    public boolean updateStoreSubscriptionManual(int storeId, int additionalDays, double price, String status) {
        SQLiteDatabase db = this.getWritableDatabase();
        long now = System.currentTimeMillis();
        // جلب تاريخ الانتهاء الحالي
        Cursor c = db.rawQuery("SELECT subscription_end FROM " + TABLE_USERS + " WHERE id = ?", new String[]{String.valueOf(storeId)});
        long currentEnd = now;
        if (c != null && c.moveToFirst()) {
            currentEnd = c.getLong(0);
            c.close();
        }
        long base = (currentEnd > now) ? currentEnd : now;
        long newEnd = base + (additionalDays * 24L * 60 * 60 * 1000);

        ContentValues cv = new ContentValues();
        cv.put("subscription_end", newEnd);
        cv.put("status", status != null ? status : "active");
        cv.put("suspension_reason", (String) null);

        int rows = db.update(TABLE_USERS, cv, "id = ?", new String[]{String.valueOf(storeId)});
        return rows > 0;
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
