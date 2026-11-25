/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Wifi, Battery, Signal, ArrowRight, Circle, Square } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.tsx';

interface AndroidPhoneFrameProps {
  children: React.ReactNode;
  currentScreenName?: string;
  onBack?: () => void;
  onHome?: () => void;
  onRecents?: () => void;
}

export const AndroidPhoneFrame: React.FC<AndroidPhoneFrameProps> = ({
  children,
  onBack,
  onHome,
  onRecents,
}) => {
  const { isDarkMode, theme } = useTheme();
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const timer = setInterval(updateTime, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-[420px] h-[860px] bg-black rounded-[46px] p-3 shadow-2xl border-4 border-gray-800 flex flex-col overflow-hidden select-none">
      {/* Front camera notch */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-b-xl z-50 flex items-center justify-center">
        <div className="w-3.5 h-3.5 rounded-full bg-[#111] border border-gray-700 mr-2 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-900/60" />
        </div>
        <div className="w-10 h-1 bg-gray-800 rounded-full" />
      </div>

      {/* Screen container */}
      <div className={`relative flex-1 w-full rounded-[36px] overflow-hidden flex flex-col transition-colors duration-300 ${theme.screenBg}`}>
        {/* Android Status Bar */}
        <div className={`h-8 px-5 flex items-center justify-between text-xs font-semibold tracking-wider z-40 select-none transition-colors duration-300 ${theme.statusBar}`}>
          <span className="font-mono text-[11px]">{time || '10:45'}</span>
          <div className="flex items-center gap-1.5 text-white/90">
            <span className="text-[10px] font-mono tracking-tighter text-emerald-200">5G</span>
            <Signal className="w-3.5 h-3.5" />
            <Wifi className="w-3.5 h-3.5" />
            <Battery className="w-4 h-4 text-emerald-300" />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 w-full overflow-y-auto flex flex-col relative" id="android-screen-viewport">
          {children}
        </div>

        {/* Android Bottom Navigation Bar */}
        <div className={`h-10 flex items-center justify-around px-6 z-40 transition-colors duration-300 ${theme.bottomNav}`}>
          <button
            onClick={onBack}
            title="رجوع (Back)"
            className="p-1 hover:text-white transition active:scale-90"
          >
            <ArrowRight className="w-4 h-4 text-gray-300" />
          </button>
          <button
            onClick={onHome}
            title="الرئيسية (Home)"
            className="p-1 hover:text-white transition active:scale-90"
          >
            <Circle className="w-4 h-4 text-gray-300" />
          </button>
          <button
            onClick={onRecents}
            title="التطبيقات المفتوحة (Recents)"
            className="p-1 hover:text-white transition active:scale-90"
          >
            <Square className="w-4 h-4 text-gray-300" />
          </button>
        </div>
      </div>
    </div>
  );
};
