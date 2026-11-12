package com.grocery.pos;

import android.app.AlertDialog;
import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.os.Bundle;
import android.text.InputType;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Spinner;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Locale;

public class ReturnsActivity extends AppCompatActivity {

    private Button btnReturnFromInvoice, btnCreditReturn;
    private DatabaseHelper dbHelper;
    private int storeId;
    private final ArrayList<InvoiceLine> invoiceLines = new ArrayList<>();

    private static class InvoiceLine {
        int productId;
        double remainingQty;
        String label;

        InvoiceLine(int productId, double remainingQty, String label) {
            this.productId = productId;
            this.remainingQty = remainingQty;
            this.label = label;
        }

        @Override public String toString() { return label; }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_returns);
        dbHelper = new DatabaseHelper(this);
        SharedPreferences prefs = getSharedPreferences("GroceryPrefs", Context.MODE_PRIVATE);
        storeId = prefs.getInt("store_id", -1);
        btnReturnFromInvoice = findViewById(R.id.btnReturnFromInvoice);
        btnCreditReturn = findViewById(R.id.btnCreditReturn);
        btnReturnFromInvoice.setOnClickListener(v -> showReturnFromInvoiceDialog());
        btnCreditReturn.setOnClickListener(v -> showCreditReturnDialog());
    }

    private void showReturnFromInvoiceDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this).setTitle("مرتجع من فاتورة سابقة");
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(32, 16, 32, 16);

        EditText etSaleId = new EditText(this);
        etSaleId.setHint("أدخل رقم الفاتورة (#ID)");
        etSaleId.setInputType(InputType.TYPE_CLASS_NUMBER);
        layout.addView(etSaleId);

        Button btnLoad = new Button(this);
        btnLoad.setText("عرض بنود الفاتورة");
        layout.addView(btnLoad);

        Spinner productSpinner = new Spinner(this);
        layout.addView(productSpinner, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        EditText etQty = new EditText(this);
        etQty.setHint("الكمية المرتجعة");
        etQty.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        layout.addView(etQty);
        EditText etAmount = new EditText(this);
        etAmount.setHint("المبلغ المرتجع الإجمالي");
        etAmount.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        layout.addView(etAmount);

        btnLoad.setOnClickListener(v -> {
            String rawId = etSaleId.getText().toString().trim();
            try {
                if (rawId.isEmpty()) throw new IllegalArgumentException();
                int saleId = Integer.parseInt(rawId);
                if (saleId <= 0 || !loadInvoiceLines(saleId)) {
                    toast("الفاتورة غير موجودة في هذا المتجر أو لا تحتوي بنوداً قابلة للإرجاع");
                    return;
                }
                ArrayAdapter<InvoiceLine> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, invoiceLines);
                adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
                productSpinner.setAdapter(adapter);
            } catch (IllegalArgumentException e) {
                toast("رقم الفاتورة غير صحيح");
            }
        });

        builder.setView(layout);
        builder.setPositiveButton("تسجيل الإرجاع", (dialog, which) -> {
            try {
                String saleRaw = etSaleId.getText().toString().trim();
                int saleId = Integer.parseInt(saleRaw);
                if (!loadInvoiceLines(saleId) || invoiceLines.isEmpty()) {
                    toast("الفاتورة غير موجودة في هذا المتجر أو لا تحتوي بنوداً قابلة للإرجاع");
                    return;
                }
                int selection = productSpinner.getSelectedItemPosition();
                if (selection < 0 || selection >= invoiceLines.size()) {
                    toast("اختر بنداً من الفاتورة أولاً");
                    return;
                }
                InvoiceLine line = invoiceLines.get(selection);
                double qty = parsePositive(etQty.getText().toString(), "الكمية");
                double amount = parsePositive(etAmount.getText().toString(), "المبلغ");
                if (qty > line.remainingQty + 0.000001d) {
                    toast("الكمية تتجاوز المتبقي من هذا البند: " + line.remainingQty);
                    return;
                }
                Integer customerId = null;
                boolean isCredit = false;
                Cursor sc = null;
                try {
                    sc = dbHelper.getReadableDatabase().rawQuery("SELECT customer_id, payment_type FROM " + DatabaseHelper.TABLE_SALES + " WHERE id = ? AND store_id = ? LIMIT 1",
                            new String[]{String.valueOf(saleId), String.valueOf(storeId)});
                    if (sc.moveToFirst()) {
                        if (!sc.isNull(0)) customerId = sc.getInt(0);
                        isCredit = "آجل".equals(sc.getString(1));
                    }
                } finally { if (sc != null) sc.close(); }

                String now = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date());
                long inserted = dbHelper.insertReturn(storeId, saleId, customerId, line.productId, qty, amount, "invoice", now);
                if (inserted < 0) { toast("تعذر تسجيل المرتجع"); return; }
                toast(isCredit && customerId != null
                        ? "تم إرجاع الصنف وخصم " + amount + " ر.ي من دين العميل"
                        : "تم إرجاع الصنف للمخزون واسترداد المبلغ للزبون");
            } catch (NumberFormatException e) {
                toast("أدخل رقماً صحيحاً للفاتورة والكمية والمبلغ");
            } catch (IllegalArgumentException e) {
                toast(e.getMessage());
            } catch (Exception e) {
                toast("تعذر تسجيل المرتجع؛ تحقق من البيانات وحاول مجدداً");
            }
        });
        builder.setNegativeButton("إلغاء", null);
        builder.show();
    }

    private boolean loadInvoiceLines(int saleId) {
        invoiceLines.clear();
        SQLiteDatabase db = dbHelper.getReadableDatabase();
        Cursor sale = null;
        Cursor items = null;
        boolean invoiceExists = false;
        try {
            sale = db.rawQuery("SELECT id FROM " + DatabaseHelper.TABLE_SALES + " WHERE id = ? AND store_id = ? LIMIT 1",
                    new String[]{String.valueOf(saleId), String.valueOf(storeId)});
            invoiceExists = sale.moveToFirst();
            if (!invoiceExists) return false;
            items = db.rawQuery("SELECT si.product_id, SUM(si.qty), p.name, " +
                            "MAX(0, SUM(si.qty) - COALESCE((SELECT SUM(r.qty) FROM " + DatabaseHelper.TABLE_RETURNS + " r " +
                            "WHERE r.sale_id = si.sale_id AND r.product_id = si.product_id AND r.store_id = ? AND r.type = 'invoice'), 0)) " +
                            "AS remaining_qty FROM " + DatabaseHelper.TABLE_SALE_ITEMS + " si " +
                            "JOIN " + DatabaseHelper.TABLE_PRODUCTS + " p ON p.id = si.product_id AND p.store_id = ? " +
                            "WHERE si.sale_id = ? GROUP BY si.product_id, p.name ORDER BY MIN(si.id)",
                    new String[]{String.valueOf(storeId), String.valueOf(storeId), String.valueOf(saleId)});
            while (items.moveToNext()) {
                double remaining = items.getDouble(3);
                if (remaining > 0) invoiceLines.add(new InvoiceLine(items.getInt(0), remaining,
                        items.getString(2) + " — متبقٍ " + remaining));
            }
            return !invoiceLines.isEmpty();
        } finally {
            if (items != null) items.close();
            if (sale != null) sale.close();
        }
    }

    private void showCreditReturnDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this).setTitle("مرتجع دائن (خصم مباشر من الدين)");
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(32, 16, 32, 16);
        EditText etCustomer = new EditText(this);
        etCustomer.setHint("معرف أو اسم الزبون");
        layout.addView(etCustomer);
        EditText etAmount = new EditText(this);
        etAmount.setHint("قيمة المرتجع المراد خصمها من الدين");
        etAmount.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        layout.addView(etAmount);
        builder.setView(layout);
        builder.setPositiveButton("خصم من الدين", (dialog, which) -> {
            Cursor customer = null;
            try {
                String identity = etCustomer.getText().toString().trim();
                if (identity.isEmpty()) throw new IllegalArgumentException("أدخل معرف العميل أو اسمه");
                double amount = parsePositive(etAmount.getText().toString(), "المبلغ");
                SQLiteDatabase db = dbHelper.getReadableDatabase();
                String selection;
                String[] args;
                if (identity.matches("[0-9]+")) {
                    selection = "id = ? AND store_id = ?";
                    args = new String[]{identity, String.valueOf(storeId)};
                } else {
                    selection = "name = ? COLLATE NOCASE AND store_id = ?";
                    args = new String[]{identity, String.valueOf(storeId)};
                }
                customer = db.query(DatabaseHelper.TABLE_CUSTOMERS, new String[]{"id", "total_debt"}, selection, args, null, null, null, "2");
                if (!customer.moveToFirst()) throw new IllegalArgumentException("لم يتم العثور على العميل في هذا المتجر");
                int customerId = customer.getInt(0);
                double balance = customer.getDouble(1);
                if (customer.moveToNext()) throw new IllegalArgumentException("الاسم يطابق أكثر من عميل؛ استخدم المعرف");
                customer.close();
                customer = null;
                if (balance <= 0) throw new IllegalArgumentException("لا يوجد رصيد دين متاح لهذا العميل");
                if (amount > balance + 0.000001d) throw new IllegalArgumentException("المبلغ يتجاوز رصيد الدين المتاح: " + balance);

                // product_id=0 يحدد قيد خصم الدين، ولا ينشئ حركة مخزون.
                String now = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date());
                long rowId = dbHelper.insertReturn(storeId, null, customerId, 0, 1d, amount, "credit", now);
                if (rowId < 0) throw new IllegalArgumentException("تعذر حفظ عملية الخصم");
                toast("تم تسجيل المرتجع وخصم " + amount + " ر.ي من حساب الدين بنجاح");
            } catch (NumberFormatException e) {
                toast("أدخل مبلغاً أو معرفاً رقمياً صحيحاً");
            } catch (IllegalArgumentException e) {
                toast(e.getMessage());
            } catch (Exception e) {
                toast("تعذر تسجيل الخصم؛ تحقق من البيانات وحاول مجدداً");
            } finally { if (customer != null) customer.close(); }
        });
        builder.setNegativeButton("إلغاء", null);
        builder.show();
    }

    private double parsePositive(String text, String field) {
        String value = text == null ? "" : text.trim();
        if (value.isEmpty()) throw new IllegalArgumentException("أدخل " + field);
        final double parsed;
        try {
            parsed = Double.parseDouble(value);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("صيغة " + field + " غير صحيحة");
        }
        if (Double.isNaN(parsed) || Double.isInfinite(parsed) || parsed <= 0) {
            throw new IllegalArgumentException("يجب أن يكون " + field + " أكبر من صفر");
        }
        return parsed;
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }
}
