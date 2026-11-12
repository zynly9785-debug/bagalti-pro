package com.grocery.pos;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.Spinner;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;

public class AddProductActivity extends AppCompatActivity {

    private EditText etName, etBarcode, etCostPrice, etSalePrice, etQuantity;
    private Spinner spUnitType;
    private LinearLayout layoutCartonFields;
    private EditText etCartonPrice, etPiecesInCarton;
    private ImageView btnScanBarcode;
    private Button btnSaveProduct;

    private DatabaseHelper dbHelper;
    private int storeId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_add_product);

        dbHelper = new DatabaseHelper(this);
        SharedPreferences prefs = getSharedPreferences("GroceryPrefs", Context.MODE_PRIVATE);
        storeId = prefs.getInt("store_id", -1);

        etName = findViewById(R.id.etName);
        etBarcode = findViewById(R.id.etBarcode);
        etCostPrice = findViewById(R.id.etCostPrice);
        etSalePrice = findViewById(R.id.etSalePrice);
        etQuantity = findViewById(R.id.etQuantity);
        spUnitType = findViewById(R.id.spUnitType);
        layoutCartonFields = findViewById(R.id.layoutCartonFields);
        etCartonPrice = findViewById(R.id.etCartonPrice);
        etPiecesInCarton = findViewById(R.id.etPiecesInCarton);
        btnScanBarcode = findViewById(R.id.btnScanBarcode);
        btnSaveProduct = findViewById(R.id.btnSaveProduct);

        setupUnitSpinner();

        btnScanBarcode.setOnClickListener(v -> {
            IntentIntegrator integrator = new IntentIntegrator(AddProductActivity.this);
            integrator.setPrompt("مسح باركود المنتج");
            integrator.setBeepEnabled(true);
            integrator.initiateScan();
        });

        btnSaveProduct.setOnClickListener(v -> saveProduct());
    }

    private void setupUnitSpinner() {
        String[] units = {"قطعة", "كرتون", "كيلو"};
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, units);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spUnitType.setAdapter(adapter);

        spUnitType.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                String selected = units[position];
                if ("كرتون".equals(selected)) {
                    layoutCartonFields.setVisibility(View.VISIBLE);
                } else {
                    layoutCartonFields.setVisibility(View.GONE);
                }
            }
            @Override
            public void onNothingSelected(AdapterView<?> parent) {}
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
        if (result != null && result.getContents() != null) {
            etBarcode.setText(result.getContents());
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    private void saveProduct() {
        String name = etName.getText().toString().trim();
        String barcode = etBarcode.getText().toString().trim();
        String unitType = spUnitType.getSelectedItem().toString();
        String costStr = etCostPrice.getText().toString().trim();
        String saleStr = etSalePrice.getText().toString().trim();
        String qtyStr = etQuantity.getText().toString().trim();

        if (name.isEmpty() || saleStr.isEmpty() || qtyStr.isEmpty()) {
            Toast.makeText(this, "يرجى تعبئة الحقول الأساسية: الاسم، سعر البيع، الكمية", Toast.LENGTH_SHORT).show();
            return;
        }

        final double costPriceInput, salePrice, quantity;
        try {
            costPriceInput = costStr.isEmpty() ? 0 : Double.parseDouble(costStr);
            salePrice = Double.parseDouble(saleStr);
            quantity = Double.parseDouble(qtyStr);
        } catch (NumberFormatException e) {
            Toast.makeText(this, "أدخل أسعاراً وكميات رقمية صحيحة", Toast.LENGTH_LONG).show(); return;
        }
        if (Double.isNaN(costPriceInput) || Double.isInfinite(costPriceInput) || costPriceInput < 0 ||
                Double.isNaN(salePrice) || Double.isInfinite(salePrice) || salePrice < 0 ||
                Double.isNaN(quantity) || Double.isInfinite(quantity) || quantity < 0) {
            Toast.makeText(this, "الأسعار والكميات يجب أن تكون قيمًا غير سالبة", Toast.LENGTH_LONG).show(); return;
        }
        double costPrice = costPriceInput;
        if ("كرتون".equals(unitType)) {
            String cartonPriceStr = etCartonPrice.getText().toString().trim();
            String piecesStr = etPiecesInCarton.getText().toString().trim();
            if (cartonPriceStr.isEmpty() || piecesStr.isEmpty()) {
                Toast.makeText(this, "أدخل سعر الكرتون وعدد القطع فيه", Toast.LENGTH_LONG).show(); return;
            }
            try {
                double cartonPrice = Double.parseDouble(cartonPriceStr);
                double piecesCount = Double.parseDouble(piecesStr);
                if (cartonPrice < 0 || piecesCount <= 0 || Double.isNaN(cartonPrice) || Double.isInfinite(cartonPrice) || Double.isNaN(piecesCount) || Double.isInfinite(piecesCount)) {
                    Toast.makeText(this, "سعر الكرتون وعدد القطع غير صالحين", Toast.LENGTH_LONG).show(); return;
                }
                costPrice = cartonPrice / piecesCount;
            } catch (NumberFormatException e) { Toast.makeText(this, "بيانات الكرتون غير صحيحة", Toast.LENGTH_LONG).show(); return; }
        }
        if (storeId <= 0) { Toast.makeText(this, "تعذر تحديد المتجر الحالي. سجّل الدخول مجدداً.", Toast.LENGTH_LONG).show(); return; }
        if (!barcode.isEmpty()) {
            android.database.Cursor existing = null;
            try {
                existing = dbHelper.getReadableDatabase().rawQuery("SELECT id FROM " + DatabaseHelper.TABLE_PRODUCTS + " WHERE store_id = ? AND barcode = ? AND is_active = 1 LIMIT 1", new String[]{String.valueOf(storeId), barcode});
                if (existing.moveToFirst()) { Toast.makeText(this, "هذا الباركود مسجل لصنف آخر في متجرك", Toast.LENGTH_LONG).show(); return; }
            } finally { if (existing != null) existing.close(); }
        }

        long res = dbHelper.insertProduct(storeId, name, barcode, unitType, costPrice, salePrice, quantity, 5);
        if (res > 0) {
            Toast.makeText(this, "تم إضافة المنتج بنجاح!", Toast.LENGTH_SHORT).show();
            finish();
        } else {
            Toast.makeText(this, "فشل حفظ المنتج", Toast.LENGTH_SHORT).show();
        }
    }
}
