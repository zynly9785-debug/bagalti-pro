package com.grocery.pos;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import androidx.appcompat.app.AppCompatActivity;

public class DashboardActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_dashboard); // هذا السطر هو الأساس لإظهار كافة الأزرار والحقول في الشاشة

        findViewById(R.id.btnExpenses).setOnClickListener(v ->
                startActivity(new Intent(DashboardActivity.this, ExpensesActivity.class)));
    }
}
