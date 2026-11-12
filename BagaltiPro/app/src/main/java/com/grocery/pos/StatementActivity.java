package com.grocery.pos;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class StatementActivity extends AppCompatActivity {
    private TextView tvCustomerTitle;
    private TextView tvStatementTotalDebt;
    private TextView tvEmptyState;
    private TextView tvPayments;
    private String paymentHistoryText = "";
    private Button btnShareStatement;
    private RecyclerView rvInvoices;
    private DatabaseHelper dbHelper;
    private int storeId;
    private int customerId;
    private String customerName;
    private String customerPhone;
    private double totalDebt;
    private final List<StatementInvoiceModel> invoiceList = new ArrayList<>();
    private StatementInvoiceAdapter adapter;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_statement);

        dbHelper = new DatabaseHelper(this);
        SharedPreferences prefs = getSharedPreferences("GroceryPrefs", Context.MODE_PRIVATE);
        storeId = prefs.getInt("store_id", -1);
        customerId = getIntent().getIntExtra("customer_id", 0);
        customerName = getIntent().getStringExtra("customer_name");
        customerPhone = getIntent().getStringExtra("customer_phone");

        tvCustomerTitle = findViewById(R.id.tvCustomerTitle);
        tvStatementTotalDebt = findViewById(R.id.tvStatementTotalDebt);
        btnShareStatement = findViewById(R.id.btnShareStatement);
        rvInvoices = findViewById(R.id.rvInvoices);
        addEmptyStateView();
        addPaymentHistoryView();

        rvInvoices.setLayoutManager(new LinearLayoutManager(this));
        adapter = new StatementInvoiceAdapter(invoiceList);
        rvInvoices.setAdapter(adapter);

        if (customerId <= 0 || storeId <= 0 || !loadCustomer()) {
            Toast.makeText(this, "تعذر فتح كشف الحساب: العميل غير موجود أو لا يتبع لهذا المتجر.", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        tvCustomerTitle.setText("كشف حساب: " + customerName);
        loadCustomerSales();
        loadCustomerPayments();
        updateBalanceText();
        btnShareStatement.setOnClickListener(v -> shareStatement());
    }

    private void addEmptyStateView() {
        ViewGroup parent = (ViewGroup) rvInvoices.getParent();
        tvEmptyState = new TextView(this);
        tvEmptyState.setText("لا توجد فواتير مسجلة لهذا العميل.");
        tvEmptyState.setTextSize(15);
        tvEmptyState.setGravity(Gravity.CENTER);
        tvEmptyState.setPadding(12, 20, 12, 20);
        tvEmptyState.setVisibility(View.GONE);
        int index = parent.indexOfChild(rvInvoices);
        parent.addView(tvEmptyState, index);
    }

    private void addPaymentHistoryView() {
        ViewGroup parent = (ViewGroup) rvInvoices.getParent();
        tvPayments = new TextView(this);
        tvPayments.setTextSize(14);
        tvPayments.setTextColor(0xFF263238);
        tvPayments.setPadding(12, 16, 12, 16);
        int shareIndex = parent.indexOfChild(btnShareStatement);
        parent.addView(tvPayments, shareIndex < 0 ? parent.getChildCount() : shareIndex);
    }

    private void loadCustomerPayments() {
        StringBuilder text = new StringBuilder("دفعات السداد المسجلة:");
        Cursor cursor = null;
        try {
            cursor = dbHelper.getReadableDatabase().rawQuery("SELECT amount, method, note, created_at FROM customer_payments WHERE store_id = ? AND customer_id = ? ORDER BY id DESC LIMIT 100",
                    new String[]{String.valueOf(storeId), String.valueOf(customerId)});
            if (cursor.getCount() == 0) text.append("\nلا توجد دفعات مسجلة.");
            while (cursor.moveToNext()) {
                double amount = cursor.getDouble(0);
                String method = cursor.getString(1), note = cursor.getString(2), date = cursor.getString(3);
                text.append("\n").append(date == null ? "" : date).append(" — ").append(formatAmount(amount)).append(" ر.ي");
                if (method != null) text.append(" (ــ ").append(method).append(")");
                if (note != null && !note.trim().isEmpty()) text.append(" — ").append(note);
            }
        } catch (Exception e) { text.append("\nتعذر تحميل الدفعات."); }
        finally { if (cursor != null) cursor.close(); }
        paymentHistoryText = text.toString();
        tvPayments.setText(paymentHistoryText);
    }

    private boolean loadCustomer() {
        Cursor cursor = null;
        try {
            SQLiteDatabase db = dbHelper.getReadableDatabase();
            cursor = db.query(DatabaseHelper.TABLE_CUSTOMERS,
                    new String[]{"name", "phone", "total_debt"},
                    "id = ? AND store_id = ?",
                    new String[]{String.valueOf(customerId), String.valueOf(storeId)},
                    null, null, null, "1");
            if (!cursor.moveToFirst()) return false;
            String dbName = cursor.getString(cursor.getColumnIndexOrThrow("name"));
            customerName = (dbName == null || dbName.trim().isEmpty()) ? customerName : dbName;
            String dbPhone = cursor.getString(cursor.getColumnIndexOrThrow("phone"));
            if (dbPhone != null) customerPhone = dbPhone;
            totalDebt = cursor.getDouble(cursor.getColumnIndexOrThrow("total_debt"));
            return true;
        } catch (Exception e) {
            return false;
        } finally {
            if (cursor != null) cursor.close();
        }
    }

    private void loadCustomerSales() {
        invoiceList.clear();
        Cursor cursor = null;
        try {
            cursor = dbHelper.getCustomerSales(storeId, customerId);
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    invoiceList.add(new StatementInvoiceModel(
                            cursor.getInt(cursor.getColumnIndexOrThrow("id")),
                            cursor.getDouble(cursor.getColumnIndexOrThrow("total_amount")),
                            cursor.getDouble(cursor.getColumnIndexOrThrow("paid_amount")),
                            cursor.getDouble(cursor.getColumnIndexOrThrow("remaining_amount")),
                            cursor.getString(cursor.getColumnIndexOrThrow("created_at"))));
                }
            }
        } catch (Exception e) {
            Toast.makeText(this, "تعذر تحميل الفواتير. حاول فتح الكشف مرة أخرى.", Toast.LENGTH_LONG).show();
        } finally {
            if (cursor != null) cursor.close();
        }
        adapter.notifyDataSetChanged();
        tvEmptyState.setVisibility(invoiceList.isEmpty() ? View.VISIBLE : View.GONE);
        rvInvoices.setVisibility(invoiceList.isEmpty() ? View.GONE : View.VISIBLE);
    }

    private void updateBalanceText() {
        tvStatementTotalDebt.setText("إجمالي الرصيد المستحق: " + formatAmount(totalDebt) + " ر.ي");
    }

    private void shareStatement() {
        if (customerId <= 0) {
            Toast.makeText(this, "لا يمكن مشاركة كشف حساب غير صالح.", Toast.LENGTH_SHORT).show();
            return;
        }
        StringBuilder text = new StringBuilder();
        text.append("كشف حساب العميل: ").append(customerName).append('\n');
        text.append("رقم الهاتف: ").append(customerPhone == null || customerPhone.trim().isEmpty() ? "-" : customerPhone).append('\n');
        text.append("الرصيد الحالي المستحق: ").append(formatAmount(totalDebt)).append(" ر.ي\n\n");
        if (invoiceList.isEmpty()) {
            text.append("لا توجد فواتير مسجلة لهذا العميل.\n");
        } else {
            text.append("الفواتير:\n");
            for (StatementInvoiceModel invoice : invoiceList) {
                text.append("فاتورة #").append(invoice.saleId)
                        .append(" | التاريخ: ").append(invoice.date == null ? "-" : invoice.date)
                        .append(" | الإجمالي: ").append(formatAmount(invoice.total))
                        .append(" | المدفوع: ").append(formatAmount(invoice.paid))
                        .append(" | المتبقي: ").append(formatAmount(invoice.remaining)).append(" ر.ي\n");
            }
        }
        text.append("\n").append(paymentHistoryText).append('\n');
        Intent sendIntent = new Intent(Intent.ACTION_SEND);
        sendIntent.setType("text/plain");
        sendIntent.putExtra(Intent.EXTRA_SUBJECT, "كشف حساب العميل - " + customerName);
        sendIntent.putExtra(Intent.EXTRA_TEXT, text.toString());
        startActivity(Intent.createChooser(sendIntent, "مشاركة كشف الحساب"));
    }

    private String formatAmount(double amount) {
        return String.format(Locale.getDefault(), "%.2f", amount);
    }

    public static class StatementInvoiceModel {
        public final int saleId;
        public final double total;
        public final double paid;
        public final double remaining;
        public final String date;

        public StatementInvoiceModel(int saleId, double total, double paid, double remaining, String date) {
            this.saleId = saleId;
            this.total = total;
            this.paid = paid;
            this.remaining = remaining;
            this.date = date;
        }
    }

    private class StatementInvoiceAdapter extends RecyclerView.Adapter<StatementInvoiceAdapter.InvoiceViewHolder> {
        private final List<StatementInvoiceModel> items;

        StatementInvoiceAdapter(List<StatementInvoiceModel> items) {
            this.items = items;
        }

        @Override
        public InvoiceViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
            View view = getLayoutInflater().inflate(R.layout.item_statement_invoice, parent, false);
            return new InvoiceViewHolder(view);
        }

        @Override
        public void onBindViewHolder(InvoiceViewHolder holder, int position) {
            StatementInvoiceModel item = items.get(position);
            holder.invoiceNumber.setText("فاتورة #" + item.saleId);
            holder.date.setText("التاريخ: " + (item.date == null ? "-" : item.date));
            holder.amounts.setText("الإجمالي: " + formatAmount(item.total) + " ر.ي"
                    + "\nالمدفوع: " + formatAmount(item.paid) + " ر.ي"
                    + "\nالمتبقي: " + formatAmount(item.remaining) + " ر.ي");
        }

        @Override
        public int getItemCount() {
            return items.size();
        }

        class InvoiceViewHolder extends RecyclerView.ViewHolder {
            final TextView invoiceNumber;
            final TextView date;
            final TextView amounts;

            InvoiceViewHolder(View itemView) {
                super(itemView);
                invoiceNumber = itemView.findViewById(R.id.tvStatementInvoiceNumber);
                date = itemView.findViewById(R.id.tvStatementInvoiceDate);
                amounts = itemView.findViewById(R.id.tvStatementInvoiceAmounts);
            }
        }
    }
}
