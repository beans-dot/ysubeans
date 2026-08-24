import { ValueTransformer } from 'typeorm';

/** pg 드라이버는 numeric을 문자열로 돌려주므로 숫자로 되돌린다. */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined) =>
    value === undefined || value === null || Number.isNaN(value) ? null : value,
  from: (value: string | null) =>
    value === null || value === undefined ? null : Number(value),
};
