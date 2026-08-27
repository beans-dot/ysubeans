'use client';

import { useEffect, useState } from 'react';

const AUTOSAVE_EVENT = 'ir-autosave-toast';

const DEFAULT_MESSAGE = '저장되었습니다.';

export function notifyAutoSaved(message = DEFAULT_MESSAGE) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTOSAVE_EVENT, { detail: message }));
}

export function AutoSaveToastHost() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setMessage(typeof detail === 'string' && detail ? detail : DEFAULT_MESSAGE);
      setVisible(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setVisible(false), 1600);
    };
    window.addEventListener(AUTOSAVE_EVENT, onToast);
    return () => {
      window.removeEventListener(AUTOSAVE_EVENT, onToast);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed bottom-6 right-6 z-[80] rounded-md border border-red-600 bg-white px-3 py-2 text-sm font-bold text-red-600 shadow-md"
    >
      {message}
    </div>
  );
}
