package com.grocery.pos;

import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class ReturnsActivity extends AppCompatActivity {

    private Button btnReturnFromInvoice, btnCreditReturn;
    private DatabaseHelper dbHelper;
    private int storeId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_returns);

        dbHelper = new DatabaseHelper(this);
        SharedPreferences prefs = getSharedPreferences("GroceryPrefs", Context.MODE_PRIVATE);
        storeId = prefs.getInt("store_id", 1);

        btnReturnFromInvoice = findViewById(R.id.btnReturnFromInvoice);
        btnCreditReturn = findViewById(R.id.btnCreditReturn);

        btnReturnFromInvoice.setOnClickListener(v -> showReturnFromInvoiceDialog());
        btnCreditReturn.setOnClickListener(v -> showCreditReturnDialog());
    }

    private void showReturnFromInvoiceDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("مرتجع من فاتورة سابقة");

        android.widget.LinearLayout layout = new android.widget.LinearLayout(this);
        layout.setOrientation(android.widget.LinearLayout.VERTICAL);
        layout.setPadding(32, 16, 32, 16);

        final EditText etSaleId = new EditText(this);
        etSaleId.setHint("أدخل رقم الفاتورة (#ID)");
        etSaleId.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        layout.addView(etSaleId);

        final EditText etQty = new EditText(this);
        etQty.setHint("الكمية المرتجعة");
        etQty.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);
        layout.addView(etQty);

        final EditText etAmount = new EditText(this);
        etAmount.setHint("المبلغ المرتجع الإجمالي");
        etAmount.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);
        layout.addView(etAmount);

        builder.setView(layout);
        builder.setPositiveButton("تسجيل الإرجاع", (dialog, which) -> {
            String saleIdStr = etSaleId.getText().toString().trim();
            String qtyStr = etQty.getText().toString().trim();
            String amountStr = etAmount.getText().toString().trim();

            if (!saleIdStr.isEmpty() && !amountStr.isEmpty()) {
                int saleId = Integer.parseInt(saleIdStr);
                double qty = qtyStr.isEmpty() ? 1 : Double.parseDouble(qtyStr);
                double amount = Double.parseDouble(amountStr);

                // استعلام عن العميل من الفاتورة
                Cursor sc = dbHelper.getReadableDatabase().rawQuery(
                        "SELECT customer_id, payment_type FROM " + DatabaseHelper.TABLE_SALES +
                                " WHERE id = ? AND store_id = ?",
                        new String[]{String.valueOf(saleId), String.valueOf(storeId)});

                Integer customerId = null;
                boolean isCredit = false;
                if (sc != null && sc.moveToFirst()) {
                    if (!sc.isNull(0)) customerId = sc.getInt(0);
                    isCredit = "آجل".equals(sc.getString(1));
                    sc.close();
                }

                String now = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date());
                // استرجاع إلى المخزون وتخفيض الدين
                dbHelper.insertReturn(storeId, saleId, customerId, 1, qty, amount, "invoice", now);

                if (isCredit && customerId != null) {
                    dbHelper.updateCustomerDebt(storeId, customerId, -amount);
                    Toast.makeText(this, "تم إرجاع الصنف وخصم " + amount + " ر.ي من دين العميل", Toast.LENGTH_LONG).show();
                } else {
                    Toast.makeText(this, "تم إرجاع الصنف للمخزون واسترداد المبلغ للزبون", Toast.LENGTH_LONG).show();
                }
            }
        });

        builder.setNegativeButton("إلغاء", null);
        builder.show();
    }

    private void showCreditReturnDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("مرتجع دائن (خصم مباشر من الدين)");

        android.widget.LinearLayout layout = new android.widget.LinearLayout(this);
        layout.setOrientation(android.widget.LinearLayout.VERTICAL);
        layout.setPadding(32, 16, 32, 16);

        final EditText etCustId = new EditText(this);
        etCustId.setHint("معرف أو اسم الزبون");
        layout.addView(etCustId);

        final EditText etAmount = new EditText(this);
        etAmount.setHint("قيمة المرتجع المراد خصمها من الدين");
        etAmount.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);
        layout.addView(etAmount);

        builder.setView(layout);
        builder.setPositiveButton("خصم من الدين", (dialog, which) -> {
            String amountStr = etAmount.getText().toString().trim();
            if (!amountStr.isEmpty()) {
                double amount = Double.parseDouble(amountStr);
                String now = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date());
                dbHelper.insertReturn(storeId, null, 1, 1, 1, amount, "credit", now);
                Toast.makeText(this, "تم تسجيل المرتجع وخصم " + amount + " ر.ي من حساب الدين بنجاح", Toast.LENGTH_SHORT).show();
            }
        });
        builder.setNegativeButton("إلغاء", null);
        builder.show();
    }
}
