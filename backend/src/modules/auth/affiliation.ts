import { AffiliationType } from '../../entities/ir-user.entity';

export const AFFILIATION_TYPES: AffiliationType[] = ['학과', '부서', '기타'];

export type AffiliationMajorOption = {
  deptName: string;
  seriesName: string;
};

export type AffiliationOfficeOption = {
  deptName: string;
};

export type AffiliationOptions = {
  majors: AffiliationMajorOption[];
  offices: AffiliationOfficeOption[];
};
