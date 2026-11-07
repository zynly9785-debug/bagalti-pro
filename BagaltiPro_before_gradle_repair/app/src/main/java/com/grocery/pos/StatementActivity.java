package com.grocery.pos;

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
        sb.append("📋 *كشف حساب تفصيلي للعميل: ").append(customerName).append("*
");
        sb.append("رقم الهاتف: ").append(customerPhone != null ? customerPhone : "-").append("
");
        sb.append("الرصيد المستحق (الدين الحالي): *").append(totalDebt).append(" ر.ي*
");
        sb.append("=============================
");
        sb.append("تفاصيل الفواتير والعمليات السابقة:
");
        for (StatementInvoiceModel inv : invoiceList) {
            sb.append("• فاتورة #").append(inv.saleId).append(" بتاريخ ").append(inv.date).append("
");
            sb.append("  الإجمالي: ").append(inv.total).append(" | المدفوع: ").append(inv.paid);
            if (inv.remaining > 0) {
                sb.append(" | المتبقي: ").append(inv.remaining).append(" ر.ي (آجل)");
            }
            sb.append("
-----------------------------
");
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
