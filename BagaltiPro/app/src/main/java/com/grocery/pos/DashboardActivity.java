package com.grocery.pos;

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
