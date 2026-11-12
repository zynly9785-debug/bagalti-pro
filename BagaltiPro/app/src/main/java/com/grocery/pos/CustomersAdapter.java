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

public class CustomersAdapter extends RecyclerView.Adapter<CustomersAdapter.Holder> {
    public interface OnCustomerClickListener {
        void onRepay(CustomersActivity.CustomerModel customer);
        void onStatement(CustomersActivity.CustomerModel customer);
        void onReturn(CustomersActivity.CustomerModel customer);
    }
    private final List<CustomersActivity.CustomerModel> items;
    private final OnCustomerClickListener listener;
    public CustomersAdapter(List<CustomersActivity.CustomerModel> items, OnCustomerClickListener listener) { this.items = items; this.listener = listener; }
    @Override public Holder onCreateViewHolder(ViewGroup parent, int type) {
        LinearLayout root = new LinearLayout(parent.getContext()); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(16, 12, 16, 12); root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL); root.setBackgroundColor(0xFFFFFFFF); return new Holder(root);
    }
    @Override public void onBindViewHolder(Holder h, int position) {
        CustomersActivity.CustomerModel c = items.get(position);
        h.name.setText(c.name); h.details.setText("الهاتف: " + (c.phone == null || c.phone.trim().isEmpty() ? "غير مسجل" : c.phone) + "\nالرصيد المستحق: " + String.format(Locale.getDefault(), "%,.2f ر.ي", c.totalDebt));
        h.statement.setOnClickListener(v -> listener.onStatement(c)); h.repay.setOnClickListener(v -> listener.onRepay(c)); h.returns.setOnClickListener(v -> listener.onReturn(c));
    }
    @Override public int getItemCount() { return items.size(); }
    static class Holder extends RecyclerView.ViewHolder {
        TextView name, details; Button statement, repay, returns;
        Holder(LinearLayout root) { super(root); name = new TextView(root.getContext()); name.setTextSize(18); name.setTextColor(0xFF0B3D2E); root.addView(name); details = new TextView(root.getContext()); details.setPadding(0, 5, 0, 8); root.addView(details); LinearLayout actions = new LinearLayout(root.getContext()); actions.setGravity(Gravity.END); statement = new Button(root.getContext()); statement.setText("كشف الحساب"); repay = new Button(root.getContext()); repay.setText("سداد"); returns = new Button(root.getContext()); returns.setText("مرتجع"); actions.addView(statement); actions.addView(repay); actions.addView(returns); root.addView(actions); }
    }
}
