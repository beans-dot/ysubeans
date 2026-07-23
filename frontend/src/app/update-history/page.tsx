'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { api, type UpdateLog } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export default function UpdateHistoryPage() {
  const [logs, setLogs] = useState<UpdateLog[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .get<UpdateLog[]>('/update-log')
      .then(({ data }) => setLogs(data))
      .catch(() => setLogs([]))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <AuthGuard>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-2xl">업데이트 이력</h1>

        {!loaded && <p className="text-muted-foreground">불러오는 중...</p>}
        {loaded && logs.length === 0 && (
          <p className="text-muted-foreground">업데이트 내역이 없습니다.</p>
        )}

        <div className="space-y-3">
          {logs.map((log) => (
            <Card key={log.logId}>
              <CardContent className="flex items-start gap-4 py-4">
                <Badge variant="secondary" className="mt-0.5">
                  {log.updateType}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-foreground">{log.logText}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(log.updateDate).toLocaleString('ko-KR')}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AuthGuard>
  );
}
