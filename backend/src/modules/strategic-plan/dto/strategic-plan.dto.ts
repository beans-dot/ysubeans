import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SP_MAX_YEAR, SP_MIN_YEAR } from '../strategic-plan.constants';

export class YearQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(SP_MIN_YEAR)
  @Max(SP_MAX_YEAR)
  year: number;
}

export class OptionalYearQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(SP_MIN_YEAR)
  @Max(SP_MAX_YEAR)
  year?: number;
}

export class UpsertGoalDto {
  @IsString()
  @MaxLength(10)
  goalId: string;

  @IsOptional()
  @IsInt()
  goalNo?: number;

  @IsString()
  @MaxLength(300)
  goalName: string;

  @Type(() => Number)
  @IsInt()
  @Min(SP_MIN_YEAR)
  @Max(SP_MAX_YEAR)
  year: number;
}

export class UpdateGoalDto {
  @IsOptional()
  @IsInt()
  goalNo?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  goalName?: string;

  @Type(() => Number)
  @IsInt()
  @Min(SP_MIN_YEAR)
  @Max(SP_MAX_YEAR)
  year: number;
}

export class UpsertStrategyDto {
  @IsString()
  @MaxLength(20)
  strategyId: string;

  @IsString()
  @MaxLength(10)
  goalId: string;

  @IsString()
  @MaxLength(300)
  strategyName: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @Type(() => Number)
  @IsInt()
  @Min(SP_MIN_YEAR)
  @Max(SP_MAX_YEAR)
  year: number;
}

export class UpdateStrategyDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  goalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  strategyName?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @Type(() => Number)
  @IsInt()
  @Min(SP_MIN_YEAR)
  @Max(SP_MAX_YEAR)
  year: number;
}

export class UpsertTaskDto {
  @IsString()
  @MaxLength(60)
  taskCode: string;

  @IsString()
  @MaxLength(400)
  taskName: string;

  @IsString()
  @MaxLength(20)
  strategyId: string;

  @IsOptional()
  @IsBoolean()
  isSpecialized?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  primaryDept?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  relatedDepts?: string[];

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  hangulCode?: string;

  @Type(() => Number)
  @IsInt()
  @Min(SP_MIN_YEAR)
  @Max(SP_MAX_YEAR)
  year: number;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(400)
  taskName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  strategyId?: string;

  @IsOptional()
  @IsBoolean()
  isSpecialized?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  primaryDept?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  relatedDepts?: string[];

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  hangulCode?: string;

  @Type(() => Number)
  @IsInt()
  @Min(SP_MIN_YEAR)
  @Max(SP_MAX_YEAR)
  year: number;
}

export class SubtaskItemDto {
  @IsString()
  @MaxLength(80)
  subtaskCode: string;

  @IsString()
  @MaxLength(400)
  subtaskName: string;
}

export class ReplaceSubtasksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubtaskItemDto)
  @ArrayMaxSize(50)
  subtasks: SubtaskItemDto[];
}

export class UpsertKpiDto {
  @IsString()
  @MaxLength(30)
  kpiCode: string;

  @IsString()
  @MaxLength(300)
  kpiName: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  taskCode?: string;

  @IsOptional()
  @IsNumber()
  baseline?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  baselineRef?: string;

  @IsOptional()
  @IsString()
  formula?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  primaryDept?: string;

  @Type(() => Number)
  @IsInt()
  @Min(SP_MIN_YEAR)
  @Max(SP_MAX_YEAR)
  year: number;
}

export class UpdateKpiDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  kpiName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  taskCode?: string;

  @IsOptional()
  @IsNumber()
  baseline?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  baselineRef?: string;

  @IsOptional()
  @IsString()
  formula?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  primaryDept?: string;

  @Type(() => Number)
  @IsInt()
  @Min(SP_MIN_YEAR)
  @Max(SP_MAX_YEAR)
  year: number;
}

