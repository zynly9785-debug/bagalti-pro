package com.grocery.pos;
import android.app.AlertDialog;
import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;

public class PosActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_pos);
        findViewById(R.id.btnClearPos).setOnClickListener(v -> clearPos());
    }
    public void clearPos() {
        new AlertDialog.Builder(this).setTitle("تأكيد").setMessage("هل تريد مسح الحالة؟")
            .setPositiveButton("نعم", (d, w) -> {}).setNegativeButton("إلغاء", (d, w) -> d.dismiss()).show();
    }
}
