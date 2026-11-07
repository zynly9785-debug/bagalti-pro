<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.bagalti.pro">

    <uses-permission android:name="android.permission.CAMERA"/>
    <uses-permission android:name="android.permission.USE_BIOMETRIC"/>
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>

    <application
        android:allowBackup="true"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@style/Theme.AppCompat.Light.DarkActionBar">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>

        <activity android:name=".LoginActivity" android:exported="true"/>
        <activity android:name=".RegisterActivity" android:exported="true"/>
        <activity android:name=".DashboardActivity" android:exported="true"/>
        <activity android:name=".PosActivity" android:exported="true"/>
        <activity android:name=".InventoryActivity" android:exported="true"/>
        <activity android:name=".AddProductActivity" android:exported="true"/>
        <activity android:name=".CustomersActivity" android:exported="true"/>
        <activity android:name=".StatementActivity" android:exported="true"/>
        <activity android:name=".ReturnsActivity" android:exported="true"/>
        <activity android:name=".SettingsActivity" android:exported="true"/>
        <activity android:name=".OwnerActivity" android:exported="true"/>

    </application>

</manifest>
