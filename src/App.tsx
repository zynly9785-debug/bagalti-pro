/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import {
  Smartphone,
  Code2,
  Store,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  Share2,
  Sun,
  Moon,
} from 'lucide-react';
import { AndroidPhoneFrame } from './components/simulator/AndroidPhoneFrame.tsx';
import { OwnerSecretDialog } from './components/simulator/OwnerSecretDialog.tsx';
import { AndroidCodeInspector } from './components/code-inspector/AndroidCodeInspector.tsx';
import { PublishModal } from './components/PublishModal.tsx';
import { ThemeProvider, useTheme } from './context/ThemeContext.tsx';

// Screens
import { LoginScreen } from './components/simulator/screens/LoginScreen.tsx';
import { RegisterScreen } from './components/simulator/screens/RegisterScreen.tsx';
import { DashboardScreen } from './components/simulator/screens/DashboardScreen.tsx';
import { PosScreen } from './components/simulator/screens/PosScreen.tsx';
import { InventoryScreen } from './components/simulator/screens/InventoryScreen.tsx';
import { AddProductScreen } from './components/simulator/screens/AddProductScreen.tsx';
import { CustomersScreenAdvanced as CustomersScreen } from './components/simulator/screens/CustomersScreenAdvanced.tsx';
import { StatementScreen } from './components/simulator/screens/StatementScreen.tsx';
import { ReturnsScreen } from './components/simulator/screens/ReturnsScreen.tsx';
import { SettingsScreen, type SettingsSection } from './components/simulator/screens/SettingsScreen.tsx';
import { ReportsScreen } from './components/simulator/screens/ReportsScreen.tsx';
import { ExpensesScreen } from './components/simulator/screens/ExpensesScreen.tsx';
import { CloudOwnerScreen } from './components/simulator/screens/CloudOwnerScreen.tsx';
import { OwnerScreen } from './components/simulator/screens/OwnerScreen.tsx';

import { db } from './db/sqlite-simulation.ts';
import { startAutoSync } from './services/syncService.ts';
import { supabase } from './supabaseClient.ts';