export class KpiValueDto {
  @IsOptional()
  @IsNumber()
  value?: number | null;
}

export class UpsertEvaluationDto {
  @IsString()
  @MaxLength(60)
  taskCode: string;

  @IsInt()
  @Min(SP_MIN_YEAR)
  @Max(SP_MAX_YEAR)
  year: number;

  @IsOptional()
  @IsString()
  deptSummary?: string | null;

  @IsOptional()
  @IsString()
  deptAnalysis?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  deptGrade?: string | null;

  @IsOptional()
  @IsString()
  deptImprovement?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  irGrade?: string | null;

  @IsOptional()
  @IsString()
  irFeedback?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  surveyGrade?: string | null;

  @IsOptional()
  @IsString()
  surveyAnalysis?: string | null;

  @IsOptional()
  @IsString()
  surveyFeedback?: string | null;

  @IsOptional()
  @IsObject()
  taskActivities?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  kpiPoEvals?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  budgetAdequacy?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  budgetAdequacyGrade?: string | null;

  @IsOptional()
  @IsString()
  processAdequacy?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  processAdequacyGrade?: string | null;

  @IsOptional()
  @IsString()
  kpiAdequacy?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  kpiAdequacyGrade?: string | null;

  @IsOptional()
  @IsArray()
  surveyItems?: unknown[] | null;

  @IsOptional()
  @IsArray()
  surveyPlans?: unknown[] | null;

  @IsOptional()
  @IsObject()
  irEval?: Record<string, unknown> | null;
}

export class UpsertBudgetDto {
  @IsString()
  @MaxLength(60)
  taskCode: string;

  @IsString()
  @MaxLength(80)
  subtaskCode: string;

  @IsInt()
  @Min(SP_MIN_YEAR)
  @Max(SP_MAX_YEAR)
  year: number;

  @IsInt()
  fundSourceId: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetAmount?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  settlementAmount?: number | null;
}

export class CreateFundSourceDto {
  @IsString()
  @MaxLength(100)
  fundSourceName: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @Type(() => Number)
  @IsInt()
  @Min(SP_MIN_YEAR)
  @Max(SP_MAX_YEAR)
  year: number;
}

export class UpdateFundSourceDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fundSourceName?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(SP_MIN_YEAR)
  @Max(SP_MAX_YEAR)
  year?: number;
}

export class CreateSubtaskDto {
  @IsString()
  @MaxLength(60)
  taskCode: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  hangulCode?: string;

  @IsOptional()
  @IsInt()
  seqNo?: number;

  @IsString()
  @MaxLength(400)
  subtaskName: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @Type(() => Number)
  @IsInt()
  @Min(SP_MIN_YEAR)
  @Max(SP_MAX_YEAR)
  year: number;
}

export class UpdateSubtaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(400)
  subtaskName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  hangulCode?: string;

  @IsOptional()
  @IsString()
  purpose?: string | null;

  @IsOptional()
  @IsString()
  method?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(SP_MIN_YEAR)
  @Max(SP_MAX_YEAR)
  year: number;
}

export class CreateDepartmentDto {
  @IsString()
  @MaxLength(100)
  deptName: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deptName?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;
}

export class MottoPairDto {
  @IsString()
  @MaxLength(80)
  motto: string;

  @IsString()
  @MaxLength(200)
  talent: string;
}

export class Talent3cDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(12)
  items: string[];
}

export class UpdateVisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  officialName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  planPeriod?: string | null;

  @IsOptional()
  @IsString()
  structureSummary?: string | null;

  @IsOptional()
  @IsString()
  visionStatement?: string | null;

  @IsOptional()
  @IsString()
  visionGoal?: string | null;

  @IsOptional()
  @IsString()
  mission?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200000)
  contentHtml?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keyIndicators?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  foundingPhilosophy?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MottoPairDto)
  mottoPairs?: MottoPairDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => Talent3cDto)
  talent3c?: Talent3cDto | null;
}
