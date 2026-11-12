package com.grocery.pos;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.os.Bundle;
import android.widget.EditText;
import android.widget.ArrayAdapter;
import android.widget.Spinner;
import android.widget.LinearLayout;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.floatingactionbutton.FloatingActionButton;

import java.util.ArrayList;
import java.util.List;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class CustomersActivity extends AppCompatActivity {

    private RecyclerView rvCustomers;
    private FloatingActionButton fabAddCustomer;
    private DatabaseHelper dbHelper;
    private int storeId;
    private CustomersAdapter adapter;
    private final List<CustomerModel> customerList = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_customers);

        dbHelper = new DatabaseHelper(this);
        SharedPreferences prefs = getSharedPreferences("GroceryPrefs", Context.MODE_PRIVATE);
        storeId = prefs.getInt("store_id", -1);

        rvCustomers = findViewById(R.id.rvCustomers);
        fabAddCustomer = findViewById(R.id.fabAddCustomer);

        rvCustomers.setLayoutManager(new LinearLayoutManager(this));
        adapter = new CustomersAdapter(customerList, new CustomersAdapter.OnCustomerClickListener() {
            @Override
            public void onRepay(CustomerModel customer) {
                showRepayDialog(customer);
            }

            @Override
            public void onStatement(CustomerModel customer) {
                Intent intent = new Intent(CustomersActivity.this, StatementActivity.class);
                intent.putExtra("customer_id", customer.id);
                intent.putExtra("customer_name", customer.name);
                intent.putExtra("customer_phone", customer.phone);
                intent.putExtra("total_debt", customer.totalDebt);
                startActivity(intent);
            }

            @Override
            public void onReturn(CustomerModel customer) {
                Intent intent = new Intent(CustomersActivity.this, ReturnsActivity.class);
                intent.putExtra("customer_id", customer.id);
                startActivity(intent);
            }
        });
        rvCustomers.setAdapter(adapter);

        fabAddCustomer.setOnClickListener(v -> showAddCustomerDialog());

        loadCustomers();
    }

    private void loadCustomers() {
        customerList.clear();
        Cursor c = dbHelper.getCustomers(storeId);
        if (c != null) {
            while (c.moveToNext()) {
                int id = c.getInt(c.getColumnIndexOrThrow("id"));
                String name = c.getString(c.getColumnIndexOrThrow("name"));
                String phone = c.getString(c.getColumnIndexOrThrow("phone"));
                double debt = c.getDouble(c.getColumnIndexOrThrow("total_debt"));
                customerList.add(new CustomerModel(id, name, phone, debt));
            }
            c.close();
        }
        adapter.notifyDataSetChanged();
    }

    private void showRepayDialog(CustomerModel customer) {
        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        form.setPadding(32, 12, 32, 8);
        EditText etAmount = new EditText(this);
        etAmount.setHint("أدخل المبلغ المسدد");
        etAmount.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);
        form.addView(etAmount);
        Spinner method = new Spinner(this);
        ArrayAdapter<String> methods = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item,
                new String[]{"نقداً", "تحويل", "بطاقة", "أخرى"});
        methods.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        method.setAdapter(methods);
        form.addView(method);
        EditText note = new EditText(this); note.setHint("مرجع أو ملاحظة (اختياري)"); form.addView(note);
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle("تسديد دفعة: " + customer.name)
                .setMessage("الدين الحالي: " + customer.totalDebt + " ر.ي").setView(form)
                .setNegativeButton("إلغاء", null).setPositiveButton("حفظ السداد", null).create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            final double amount;
            try { amount = Double.parseDouble(etAmount.getText().toString().trim()); }
            catch (Exception e) { etAmount.setError("أدخل مبلغاً صحيحاً"); return; }
            if (amount <= 0 || Double.isNaN(amount) || Double.isInfinite(amount)) { etAmount.setError("يجب أن يكون المبلغ أكبر من صفر"); return; }
            String now = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date());
            boolean saved = dbHelper.recordCustomerPayment(storeId, customer.id, amount,
                    method.getSelectedItem().toString(), note.getText().toString().trim(), now);
            if (!saved) { Toast.makeText(this, "تعذر تسجيل السداد؛ تحقق من أن المبلغ لا يتجاوز رصيد العميل.", Toast.LENGTH_LONG).show(); return; }
            dialog.dismiss();
            Toast.makeText(this, "تم حفظ السداد " + amount + " ر.ي", Toast.LENGTH_SHORT).show();
            loadCustomers();
        }));
        dialog.show();
    }

    private void showAddCustomerDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("إضافة عميل جديد");

        android.widget.LinearLayout layout = new android.widget.LinearLayout(this);
        layout.setOrientation(android.widget.LinearLayout.VERTICAL);
        layout.setPadding(32, 16, 32, 16);

        final EditText etName = new EditText(this);
        etName.setHint("اسم العميل");
        layout.addView(etName);

        final EditText etPhone = new EditText(this);
        etPhone.setHint("رقم الهاتف");
        etPhone.setInputType(android.text.InputType.TYPE_CLASS_PHONE);
        layout.addView(etPhone);

        final EditText etInitialDebt = new EditText(this);
        etInitialDebt.setHint("دين سابق (إن وجد)");
        etInitialDebt.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);
        layout.addView(etInitialDebt);

        builder.setView(layout);
        builder.setPositiveButton("حفظ", null);
        AlertDialog dialog = builder.setNegativeButton("إلغاء", null).create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String name = etName.getText().toString().trim();
            String phone = etPhone.getText().toString().trim();
            String debtStr = etInitialDebt.getText().toString().trim();
            if (name.isEmpty()) { etName.setError("اسم العميل مطلوب"); return; }
            final double debt;
            try { debt = debtStr.isEmpty() ? 0 : Double.parseDouble(debtStr); }
            catch (NumberFormatException e) { etInitialDebt.setError("أدخل مبلغاً صحيحاً"); return; }
            if ((Double.isNaN(debt) || Double.isInfinite(debt)) || debt < 0) { etInitialDebt.setError("الدين الافتتاحي لا يمكن أن يكون سالباً"); return; }
            long id = dbHelper.insertCustomer(storeId, name, phone, debt);
            if (id <= 0) { Toast.makeText(this, "تعذر حفظ العميل", Toast.LENGTH_LONG).show(); return; }
            dialog.dismiss(); Toast.makeText(this, "تم إضافة العميل", Toast.LENGTH_SHORT).show(); loadCustomers();
        }));
        dialog.show();
    }

    public static class CustomerModel {
        public int id;
        public String name;
        public String phone;
        public double totalDebt;

        public CustomerModel(int id, String name, String phone, double totalDebt) {
            this.id = id;
            this.name = name;
            this.phone = phone;
            this.totalDebt = totalDebt;
        }
    }
}
