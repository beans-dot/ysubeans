'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AnnualEventsManager } from '@/components/admin/AnnualEventsManager';
import { InternalOrgManager } from '@/components/admin/InternalOrgManager';
import { MemberManager } from '@/components/admin/MemberManager';
import { RawDataCorrection } from '@/components/admin/RawDataCorrection';
import { StrategicPlanManager } from '@/components/admin/StrategicPlanManager';
import { TreeBuilder } from '@/components/admin/TreeBuilder';
import { UploadCenter } from '@/components/admin/UploadCenter';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';

export default function AdminPage() {
  const [batchMsg, setBatchMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runBatch = async () => {
    setBusy(true);
    setBatchMsg(null);
    try {
      const { data } = await api.post<{ year: number; upserted: number }>(
        '/alimi/batch',
      );
      setBatchMsg(`정기 배치 완료: ${data.year}년, ${data.upserted}건 반영`);
    } catch {
      setBatchMsg('배치 실행 실패 (백엔드/API 키 확인)');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthGuard adminOnly>
      <div className="px-6 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl">관리자</h1>
          <div className="flex items-center gap-3">
            {batchMsg && (
              <span className="text-sm text-muted-foreground">{batchMsg}</span>
            )}
            <Button variant="outline" onClick={runBatch} disabled={busy}>
              <RefreshCw className="mr-1 h-4 w-4" />
              대학알리미 배치 (당해 연도)
            </Button>
          </div>
        </div>

        <Tabs defaultValue="members">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="members">회원관리</TabsTrigger>
            <TabsTrigger value="tree">지표 DB 빌더</TabsTrigger>
            <TabsTrigger value="org">계열·학과 관리</TabsTrigger>
            <TabsTrigger value="upload">엑셀 업로드</TabsTrigger>
            <TabsTrigger value="correction">자체 데이터 교정</TabsTrigger>
            <TabsTrigger value="annual">연간 변동사항 관리</TabsTrigger>
            <TabsTrigger value="strategic-plan">중장기발전계획</TabsTrigger>
          </TabsList>
          <TabsContent value="members">
            <MemberManager />
          </TabsContent>
          <TabsContent value="tree">
            <TreeBuilder />
          </TabsContent>
          <TabsContent value="org">
            <InternalOrgManager />
          </TabsContent>
          <TabsContent value="upload">
            <UploadCenter />
          </TabsContent>
          <TabsContent value="correction">
            <RawDataCorrection />
          </TabsContent>
          <TabsContent value="annual">
            <AnnualEventsManager />
          </TabsContent>
          <TabsContent value="strategic-plan">
            <StrategicPlanManager />
          </TabsContent>
        </Tabs>
      </div>
    </AuthGuard>
  );
}