function AppContent() {
  const { isDarkMode, toggleDarkMode, theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'simulator' | 'code'>('simulator');
  const [currentScreen, setCurrentScreen] = useState<string>('login');
  const [screenHistory, setScreenHistory] = useState<string[]>(['login']);
  const [screenParams, setScreenParams] = useState<Record<string, any>>({});

  const [activeStoreId, setActiveStoreId] = useState<number>(1);
  const [isOwnerDoorOpen, setIsOwnerDoorOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  const isNativeApp =
    Capacitor.isNativePlatform() ||
    (typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('native') === '1');

  useEffect(() => {
    const prefs = db.getSharedPreferences();
    if (prefs.store_id) {
      setActiveStoreId(prefs.store_id);
    }
  }, []);

  useEffect(() => {
    if (currentScreen === 'login' || currentScreen === 'owner') return;
    const minutes = db.getSharedPreferences().auto_lock_minutes || 5;
    let timer = window.setTimeout(() => {
      setScreenParams({});
      setScreenHistory(['login']);
      setCurrentScreen('login');
    }, minutes * 60 * 1000);
    const resetTimer = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setScreenParams({});
        setScreenHistory(['login']);
        setCurrentScreen('login');
      }, minutes * 60 * 1000);
    };
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [currentScreen]);

  useEffect(() => {
    if (currentScreen !== 'dashboard' || !db.getSharedPreferences().cloud_store_id) return;
    return startAutoSync();
  }, [currentScreen, activeStoreId]);

  const navigateTo = (screen: string, params: Record<string, any> = {}) => {
    const prefs = db.getSharedPreferences();
    if (prefs.store_id) {
      setActiveStoreId(prefs.store_id);
    }
    setScreenParams(params);
    setCurrentScreen(screen);
    setScreenHistory((prev) => [...prev, screen]);
  };

  const handleBack = useCallback(() => {
    setScreenHistory((prev) => {
      if (prev.length > 1) {
        const nextHistory = [...prev];
        nextHistory.pop();
        const prevScreen = nextHistory[nextHistory.length - 1];
        setCurrentScreen(prevScreen);
        return nextHistory;
      }
      if (isNativeApp && (currentScreen === 'login' || currentScreen === 'dashboard')) {
        CapApp.exitApp();
        return prev;
      }
      setCurrentScreen('dashboard');
      return prev;
    });
  }, [currentScreen, isNativeApp]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let listenerHandle: { remove: () => Promise<void> } | null = null;
    CapApp.addListener('backButton', () => {
      handleBack();
    }).then((handle) => {
      listenerHandle = handle;
    });
    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [handleBack]);

  const handleHome = () => {
    if (currentScreen === 'login' || currentScreen === 'register') {
      setCurrentScreen('login');
    } else {
      navigateTo('dashboard');
    }
  };

  const handleRecents = () => {
    // Quick switch to dashboard
    navigateTo('dashboard');
  };

  const currentUser = db.findUserById(activeStoreId);
  const storeRestriction = db.getStoreRestriction(activeStoreId);
  const isSuspended = storeRestriction.restricted;

  const renderActiveScreen = () => {
    switch (currentScreen) {
      case 'login':
        return (
          <LoginScreen
            onNavigate={navigateTo}
            onOpenOwnerDoor={() => setIsOwnerDoorOpen(true)}
          />
        );
      case 'register':
        return <RegisterScreen onNavigate={navigateTo} />;
      case 'dashboard':
        return (
          <DashboardScreen
            storeId={activeStoreId}
            isSuspended={isSuspended}
            suspensionReason={currentUser?.suspension_reason || storeRestriction.message}
            onNavigate={navigateTo}
          />
        );
      case 'pos':
        return (
          <PosScreen
            storeId={activeStoreId}
            isSuspended={isSuspended}
            onNavigate={navigateTo}
          />
        );
      case 'inventory':
        return (
          <InventoryScreen
            storeId={activeStoreId}
            onNavigate={navigateTo}
          />
        );
      case 'addProduct':
        return (
          <AddProductScreen
            storeId={activeStoreId}
            initialBarcode={typeof screenParams.initialBarcode === 'string' ? screenParams.initialBarcode : ''}
            onNavigate={navigateTo}
          />
        );
      case 'customers':
        return (
          <CustomersScreen
            storeId={activeStoreId}
            onNavigate={navigateTo}
            onBack={handleBack}
          />
        );
      case 'statement':
        return (
          <StatementScreen
            storeId={activeStoreId}
            customerId={screenParams.customerId || 1}
            customerName={screenParams.customerName || 'عميل'}
            customerPhone={screenParams.customerPhone}
            totalDebt={screenParams.totalDebt || 0}
            onNavigate={navigateTo}
          />
        );
      case 'returns':
        return (
          <ReturnsScreen
            storeId={activeStoreId}
            initialCustomerId={screenParams.customerId}
            onNavigate={navigateTo}
          />
        );
      case 'settings':
        return (
          <SettingsScreen
            storeId={activeStoreId}
            initialSection={screenParams.section as SettingsSection | undefined}
            initialOpenPasswordModal={Boolean(screenParams.openPasswordModal)}
            onNavigate={navigateTo}
          />
        );
      case 'reports':
        return <ReportsScreen storeId={activeStoreId} onNavigate={navigateTo} />;
      case 'expenses':
        return <ExpensesScreen storeId={activeStoreId} onNavigate={navigateTo} />;
      case 'owner':
        return supabase ? <CloudOwnerScreen onNavigate={navigateTo} /> : <OwnerScreen onNavigate={navigateTo} />;
      default:
        return (
          <DashboardScreen
            storeId={activeStoreId}
            isSuspended={isSuspended}
            suspensionReason={currentUser?.suspension_reason || storeRestriction.message}
            onNavigate={navigateTo}
          />
        );
    }
  };

  if (isNativeApp) {
    return (
      <div
        className={`h-[100dvh] w-full flex flex-col overflow-hidden selection:bg-[#C9A961]/30 transition-colors duration-200 ${theme.screenBg}`}
      >
        <div className="flex-1 w-full overflow-y-auto flex flex-col relative">
          {renderActiveScreen()}
        </div>

        <OwnerSecretDialog
          isOpen={isOwnerDoorOpen}
          onClose={() => setIsOwnerDoorOpen(false)}
          onSuccess={() => {
            setIsOwnerDoorOpen(false);
            navigateTo('owner');
          }}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col selection:bg-[#C9A961]/30 transition-colors duration-200 ${
      isDarkMode ? 'bg-[#0A110E] text-gray-100' : 'bg-[#FAF8F3] text-gray-900'
    }`}>
      {/* Top Main Navigation / Bar */}
      <header className="bg-[#0B3D2E] text-white border-b-2 border-[#C9A961] shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C9A961] text-[#0B3D2E] flex items-center justify-center font-black shadow-md border-2 border-white/20">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base md:text-lg tracking-tight">
                  بقالتي برو <span className="text-[#C9A961] font-mono text-sm">(Android POS)</span>
                </h1>
                <span className="bg-emerald-900 text-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-700">
                  Native Java & XML
                </span>
              </div>
              <p className="text-[11px] text-emerald-100/80">
                نظام إدارة البقالات ونقاط البيع المتكامل • متوافق مع Android Studio
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs & Quick Theme Toggle */}
          <div className="flex items-center gap-2 bg-[#06231A] p-1 rounded-2xl border border-emerald-900">
            {/* Quick Dark Mode / Light Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="px-3 py-2 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 rounded-xl text-amber-300 hover:text-white transition flex items-center gap-1.5 text-xs font-bold shadow-xs"
              title={isDarkMode ? 'التحويل إلى الوضع الفاتح' : 'التحويل إلى الوضع الداكن (تقليل إجهاد العين)'}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-amber-200" />}
              <span className="font-bold">{isDarkMode ? 'الوضع الفاتح' : 'الوضع الداكن'}</span>
            </button>

            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                activeTab === 'simulator'
                  ? 'bg-[#C9A961] text-[#0B3D2E] shadow-md'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>محاكي التطبيق الحي (Live Android)</span>
            </button>

            <button
              onClick={() => setActiveTab('code')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                activeTab === 'code'
                  ? 'bg-[#C9A961] text-[#0B3D2E] shadow-md'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>مستودع كود Java و XML (.ZIP)</span>
            </button>

            <button
              onClick={() => setIsPublishModalOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-[#C9A961] hover:from-amber-400 hover:to-[#dfbe73] text-[#0B3D2E] rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md hover:shadow-lg transition transform hover:-translate-y-0.5"
              title="مجلد ملفات وأكواد التطبيق بالكامل وحزم بناء APK"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>مجلد ملفات وأكواد التطبيق (ZIP)</span>
            </button>

          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col">
        {activeTab === 'simulator' ? (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left/Middle Column: The Interactive Android Phone Frame */}
            <div className="lg:col-span-6 flex flex-col items-center justify-center">
              <AndroidPhoneFrame
                currentScreenName={currentScreen}
                onBack={handleBack}
                onHome={handleHome}
                onRecents={handleRecents}
              >
                {renderActiveScreen()}
              </AndroidPhoneFrame>
            </div>

            {/* Right Column: Assistant Guide & Testing Controls */}
            <div className="lg:col-span-6 space-y-4">
              {/* Quick Screen Navigation Panel */}
              <div className={`${
                isDarkMode ? 'bg-[#141E1A] border-emerald-900/50 text-gray-200' : 'bg-white border-emerald-950/10 text-gray-900'
              } rounded-3xl p-5 shadow-sm border space-y-3`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-[#C9A961] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#C9A961]" />
                    <span>الانتقال السريع بين شاشات التطبيق:</span>
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                    isDarkMode ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : 'bg-emerald-50 text-[#0B3D2E]'
                  }`}>
                    الشاشة الحالية: {currentScreen}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    { id: 'login', label: '1. الدخول (LoginActivity)' },
                    { id: 'register', label: '2. إنشاء حساب (Register)' },
                    { id: 'dashboard', label: '3. الرئيسية (Dashboard)' },
                    { id: 'pos', label: '4. نقطة البيع (POS)' },
                    { id: 'inventory', label: '5. المخزون (Inventory)' },
                    { id: 'addProduct', label: '6. إضافة منتج (AddProduct)' },
                    { id: 'customers', label: '7. العملاء (Customers)' },
                    {
                      id: 'statement',
                      label: '8. كشف الحساب (Statement)',
                      params: {
                        customerId: 1,
                        customerName: 'الأستاذ خالد عبد الله المعمري',
                        customerPhone: '775551122',
                        totalDebt: 24500,
                      },
                    },
                    { id: 'returns', label: '9. المرتجعات (Returns)' },
                    { id: 'expenses', label: '10. المصروفات (Expenses)' },
                    { id: 'settings', label: '11. الإعدادات (Settings)' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => navigateTo(item.id, item.params)}
                      className={`p-2.5 rounded-xl border text-right transition font-bold ${
                        currentScreen === item.id
                          ? 'bg-[#0B3D2E] text-white border-[#C9A961]'
                          : isDarkMode
                          ? 'bg-[#182520] hover:bg-[#22352D] border-emerald-900/60 text-gray-200'
                          : 'bg-[#FAF8F3] hover:bg-emerald-50 border-gray-200 text-gray-800'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}

                  <button
                    onClick={() => setIsOwnerDoorOpen(true)}
                    className={`p-2.5 rounded-xl border text-right transition font-bold flex items-center justify-between ${
                      isDarkMode
                        ? 'border-amber-700/60 bg-amber-950/40 hover:bg-amber-900/50 text-amber-300'
                        : 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900'
                    }`}
                  >
                    <span>لوحة المالك (10 نقرات)</span>
                    <ShieldCheck className="w-4 h-4 text-[#C9A961]" />
                  </button>
                </div>
              </div>

              {/* Verified Requirements Badge Card */}
              <div className={`${
                isDarkMode ? 'bg-[#141E1A] border-emerald-900/50 text-gray-200' : 'bg-white border-emerald-950/10 text-gray-700'
              } rounded-3xl p-5 shadow-sm border space-y-3`}>
                <h3 className="font-bold text-sm text-[#C9A961] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>الميزات والقواعد المطبقة في النظام:</span>
                </h3>

                <ul className={`space-y-2 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#C9A961] mt-1.5 shrink-0" />
                    <span><strong>الوضع الداكن المريح للعين:</strong> دعم كامل للوضع الداكن (Dark Mode) في جميع شاشات محاكي الأندرويد وإعدادات النظام لحماية العين وتوفير طاقة شاشات AMOLED.</span>
                  </li>

                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#C9A961] mt-1.5 shrink-0" />
                    <span><strong>الألوان المحددة:</strong> الأساسي الزمردي <code className="bg-emerald-950 text-emerald-300 px-1 rounded border border-emerald-800">#0B3D2E</code>، الثانوي الذهبي <code className="bg-amber-950 text-amber-300 px-1 rounded border border-amber-800">#C9A961</code>، الداكن <code className="bg-gray-900 text-gray-200 px-1 rounded">#0F1715</code>.</span>
                  </li>

                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#C9A961] mt-1.5 shrink-0" />
                    <span><strong>عزل بيانات المتاجر:</strong> جميع دوال جلب البيانات مقيدة بشرط <code className="bg-emerald-950 text-emerald-300 px-1 py-0.5 rounded font-mono border border-emerald-800">WHERE store_id = ?</code> لمنع اختلاط بيانات البقالات.</span>
                  </li>

                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#C9A961] mt-1.5 shrink-0" />
                    <span><strong>حسابات الكرتون الذكية:</strong> في شاشة إضافة المنتج، عند اختيار "كرتون" يقسم سعر شراء الكرتون على عدد القطع لحساب تكلفة القطعة الواحدة برمجياً.</span>
                  </li>

                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#C9A961] mt-1.5 shrink-0" />
                    <span><strong>بوابة الإدارة:</strong> الوصول إليها محمي بتحقق منفصل عن حسابات مالكي المتاجر.</span>
                  </li>
                </ul>
              </div>

              {/* SharedPreferences Status */}
              <div className={`${
                isDarkMode ? 'bg-[#141E1A] border-emerald-900/50 text-gray-300' : 'bg-white border-emerald-950/10 text-gray-600'
              } rounded-3xl p-4 shadow-sm border text-xs flex items-center justify-between`}>
                <div>
                  <span className={`font-bold block ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>SharedPreferences المخزنة:</span>
                  <span className="font-mono text-[11px] text-emerald-400">
                    user_id: {activeStoreId} | store_id: {activeStoreId} | dark_mode: {isDarkMode ? 'true' : 'false'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const nextId = activeStoreId === 1 ? 2 : 1;
                    setActiveStoreId(nextId);
                    db.saveSharedPreferences({ user_id: nextId, store_id: nextId });
                    navigateTo('dashboard');
                  }}
                  className="bg-[#0B3D2E] text-white px-3 py-1.5 rounded-xl font-bold hover:bg-[#06231A] border border-[#C9A961]/40"
                >
                  تبديل المتجر ({activeStoreId === 1 ? 'إلى الموقوف' : 'إلى النشط'})
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-[820px]">
            <AndroidCodeInspector />
          </div>
        )}
      </main>

      {/* Secret Owner Backdoor Dialog */}
      <OwnerSecretDialog
        isOpen={isOwnerDoorOpen}
        onClose={() => setIsOwnerDoorOpen(false)}
        onSuccess={() => {
          setIsOwnerDoorOpen(false);
          navigateTo('owner');
        }}
      />

      {/* Publish & APK Modal */}
      <PublishModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        onSwitchToCodeTab={() => {
          setIsPublishModalOpen(false);
          setActiveTab('code');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
