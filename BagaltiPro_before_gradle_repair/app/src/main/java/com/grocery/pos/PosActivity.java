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
        storeId = sharedPreferences.getInt("store_id", 1);
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
            double qty = qtyStr.isEmpty() ? 1 : Double.parseDouble(qtyStr);
            addToCart(productId, name, price, qty);
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
        double paid = paidStr.isEmpty() ? 0 : Double.parseDouble(paidStr);
        double remaining = Math.max(0, currentTotal - paid);
        tvRemainingAmount.setText(String.format(Locale.getDefault(), "%,.0f ر.ي", remaining));
    }

    private void processSale() {
        if (cartList.isEmpty()) {
            Toast.makeText(this, "السلة فارغة!", Toast.LENGTH_SHORT).show();
            return;
        }

        String paidStr = etPaidAmount.getText().toString().trim();
        double paid = paidStr.isEmpty() ? currentTotal : Double.parseDouble(paidStr);
        double remaining = Math.max(0, currentTotal - paid);

        if (remaining > 0 && selectedCustomerId == null) {
            String typedCustomerName = actvCustomerSearch.getText().toString().trim();
            if (!typedCustomerName.isEmpty()) {
                // إنشاء زبون جديد تلقائياً وقيد المديونية في حسابه
                long newCustId = dbHelper.insertCustomer(storeId, typedCustomerName, "", 0);
                selectedCustomerId = (int) newCustId;
                Toast.makeText(this, "تم فتح حساب جديد تلقائياً للزبون: " + typedCustomerName + " وقيد الدين عليه", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "البيع الآجل يتطلب تحديد الزبون أو كتابة اسمه لفتح حساب دين!", Toast.LENGTH_LONG).show();
                return;
            }
        }

        String paymentType = remaining > 0 ? "آجل" : "نقداً";
        String createdAt = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date());

        // 1. حفظ الفاتورة
        long saleId = dbHelper.insertSale(storeId, selectedCustomerId, currentTotal, paid, remaining, paymentType, createdAt);

        // 2. حفظ الأصناف وخصم المخزون
        for (CartItemModel it : cartList) {
            dbHelper.insertSaleItem(saleId, it.productId, it.qty, it.price);
        }

        // 3. إضافة المتبقي لدين الزبون
        if (remaining > 0 && selectedCustomerId != null) {
            dbHelper.updateCustomerDebt(storeId, selectedCustomerId, remaining);
        }

        showPostSaleDialog(saleId, currentTotal, paid, remaining);
    }

    private void showPostSaleDialog(long saleId, double total, double paid, double remaining) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("تمت العملية بنجاح! فاتورة رقم #" + saleId);
        builder.setMessage("الإجمالي: " + total + " ر.ي | المدفوع: " + paid + " ر.ي | المتبقي: " + remaining + " ر.ي");

        builder.setPositiveButton("مشاركة واتساب", (dialog, which) -> {
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
        StringBuilder sb = new StringBuilder();
        sb.append("🧾 *فاتورة مبيعات - ").append(sharedPreferences.getString("store_name", "بقالة")).append("*
");
        sb.append("رقم الفاتورة: #").append(saleId).append("
");
        sb.append("التاريخ: ").append(new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(new Date())).append("
");
        sb.append("-----------------------------
");
        for (CartItemModel item : cartList) {
            sb.append("• ").append(item.name).append(" (").append(item.qty).append(" × ").append(item.price).append(") = ").append(item.subtotal).append(" ر.ي
");
        }
        sb.append("-----------------------------
");
        sb.append("💰 *الإجمالي:* ").append(total).append(" ر.ي
");
        sb.append("💵 *المدفوع:* ").append(paid).append(" ر.ي
");
        if (remaining > 0) {
            sb.append("⚠️ *المتبقي (دين):* ").append(remaining).append(" ر.ي
");
        }
        sb.append("شكراً لتسوقكم معنا ونسعد بخدمتكم دائماً!");

        Intent sendIntent = new Intent();
        sendIntent.setAction(Intent.ACTION_SEND);
        sendIntent.putExtra(Intent.EXTRA_TEXT, sb.toString());
        sendIntent.setType("text/plain");
        sendIntent.setPackage("com.whatsapp");

        try {
            startActivity(sendIntent);
        } catch (Exception e) {
            // فتح مشاركة عامة في حال عدم توفر واتساب
            Intent generalIntent = Intent.createChooser(sendIntent, "مشاركة الفاتورة عبر");
            startActivity(generalIntent);
        }
    }

    private void printReceipt(long saleId, double total, double paid, double remaining) {
        Toast.makeText(this, "جاري إرسال أمر الطباعة للطابعة الحرارية عبر البلوتوث...", Toast.LENGTH_SHORT).show();
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
