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
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class InvoicesActivity extends AppCompatActivity {
    private final List<Invoice> invoices = new ArrayList<>();
    private int storeId;
    private String storeName;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        SharedPreferences prefs = getSharedPreferences("GroceryPrefs", Context.MODE_PRIVATE);
        storeId = prefs.getInt("store_id", -1);
        storeName = prefs.getString("store_name", "المتجر");
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(20, 16, 20, 16); root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        root.setBackgroundColor(0xFFFAF8F3);
        TextView title = new TextView(this); title.setText("سجل الفواتير"); title.setTextSize(22); title.setTextColor(0xFF0B3D2E); title.setPadding(0, 8, 0, 16); root.addView(title);
        Button back = new Button(this); back.setText("رجوع"); back.setOnClickListener(v -> finish()); root.addView(back);
        ScrollView scroll = new ScrollView(this); LinearLayout list = new LinearLayout(this); list.setOrientation(LinearLayout.VERTICAL); scroll.addView(list); root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1)); setContentView(root);
        if (storeId <= 0) { addText(list, "سجل المتجر غير متاح. سجّل الدخول مجدداً."); return; }
        loadInvoices();
        if (invoices.isEmpty()) { addText(list, "لا توجد فواتير بعد. ستظهر هنا الفواتير المسجلة من نقطة البيع."); return; }
        for (Invoice invoice : invoices) {
            LinearLayout card = new LinearLayout(this); card.setOrientation(LinearLayout.VERTICAL); card.setPadding(16, 14, 16, 14); card.setBackgroundColor(0xFFFFFFFF); LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(-1, -2); cp.setMargins(0, 8, 0, 8); list.addView(card, cp);
            TextView data = new TextView(this); data.setText("فاتورة #" + invoice.id + "\n" + invoice.date + "\nالعميل: " + invoice.customer + "\nالإجمالي: " + fmt(invoice.total) + " ر.ي | المدفوع: " + fmt(invoice.paid) + " ر.ي | المتبقي: " + fmt(invoice.remaining) + " ر.ي"); data.setTextSize(15); data.setTextColor(0xFF263238); card.addView(data);
            Button share = new Button(this); share.setText("مشاركة الفاتورة"); share.setOnClickListener(v -> shareInvoice(invoice)); card.addView(share);
        }
    }

    private void loadInvoices() {
        Cursor c = null;
        try {
            c = new DatabaseHelper(this).getReadableDatabase().rawQuery(
                    "SELECT s.id, s.total_amount, s.paid_amount, s.remaining_amount, s.created_at, COALESCE(c.name, 'نقدي') " +
                    "FROM sales s LEFT JOIN customers c ON c.id=s.customer_id AND c.store_id=s.store_id " +
                    "WHERE s.store_id=? ORDER BY s.id DESC LIMIT 300", new String[]{String.valueOf(storeId)});
            while (c.moveToNext()) invoices.add(new Invoice(c.getLong(0), c.getDouble(1), c.getDouble(2), c.getDouble(3), c.getString(4), c.getString(5)));
        } catch (Exception e) { Toast.makeText(this, "تعذر تحميل سجل الفواتير", Toast.LENGTH_LONG).show(); }
        finally { if (c != null) c.close(); }
    }

    private void shareInvoice(Invoice invoice) {
        StringBuilder text = new StringBuilder();
        text.append("فاتورة ").append(storeName).append("\nرقم الفاتورة: #").append(invoice.id).append("\nالتاريخ: ").append(invoice.date)
                .append("\nالعميل: ").append(invoice.customer).append("\nالإجمالي: ").append(fmt(invoice.total))
                .append(" ر.ي\nالمدفوع: ").append(fmt(invoice.paid)).append(" ر.ي\nالمتبقي: ").append(fmt(invoice.remaining)).append(" ر.ي");
        Intent send = new Intent(Intent.ACTION_SEND); send.setType("text/plain"); send.putExtra(Intent.EXTRA_SUBJECT, "فاتورة #" + invoice.id); send.putExtra(Intent.EXTRA_TEXT, text.toString());
        startActivity(Intent.createChooser(send, "مشاركة الفاتورة عبر"));
    }
    private void addText(LinearLayout parent, String value) { TextView t = new TextView(this); t.setText(value); t.setTextSize(16); t.setPadding(12, 24, 12, 24); parent.addView(t); }
    private String fmt(double n) { return String.format(Locale.getDefault(), "%,.2f", n); }
    private static class Invoice { long id; double total, paid, remaining; String date, customer; Invoice(long i,double t,double p,double r,String d,String c){id=i;total=t;paid=p;remaining=r;date=d;customer=c;} }
}
