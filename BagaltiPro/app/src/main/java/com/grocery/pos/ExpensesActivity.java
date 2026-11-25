package com.grocery.pos;

import android.app.AlertDialog;
import android.app.DatePickerDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.graphics.Color;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.cardview.widget.CardView;

import java.text.DecimalFormat;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

public class ExpensesActivity extends AppCompatActivity {
    private final int green = Color.rgb(11, 61, 46);
    private final int ink = Color.rgb(31, 41, 55);
    private final int muted = Color.rgb(107, 114, 128);
    private final int ivory = Color.rgb(250, 248, 243);
    private DatabaseHelper db;
    private int storeId;
    private LinearLayout list;
    private TextView totalView, countView;
    private final DecimalFormat money = new DecimalFormat("#,##0.##");
    private static final String[] CATEGORIES = {"إيجار", "رواتب وأجور", "مشتريات تشغيلية", "كهرباء ومياه", "نقل وتوصيل", "صيانة", "اتصالات وإنترنت", "رسوم حكومية", "أخرى"};
    private static final String[] PAYMENTS = {"نقداً", "تحويل بنكي", "محفظة إلكترونية", "بطاقة", "آجل"};

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        db = new DatabaseHelper(this);
        SharedPreferences prefs = getSharedPreferences("GroceryPrefs", Context.MODE_PRIVATE);
        storeId = prefs.getInt("store_id", 1);
        buildScreen();
        loadExpenses();
    }

    private void buildScreen() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(ivory);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);

        TextView title = new TextView(this);
        title.setText("إدارة المصروفات");
        title.setTextColor(Color.WHITE);
        title.setTextSize(20);
        title.setGravity(Gravity.CENTER_VERTICAL);
        title.setPadding(dp(18), 0, dp(18), 0);
        title.setBackgroundColor(green);
        root.addView(title, new LinearLayout.LayoutParams(-1, dp(58)));

        ScrollView scroll = new ScrollView(this);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(16), dp(12), dp(16), dp(20));
        scroll.addView(content);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));

        CardView summary = new CardView(this);
        summary.setRadius(dp(14)); summary.setCardElevation(dp(2)); summary.setCardBackgroundColor(Color.WHITE);
        LinearLayout summaryBody = new LinearLayout(this);
        summaryBody.setOrientation(LinearLayout.VERTICAL); summaryBody.setPadding(dp(16), dp(14), dp(16), dp(14));
        TextView summaryTitle = label("إجمالي المصروفات المسجلة", 14, muted, true);
        totalView = label("0 ر.ي", 24, green, true);
        countView = label("عدد العمليات: 0", 13, muted, false);
        summaryBody.addView(summaryTitle); summaryBody.addView(totalView); summaryBody.addView(countView);
        summary.addView(summaryBody);
        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(-1, -2); cardParams.bottomMargin = dp(12);
        content.addView(summary, cardParams);

        Button add = new Button(this);
        add.setText("＋  إضافة مصروف"); add.setTextColor(Color.WHITE); add.setBackgroundTintList(android.content.res.ColorStateList.valueOf(green));
        add.setOnClickListener(v -> showExpenseDialog(null));
        LinearLayout.LayoutParams addParams = new LinearLayout.LayoutParams(-1, dp(52)); addParams.bottomMargin = dp(14);
        content.addView(add, addParams);

        TextView history = label("سجل المصروفات", 17, ink, true);
        LinearLayout.LayoutParams historyParams = new LinearLayout.LayoutParams(-1, -2); historyParams.bottomMargin = dp(8);
        content.addView(history, historyParams);
        list = new LinearLayout(this); list.setOrientation(LinearLayout.VERTICAL); content.addView(list);
        setContentView(root);
    }

    private void loadExpenses() {
        list.removeAllViews();
        Cursor c = db.getExpenses(storeId);
        double total = 0;
        int count = 0;
        if (c != null) {
            while (c.moveToNext()) {
                int id = c.getInt(c.getColumnIndexOrThrow("id"));
                String title = c.getString(c.getColumnIndexOrThrow("title"));
                String category = c.getString(c.getColumnIndexOrThrow("category"));
                double amount = c.getDouble(c.getColumnIndexOrThrow("amount"));
                String method = c.getString(c.getColumnIndexOrThrow("payment_method"));
                String payee = c.getString(c.getColumnIndexOrThrow("payee"));
                String reference = c.getString(c.getColumnIndexOrThrow("reference"));
                String date = c.getString(c.getColumnIndexOrThrow("expense_date"));
                String notes = c.getString(c.getColumnIndexOrThrow("notes"));
                total += amount; count++;
                addExpenseRow(id, title, category, amount, method, payee, reference, date, notes);
            }
            c.close();
        }
        totalView.setText(money.format(total) + " ر.ي");
        countView.setText("عدد العمليات: " + count);
        if (count == 0) {
            TextView empty = label("لا توجد مصروفات بعد. اضغط «إضافة مصروف» لتسجيل أول عملية.", 14, muted, false);
            empty.setGravity(Gravity.CENTER); empty.setPadding(dp(12), dp(28), dp(12), dp(28));
            list.addView(empty);
        }
    }

    private void addExpenseRow(int id, String title, String category, double amount, String method,
                               String payee, String reference, String date, String notes) {
        CardView card = new CardView(this);
        card.setRadius(dp(12)); card.setCardElevation(dp(1)); card.setCardBackgroundColor(Color.WHITE);
        LinearLayout body = new LinearLayout(this); body.setOrientation(LinearLayout.VERTICAL); body.setPadding(dp(14), dp(12), dp(14), dp(12));
        LinearLayout top = new LinearLayout(this); top.setOrientation(LinearLayout.HORIZONTAL); top.setGravity(Gravity.CENTER_VERTICAL);
        TextView name = label(title, 16, ink, true); top.addView(name, new LinearLayout.LayoutParams(0, -2, 1));
        TextView value = label(money.format(amount) + " ر.ي", 16, green, true); top.addView(value);
        body.addView(top);
        String detail = category + " • " + date + " • " + method;
        if (payee != null && !payee.trim().isEmpty()) detail += " • المستفيد: " + payee;
        TextView info = label(detail, 12, muted, false); info.setPadding(0, dp(5), 0, dp(2)); body.addView(info);
        if (reference != null && !reference.trim().isEmpty()) body.addView(label("المرجع: " + reference, 12, muted, false));
        if (notes != null && !notes.trim().isEmpty()) body.addView(label("ملاحظات: " + notes, 12, muted, false));
        LinearLayout actions = new LinearLayout(this); actions.setGravity(Gravity.LEFT);
        Button edit = new Button(this); edit.setText("تعديل"); edit.setTextSize(12); edit.setOnClickListener(v -> showExpenseDialog(new Expense(id, title, category, amount, method, payee, reference, date, notes)));
        Button delete = new Button(this); delete.setText("حذف"); delete.setTextSize(12); delete.setTextColor(Color.rgb(139, 46, 46));
        delete.setOnClickListener(v -> new AlertDialog.Builder(this).setTitle("حذف المصروف")
                .setMessage("هل تريد حذف «" + title + "»؟ لا يمكن التراجع عن هذا الإجراء.")
                .setNegativeButton("إلغاء", null).setPositiveButton("حذف", (d, w) -> {
                    db.deleteExpense(storeId, id); loadExpenses(); Toast.makeText(this, "تم حذف المصروف", Toast.LENGTH_SHORT).show();
                }).show());
        actions.addView(edit); actions.addView(delete); body.addView(actions);
        card.addView(body);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2); params.bottomMargin = dp(10); list.addView(card, params);
    }

    private void showExpenseDialog(Expense existing) {
        LinearLayout form = new LinearLayout(this); form.setOrientation(LinearLayout.VERTICAL); form.setPadding(dp(20), dp(8), dp(20), 0); form.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        EditText title = input("اسم المصروف / البيان", InputType.TYPE_CLASS_TEXT);
        EditText amount = input("المبلغ بالريال اليمني", InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        Spinner category = spinner(CATEGORIES);
        Spinner payment = spinner(PAYMENTS);
        EditText payee = input("المستفيد أو الجهة (اختياري)", InputType.TYPE_CLASS_TEXT);
        EditText reference = input("رقم الفاتورة أو المرجع (اختياري)", InputType.TYPE_CLASS_TEXT);
        EditText date = input("التاريخ (اضغط للاختيار)", InputType.TYPE_CLASS_TEXT); date.setFocusable(false);
        EditText notes = input("ملاحظات (اختياري)", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE); notes.setMinLines(2);
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());
        date.setText(existing == null ? today : existing.date);
        date.setOnClickListener(v -> {
            Calendar cal = Calendar.getInstance();
            try { cal.setTime(new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).parse(date.getText().toString())); } catch (Exception ignored) { }
            new DatePickerDialog(this, (picker, year, month, day) -> date.setText(String.format(Locale.US, "%04d-%02d-%02d", year, month + 1, day)),
                    cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).show();
        });
        addField(form, "البيان *", title); addField(form, "المبلغ *", amount);
        addField(form, "التصنيف *", category); addField(form, "طريقة الدفع *", payment);
        addField(form, "المستفيد", payee); addField(form, "رقم الفاتورة / المرجع", reference);
        addField(form, "تاريخ المصروف *", date); addField(form, "ملاحظات", notes);
        if (existing != null) {
            title.setText(existing.title); amount.setText(String.valueOf(existing.amount)); payee.setText(existing.payee); reference.setText(existing.reference); notes.setText(existing.notes);
            select(category, CATEGORIES, existing.category); select(payment, PAYMENTS, existing.method);
        }
        ScrollView scroll = new ScrollView(this); scroll.addView(form);
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle(existing == null ? "تسجيل مصروف جديد" : "تعديل المصروف")
                .setView(scroll).setNegativeButton("إلغاء", null).setPositiveButton(existing == null ? "حفظ المصروف" : "حفظ التعديلات", null).create();
        dialog.setOnShowListener(unused -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String n = title.getText().toString().trim();
            String rawAmount = amount.getText().toString().trim().replace(',', '.');
            double value;
            try { value = Double.parseDouble(rawAmount); } catch (Exception e) { amount.setError("أدخل مبلغاً صحيحاً"); return; }
            if (n.isEmpty()) { title.setError("هذا الحقل مطلوب"); return; }
            if (value <= 0) { amount.setError("يجب أن يكون المبلغ أكبر من صفر"); return; }
            String cat = category.getSelectedItem().toString(), method = payment.getSelectedItem().toString();
            boolean saved = existing == null
                    ? db.insertExpense(storeId, n, cat, value, method, payee.getText().toString().trim(), reference.getText().toString().trim(), date.getText().toString(), notes.getText().toString().trim()) > 0
                    : db.updateExpense(storeId, existing.id, n, cat, value, method, payee.getText().toString().trim(), reference.getText().toString().trim(), date.getText().toString(), notes.getText().toString().trim());
            if (saved) { dialog.dismiss(); loadExpenses(); Toast.makeText(this, "تم حفظ المصروف", Toast.LENGTH_SHORT).show(); }
            else Toast.makeText(this, "تعذر حفظ المصروف، حاول مرة أخرى", Toast.LENGTH_LONG).show();
        }));
        dialog.show();
    }

    private EditText input(String hint, int type) {
        EditText view = new EditText(this); view.setHint(hint); view.setInputType(type); view.setTextSize(14); return view;
    }
    private Spinner spinner(String[] values) {
        Spinner view = new Spinner(this); ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, values);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item); view.setAdapter(adapter); return view;
    }
    private void select(Spinner spinner, String[] values, String choice) {
        for (int i = 0; i < values.length; i++) if (values[i].equals(choice)) { spinner.setSelection(i); return; }
    }
    private void addField(LinearLayout parent, String caption, View field) {
        TextView label = label(caption, 12, muted, true); LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2); lp.topMargin = dp(6); parent.addView(label, lp);
        parent.addView(field, new LinearLayout.LayoutParams(-1, -2));
    }
    private TextView label(String text, int size, int color, boolean bold) {
        TextView view = new TextView(this); view.setText(text); view.setTextSize(size); view.setTextColor(color); if (bold) view.setTypeface(null, android.graphics.Typeface.BOLD); return view;
    }
    private int dp(int value) { return (int) (value * getResources().getDisplayMetrics().density + 0.5f); }

    private static class Expense {
        final int id; final String title, category, method, payee, reference, date, notes; final double amount;
        Expense(int id, String title, String category, double amount, String method, String payee, String reference, String date, String notes) {
            this.id=id; this.title=title; this.category=category; this.amount=amount; this.method=method;
            this.payee=payee == null ? "" : payee; this.reference=reference == null ? "" : reference;
            this.date=date; this.notes=notes == null ? "" : notes;
        }
    }
}
