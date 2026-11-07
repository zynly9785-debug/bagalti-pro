package com.grocery.pos;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.os.Bundle;
import android.widget.EditText;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.floatingactionbutton.FloatingActionButton;

import java.util.ArrayList;
import java.util.List;

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
        storeId = prefs.getInt("store_id", 1);

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
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("تسديد دفعة: " + customer.name);
        builder.setMessage("الدين الحالي: " + customer.totalDebt + " ر.ي");

        final EditText etAmount = new EditText(this);
        etAmount.setHint("أدخل المبلغ المسدد");
        etAmount.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);
        builder.setView(etAmount);

        builder.setPositiveButton("تسديد وخصم", (dialog, which) -> {
            String str = etAmount.getText().toString().trim();
            if (!str.isEmpty()) {
                double amount = Double.parseDouble(str);
                dbHelper.updateCustomerDebt(storeId, customer.id, -amount);
                Toast.makeText(this, "تم تسجيل تسديد " + amount + " ر.ي بنجاح", Toast.LENGTH_SHORT).show();
                loadCustomers();
            }
        });

        builder.setNegativeButton("إلغاء", null);
        builder.show();
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
        builder.setPositiveButton("حفظ", (dialog, which) -> {
            String name = etName.getText().toString().trim();
            String phone = etPhone.getText().toString().trim();
            String debtStr = etInitialDebt.getText().toString().trim();
            double debt = debtStr.isEmpty() ? 0 : Double.parseDouble(debtStr);

            if (!name.isEmpty()) {
                dbHelper.insertCustomer(storeId, name, phone, debt);
                Toast.makeText(this, "تم إضافة العميل", Toast.LENGTH_SHORT).show();
                loadCustomers();
            }
        });
        builder.setNegativeButton("إلغاء", null);
        builder.show();
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
