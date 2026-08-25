'use client';

import { useEffect, useState } from 'react';

const AUTOSAVE_EVENT = 'ir-autosave-toast';
const WORKSAVE_EVENT = 'ir-work-save';

export function notifyAutoSaved() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AUTOSAVE_EVENT));
}

export function requestWorkSave() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(WORKSAVE_EVENT));
}

export function AutoSaveToastHost() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onToast = () => {
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
      className="pointer-events-none fixed bottom-6 right-6 z-[80] rounded-md border bg-background px-3 py-2 text-sm shadow-md"
    >
      자동 저장 되었습니다
    </div>
  );
}

export const IR_WORK_SAVE_EVENT = WORKSAVE_EVENT;
