'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/strategic-plan/ui';
import { updateSpVision, uploadSpVisionImage } from '@/lib/strategic-plan/api';
import { apiMessage } from '@/lib/strategic-plan/apiError';

const FONT_SIZES = [
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '24', value: '24px' },
  { label: '32', value: '32px' },
];

const COLORS = [
  { label: '검정', value: '#111827' },
  { label: '회색', value: '#6b7280' },
  { label: '빨강', value: '#dc2626' },
  { label: '주황', value: '#ea580c' },
  { label: '노랑', value: '#ca8a04' },
  { label: '초록', value: '#16a34a' },
  { label: '파랑', value: '#2563eb' },
  { label: '남색', value: '#1e3a8a' },
  { label: '보라', value: '#7c3aed' },
];

function stripFontFamily(html: string): string {
  return html
    .replace(/font-family\s*:[^;"]*;?/gi, '')
    .replace(/\sface="[^"]*"/gi, '');
}

function applyToSelection(
  editor: HTMLElement,
  mutate: (el: HTMLElement) => void,
) {
  editor.focus();
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) {
    mutate(editor);
    return;
  }
  const range = sel.getRangeAt(0);
  if (range.collapsed) {
    const node = sel.anchorNode;
    const el =
      node instanceof HTMLElement ? node : (node?.parentElement ?? null);
    const block = el?.closest(
      'p,div,h1,h2,h3,h4,h5,h6,li,span,font',
    ) as HTMLElement | null;
    mutate(block && editor.contains(block) ? block : editor);
    return;
  }
  const span = document.createElement('span');
  mutate(span);
  span.appendChild(range.extractContents());
  range.insertNode(span);
  sel.removeAllRanges();
  const next = document.createRange();
  next.selectNodeContents(span);
  sel.addRange(next);
}

export function VisionEditor({
  initialHtml,
  onCancel,
  onSaved,
}: {
  initialHtml: string;
  onCancel: () => void;
  onSaved: (html: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState('14px');

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = initialHtml.trim() ? initialHtml : '<p><br></p>';
  }, [initialHtml]);

  const saveRange = () => {
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel || sel.rangeCount === 0) return;
    if (editor.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreRange = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const range = savedRange.current;
    if (!range) return;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const insertImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 첨부할 수 있습니다.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const { url } = await uploadSpVisionImage(file);
      restoreRange();
      document.execCommand(
        'insertHTML',
        false,
        `<img src="${url}" alt="" />`,
      );
    } catch (e) {
      setError(apiMessage(e, '이미지 업로드에 실패했습니다.'));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    const html = editorRef.current?.innerHTML ?? '';
    setBusy(true);
    setError(null);
    try {
      const saved = await updateSpVision({ contentHtml: html });
      onSaved(saved.contentHtml ?? html);
    } catch (e) {
      setError(apiMessage(e, '비전 체계 저장에 실패했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div
        className="flex flex-wrap items-center gap-2 border-b px-3 py-2"
        onMouseDown={(e) => {
          saveRange();
          if ((e.target as HTMLElement).closest('button')) {
            e.preventDefault();
          }
        }}
      >
        <label className="flex items-center gap-1.5 text-muted-foreground">
          크기
          <NativeSelect
            value={fontSize}
            aria-label="글자 크기"
            onChange={(e) => {
              const value = e.target.value;
              setFontSize(value);
              const editor = editorRef.current;
              if (!editor) return;
              restoreRange();
              applyToSelection(editor, (el) => {
                el.style.fontSize = value;
              });
            }}
          >
            {FONT_SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
        </label>

        <div className="flex items-center gap-1" role="group" aria-label="글자 색">
          <span className="text-muted-foreground">색</span>
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              className="h-5 w-5 rounded-sm border border-black/10"
              style={{ backgroundColor: c.value }}
              onClick={() => {
                restoreRange();
                document.execCommand('styleWithCSS', false, 'true');
                document.execCommand('foreColor', false, c.value);
              }}
            />
          ))}
          <input
            type="color"
            aria-label="직접 고른 글자 색"
            className="h-6 w-6 cursor-pointer rounded-sm border bg-background p-0"
            defaultValue="#111827"
            onChange={(e) => {
              restoreRange();
              document.execCommand('styleWithCSS', false, 'true');
              document.execCommand('foreColor', false, e.target.value);
            }}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading || busy}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
          그림
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void insertImageFile(file);
          }}
        />

        <div className="ml-auto flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onCancel}
          >
            <X className="h-4 w-4" />
            취소
          </Button>
          <Button type="button" size="sm" disabled={busy || uploading} onClick={() => void handleSave()}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            저장
          </Button>
        </div>
      </div>

      {error && (
        <p className="border-b px-3 py-2 text-destructive">{error}</p>
      )}

      <div
        ref={editorRef}
        className="sp-vision-doc min-h-[280px] px-4 py-5 focus:outline-none"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="비전 체계 본문"
        onBlur={saveRange}
        onPaste={(e) => {
          const files = [...(e.clipboardData?.files ?? [])].filter((f) =>
            f.type.startsWith('image/'),
          );
          if (files[0]) {
            e.preventDefault();
            void insertImageFile(files[0]);
            return;
          }
          const html = e.clipboardData?.getData('text/html');
          if (html) {
            e.preventDefault();
            document.execCommand('insertHTML', false, stripFontFamily(html));
          }
        }}
        onDrop={(e) => {
          const file = [...e.dataTransfer.files].find((f) =>
            f.type.startsWith('image/'),
          );
          if (file) {
            e.preventDefault();
            void insertImageFile(file);
          }
        }}
      />
    </div>
  );
}
