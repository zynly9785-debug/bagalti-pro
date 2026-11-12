package com.grocery.pos;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import java.util.Locale;

public class ReportsActivity extends AppCompatActivity {
    private int storeId;
    private String reportText = "";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        SharedPreferences prefs = getSharedPreferences("GroceryPrefs", Context.MODE_PRIVATE);
        storeId = prefs.getInt("store_id", -1);
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(20, 16, 20, 16); root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL); root.setBackgroundColor(0xFFFAF8F3);
        TextView title = new TextView(this); title.setText("التقارير والأرباح"); title.setTextSize(22); title.setTextColor(0xFF0B3D2E); root.addView(title);
        Button back = new Button(this); back.setText("رجوع"); back.setOnClickListener(v -> finish()); root.addView(back);
        Button expense = new Button(this); expense.setText("إدارة المصروفات"); expense.setOnClickListener(v -> startActivity(new Intent(this, ExpensesActivity.class))); root.addView(expense);
        Button share = new Button(this); share.setText("مشاركة ملخص التقرير"); share.setOnClickListener(v -> shareReport()); root.addView(share);
        ScrollView scroll = new ScrollView(this); TextView body = new TextView(this); body.setTextSize(17); body.setTextColor(0xFF263238); body.setPadding(8, 20, 8, 20); scroll.addView(body); root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1)); setContentView(root);
        if (storeId <= 0) { body.setText("سجل المتجر غير متاح. سجّل الدخول مجدداً."); return; }
        body.setText(loadReport());
    }

    private String loadReport() {
        Cursor c = null;
        double sales = 0, cost = 0, debt = 0, expenses = 0;
        int invoices = 0;
        try {
            c = new DatabaseHelper(this).getReadableDatabase().rawQuery(
                    "SELECT COALESCE(SUM(total_amount),0), COUNT(*), COALESCE(SUM(paid_amount),0) FROM sales WHERE store_id=?",
                    new String[]{String.valueOf(storeId)});
            if (c.moveToFirst()) { sales = c.getDouble(0); invoices = c.getInt(1); }
            c.close(); c = null;
            c = new DatabaseHelper(this).getReadableDatabase().rawQuery(
                    "SELECT COALESCE(SUM(si.qty * si.cost_price),0) FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE s.store_id=?",
                    new String[]{String.valueOf(storeId)});
            if (c.moveToFirst()) cost = c.getDouble(0);
            c.close(); c = null;
            c = new DatabaseHelper(this).getReadableDatabase().rawQuery("SELECT COALESCE(SUM(total_debt),0) FROM customers WHERE store_id=?", new String[]{String.valueOf(storeId)});
            if (c.moveToFirst()) debt = c.getDouble(0);
            c.close(); c = null;
            c = new DatabaseHelper(this).getReadableDatabase().rawQuery("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE store_id=?", new String[]{String.valueOf(storeId)});
            if (c.moveToFirst()) expenses = c.getDouble(0);
        } catch (Exception e) { Toast.makeText(this, "تعذر تحميل بعض بيانات التقرير", Toast.LENGTH_LONG).show(); }
        finally { if (c != null) c.close(); }
        double gross = sales - cost;
        double net = gross - expenses;
        reportText = "ملخص إجمالي بيانات المتجر\n(تقرير تراكمي منذ بدء الاستخدام)\n\n" +
                "إجمالي المبيعات: " + fmt(sales) + " ر.ي\n" +
                "عدد الفواتير: " + invoices + "\n" +
                "تكلفة الأصناف وقت البيع المسجلة: " + fmt(cost) + " ر.ي\n" +
                "مجمل الربح: " + fmt(gross) + " ر.ي\n" +
                "المصروفات المسجلة: " + fmt(expenses) + " ر.ي\n" +
                "صافي تقريبي بعد المصروفات: " + fmt(net) + " ر.ي\n" +
                "ديون العملاء الحالية: " + fmt(debt) + " ر.ي\n\n" +
                "تنبيه: القيم القديمة التي لا تحتوي تكلفة تاريخية محفوظة قد لا تعكس الربح الحقيقي. التقرير هنا تراكمي، وليس بديلاً عن تقرير محاسبي رسمي.";
        return reportText;
    }
    private void shareReport() {
        if (reportText.isEmpty()) { Toast.makeText(this, "لا يوجد تقرير للمشاركة", Toast.LENGTH_SHORT).show(); return; }
        Intent send = new Intent(Intent.ACTION_SEND); send.setType("text/plain"); send.putExtra(Intent.EXTRA_SUBJECT, "تقرير بقالتي برو"); send.putExtra(Intent.EXTRA_TEXT, reportText); startActivity(Intent.createChooser(send, "مشاركة التقرير عبر"));
    }
    private String fmt(double n) { return String.format(Locale.getDefault(), "%,.2f", n); }
}
