const ALLOWED_TAGS = new Set([
  'p',
  'div',
  'br',
  'span',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'img',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'font',
]);

const VOID_TAGS = new Set(['br', 'img']);

const IMAGE_SRC_RE =
  /^\/api\/(?:backend\/)?strategic-plan\/vision\/images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpe?g|png|gif|webp)$/i;

const COLOR_RE =
  /^(?:#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:0|1|0?\.\d+)\s*\)|[a-z]+)$/i;

const FONT_SIZE_RE = /^\d{1,3}(?:\.\d+)?(?:px|pt|em|rem|%)$/;

const ALIGN_RE = /^(?:left|center|right|justify)$/i;

function decodeAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function encodeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    attrs[match[1].toLowerCase()] = decodeAttr(
      match[2] ?? match[3] ?? match[4] ?? '',
    );
  }
  return attrs;
}

function sanitizeStyle(style: string): string | null {
  const kept: string[] = [];
  for (const part of style.split(';')) {
    const idx = part.indexOf(':');
    if (idx < 0) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    if (!value || /expression|url\s*\(|javascript/i.test(value)) continue;
    if (prop === 'color' && COLOR_RE.test(value)) {
      kept.push(`color: ${value}`);
    } else if (prop === 'font-size' && FONT_SIZE_RE.test(value)) {
      kept.push(`font-size: ${value}`);
    } else if (prop === 'text-align' && ALIGN_RE.test(value)) {
      kept.push(`text-align: ${value}`);
    }
  }
  return kept.length > 0 ? kept.join('; ') : null;
}

function sanitizeOpenTag(tag: string, rawAttrs: string): string | null {
  const attrs = parseAttrs(rawAttrs);
  const out: string[] = [];

  if (tag === 'img') {
    const src = (attrs.src ?? '').trim();
    if (!IMAGE_SRC_RE.test(src)) return null;
    out.push(`src="${encodeAttr(src)}"`);
    if (attrs.alt) out.push(`alt="${encodeAttr(attrs.alt.slice(0, 200))}"`);
    if (attrs.width && /^\d{1,4}$/.test(attrs.width)) {
      out.push(`width="${attrs.width}"`);
    }
    if (attrs.height && /^\d{1,4}$/.test(attrs.height)) {
      out.push(`height="${attrs.height}"`);
    }
  }

  if (tag === 'font' && attrs.color && COLOR_RE.test(attrs.color)) {
    out.push(`color="${encodeAttr(attrs.color)}"`);
  }

  if (attrs.style) {
    const style = sanitizeStyle(attrs.style);
    if (style) out.push(`style="${encodeAttr(style)}"`);
  }

  return out.length > 0 ? `<${tag} ${out.join(' ')}>` : `<${tag}>`;
}

/** 비전 체계 본문: 글자 크기·색·이미지만 남기고 스크립트·글꼴 지정은 제거한다. */
export function sanitizeVisionHtml(raw: string): string {
  if (!raw) return '';
  const html = raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(
      /<\/?(script|style|iframe|object|embed|link|meta|form|input|button|textarea|svg|math)[\s\S]*?>/gi,
      '',
    );

  const parts: string[] = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(html))) {
    parts.push(html.slice(last, match.index));
    last = match.index + match[0].length;
    const tag = match[1].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue;
    const isClose = match[0].startsWith('</');
    if (isClose) {
      if (!VOID_TAGS.has(tag)) parts.push(`</${tag}>`);
      continue;
    }
    if (VOID_TAGS.has(tag)) {
      const open = sanitizeOpenTag(tag, match[2] ?? '');
      if (open) parts.push(open.replace(/>$/, ' />'));
      continue;
    }
    const open = sanitizeOpenTag(tag, match[2] ?? '');
    if (open) parts.push(open);
  }
  parts.push(html.slice(last));

  return parts.join('').trim();
}
