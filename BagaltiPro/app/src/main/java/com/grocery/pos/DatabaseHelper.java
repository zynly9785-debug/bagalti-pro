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
    private static final int DATABASE_VERSION = 2;

    // أسماء الجداول
    public static final String TABLE_USERS = "users";
    public static final String TABLE_PRODUCTS = "products";
    public static final String TABLE_CUSTOMERS = "customers";
    public static final String TABLE_SALES = "sales";
    public static final String TABLE_SALE_ITEMS = "sale_items";
    public static final String TABLE_RETURNS = "returns";
    public static final String TABLE_PACKAGES = "subscription_packages";
    public static final String TABLE_EXPENSES = "expenses";

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
                "price REAL NOT NULL, " +
                "cost_price REAL NOT NULL DEFAULT 0" +
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
        db.execSQL("CREATE TABLE IF NOT EXISTS " + TABLE_EXPENSES + " (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL, note TEXT, created_at TEXT NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS inventory_movements (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, product_id INTEGER NOT NULL, qty_delta REAL NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS customer_payments (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, customer_id INTEGER NOT NULL, amount REAL NOT NULL, method TEXT, note TEXT, created_at TEXT NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS payment_allocations (id INTEGER PRIMARY KEY AUTOINCREMENT, payment_id INTEGER NOT NULL, sale_id INTEGER NOT NULL, amount REAL NOT NULL)");

        // لا تُنشأ أسعار افتراضية؛ يحدد مالك التطبيق الباقات وسياسة الدفع لاحقاً.
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        // ترقيات تحفظ بيانات المتاجر القائمة؛ لا تحذف الجداول المالية عند تحديث التطبيق.
        if (oldVersion < 2) {
            try { db.execSQL("ALTER TABLE " + TABLE_SALE_ITEMS + " ADD COLUMN cost_price REAL NOT NULL DEFAULT 0"); }
            catch (Exception ignored) { }
            db.execSQL("CREATE TABLE IF NOT EXISTS " + TABLE_EXPENSES + " (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL, note TEXT, created_at TEXT NOT NULL)");
            db.execSQL("CREATE TABLE IF NOT EXISTS inventory_movements (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, product_id INTEGER NOT NULL, qty_delta REAL NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL)");
            db.execSQL("CREATE TABLE IF NOT EXISTS customer_payments (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, customer_id INTEGER NOT NULL, amount REAL NOT NULL, method TEXT, note TEXT, created_at TEXT NOT NULL)");
            db.execSQL("CREATE TABLE IF NOT EXISTS payment_allocations (id INTEGER PRIMARY KEY AUTOINCREMENT, payment_id INTEGER NOT NULL, sale_id INTEGER NOT NULL, amount REAL NOT NULL)");
        }
    }

    // ==========================================
    // دوال المستخدمين (المتاجر)
    // ==========================================
    public long registerUser(String storeName, String ownerName, String phone, String password,
                             String pin, String gov, String district, String neighborhood) {
        SQLiteDatabase db = this.getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put("store_name", storeName);
        cv.put("owner_name", ownerName);
        cv.put("phone", phone);
        try {
            cv.put("password", PasswordSecurity.hash(password));
        } catch (Exception e) {
            return -1;
        }
        cv.put("governorate", gov);
        cv.put("district", district);
        cv.put("neighborhood", neighborhood);
        cv.put("pin_code", pin);
        // اشتراك تجريبي لمدة 60 يوم
        long subscriptionEnd = System.currentTimeMillis() + (60L * 24 * 60 * 60 * 1000);
        cv.put("subscription_end", subscriptionEnd);
        cv.put("role", "merchant");
        cv.put("status", "active");

        return db.insert(TABLE_USERS, null, cv);
    }

    public Cursor getUserByPhone(String phone) {
        SQLiteDatabase db = this.getReadableDatabase();
        return db.rawQuery("SELECT * FROM " + TABLE_USERS + " WHERE phone = ? LIMIT 1",
                new String[]{phone});
    }

    /** Upgrade legacy plaintext only after a successful constant-time comparison. */
    public boolean upgradeLegacyPassword(int userId, String legacyPassword, String newHash) {
        SQLiteDatabase db = this.getWritableDatabase();
        ContentValues values = new ContentValues();
        values.put("password", newHash);
        return db.update(TABLE_USERS, values, "id = ? AND password = ?",
                new String[]{String.valueOf(userId), legacyPassword}) == 1;
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
        if (storeId <= 0 || salePrice < 0 || costPrice < 0 || quantity < 0 ||
                Double.isNaN(salePrice) || Double.isInfinite(salePrice) || Double.isNaN(costPrice) || Double.isInfinite(costPrice) || Double.isNaN(quantity) || Double.isInfinite(quantity)) return false;
        SQLiteDatabase db = this.getWritableDatabase();
        Cursor c = null; db.beginTransaction();
        try {
            c = db.rawQuery("SELECT quantity FROM " + TABLE_PRODUCTS + " WHERE id = ? AND store_id = ? LIMIT 1",
                    new String[]{String.valueOf(productId), String.valueOf(storeId)});
            if (!c.moveToFirst()) return false;
            double oldQuantity = c.getDouble(0); c.close(); c = null;
            ContentValues cv = new ContentValues(); cv.put("sale_price", salePrice); cv.put("cost_price", costPrice); cv.put("quantity", quantity);
            if (db.update(TABLE_PRODUCTS, cv, "id = ? AND store_id = ?", new String[]{String.valueOf(productId), String.valueOf(storeId)}) != 1) return false;
            double delta = quantity - oldQuantity;
            if (Math.abs(delta) > 0.000001d) {
                ContentValues movement = new ContentValues(); movement.put("store_id", storeId); movement.put("product_id", productId);
                movement.put("qty_delta", delta); movement.put("reason", "manual_adjustment");
                movement.put("created_at", new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.getDefault()).format(new java.util.Date()));
                db.insert("inventory_movements", null, movement);
            }
            db.setTransactionSuccessful(); return true;
        } catch (Exception e) { return false; }
        finally { if (c != null) c.close(); db.endTransaction(); }
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

    /** Records a customer payment and updates its balance atomically; rejects overpayment. */
    public boolean recordCustomerPayment(int storeId, int customerId, double amount, String method, String note, String createdAt) {
        if (amount <= 0 || Double.isNaN(amount) || Double.isInfinite(amount)) return false;
        SQLiteDatabase db = getWritableDatabase();
        Cursor c = null; db.beginTransaction();
        try {
            c = db.rawQuery("SELECT total_debt FROM " + TABLE_CUSTOMERS + " WHERE id = ? AND store_id = ? LIMIT 1",
                    new String[]{String.valueOf(customerId), String.valueOf(storeId)});
            if (!c.moveToFirst() || amount > c.getDouble(0) + 0.000001d) return false;
            double balance = c.getDouble(0) - amount; c.close(); c = null;
            ContentValues update = new ContentValues(); update.put("total_debt", Math.max(0, balance));
            if (db.update(TABLE_CUSTOMERS, update, "id = ? AND store_id = ?", new String[]{String.valueOf(customerId), String.valueOf(storeId)}) != 1) return false;
            ContentValues payment = new ContentValues(); payment.put("store_id", storeId); payment.put("customer_id", customerId);
            payment.put("amount", amount); payment.put("method", method); payment.put("note", note); payment.put("created_at", createdAt);
            long paymentId = db.insert("customer_payments", null, payment);
            if (paymentId < 0) return false;
            java.util.ArrayList<Long> saleIds = new java.util.ArrayList<>();
            java.util.ArrayList<Double> saleBalances = new java.util.ArrayList<>();
            java.util.ArrayList<Double> salePaid = new java.util.ArrayList<>();
            Cursor sales = db.rawQuery("SELECT id, paid_amount, remaining_amount FROM " + TABLE_SALES +
                    " WHERE store_id = ? AND customer_id = ? AND remaining_amount > 0 ORDER BY id ASC",
                    new String[]{String.valueOf(storeId), String.valueOf(customerId)});
            while (sales.moveToNext()) { saleIds.add(sales.getLong(0)); salePaid.add(sales.getDouble(1)); saleBalances.add(sales.getDouble(2)); }
            sales.close();
            double toAllocate = amount;
            for (int i = 0; i < saleIds.size() && toAllocate > 0.000001d; i++) {
                double allocation = Math.min(toAllocate, saleBalances.get(i));
                ContentValues saleUpdate = new ContentValues();
                saleUpdate.put("paid_amount", salePaid.get(i) + allocation);
                saleUpdate.put("remaining_amount", Math.max(0, saleBalances.get(i) - allocation));
                if (db.update(TABLE_SALES, saleUpdate, "id = ? AND store_id = ? AND customer_id = ?",
                        new String[]{String.valueOf(saleIds.get(i)), String.valueOf(storeId), String.valueOf(customerId)}) != 1) return false;
                ContentValues allocationRow = new ContentValues(); allocationRow.put("payment_id", paymentId);
                allocationRow.put("sale_id", saleIds.get(i)); allocationRow.put("amount", allocation);
                if (db.insert("payment_allocations", null, allocationRow) < 0) return false;
                toAllocate -= allocation;
            }
            db.setTransactionSuccessful(); return true;
        } catch (Exception e) { return false; }
        finally { if (c != null) c.close(); db.endTransaction(); }
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

    /** يسجل الفاتورة وبنودها وتغيير المخزون والدين ضمن معاملة واحدة. يعيد -1 عند الفشل. */
    public long createSaleWithItems(int storeId, Integer customerId, double total, double paid,
                                    double remaining, String paymentType, String createdAt,
                                    List<PosActivity.CartItemModel> items) {
        SQLiteDatabase db = getWritableDatabase();
        long saleId = -1;
        Cursor cursor = null;
        db.beginTransaction();
        try {
            if (storeId <= 0 || items == null || items.isEmpty() || total <= 0 || paid < 0 || remaining < 0 ||
                    paid > total || Math.abs((paid + remaining) - total) > 0.01d || (remaining > 0 && customerId == null))
                throw new IllegalArgumentException("بيانات الفاتورة غير صالحة");
            if (customerId != null) {
                Cursor customerCheck = db.rawQuery("SELECT id FROM " + TABLE_CUSTOMERS + " WHERE id = ? AND store_id = ? LIMIT 1",
                        new String[]{String.valueOf(customerId), String.valueOf(storeId)});
                boolean found = customerCheck.moveToFirst(); customerCheck.close();
                if (!found) throw new IllegalStateException("العميل غير موجود في هذا المتجر");
            }
            double expectedTotal = 0;
            ContentValues sale = new ContentValues();
            sale.put("store_id", storeId);
            if (customerId != null) sale.put("customer_id", customerId);
            sale.put("total_amount", total); sale.put("paid_amount", paid);
            sale.put("remaining_amount", remaining); sale.put("payment_type", paymentType);
            sale.put("created_at", createdAt);
            saleId = db.insertOrThrow(TABLE_SALES, null, sale);
            for (PosActivity.CartItemModel item : items) {
                if (item.qty <= 0 || item.price < 0 || Double.isNaN(item.qty) || Double.isInfinite(item.qty) || Double.isNaN(item.price) || Double.isInfinite(item.price)) throw new IllegalArgumentException("كمية أو سعر غير صالح");
                expectedTotal += item.qty * item.price;
                cursor = db.rawQuery("SELECT quantity, cost_price FROM " + TABLE_PRODUCTS +
                                " WHERE id = ? AND store_id = ? AND is_active = 1 LIMIT 1",
                        new String[]{String.valueOf(item.productId), String.valueOf(storeId)});
                if (!cursor.moveToFirst()) throw new IllegalStateException("المنتج غير موجود في هذا المتجر");
                double stock = cursor.getDouble(0);
                double cost = cursor.getDouble(1);
                cursor.close(); cursor = null;
                if (stock + 0.000001d < item.qty) throw new IllegalStateException("المخزون غير كافٍ للصنف: " + item.name);
                ContentValues line = new ContentValues();
                line.put("sale_id", saleId); line.put("product_id", item.productId);
                line.put("qty", item.qty); line.put("price", item.price); line.put("cost_price", cost);
                db.insertOrThrow(TABLE_SALE_ITEMS, null, line);
                ContentValues productUpdate = new ContentValues();
                productUpdate.put("quantity", stock - item.qty);
                int changed = db.update(TABLE_PRODUCTS, productUpdate,
                        "id = ? AND store_id = ? AND quantity >= ?",
                        new String[]{String.valueOf(item.productId), String.valueOf(storeId), String.valueOf(item.qty)});
                if (changed != 1) throw new IllegalStateException("تغير المخزون أثناء البيع؛ أعد المحاولة");
                ContentValues movement = new ContentValues();
                movement.put("store_id", storeId); movement.put("product_id", item.productId);
                movement.put("qty_delta", -item.qty); movement.put("reason", "sale:" + saleId);
                movement.put("created_at", createdAt); db.insert("inventory_movements", null, movement);
            }
            if (Math.abs(expectedTotal - total) > 0.01d) throw new IllegalStateException("إجمالي الأصناف لا يطابق إجمالي الفاتورة");
            if (remaining > 0 && customerId != null) {
                Cursor customer = db.rawQuery("SELECT total_debt FROM " + TABLE_CUSTOMERS + " WHERE id = ? AND store_id = ? LIMIT 1",
                        new String[]{String.valueOf(customerId), String.valueOf(storeId)});
                if (!customer.moveToFirst()) { customer.close(); throw new IllegalStateException("العميل غير موجود في هذا المتجر"); }
                double newDebt = customer.getDouble(0) + remaining;
                customer.close();
                ContentValues debt = new ContentValues(); debt.put("total_debt", newDebt);
                if (db.update(TABLE_CUSTOMERS, debt, "id = ? AND store_id = ?",
                        new String[]{String.valueOf(customerId), String.valueOf(storeId)}) != 1)
                    throw new IllegalStateException("تعذر تحديث دين العميل");
            }
            db.setTransactionSuccessful();
        } catch (Exception e) {
            saleId = -1;
        } finally {
            if (cursor != null) cursor.close();
            db.endTransaction();
        }
        return saleId;
    }

    public long addExpense(int storeId, String category, double amount, String note, String createdAt) {
        if (storeId <= 0 || amount <= 0 || Double.isNaN(amount) || Double.isInfinite(amount) || category == null || category.trim().isEmpty()) return -1;
        ContentValues values = new ContentValues();
        values.put("store_id", storeId); values.put("category", category.trim());
        values.put("amount", amount); values.put("note", note); values.put("created_at", createdAt);
        return getWritableDatabase().insert(TABLE_EXPENSES, null, values);
    }

    public Cursor getExpenses(int storeId) {
        return getReadableDatabase().rawQuery("SELECT id, category, amount, note, created_at FROM " + TABLE_EXPENSES +
                " WHERE store_id = ? ORDER BY id DESC", new String[]{String.valueOf(storeId)});
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
        if (storeId <= 0 || qty <= 0 || amount <= 0 || Double.isNaN(qty) || Double.isInfinite(qty) || Double.isNaN(amount) || Double.isInfinite(amount)) return -1;
        SQLiteDatabase db = this.getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put("store_id", storeId);
        if (saleId != null) cv.put("sale_id", saleId);
        if (customerId != null) cv.put("customer_id", customerId);
        cv.put("product_id", productId); cv.put("qty", qty); cv.put("amount", amount);
        cv.put("type", type); cv.put("created_at", createdAt);
        long id = -1; db.beginTransaction();
        try {
            if (saleId != null) {
                Cursor invoice = db.rawQuery("SELECT id FROM " + TABLE_SALES + " WHERE id = ? AND store_id = ? LIMIT 1",
                        new String[]{String.valueOf(saleId), String.valueOf(storeId)});
                boolean valid = invoice.moveToFirst(); invoice.close();
                if (!valid) throw new IllegalStateException("الفاتورة غير موجودة في المتجر");
                if (productId > 0) {
                    Cursor sold = db.rawQuery("SELECT COALESCE(SUM(qty),0), COALESCE(SUM(qty * price),0) FROM " + TABLE_SALE_ITEMS + " WHERE sale_id = ? AND product_id = ?",
                            new String[]{String.valueOf(saleId), String.valueOf(productId)});
                    if (!sold.moveToFirst() || sold.getDouble(0) <= 0) { sold.close(); throw new IllegalStateException("الصنف ليس ضمن الفاتورة"); }
                    double soldQty = sold.getDouble(0), soldValue = sold.getDouble(1); sold.close();
                    Cursor previous = db.rawQuery("SELECT COALESCE(SUM(qty),0), COALESCE(SUM(amount),0) FROM " + TABLE_RETURNS + " WHERE sale_id = ? AND product_id = ? AND store_id = ? AND type = 'invoice'",
                            new String[]{String.valueOf(saleId), String.valueOf(productId), String.valueOf(storeId)});
                    previous.moveToFirst(); double returnedQty = previous.getDouble(0); previous.close();
                    double averagePrice = soldValue / soldQty;
                    if (qty > soldQty - returnedQty + 0.000001d || amount > qty * averagePrice + 0.01d)
                        throw new IllegalStateException("الكمية أو المبلغ يتجاوزان المتبقي من بند الفاتورة");
                }
            }
            if (productId > 0) {
                Cursor stock = db.rawQuery("SELECT quantity FROM " + TABLE_PRODUCTS + " WHERE id = ? AND store_id = ? LIMIT 1",
                        new String[]{String.valueOf(productId), String.valueOf(storeId)});
                if (!stock.moveToFirst()) { stock.close(); throw new IllegalStateException("الصنف غير موجود في المتجر"); }
                double newQty = stock.getDouble(0) + qty; stock.close();
                ContentValues stockUpdate = new ContentValues(); stockUpdate.put("quantity", newQty);
                if (db.update(TABLE_PRODUCTS, stockUpdate, "id = ? AND store_id = ?", new String[]{String.valueOf(productId), String.valueOf(storeId)}) != 1)
                    throw new IllegalStateException("تعذر تحديث المخزون");
                ContentValues movement = new ContentValues(); movement.put("store_id", storeId); movement.put("product_id", productId);
                movement.put("qty_delta", qty); movement.put("reason", "return:" + (saleId == null ? "credit" : saleId));
                movement.put("created_at", createdAt); db.insert("inventory_movements", null, movement);
            }
            if (customerId != null) {
                Cursor debt = db.rawQuery("SELECT total_debt FROM " + TABLE_CUSTOMERS + " WHERE id = ? AND store_id = ? LIMIT 1",
                        new String[]{String.valueOf(customerId), String.valueOf(storeId)});
                if (!debt.moveToFirst()) { debt.close(); throw new IllegalStateException("العميل غير موجود في المتجر"); }
                double nextDebt = Math.max(0, debt.getDouble(0) - amount); debt.close();
                ContentValues debtUpdate = new ContentValues(); debtUpdate.put("total_debt", nextDebt);
                if (db.update(TABLE_CUSTOMERS, debtUpdate, "id = ? AND store_id = ?", new String[]{String.valueOf(customerId), String.valueOf(storeId)}) != 1)
                    throw new IllegalStateException("تعذر تحديث دين العميل");
            }
            id = db.insert(TABLE_RETURNS, null, cv);
            if (id < 0) throw new IllegalStateException("تعذر حفظ المرتجع");
            db.setTransactionSuccessful();
        } catch (Exception e) { id = -1; }
        finally { db.endTransaction(); }
        return id;
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
