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

        // يمكنك هنا إضافة تفاعلات الأزرار للانتقال لشاشات المخزن أو العملاء أو نقاط البيع عند الحاجة
    }
}
