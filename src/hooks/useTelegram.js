// src/hooks/useTelegram.js
import { useEffect, useState } from 'react';

export function useTelegram() {
  const tg = window.Telegram?.WebApp;

  useEffect(() => {
    if (!tg) return;
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#0B141A');
    tg.setBackgroundColor('#0B141A');
    tg.enableClosingConfirmation();
  }, []);

  return {
    tg,
    user: tg?.initDataUnsafe?.user || null,
    initData: tg?.initData || '',
    colorScheme: tg?.colorScheme || 'dark',
    haptic: {
      impact: (style = 'medium') => tg?.HapticFeedback?.impactOccurred(style),
      success: () => tg?.HapticFeedback?.notificationOccurred('success'),
      error: () => tg?.HapticFeedback?.notificationOccurred('error'),
      warning: () => tg?.HapticFeedback?.notificationOccurred('warning'),
    }
  };
}
