package com.grocery.pos;

import android.view.View;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import java.util.List;

public class OwnerStoresAdapter extends RecyclerView.Adapter<OwnerStoresAdapter.ViewHolder> {
    private List<?> list;
    private OnStoreActionListener listener;

    public interface OnStoreActionListener {
        void onStoreAction(Object item);
    }

    public OwnerStoresAdapter(List<?> list, OnStoreActionListener listener) {
        this.list = list;
        this.listener = listener;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        return new ViewHolder(new View(parent.getContext()));
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {}

    @Override
    public int getItemCount() {
        return list != null ? list.size() : 0;
    }

    public static class ViewHolder extends RecyclerView.ViewHolder {
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
        }
    }
}
