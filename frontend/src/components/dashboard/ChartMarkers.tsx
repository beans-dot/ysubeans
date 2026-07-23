import type { MarkerShape } from '@/lib/chartStyleUtils';

interface DotProps {
  cx?: number;
  cy?: number;
  fill: string;
  shape: MarkerShape;
  r?: number;
}

// 마커 모양별 SVG 렌더 (circle, triangle, square, diamond, wye)
export function renderMarker({ cx, cy, fill, shape, r = 4 }: DotProps) {
  if (cx === undefined || cy === undefined) return <g />;
  const s = r + 1;
  switch (shape) {
    case 'triangle':
      return (
        <polygon
          points={`${cx},${cy - s} ${cx - s},${cy + s} ${cx + s},${cy + s}`}
          fill={fill}
        />
      );
    case 'square':
      return (
        <rect x={cx - s} y={cy - s} width={s * 2} height={s * 2} fill={fill} />
      );
    case 'diamond':
      return (
        <polygon
          points={`${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`}
          fill={fill}
        />
      );
    case 'wye':
      return (
        <g stroke={fill} strokeWidth={2}>
          <line x1={cx} y1={cy} x2={cx} y2={cy - s} />
          <line x1={cx} y1={cy} x2={cx - s} y2={cy + s * 0.6} />
          <line x1={cx} y1={cy} x2={cx + s} y2={cy + s * 0.6} />
        </g>
      );
    case 'circle':
    default:
      return <circle cx={cx} cy={cy} r={r} fill={fill} />;
  }
}
