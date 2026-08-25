import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const MARGIN_MM = 12;
const GAP_MM = 5;
const MIN_REMAINING_MM = 24;

function addCanvas(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  cursor: { y: number; fresh: boolean },
) {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW - MARGIN_MM * 2;
  const pxPerMm = canvas.width / imgW;

  let srcY = 0;
  while (srcY < canvas.height) {
    const remainingMm = pageH - MARGIN_MM - cursor.y;
    if (!cursor.fresh && remainingMm < MIN_REMAINING_MM) {
      pdf.addPage();
      cursor.y = MARGIN_MM;
      cursor.fresh = true;
      continue;
    }

    const availableMm = pageH - MARGIN_MM - cursor.y;
    const availablePx = Math.max(
      1,
      Math.min(canvas.height - srcY, Math.floor(availableMm * pxPerMm)),
    );

    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = availablePx;
    const ctx = slice.getContext('2d');
    if (!ctx) throw new Error('PDF 생성에 실패했습니다.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(
      canvas,
      0,
      srcY,
      canvas.width,
      availablePx,
      0,
      0,
      canvas.width,
      availablePx,
    );

    const sliceHMm = availablePx / pxPerMm;
    pdf.addImage(slice, 'PNG', MARGIN_MM, cursor.y, imgW, sliceHMm);
    cursor.y += sliceHMm;
    cursor.fresh = false;
    srcY += availablePx;

    if (srcY < canvas.height) {
      pdf.addPage();
      cursor.y = MARGIN_MM;
      cursor.fresh = true;
    }
  }

  cursor.y += GAP_MM;
}

async function capture(
  el: HTMLElement,
  widthPx: number,
  includeBudget: boolean,
) {
  return html2canvas(el, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
    onclone: (_doc, cloned) => {
      cloned.style.width = `${widthPx}px`;
      cloned.style.maxWidth = `${widthPx}px`;
      cloned.style.boxSizing = 'border-box';
      cloned.querySelectorAll<HTMLElement>('.overflow-x-auto').forEach((node) => {
        node.style.overflow = 'visible';
      });
      cloned.querySelectorAll<HTMLElement>('[data-eval-budget]').forEach((node) => {
        if (includeBudget) {
          node.classList.remove('hidden');
          node.style.display = 'block';
        } else {
          node.remove();
        }
      });
      cloned.querySelectorAll<HTMLElement>('[data-eval-ir]').forEach((node) => {
        node.classList.remove('hidden');
        node.style.display = 'block';
        node.style.visibility = 'visible';
      });
    },
  });
}

export async function exportEvalReportPdf(opts: {
  header: HTMLElement | null;
  cards: HTMLElement[];
  filename: string;
  title: string;
  includeBudget?: boolean;
  onProgress?: (done: number, total: number) => void;
}) {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pdf.setProperties({ title: opts.title, creator: 'YSU IR Library' });
  const cursor = { y: MARGIN_MM, fresh: true };
  const widthPx = Math.max(
    ...opts.cards.map((card) => card.offsetWidth),
    opts.header?.offsetWidth ?? 0,
  );
  const includeBudget = Boolean(opts.includeBudget);

  const total = opts.cards.length + (opts.header ? 1 : 0);
  let done = 0;
  const tick = () => {
    done += 1;
    opts.onProgress?.(done, total);
  };

  if (opts.header) {
    addCanvas(pdf, await capture(opts.header, widthPx, includeBudget), cursor);
    tick();
  }
  for (const card of opts.cards) {
    addCanvas(pdf, await capture(card, widthPx, includeBudget), cursor);
    tick();
  }

  pdf.save(opts.filename);
}
