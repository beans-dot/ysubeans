'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Megaphone } from 'lucide-react';
import { api, type UpdateLog } from '@/lib/api';

/** 이 너비 미만이면 본문을 숨기고 '최신 업데이트' 라벨만 표시 */
const TICKER_BODY_MIN_WIDTH = 200;

export function Ticker() {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [log, setLog] = useState<UpdateLog | null>(null);
  const [showBody, setShowBody] = useState(true);

  useEffect(() => {
    let mounted = true;
    api
      .get<UpdateLog | ''>('/update-log/latest')
      .then(({ data }) => {
        if (mounted && data) setLog(data as UpdateLog);
      })
      .catch(() => {
        /* 백엔드 미기동 시 무시 */
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const el = buttonRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setShowBody(width >= TICKER_BODY_MIN_WIDTH);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => router.push('/update-history')}
      className="flex w-full min-w-0 max-w-full items-center gap-1.5 overflow-hidden rounded-md bg-secondary px-2 py-2 text-left transition-colors hover:bg-secondary/70 sm:gap-2 sm:px-4"
      title="업데이트 이력 보기"
    >
      <Megaphone className="h-4 w-4 shrink-0 text-primary" />
      <span className="shrink-0 whitespace-nowrap text-xs font-bold text-primary">
        최신 업데이트
      </span>
      {showBody && (
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-muted-foreground">
          {log
            ? `${new Date(log.updateDate).toLocaleDateString('ko-KR')} · ${log.logText}`
            : '최근 업데이트 내역이 없습니다.'}
        </span>
      )}
    </button>
  );
}
