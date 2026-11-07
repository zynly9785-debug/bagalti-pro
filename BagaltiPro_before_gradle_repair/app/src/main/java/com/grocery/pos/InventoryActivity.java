package com.grocery.pos;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.EditText;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.floatingactionbutton.FloatingActionButton;

import java.util.ArrayList;
import java.util.List;

public class InventoryActivity extends AppCompatActivity {

    private RecyclerView rvProducts;
    private FloatingActionButton fabAddProduct;
    private DatabaseHelper dbHelper;
    private int storeId;
    private ProductsAdapter adapter;
    private final List<ProductModel> productList = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_inventory);

        dbHelper = new DatabaseHelper(this);
        SharedPreferences prefs = getSharedPreferences("GroceryPrefs", Context.MODE_PRIVATE);
        storeId = prefs.getInt("store_id", 1);

        rvProducts = findViewById(R.id.rvProducts);
        fabAddProduct = findViewById(R.id.fabAddProduct);

        rvProducts.setLayoutManager(new LinearLayoutManager(this));
        adapter = new ProductsAdapter(productList, new ProductsAdapter.OnProductActionListener() {
            @Override
            public void onEdit(ProductModel product) {
                showEditDialog(product);
            }

            @Override
            public void onDelete(ProductModel product) {
                confirmDelete(product);
            }
        });
        rvProducts.setAdapter(adapter);

        fabAddProduct.setOnClickListener(v -> {
            startActivity(new Intent(InventoryActivity.this, AddProductActivity.class));
        });

        loadProducts();
    }

    @Override
    protected void onResume() {
        super.onResume();
        loadProducts();
    }

    private void loadProducts() {
        productList.clear();
        Cursor c = dbHelper.getActiveProducts(storeId);
        if (c != null) {
            while (c.moveToNext()) {
                int id = c.getInt(c.getColumnIndexOrThrow("id"));
                String name = c.getString(c.getColumnIndexOrThrow("name"));
                String barcode = c.getString(c.getColumnIndexOrThrow("barcode"));
                String unit = c.getString(c.getColumnIndexOrThrow("unit_type"));
                double cost = c.getDouble(c.getColumnIndexOrThrow("cost_price"));
                double sale = c.getDouble(c.getColumnIndexOrThrow("sale_price"));
                double qty = c.getDouble(c.getColumnIndexOrThrow("quantity"));
                productList.add(new ProductModel(id, name, barcode, unit, cost, sale, qty));
            }
            c.close();
        }
        adapter.notifyDataSetChanged();
    }

    private void showEditDialog(ProductModel product) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("تعديل: " + product.name);

        View v = LayoutInflater.from(this).inflate(R.layout.dialog_edit_product, null);
        EditText etSale = v.findViewById(R.id.etEditSalePrice);
        EditText etCost = v.findViewById(R.id.etEditCostPrice);
        EditText etQty = v.findViewById(R.id.etEditQuantity);

        etSale.setText(String.valueOf(product.salePrice));
        etCost.setText(String.valueOf(product.costPrice));
        etQty.setText(String.valueOf(product.quantity));

        builder.setView(v);
        builder.setPositiveButton("تحديث", (dialog, which) -> {
            double sale = Double.parseDouble(etSale.getText().toString());
            double cost = Double.parseDouble(etCost.getText().toString());
            double qty = Double.parseDouble(etQty.getText().toString());

            dbHelper.updateProduct(storeId, product.id, sale, cost, qty);
            Toast.makeText(this, "تم تحديث بيانات الصنف", Toast.LENGTH_SHORT).show();
            loadProducts();
        });
        builder.setNegativeButton("إلغاء", null);
        builder.show();
    }

    private void confirmDelete(ProductModel product) {
        new AlertDialog.Builder(this)
                .setTitle("حذف الصنف")
                .setMessage("هل أنت متأكد من حذف الصنف '" + product.name + "'؟")
                .setPositiveButton("نعم (حذف)", (dialog, which) -> {
                    // حذف ناعم عبر تعيين is_active = 0
                    dbHelper.softDeleteProduct(storeId, product.id);
                    Toast.makeText(this, "تم نقل الصنف إلى المحذوفات", Toast.LENGTH_SHORT).show();
                    loadProducts();
                })
                .setNegativeButton("إلغاء", null)
                .show();
    }

    public static class ProductModel {
        public int id;
        public String name;
        public String barcode;
        public String unit;
        public double costPrice;
        public double salePrice;
        public double quantity;

        public ProductModel(int id, String name, String barcode, String unit, double costPrice, double salePrice, double quantity) {
            this.id = id;
            this.name = name;
            this.barcode = barcode;
            this.unit = unit;
            this.costPrice = costPrice;
            this.salePrice = salePrice;
            this.quantity = quantity;
        }
    }
}
