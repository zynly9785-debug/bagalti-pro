package com.grocery.pos;

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
        tvInfo.setText("أدخل عدد الأيام الإضافية وسعر الاشتراك المحصل يدوياً:");
        layout.addView(tvInfo);

        final EditText etDays = new EditText(this);
        etDays.setHint("عدد الأيام المراد إضافتها (مثال: 30 أو 90 أو 365)");
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

            dbHelper.updateStoreSubscriptionManual(store.id, days, price, status);
            Toast.makeText(this, "تم تحديث اشتراك المتجر بنجاح", Toast.LENGTH_SHORT).show();
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
                sb.append("• ").append(name).append(" (").append(days).append(" يوم) - ").append(price).append(" ر.ي
");
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
