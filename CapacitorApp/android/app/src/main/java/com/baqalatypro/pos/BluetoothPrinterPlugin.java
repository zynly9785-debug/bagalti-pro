package com.baqalatypro.pos;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@CapacitorPlugin(
    name = "BluetoothPrinter",
    permissions = {
        @Permission(alias = "bluetoothConnect", strings = { Manifest.permission.BLUETOOTH_CONNECT })
    }
)
public class BluetoothPrinterPlugin extends Plugin {
    private static final UUID SERIAL_PORT_PROFILE = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private volatile BluetoothSocket socket;

    @PluginMethod
    public void openBluetoothSettings(PluginCall call) {
        try {
            getActivity().startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS));
            call.resolve();
        } catch (Exception error) {
            call.reject("تعذر فتح إعدادات البلوتوث.", error);
        }
    }

    @PluginMethod
    public void listPairedDevices(PluginCall call) {
        if (requiresConnectPermission() && getPermissionState("bluetoothConnect") != PermissionState.GRANTED) {
            requestPermissionForAlias("bluetoothConnect", call, "listPermissionCallback");
            return;
        }
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                call.reject("هذا الجهاز لا يحتوي على بلوتوث.");
                return;
            }
            if (!adapter.isEnabled()) {
                call.reject("فعّل البلوتوث من إعدادات الجهاز ثم أعد البحث.");
                return;
            }
            JSArray devices = new JSArray();
            for (BluetoothDevice device : adapter.getBondedDevices()) {
                JSObject item = new JSObject();
                item.put("name", device.getName() == null ? "طابعة Bluetooth" : device.getName());
                item.put("address", device.getAddress());
                devices.put(item);
            }
            JSObject result = new JSObject();
            result.put("devices", devices);
            call.resolve(result);
        } catch (SecurityException error) {
            call.reject("يجب السماح للتطبيق بالوصول إلى أجهزة البلوتوث.", error);
        } catch (Exception error) {
            call.reject("تعذر البحث عن الأجهزة المقترنة.", error);
        }
    }

    @PermissionCallback
    private void listPermissionCallback(PluginCall call) {
        if (getPermissionState("bluetoothConnect") != PermissionState.GRANTED) {
            call.reject("لم يتم السماح بالوصول إلى أجهزة البلوتوث.");
            return;
        }
        listPairedDevices(call);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (requiresConnectPermission() && getPermissionState("bluetoothConnect") != PermissionState.GRANTED) {
            requestPermissionForAlias("bluetoothConnect", call, "connectPermissionCallback");
            return;
        }
        String address = call.getString("address");
        if (address == null || address.trim().isEmpty()) {
            call.reject("اختر طابعة مقترنة أولاً.");
            return;
        }
        new Thread(() -> {
            BluetoothSocket nextSocket = null;
            try {
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null || !adapter.isEnabled()) throw new IOException("فعّل البلوتوث من إعدادات الجهاز.");
                BluetoothDevice device = adapter.getRemoteDevice(address);
                nextSocket = device.createRfcommSocketToServiceRecord(SERIAL_PORT_PROFILE);
                nextSocket.connect();
                disconnectCurrentSocket();
                socket = nextSocket;
                JSObject result = new JSObject();
                result.put("name", device.getName() == null ? "طابعة Bluetooth" : device.getName());
                result.put("address", device.getAddress());
                call.resolve(result);
            } catch (Exception error) {
                if (nextSocket != null) {
                    try { nextSocket.close(); } catch (IOException ignored) { }
                }
                call.reject("تعذر الاتصال بالطابعة. تأكد من اقترانها وأنها تدعم Bluetooth SPP.", error);
            }
        }).start();
    }

    @PermissionCallback
    private void connectPermissionCallback(PluginCall call) {
        if (getPermissionState("bluetoothConnect") != PermissionState.GRANTED) {
            call.reject("لم يتم السماح بالوصول إلى أجهزة البلوتوث.");
            return;
        }
        connect(call);
    }

    @PluginMethod
    public void print(PluginCall call) {
        if (requiresConnectPermission() && getPermissionState("bluetoothConnect") != PermissionState.GRANTED) {
            requestPermissionForAlias("bluetoothConnect", call, "printPermissionCallback");
            return;
        }
        String text = call.getString("text");
        BluetoothSocket activeSocket = socket;
        if (text == null || activeSocket == null || !activeSocket.isConnected()) {
            call.reject("الطابعة غير متصلة. أعد اقترانها من الإعدادات.");
            return;
        }
        new Thread(() -> {
            try {
                OutputStream output = activeSocket.getOutputStream();
                output.write(new byte[] { 0x1B, 0x40 });
                output.write(text.getBytes(StandardCharsets.UTF_8));
                output.write(new byte[] { 0x0A, 0x0A, 0x0A });
                output.flush();
                call.resolve();
            } catch (Exception error) {
                call.reject("تعذرت طباعة الإيصال عبر البلوتوث.", error);
            }
        }).start();
    }

    @PermissionCallback
    private void printPermissionCallback(PluginCall call) {
        if (getPermissionState("bluetoothConnect") != PermissionState.GRANTED) {
            call.reject("لم يتم السماح بالوصول إلى أجهزة البلوتوث.");
            return;
        }
        print(call);
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        try {
            disconnectCurrentSocket();
            call.resolve();
        } catch (IOException error) {
            call.reject("تعذر إغلاق اتصال الطابعة.", error);
        }
    }

    private boolean requiresConnectPermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S;
    }

    private void disconnectCurrentSocket() throws IOException {
        BluetoothSocket current = socket;
        socket = null;
        if (current != null) current.close();
    }
}
