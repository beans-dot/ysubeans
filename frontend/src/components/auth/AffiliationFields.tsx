'use client';

import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { AffiliationOptions, AffiliationType } from '@/lib/api';

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

const TYPES: AffiliationType[] = ['학과', '부서', '기타'];

export function AffiliationFields({
  idPrefix,
  affiliationType,
  department,
  options,
  loading = false,
  onAffiliationTypeChange,
  onDepartmentChange,
}: {
  idPrefix: string;
  affiliationType: AffiliationType | '';
  department: string;
  options: AffiliationOptions | null;
  loading?: boolean;
  onAffiliationTypeChange: (type: AffiliationType | '') => void;
  onDepartmentChange: (value: string) => void;
}) {
  const majorGroups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const m of options?.majors ?? []) {
      const list = map.get(m.seriesName) ?? [];
      list.push(m.deptName);
      map.set(m.seriesName, list);
    }
    return Array.from(map.entries());
  }, [options]);

  const offices = options?.offices ?? [];
  const majorsEmpty = !loading && (options?.majors.length ?? 0) === 0;
  const officesEmpty = !loading && offices.length === 0;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-affiliation-type`}>소속</Label>
        <select
          id={`${idPrefix}-affiliation-type`}
          className={SELECT_CLASS}
          value={affiliationType}
          required
          disabled={loading}
          onChange={(e) => {
            onAffiliationTypeChange(e.target.value as AffiliationType | '');
            onDepartmentChange('');
          }}
        >
          <option value="">소속 유형을 선택하세요</option>
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {affiliationType === '학과' && (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-major`}>학과</Label>
          <select
            id={`${idPrefix}-major`}
            className={SELECT_CLASS}
            value={department}
            required
            disabled={loading || majorsEmpty}
            onChange={(e) => onDepartmentChange(e.target.value)}
          >
            <option value="">학과를 선택하세요</option>
            {majorGroups.map(([series, depts]) => (
              <optgroup key={series} label={series}>
                {depts.map((name) => (
                  <option key={`${series}:${name}`} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {majorsEmpty && (
            <p className="text-sm text-muted-foreground">
              등록된 학과가 없습니다.
            </p>
          )}
        </div>
      )}

      {affiliationType === '부서' && (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-office`}>부서</Label>
          <select
            id={`${idPrefix}-office`}
            className={SELECT_CLASS}
            value={department}
            required
            disabled={loading || officesEmpty}
            onChange={(e) => onDepartmentChange(e.target.value)}
          >
            <option value="">부서를 선택하세요</option>
            {offices.map((office) => (
              <option key={office.deptName} value={office.deptName}>
                {office.deptName}
              </option>
            ))}
          </select>
          {officesEmpty && (
            <p className="text-sm text-muted-foreground">
              등록된 부서가 없습니다.
            </p>
          )}
        </div>
      )}

      {affiliationType === '기타' && (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-other`}>소속 상세</Label>
          <Textarea
            id={`${idPrefix}-other`}
            value={department}
            onChange={(e) => onDepartmentChange(e.target.value)}
            placeholder="소속을 입력해 주세요"
            required
            maxLength={200}
          />
        </div>
      )}
    </>
  );
}
