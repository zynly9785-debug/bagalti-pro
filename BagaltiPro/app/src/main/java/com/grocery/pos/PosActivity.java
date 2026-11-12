package com.grocery.pos;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class PosActivity extends AppCompatActivity {

    private AutoCompleteTextView actvProductSearch, actvCustomerSearch;
    private ImageView imgBarcodeScanner;
    private RecyclerView rvCart;
    private TextView tvTotalAmount, tvRemainingAmount;
    private EditText etPaidAmount;
    private Button btnCompleteSale;

    private DatabaseHelper dbHelper;
    private SharedPreferences sharedPreferences;
    private int storeId;
    private boolean isSuspended = false;

    private final List<CartItemModel> cartList = new ArrayList<>();
    private CartAdapter cartAdapter;
    private Integer selectedCustomerId = null;
    private double currentTotal = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_pos);

        dbHelper = new DatabaseHelper(this);
        sharedPreferences = getSharedPreferences("GroceryPrefs", Context.MODE_PRIVATE);
        storeId = sharedPreferences.getInt("store_id", -1);
        isSuspended = getIntent().getBooleanExtra("isSuspended", false);

        actvProductSearch = findViewById(R.id.actvProductSearch);
        actvCustomerSearch = findViewById(R.id.actvCustomerSearch);
        imgBarcodeScanner = findViewById(R.id.imgBarcodeScanner);
        rvCart = findViewById(R.id.rvCart);
        tvTotalAmount = findViewById(R.id.tvTotalAmount);
        tvRemainingAmount = findViewById(R.id.tvRemainingAmount);
        etPaidAmount = findViewById(R.id.etPaidAmount);
        btnCompleteSale = findViewById(R.id.btnCompleteSale);

        rvCart.setLayoutManager(new LinearLayoutManager(this));
        cartAdapter = new CartAdapter(cartList, this::onCartItemChanged);
        rvCart.setAdapter(cartAdapter);

        setupProductSearch();
        setupCustomerSearch();

        // زر الماسح الضوئي (ZXing)
        imgBarcodeScanner.setOnClickListener(v -> {
            IntentIntegrator integrator = new IntentIntegrator(PosActivity.this);
            integrator.setPrompt("وجّه الكاميرا نحو باركود الصنف");
            integrator.setBeepEnabled(true);
            integrator.setOrientationLocked(false);
            integrator.initiateScan();
        });

        // حساب المتبقي تلقائياً عند كتابة المدفوع
        etPaidAmount.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                calculateRemaining();
            }
            @Override
            public void afterTextChanged(Editable s) {}
        });

        // زر إتمام البيع مع فحص الإيقاف
        btnCompleteSale.setOnClickListener(v -> {
            if (isSuspended) {
                Toast.makeText(this, "حسابك موقوف! لا يمكنك إجراء عمليات بيع جديدة.", Toast.LENGTH_LONG).show();
                return;
            }
            processSale();
        });
    }

    private void setupProductSearch() {
        actvProductSearch.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                if (s.length() >= 2) {
                    loadProductSuggestions(s.toString());
                }
            }
            @Override
            public void afterTextChanged(Editable s) {}
        });
    }

    private void loadProductSuggestions(String query) {
        Cursor c = dbHelper.searchProducts(storeId, query);
        List<ProductSuggestion> suggestions = new ArrayList<>();
        if (c != null) {
            while (c.moveToNext()) {
                int id = c.getInt(c.getColumnIndexOrThrow("id"));
                String name = c.getString(c.getColumnIndexOrThrow("name"));
                String barcode = c.getString(c.getColumnIndexOrThrow("barcode"));
                double price = c.getDouble(c.getColumnIndexOrThrow("sale_price"));
                double qty = c.getDouble(c.getColumnIndexOrThrow("quantity"));
                suggestions.add(new ProductSuggestion(id, name, barcode, price, qty));
            }
            c.close();
        }

        ArrayAdapter<ProductSuggestion> adapter = new ArrayAdapter<>(this,
                android.R.layout.simple_dropdown_item_1line, suggestions);
        actvProductSearch.setAdapter(adapter);
        actvProductSearch.setOnItemClickListener((parent, view, position, id) -> {
            ProductSuggestion selected = adapter.getItem(position);
            if (selected != null) {
                actvProductSearch.setText("");
                showQuantityDialog(selected.id, selected.name, selected.price, selected.availableQty);
            }
        });
    }

    private void setupCustomerSearch() {
        Cursor c = dbHelper.getCustomers(storeId);
        List<CustomerSuggestion> custList = new ArrayList<>();
        if (c != null) {
            while (c.moveToNext()) {
                int id = c.getInt(c.getColumnIndexOrThrow("id"));
                String name = c.getString(c.getColumnIndexOrThrow("name"));
                String phone = c.getString(c.getColumnIndexOrThrow("phone"));
                custList.add(new CustomerSuggestion(id, name, phone));
            }
            c.close();
        }

        ArrayAdapter<CustomerSuggestion> adapter = new ArrayAdapter<>(this,
                android.R.layout.simple_dropdown_item_1line, custList);
        actvCustomerSearch.setAdapter(adapter);
        actvCustomerSearch.setOnItemClickListener((parent, view, position, id) -> {
            CustomerSuggestion cust = adapter.getItem(position);
            if (cust != null) {
                selectedCustomerId = cust.id;
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
        if (result != null && result.getContents() != null) {
            String scannedBarcode = result.getContents();
            Cursor c = dbHelper.getProductByBarcode(storeId, scannedBarcode);
            if (c != null && c.moveToFirst()) {
                int pId = c.getInt(c.getColumnIndexOrThrow("id"));
                String name = c.getString(c.getColumnIndexOrThrow("name"));
                double price = c.getDouble(c.getColumnIndexOrThrow("sale_price"));
                double available = c.getDouble(c.getColumnIndexOrThrow("quantity"));
                c.close();
                showQuantityDialog(pId, name, price, available);
            } else {
                if (c != null) c.close();
                Toast.makeText(this, "لم يتم العثور على منتج بهذا الباركود: " + scannedBarcode, Toast.LENGTH_SHORT).show();
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    private void showQuantityDialog(int productId, String name, double price, double available) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle(name);
        builder.setMessage("السعر: " + price + " ر.ي | المتوفر: " + available);

        final EditText etQty = new EditText(this);
        etQty.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);
        etQty.setText("1");
        builder.setView(etQty);

        builder.setPositiveButton("إضافة للسلة", (dialog, which) -> {
            String qtyStr = etQty.getText().toString().trim();
            try {
                double qty = qtyStr.isEmpty() ? 1 : Double.parseDouble(qtyStr);
                if (Double.isNaN(qty) || Double.isInfinite(qty) || qty <= 0) {
                    etQty.setError("أدخل كمية أكبر من صفر");
                    return;
                }
                addToCart(productId, name, price, qty);
            } catch (NumberFormatException e) {
                etQty.setError("صيغة الكمية غير صحيحة");
            }
        });

        builder.setNegativeButton("إلغاء", null);
        builder.show();
    }

    private void addToCart(int productId, String name, double price, double qty) {
        for (CartItemModel item : cartList) {
            if (item.productId == productId) {
                item.qty += qty;
                item.subtotal = item.qty * item.price;
                cartAdapter.notifyDataSetChanged();
                calculateTotal();
                return;
            }
        }
        cartList.add(new CartItemModel(productId, name, price, qty, price * qty));
        cartAdapter.notifyDataSetChanged();
        calculateTotal();
    }

    private void onCartItemChanged() {
        calculateTotal();
    }

    private void calculateTotal() {
        currentTotal = 0;
        for (CartItemModel item : cartList) {
            currentTotal += item.subtotal;
        }
        tvTotalAmount.setText(String.format(Locale.getDefault(), "%,.0f ر.ي", currentTotal));
        calculateRemaining();
    }

    private void calculateRemaining() {
        String paidStr = etPaidAmount.getText().toString().trim();
        try {
            double paid = paidStr.isEmpty() ? 0 : Double.parseDouble(paidStr);
            if (paid < 0 || Double.isNaN(paid) || Double.isInfinite(paid)) paid = 0;
            double remaining = Math.max(0, currentTotal - paid);
            tvRemainingAmount.setText(String.format(Locale.getDefault(), "%,.0f ر.ي", remaining));
        } catch (NumberFormatException e) {
            tvRemainingAmount.setText("تحقق من المبلغ المدفوع");
        }
    }

    private void processSale() {
        if (cartList.isEmpty()) {
            Toast.makeText(this, "السلة فارغة!", Toast.LENGTH_SHORT).show();
            return;
        }
        final double paid;
        try {
            String paidStr = etPaidAmount.getText().toString().trim();
            paid = paidStr.isEmpty() ? currentTotal : Double.parseDouble(paidStr);
        } catch (NumberFormatException e) {
            etPaidAmount.setError("أدخل مبلغاً صحيحاً");
            return;
        }
        if (Double.isNaN(paid) || Double.isInfinite(paid) || paid < 0 || paid > currentTotal) {
            etPaidAmount.setError("يجب أن يكون المدفوع بين صفر وإجمالي الفاتورة");
            return;
        }
        double remaining = currentTotal - paid;
        if (remaining > 0 && selectedCustomerId == null) {
            String typedCustomerName = actvCustomerSearch.getText().toString().trim();
            if (typedCustomerName.isEmpty()) {
                Toast.makeText(this, "البيع الآجل يتطلب تحديد العميل أو كتابة اسمه", Toast.LENGTH_LONG).show();
                return;
            }
            long newCustId = dbHelper.insertCustomer(storeId, typedCustomerName, "", 0);
            if (newCustId <= 0) {
                Toast.makeText(this, "تعذر إنشاء حساب العميل؛ لم يتم حفظ البيع", Toast.LENGTH_LONG).show();
                return;
            }
            selectedCustomerId = (int) newCustId;
        }
        String paymentType = remaining > 0 ? "آجل" : "نقداً";
        String createdAt = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date());
        long saleId = dbHelper.createSaleWithItems(storeId, selectedCustomerId, currentTotal, paid,
                remaining, paymentType, createdAt, cartList);
        if (saleId <= 0) {
            Toast.makeText(this, "لم تُحفظ الفاتورة. تحقق من الكميات المتوفرة وحاول مجدداً.", Toast.LENGTH_LONG).show();
            return;
        }
        showPostSaleDialog(saleId, currentTotal, paid, remaining);
    }

    private void showPostSaleDialog(long saleId, double total, double paid, double remaining) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("تمت العملية بنجاح! فاتورة رقم #" + saleId);
        builder.setMessage("الإجمالي: " + total + " ر.ي | المدفوع: " + paid + " ر.ي | المتبقي: " + remaining + " ر.ي");

        builder.setPositiveButton("مشاركة الفاتورة", (dialog, which) -> {
            shareInvoiceViaWhatsApp(saleId, total, paid, remaining);
            clearPos();
        });

        builder.setNeutralButton("طباعة", (dialog, which) -> {
            printReceipt(saleId, total, paid, remaining);
            clearPos();
        });

        builder.setNegativeButton("إغلاق", (dialog, which) -> clearPos());
        builder.setCancelable(false);
        builder.show();
    }

    private void shareInvoiceViaWhatsApp(long saleId, double total, double paid, double remaining) {
        StringBuilder text = new StringBuilder();
        text.append("فاتورة مبيعات - ").append(sharedPreferences.getString("store_name", "بقالة")).append('\n');
        text.append("رقم الفاتورة: #").append(saleId).append('\n');
        text.append("التاريخ: ").append(new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(new Date())).append('\n');
        text.append("-----------------------------\n");
        for (CartItemModel item : cartList) {
            text.append(item.name).append(" ( ").append(item.qty).append(" × ").append(item.price)
                    .append(" ) = ").append(item.subtotal).append(" ر.ي\n");
        }
        text.append("-----------------------------\n");
        text.append("الإجمالي: ").append(total).append(" ر.ي\n");
        text.append("المدفوع: ").append(paid).append(" ر.ي\n");
        text.append("المتبقي: ").append(remaining).append(" ر.ي\n");
        text.append("شكراً لتسوقكم معنا.");
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_SUBJECT, "فاتورة رقم #" + saleId);
        send.putExtra(Intent.EXTRA_TEXT, text.toString());
        startActivity(Intent.createChooser(send, "مشاركة الفاتورة عبر"));
    }

    private void printReceipt(long saleId, double total, double paid, double remaining) {
        Toast.makeText(this, "الطباعة المباشرة غير مهيأة في هذه النسخة. استخدم مشاركة الفاتورة إلى تطبيق الطباعة.", Toast.LENGTH_LONG).show();
    }

    private void clearPos() {
        cartList.clear();
        cartAdapter.notifyDataSetChanged();
        etPaidAmount.setText("");
        actvCustomerSearch.setText("");
        selectedCustomerId = null;
        calculateTotal();
    }

    public static class CartItemModel {
        public int productId;
        public String name;
        public double price;
        public double qty;
        public double subtotal;

        public CartItemModel(int productId, String name, double price, double qty, double subtotal) {
            this.productId = productId;
            this.name = name;
            this.price = price;
            this.qty = qty;
            this.subtotal = subtotal;
        }
    }

    public static class ProductSuggestion {
        public int id;
        public String name;
        public String barcode;
        public double price;
        public double availableQty;

        public ProductSuggestion(int id, String name, String barcode, double price, double availableQty) {
            this.id = id;
            this.name = name;
            this.barcode = barcode;
            this.price = price;
            this.availableQty = availableQty;
        }

        @Override
        public String toString() {
            return name + " (" + price + " ر.ي)";
        }
    }

    public static class CustomerSuggestion {
        public int id;
        public String name;
        public String phone;

        public CustomerSuggestion(int id, String name, String phone) {
            this.id = id;
            this.name = name;
            this.phone = phone;
        }

        @Override
        public String toString() {
            return name + (phone != null && !phone.isEmpty() ? " [" + phone + "]" : "");
        }
    }
}
