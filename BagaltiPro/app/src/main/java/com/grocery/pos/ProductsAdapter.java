package com.grocery.pos;

import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.recyclerview.widget.RecyclerView;
import java.util.List;
import java.util.Locale;

public class ProductsAdapter extends RecyclerView.Adapter<ProductsAdapter.Holder> {
    public interface OnProductActionListener { void onEdit(InventoryActivity.ProductModel product); void onDelete(InventoryActivity.ProductModel product); }
    private final List<InventoryActivity.ProductModel> items;
    private final OnProductActionListener listener;
    public ProductsAdapter(List<InventoryActivity.ProductModel> items, OnProductActionListener listener) { this.items = items; this.listener = listener; }
    @Override public Holder onCreateViewHolder(ViewGroup parent, int type) {
        LinearLayout box = new LinearLayout(parent.getContext()); box.setOrientation(LinearLayout.VERTICAL); box.setPadding(18, 14, 18, 14); box.setLayoutDirection(View.LAYOUT_DIRECTION_RTL); box.setBackgroundColor(0xFFFFFFFF);
        return new Holder(box);
    }
    @Override public void onBindViewHolder(Holder h, int position) {
        InventoryActivity.ProductModel p = items.get(position);
        h.title.setText(p.name + (p.barcode == null || p.barcode.isEmpty() ? "" : "  •  " + p.barcode));
        h.details.setText("الكمية: " + fmt(p.quantity) + " " + p.unit + "\nسعر البيع: " + fmt(p.salePrice) + " ر.ي\nالتكلفة: " + fmt(p.costPrice) + " ر.ي");
        h.edit.setOnClickListener(v -> listener.onEdit(p)); h.delete.setOnClickListener(v -> listener.onDelete(p));
    }
    @Override public int getItemCount() { return items.size(); }
    private String fmt(double x) { return String.format(Locale.getDefault(), "%,.2f", x); }
    static class Holder extends RecyclerView.ViewHolder {
        TextView title, details; Button edit, delete;
        Holder(LinearLayout root) { super(root); title = new TextView(root.getContext()); title.setTextSize(18); title.setTextColor(0xFF0B3D2E); root.addView(title); details = new TextView(root.getContext()); details.setPadding(0, 6, 0, 8); root.addView(details); LinearLayout actions = new LinearLayout(root.getContext()); actions.setGravity(Gravity.END); edit = new Button(root.getContext()); edit.setText("تعديل"); delete = new Button(root.getContext()); delete.setText("حذف"); actions.addView(edit); actions.addView(delete); root.addView(actions); }
    }
}
