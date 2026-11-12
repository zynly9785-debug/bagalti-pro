package com.grocery.pos;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class ExpensesActivity extends AppCompatActivity {
    private int storeId;
    private DatabaseHelper db;
    private LinearLayout list;
    private TextView totalView;
    private final StringBuilder shareText = new StringBuilder();

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        storeId = getSharedPreferences("GroceryPrefs", Context.MODE_PRIVATE).getInt("store_id", -1);
        db = new DatabaseHelper(this);
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(18, 16, 18, 16); root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL); root.setBackgroundColor(0xFFFAF8F3);
        TextView title = new TextView(this); title.setText("مصروفات المتجر"); title.setTextSize(22); title.setTextColor(0xFF0B3D2E); root.addView(title);
        totalView = new TextView(this); totalView.setTextSize(18); totalView.setPadding(4, 12, 4, 12); root.addView(totalView);
        Button add = new Button(this); add.setText("إضافة مصروف"); add.setOnClickListener(v -> showAddExpense()); root.addView(add);
        Button share = new Button(this); share.setText("مشاركة قائمة المصروفات"); share.setOnClickListener(v -> shareExpenses()); root.addView(share);
        ScrollView scroll = new ScrollView(this); list = new LinearLayout(this); list.setOrientation(LinearLayout.VERTICAL); scroll.addView(list); root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1)); setContentView(root);
        loadExpenses();
    }

    private void loadExpenses() {
        list.removeAllViews(); shareText.setLength(0); shareText.append("مصروفات المتجر\n");
        Cursor c = null; double total = 0; int count = 0;
        try {
            c = db.getExpenses(storeId);
            while (c.moveToNext()) {
                String category = c.getString(1); double amount = c.getDouble(2); String note = c.getString(3); String date = c.getString(4);
                total += amount; count++;
                String row = category + " — " + fmt(amount) + " ر.ي\n" + (date == null ? "" : date) + (note == null || note.trim().isEmpty() ? "" : "\n" + note);
                TextView item = new TextView(this); item.setText(row); item.setTextSize(15); item.setTextColor(0xFF263238); item.setPadding(14, 14, 14, 14); item.setBackgroundColor(0xFFFFFFFF); LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2); lp.setMargins(0, 6, 0, 6); list.addView(item, lp);
                shareText.append(row).append("\n----------------\n");
            }
        } catch (Exception e) { Toast.makeText(this, "تعذر تحميل المصروفات", Toast.LENGTH_LONG).show(); }
        finally { if (c != null) c.close(); }
        totalView.setText("الإجمالي: " + fmt(total) + " ر.ي  |  عدد السجلات: " + count);
        if (count == 0) { TextView empty = new TextView(this); empty.setText("لا توجد مصروفات مسجلة."); empty.setPadding(10, 24, 10, 24); list.addView(empty); }
        shareText.insert(0, "الإجمالي: " + fmt(total) + " ر.ي\n\n");
    }

    private void showAddExpense() {
        LinearLayout form = new LinearLayout(this); form.setOrientation(LinearLayout.VERTICAL); form.setPadding(24, 8, 24, 0);
        EditText category = new EditText(this); category.setHint("التصنيف (إيجار، نقل، كهرباء...)"); form.addView(category);
        EditText amount = new EditText(this); amount.setHint("المبلغ بالريال اليمني"); amount.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL); form.addView(amount);
        EditText note = new EditText(this); note.setHint("ملاحظة أو مرجع الإيصال (اختياري)"); form.addView(note);
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle("تسجيل مصروف").setView(form).setNegativeButton("إلغاء", null).setPositiveButton("حفظ", null).create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String cat = category.getText().toString().trim();
            double value;
            try { value = Double.parseDouble(amount.getText().toString().trim()); }
            catch (Exception e) { amount.setError("أدخل مبلغاً صحيحاً"); return; }
            if (cat.isEmpty()) { category.setError("أدخل تصنيف المصروف"); return; }
            if (value <= 0 || Double.isNaN(value) || Double.isInfinite(value)) { amount.setError("يجب أن يكون المبلغ أكبر من صفر"); return; }
            String date = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date());
            long id = db.addExpense(storeId, cat, value, note.getText().toString().trim(), date);
            if (id < 0) { Toast.makeText(this, "تعذر حفظ المصروف", Toast.LENGTH_LONG).show(); return; }
            dialog.dismiss(); loadExpenses(); Toast.makeText(this, "تم حفظ المصروف", Toast.LENGTH_SHORT).show();
        }));
        dialog.show();
    }
    private void shareExpenses() { Intent send = new Intent(Intent.ACTION_SEND); send.setType("text/plain"); send.putExtra(Intent.EXTRA_SUBJECT, "مصروفات المتجر"); send.putExtra(Intent.EXTRA_TEXT, shareText.toString()); startActivity(Intent.createChooser(send, "مشاركة المصروفات عبر")); }
    private String fmt(double n) { return String.format(Locale.getDefault(), "%,.2f", n); }
}
