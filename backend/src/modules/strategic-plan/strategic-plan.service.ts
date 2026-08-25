import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  IrSpCompareData,
  IrSpDepartment,
  IrSpEvaluation,
  IrSpFundSource,
  IrSpGoal,
  IrSpKpi,
  IrSpKpiResult,
  IrSpKpiTarget,
  IrSpStrategy,
  IrSpSubtask,
  IrSpTask,
  IrSpTaskBudget,
  IrSpVision,
  type SpCompareAlt,
  type SpComparePayload,
} from '../../entities';
import {
  CreateDepartmentDto,
  CreateFundSourceDto,
  ReplaceSubtasksDto,
  UpdateDepartmentDto,
  UpdateFundSourceDto,
  UpdateGoalDto,
  UpdateKpiDto,
  UpdateStrategyDto,
  UpdateTaskDto,
  UpdateVisionDto,
  UpsertBudgetDto,
  UpsertEvaluationDto,
  UpsertGoalDto,
  UpsertKpiDto,
  UpsertStrategyDto,
  UpsertTaskDto,
} from './dto/strategic-plan.dto';
import { sanitizeVisionHtml } from './sanitize-vision-html';
import {
  sanitizeIrEval,
  sanitizeKpiPoEvals,
  sanitizeSurveyItems,
  sanitizeSurveyPlans,
  sanitizeTaskActivities,
} from './sanitize-evaluation';
import {
  SP_DEPT_GRADES,
  SP_IR_GRADES,
  SP_SURVEY_PLAN_GRADES,
  SP_YEARS,
} from './strategic-plan.constants';

const VISION_IMAGE_DIR = join(process.cwd(), 'uploads', 'sp-vision');
const VISION_IMAGE_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};
const VISION_IMAGE_NAME_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpe?g|png|gif|webp)$/i;

function mimeToExt(mime: string): string | null {
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/gif') return '.gif';
  if (mime === 'image/webp') return '.webp';
  return null;
}

export interface SpSubtaskNode {
  subtaskId: number;
  subtaskCode: string;
  subtaskName: string;
}

export interface SpTaskNode {
  taskCode: string;
  taskName: string;
  strategyId: string;
  goalId: string;
  isSpecialized: boolean;
  primaryDept: string | null;
  relatedDepts: string[];
  subtasks: SpSubtaskNode[];
  kpiCodes: string[];
}

export interface SpStrategyNode {
  strategyId: string;
  strategyName: string;
  goalId: string;
  tasks: SpTaskNode[];
}

export interface SpGoalNode {
  goalId: string;
  goalNo: number;
  goalName: string;
  strategies: SpStrategyNode[];
}

export interface SpKpiNode {
  kpiCode: string;
  kpiName: string;
  unit: string | null;
  taskCode: string | null;
  strategyId: string | null;
  goalId: string | null;
  baseline: number | null;
  baselineRef: string | null;
  formula: string | null;
  source: string | null;
  targets: Record<number, number | null>;
  results: Record<number, number | null>;
}

export interface SpCompareIndicator {
  id: string;
  name: string;
  src: string | null;
  srcLabel: string | null;
  priv: boolean;
  years: Record<number, SpComparePayload>;
  alt: { label: string; years: Record<number, SpCompareAlt['value']> } | null;
}

@Injectable()
export class StrategicPlanService implements OnModuleInit {
  constructor(
    @InjectRepository(IrSpVision)
    private readonly visionRepo: Repository<IrSpVision>,
    @InjectRepository(IrSpGoal)
    private readonly goalRepo: Repository<IrSpGoal>,
    @InjectRepository(IrSpStrategy)
    private readonly strategyRepo: Repository<IrSpStrategy>,
    @InjectRepository(IrSpTask)
    private readonly taskRepo: Repository<IrSpTask>,
    @InjectRepository(IrSpSubtask)
    private readonly subtaskRepo: Repository<IrSpSubtask>,
    @InjectRepository(IrSpKpi)
    private readonly kpiRepo: Repository<IrSpKpi>,
    @InjectRepository(IrSpKpiTarget)
    private readonly targetRepo: Repository<IrSpKpiTarget>,
    @InjectRepository(IrSpKpiResult)
    private readonly resultRepo: Repository<IrSpKpiResult>,
    @InjectRepository(IrSpEvaluation)
    private readonly evaluationRepo: Repository<IrSpEvaluation>,
    @InjectRepository(IrSpCompareData)
    private readonly compareRepo: Repository<IrSpCompareData>,
    @InjectRepository(IrSpFundSource)
    private readonly fundSourceRepo: Repository<IrSpFundSource>,
    @InjectRepository(IrSpDepartment)
    private readonly departmentRepo: Repository<IrSpDepartment>,
    @InjectRepository(IrSpTaskBudget)
    private readonly budgetRepo: Repository<IrSpTaskBudget>,
  ) {}

  async onModuleInit() {
    try {
      await this.budgetRepo.query(`
        DO $$
        DECLARE r RECORD;
        BEGIN
          IF to_regclass('ir_sp_task_budget') IS NULL THEN
            RETURN;
          END IF;
          FOR r IN
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'ir_sp_task_budget'::regclass
              AND contype = 'u'
              AND conname <> 'uq_sp_subtask_budget'
          LOOP
            EXECUTE format(
              'ALTER TABLE ir_sp_task_budget DROP CONSTRAINT %I',
              r.conname
            );
          END LOOP;
        END $$;
      `);
    } catch {
      // 최초 기동 등 테이블이 아직 없으면 synchronize가 생성한다.
    }
  }

  /* ── 대시보드 조회 ── */

  async getTree() {
    const [vision, goals, strategies, tasks, subtasks, kpis, targets, results] =
      await Promise.all([
        this.visionRepo.find({ order: { visionId: 'ASC' }, take: 1 }),
        this.goalRepo.find({ order: { goalNo: 'ASC', goalId: 'ASC' } }),
        this.strategyRepo.find({
          order: { displayOrder: 'ASC', strategyId: 'ASC' },
        }),
        this.taskRepo.find({ order: { displayOrder: 'ASC', taskCode: 'ASC' } }),
        this.subtaskRepo.find({
          order: { displayOrder: 'ASC', subtaskId: 'ASC' },
        }),
        this.kpiRepo.find({ order: { displayOrder: 'ASC', kpiCode: 'ASC' } }),
        this.targetRepo.find(),
        this.resultRepo.find(),
      ]);

    const subtasksByTask = new Map<string, SpSubtaskNode[]>();
    for (const s of subtasks) {
      const list = subtasksByTask.get(s.taskCode) ?? [];
      list.push({
        subtaskId: s.subtaskId,
        subtaskCode: s.subtaskCode,
        subtaskName: s.subtaskName,
      });
      subtasksByTask.set(s.taskCode, list);
    }

    const kpiCodesByTask = new Map<string, string[]>();
    for (const k of kpis) {
      if (!k.taskCode) continue;
      const list = kpiCodesByTask.get(k.taskCode) ?? [];
      list.push(k.kpiCode);
      kpiCodesByTask.set(k.taskCode, list);
    }

    const targetsByKpi = new Map<string, Record<number, number | null>>();
    for (const t of targets) {
      const map = targetsByKpi.get(t.kpiCode) ?? {};
      map[t.year] = t.targetValue;
      targetsByKpi.set(t.kpiCode, map);
    }
    const resultsByKpi = new Map<string, Record<number, number | null>>();
    for (const r of results) {
      const map = resultsByKpi.get(r.kpiCode) ?? {};
      map[r.year] = r.actualValue;
      resultsByKpi.set(r.kpiCode, map);
    }

    const taskNodes: SpTaskNode[] = tasks.map((t) => ({
      taskCode: t.taskCode,
      taskName: t.taskName,
      strategyId: t.strategyId,
      goalId: t.goalId,
      isSpecialized: t.isSpecialized,
      primaryDept: t.primaryDept,
      relatedDepts: t.relatedDepts ?? [],
      subtasks: subtasksByTask.get(t.taskCode) ?? [],
      kpiCodes: kpiCodesByTask.get(t.taskCode) ?? [],
    }));

    const goalNodes: SpGoalNode[] = goals.map((g) => ({
      goalId: g.goalId,
      goalNo: g.goalNo,
      goalName: g.goalName,
      strategies: strategies
        .filter((s) => s.goalId === g.goalId)
        .map((s) => ({
          strategyId: s.strategyId,
          strategyName: s.strategyName,
          goalId: s.goalId,
          tasks: taskNodes.filter((t) => t.strategyId === s.strategyId),
        })),
    }));

    const kpiNodes: SpKpiNode[] = kpis.map((k) => ({
      kpiCode: k.kpiCode,
      kpiName: k.kpiName,
      unit: k.unit,
      taskCode: k.taskCode,
      strategyId: k.strategyId,
      goalId: k.goalId,
      baseline: k.baseline,
      baselineRef: k.baselineRef,
      formula: k.formula,
      source: k.source,
      targets: targetsByKpi.get(k.kpiCode) ?? {},
      results: resultsByKpi.get(k.kpiCode) ?? {},
    }));

    const v = vision[0] ?? null;

    return {
      years: [...SP_YEARS],
      scales: {
        deptGrades: [...SP_DEPT_GRADES],
        irGrades: [...SP_IR_GRADES],
        surveyPlanGrades: [...SP_SURVEY_PLAN_GRADES],
      },
      vision: v ? this.toVisionJson(v) : null,
      goals: goalNodes,
      tasks: taskNodes,
      kpis: kpiNodes,
    };
  }

  async getCompare() {
    const rows = await this.compareRepo.find({
      order: { displayOrder: 'ASC', indicatorId: 'ASC', year: 'ASC' },
    });

    const byIndicator = new Map<string, SpCompareIndicator>();
    const years = new Set<number>();
    for (const row of rows) {
      years.add(row.year);
      let ind = byIndicator.get(row.indicatorId);
      if (!ind) {
        ind = {
          id: row.indicatorId,
          name: row.indicatorName,
          src: row.src,
          srcLabel: row.srcLabel,
          priv: row.isPrivateBasis,
          years: {},
          alt: null,
        };
        byIndicator.set(row.indicatorId, ind);
      }
      ind.years[row.year] = row.payload;
      if (row.altPayload) {
        if (!ind.alt) ind.alt = { label: row.altPayload.label, years: {} };
        ind.alt.years[row.year] = row.altPayload.value;
      }
    }

    return {
      years: [...years].sort((a, b) => a - b),
      indicators: [...byIndicator.values()],
    };
  }

  listFundSources(includeInactive = false) {
    return this.fundSourceRepo.find({
      where: includeInactive ? {} : { isActive: true },
      order: { displayOrder: 'ASC', fundSourceId: 'ASC' },
    });
  }

  async listDepartments() {
    await this.ensureDepartmentsFromTasks();
    return this.departmentRepo.find({
      order: { displayOrder: 'ASC', deptId: 'ASC' },
    });
  }

  listEvaluations(year: number) {
    return this.evaluationRepo.find({ where: { year } });
  }

  listBudgets(year: number) {
    return this.budgetRepo.find({ where: { year } });
  }

  /* ── 자체평가 (로그인 사용자 전원) ── */

  async upsertEvaluation(dto: UpsertEvaluationDto, userId: string) {
    await this.assertTaskExists(dto.taskCode);
    this.assertGrade(dto.deptGrade, SP_DEPT_GRADES, '부서 자체점검');
    this.assertGrade(dto.irGrade, SP_IR_GRADES, 'IR센터 평가');
    this.assertGrade(dto.surveyGrade, SP_DEPT_GRADES, '만족도조사 자체점검');
    this.assertGrade(dto.budgetAdequacyGrade, SP_DEPT_GRADES, '예결산의 적절성');
    this.assertGrade(dto.processAdequacyGrade, SP_DEPT_GRADES, '절차상 적절성');
    this.assertGrade(dto.kpiAdequacyGrade, SP_DEPT_GRADES, '성과지표 적절성');

    const existing = await this.evaluationRepo.findOne({
      where: { taskCode: dto.taskCode, year: dto.year },
    });
    const row = this.evaluationRepo.create({
      ...existing,
      taskCode: dto.taskCode,
      year: dto.year,
      updatedBy: userId,
    });
    for (const key of [
      'deptSummary',
      'deptAnalysis',
      'deptGrade',
      'deptImprovement',
      'irGrade',
      'irFeedback',
      'surveyGrade',
      'surveyAnalysis',
      'surveyFeedback',
      'budgetAdequacy',
      'budgetAdequacyGrade',
      'processAdequacy',
      'processAdequacyGrade',
      'kpiAdequacy',
      'kpiAdequacyGrade',
    ] as const) {
      if (dto[key] !== undefined) {
        row[key] = this.emptyToNull(dto[key]);
      }
    }
    if (dto.taskActivities !== undefined) {
      row.taskActivities = sanitizeTaskActivities(dto.taskActivities);
    }
    if (dto.kpiPoEvals !== undefined) {
      row.kpiPoEvals = sanitizeKpiPoEvals(dto.kpiPoEvals);
    }
    if (dto.surveyItems !== undefined) {
      row.surveyItems = sanitizeSurveyItems(dto.surveyItems);
    }
    if (dto.surveyPlans !== undefined) {
      row.surveyPlans = sanitizeSurveyPlans(dto.surveyPlans);
    }
    if (dto.irEval !== undefined) {
      row.irEval = sanitizeIrEval(dto.irEval);
    }
    return this.evaluationRepo.save(row);
  }

  /* ── 예산·결산 (로그인 사용자 전원) ── */

  async upsertBudget(dto: UpsertBudgetDto, userId: string) {
    await this.assertBudgetUnit(dto.taskCode, dto.subtaskCode);
    const fund = await this.fundSourceRepo.findOne({
      where: { fundSourceId: dto.fundSourceId },
    });
    if (!fund) {
      throw new NotFoundException('재원 유형을 찾을 수 없습니다.');
    }
    if (!fund.isActive) {
      throw new BadRequestException(
        `「${fund.fundSourceName}」은 비활성 재원이라 입력할 수 없습니다.`,
      );
    }

    const existing = await this.budgetRepo.findOne({
      where: {
        taskCode: dto.taskCode,
        subtaskCode: dto.subtaskCode,
        year: dto.year,
        fundSourceId: dto.fundSourceId,
      },
    });
    const row = this.budgetRepo.create({
      ...existing,
      taskCode: dto.taskCode,
      subtaskCode: dto.subtaskCode,
      year: dto.year,
      fundSourceId: dto.fundSourceId,
      updatedBy: userId,
    });
    if (dto.budgetAmount !== undefined) {
      row.budgetAmount = dto.budgetAmount ?? null;
    }
    if (dto.settlementAmount !== undefined) {
      row.settlementAmount = dto.settlementAmount ?? null;
    }

    // 두 값이 모두 비면 행을 남기지 않는다.
    if (
      row.budgetAmount === null &&
      row.settlementAmount === null &&
      existing
    ) {
      await this.budgetRepo.delete(existing.budgetId);
      return {
        taskCode: dto.taskCode,
        subtaskCode: dto.subtaskCode,
        year: dto.year,
        fundSourceId: dto.fundSourceId,
        budgetAmount: null,
        settlementAmount: null,
      };
    }
    return this.budgetRepo.save(row);
  }

  /* ── 관리자: 체계 CRUD ── */

  listGoals() {
    return this.goalRepo.find({ order: { goalNo: 'ASC', goalId: 'ASC' } });
  }

  async createGoal(dto: UpsertGoalDto) {
    const exists = await this.goalRepo.findOne({
      where: { goalId: dto.goalId },
    });
    if (exists) {
      throw new BadRequestException('같은 코드의 발전전략이 이미 있습니다.');
    }
    return this.goalRepo.save(
      this.goalRepo.create({
        goalId: dto.goalId,
        goalNo: dto.goalNo ?? 0,
        goalName: dto.goalName,
      }),
    );
  }

  async updateGoal(goalId: string, dto: UpdateGoalDto) {
    const goal = await this.goalRepo.findOne({ where: { goalId } });
    if (!goal) throw new NotFoundException('발전전략을 찾을 수 없습니다.');
    if (dto.goalNo !== undefined) goal.goalNo = dto.goalNo;
    if (dto.goalName !== undefined) goal.goalName = dto.goalName;
    return this.goalRepo.save(goal);
  }

  async deleteGoal(goalId: string) {
    const used = await this.strategyRepo.count({ where: { goalId } });
    if (used > 0) {
      throw new BadRequestException(
        `전략과제 ${used}건이 속해 있어 삭제할 수 없습니다.`,
      );
    }
    await this.goalRepo.delete(goalId);
    return { ok: true as const };
  }

  async createStrategy(dto: UpsertStrategyDto) {
    const exists = await this.strategyRepo.findOne({
      where: { strategyId: dto.strategyId },
    });
    if (exists) {
      throw new BadRequestException('같은 코드의 전략과제가 이미 있습니다.');
    }
    await this.assertGoalExists(dto.goalId);
    return this.strategyRepo.save(
      this.strategyRepo.create({
        strategyId: dto.strategyId,
        goalId: dto.goalId,
        strategyName: dto.strategyName,
        displayOrder: dto.displayOrder ?? 0,
      }),
    );
  }

  async updateStrategy(strategyId: string, dto: UpdateStrategyDto) {
    const strategy = await this.strategyRepo.findOne({
      where: { strategyId },
    });
    if (!strategy) throw new NotFoundException('전략과제를 찾을 수 없습니다.');
    if (dto.goalId !== undefined) {
      await this.assertGoalExists(dto.goalId);
      strategy.goalId = dto.goalId;
      await this.taskRepo.update({ strategyId }, { goalId: dto.goalId });
      await this.kpiRepo.update({ strategyId }, { goalId: dto.goalId });
    }
    if (dto.strategyName !== undefined) {
      strategy.strategyName = dto.strategyName;
    }
    if (dto.displayOrder !== undefined) {
      strategy.displayOrder = dto.displayOrder;
    }
    return this.strategyRepo.save(strategy);
  }

  async deleteStrategy(strategyId: string) {
    const used = await this.taskRepo.count({ where: { strategyId } });
    if (used > 0) {
      throw new BadRequestException(
        `실행과제 ${used}건이 속해 있어 삭제할 수 없습니다.`,
      );
    }
    await this.strategyRepo.delete(strategyId);
    return { ok: true as const };
  }

  async createTask(dto: UpsertTaskDto) {
    const exists = await this.taskRepo.findOne({
      where: { taskCode: dto.taskCode },
    });
    if (exists) {
      throw new BadRequestException('같은 코드의 실행과제가 이미 있습니다.');
    }
    const strategy = await this.strategyRepo.findOne({
      where: { strategyId: dto.strategyId },
    });
    if (!strategy) throw new NotFoundException('전략과제를 찾을 수 없습니다.');
    return this.taskRepo.save(
      this.taskRepo.create({
        taskCode: dto.taskCode,
        taskName: dto.taskName,
        strategyId: dto.strategyId,
        goalId: strategy.goalId,
        isSpecialized: dto.isSpecialized ?? false,
        primaryDept: this.emptyToNull(dto.primaryDept ?? null),
        relatedDepts: await this.normalizeTaskDepts(
          dto.primaryDept,
          dto.relatedDepts ?? [],
        ),
        displayOrder: dto.displayOrder ?? 0,
      }),
    );
  }

  async updateTask(taskCode: string, dto: UpdateTaskDto) {
    const task = await this.taskRepo.findOne({ where: { taskCode } });
    if (!task) throw new NotFoundException('실행과제를 찾을 수 없습니다.');
    if (dto.strategyId !== undefined) {
      const strategy = await this.strategyRepo.findOne({
        where: { strategyId: dto.strategyId },
      });
      if (!strategy) {
        throw new NotFoundException('전략과제를 찾을 수 없습니다.');
      }
      task.strategyId = strategy.strategyId;
      task.goalId = strategy.goalId;
      await this.kpiRepo.update(
        { taskCode },
        { strategyId: strategy.strategyId, goalId: strategy.goalId },
      );
    }
    if (dto.taskName !== undefined) task.taskName = dto.taskName;
    if (dto.isSpecialized !== undefined) task.isSpecialized = dto.isSpecialized;
    if (dto.primaryDept !== undefined || dto.relatedDepts !== undefined) {
      const primary =
        dto.primaryDept !== undefined
          ? this.emptyToNull(dto.primaryDept)
          : task.primaryDept;
      const related =
        dto.relatedDepts !== undefined
          ? dto.relatedDepts
          : (task.relatedDepts ?? []);
      task.primaryDept = primary;
      task.relatedDepts = await this.normalizeTaskDepts(primary, related);
    }
    if (dto.displayOrder !== undefined) task.displayOrder = dto.displayOrder;
    return this.taskRepo.save(task);
  }

  async deleteTask(taskCode: string) {
    const kpiCount = await this.kpiRepo.count({ where: { taskCode } });
    if (kpiCount > 0) {
      throw new BadRequestException(
        `연계 KPI ${kpiCount}개가 있어 삭제할 수 없습니다. 먼저 KPI를 옮기거나 지워 주세요.`,
      );
    }
    await this.subtaskRepo.delete({ taskCode });
    await this.evaluationRepo.delete({ taskCode });
    await this.budgetRepo.delete({ taskCode });
    await this.taskRepo.delete(taskCode);
    return { ok: true as const };
  }

  async replaceSubtasks(taskCode: string, dto: ReplaceSubtasksDto) {
    await this.assertTaskExists(taskCode);
    const seen = new Set<string>();
    for (const s of dto.subtasks) {
      if (seen.has(s.subtaskCode)) {
        throw new BadRequestException(
          `세부과제 코드가 중복됩니다: ${s.subtaskCode}`,
        );
      }
      seen.add(s.subtaskCode);
    }
    await this.subtaskRepo.delete({ taskCode });
    const kept = new Set(dto.subtasks.map((s) => s.subtaskCode));
    const budgets = await this.budgetRepo.find({ where: { taskCode } });
    const staleIds = budgets
      .filter((b) => b.subtaskCode && !kept.has(b.subtaskCode))
      .map((b) => b.budgetId);
    if (staleIds.length > 0) {
      await this.budgetRepo.delete(staleIds);
    }
    if (dto.subtasks.length === 0) return [];
    return this.subtaskRepo.save(
      dto.subtasks.map((s, index) =>
        this.subtaskRepo.create({
          taskCode,
          subtaskCode: s.subtaskCode,
          subtaskName: s.subtaskName,
          displayOrder: index,
        }),
      ),
    );
  }

  /* ── 관리자: KPI ── */

  async createKpi(dto: UpsertKpiDto) {
    const exists = await this.kpiRepo.findOne({
      where: { kpiCode: dto.kpiCode },
    });
    if (exists) {
      throw new BadRequestException('같은 코드의 KPI가 이미 있습니다.');
    }
    const task = dto.taskCode
      ? await this.taskRepo.findOne({ where: { taskCode: dto.taskCode } })
      : null;
    if (dto.taskCode && !task) {
      throw new NotFoundException('실행과제를 찾을 수 없습니다.');
    }
    return this.kpiRepo.save(
      this.kpiRepo.create({
        kpiCode: dto.kpiCode,
        kpiName: dto.kpiName,
        unit: dto.unit ?? null,
        taskCode: task?.taskCode ?? null,
        strategyId: task?.strategyId ?? null,
        goalId: task?.goalId ?? null,
        baseline: dto.baseline ?? null,
        baselineRef: dto.baselineRef ?? null,
        formula: dto.formula ?? null,
        source: dto.source ?? null,
        displayOrder: dto.displayOrder ?? 0,
      }),
    );
  }

  async updateKpi(kpiCode: string, dto: UpdateKpiDto) {
    const kpi = await this.kpiRepo.findOne({ where: { kpiCode } });
    if (!kpi) throw new NotFoundException('KPI를 찾을 수 없습니다.');
    if (dto.taskCode !== undefined) {
      const task = await this.taskRepo.findOne({
        where: { taskCode: dto.taskCode },
      });
      if (!task) throw new NotFoundException('실행과제를 찾을 수 없습니다.');
      kpi.taskCode = task.taskCode;
      kpi.strategyId = task.strategyId;
      kpi.goalId = task.goalId;
    }
    if (dto.kpiName !== undefined) kpi.kpiName = dto.kpiName;
    if (dto.unit !== undefined) kpi.unit = this.emptyToNull(dto.unit);
    if (dto.baseline !== undefined) kpi.baseline = dto.baseline ?? null;
    if (dto.baselineRef !== undefined) {
      kpi.baselineRef = this.emptyToNull(dto.baselineRef);
    }
    if (dto.formula !== undefined) kpi.formula = this.emptyToNull(dto.formula);
    if (dto.source !== undefined) kpi.source = this.emptyToNull(dto.source);
    if (dto.displayOrder !== undefined) kpi.displayOrder = dto.displayOrder;
    return this.kpiRepo.save(kpi);
  }

  async deleteKpi(kpiCode: string) {
    await this.targetRepo.delete({ kpiCode });
    await this.resultRepo.delete({ kpiCode });
    await this.kpiRepo.delete(kpiCode);
    return { ok: true as const };
  }

  async setKpiTarget(kpiCode: string, year: number, value: number | null) {
    await this.assertKpiExists(kpiCode);
    const existing = await this.targetRepo.findOne({
      where: { kpiCode, year },
    });
    if (value === null || value === undefined) {
      if (existing) await this.targetRepo.delete(existing.targetId);
      return { kpiCode, year, targetValue: null };
    }
    return this.targetRepo.save(
      this.targetRepo.create({
        targetId: existing?.targetId,
        kpiCode,
        year,
        targetValue: value,
      }),
    );
  }

  async setKpiResult(
    kpiCode: string,
    year: number,
    value: number | null,
    userId: string,
  ) {
    await this.assertKpiExists(kpiCode);
    const existing = await this.resultRepo.findOne({
      where: { kpiCode, year },
    });
    if (value === null || value === undefined) {
      if (existing) await this.resultRepo.delete(existing.resultId);
      return { kpiCode, year, actualValue: null };
    }
    return this.resultRepo.save(
      this.resultRepo.create({
        resultId: existing?.resultId,
        kpiCode,
        year,
        actualValue: value,
        updatedBy: userId,
      }),
    );
  }

  /* ── 관리자: 재원 유형 ── */

  async createFundSource(dto: CreateFundSourceDto) {
    const name = dto.fundSourceName.trim();
    if (!name) throw new BadRequestException('재원 이름을 입력해 주세요.');
    const dup = await this.fundSourceRepo.findOne({
      where: { fundSourceName: name },
    });
    if (dup) throw new BadRequestException('같은 이름의 재원이 이미 있습니다.');
    const max = await this.fundSourceRepo
      .createQueryBuilder('f')
      .select('MAX(f.displayOrder)', 'max')
      .getRawOne<{ max: number | null }>();
    return this.fundSourceRepo.save(
      this.fundSourceRepo.create({
        fundSourceName: name,
        displayOrder: dto.displayOrder ?? (max?.max ?? -1) + 1,
        isActive: true,
      }),
    );
  }

  async updateFundSource(fundSourceId: number, dto: UpdateFundSourceDto) {
    const fund = await this.fundSourceRepo.findOne({ where: { fundSourceId } });
    if (!fund) throw new NotFoundException('재원 유형을 찾을 수 없습니다.');
    if (dto.fundSourceName !== undefined) {
      const name = dto.fundSourceName.trim();
      if (!name) throw new BadRequestException('재원 이름을 입력해 주세요.');
      const dup = await this.fundSourceRepo.findOne({
        where: { fundSourceName: name },
      });
      if (dup && dup.fundSourceId !== fundSourceId) {
        throw new BadRequestException('같은 이름의 재원이 이미 있습니다.');
      }
      fund.fundSourceName = name;
    }
    if (dto.displayOrder !== undefined) fund.displayOrder = dto.displayOrder;
    if (dto.isActive !== undefined) fund.isActive = dto.isActive;
    return this.fundSourceRepo.save(fund);
  }

  async deleteFundSource(fundSourceId: number) {
    const fund = await this.fundSourceRepo.findOne({ where: { fundSourceId } });
    if (!fund) throw new NotFoundException('재원 유형을 찾을 수 없습니다.');
    const used = await this.budgetRepo.count({ where: { fundSourceId } });
    if (used > 0) {
      fund.isActive = false;
      await this.fundSourceRepo.save(fund);
      return { ok: true as const, deactivated: true, used };
    }
    await this.fundSourceRepo.delete(fundSourceId);
    return { ok: true as const, deactivated: false, used: 0 };
  }

  /* ── 관리자: 부서 ── */

  async createDepartment(dto: CreateDepartmentDto) {
    const name = dto.deptName.trim();
    if (!name) throw new BadRequestException('부서명을 입력해 주세요.');
    const dup = await this.departmentRepo.findOne({
      where: { deptName: name },
    });
    if (dup) throw new BadRequestException('같은 이름의 부서가 이미 있습니다.');
    const max = await this.departmentRepo
      .createQueryBuilder('d')
      .select('MAX(d.displayOrder)', 'max')
      .getRawOne<{ max: number | null }>();
    return this.departmentRepo.save(
      this.departmentRepo.create({
        deptName: name,
        displayOrder: dto.displayOrder ?? (max?.max ?? -1) + 1,
      }),
    );
  }

  async updateDepartment(deptId: number, dto: UpdateDepartmentDto) {
    const dept = await this.departmentRepo.findOne({ where: { deptId } });
    if (!dept) throw new NotFoundException('부서를 찾을 수 없습니다.');
    if (dto.deptName !== undefined) {
      const name = dto.deptName.trim();
      if (!name) throw new BadRequestException('부서명을 입력해 주세요.');
      const dup = await this.departmentRepo.findOne({
        where: { deptName: name },
      });
      if (dup && dup.deptId !== deptId) {
        throw new BadRequestException('같은 이름의 부서가 이미 있습니다.');
      }
      if (name !== dept.deptName) {
        await this.rewriteDeptOnTasks(dept.deptName, name);
        dept.deptName = name;
      }
    }
    if (dto.displayOrder !== undefined) dept.displayOrder = dto.displayOrder;
    return this.departmentRepo.save(dept);
  }

  async deleteDepartment(deptId: number) {
    const dept = await this.departmentRepo.findOne({ where: { deptId } });
    if (!dept) throw new NotFoundException('부서를 찾을 수 없습니다.');
    await this.rewriteDeptOnTasks(dept.deptName, null);
    await this.departmentRepo.delete(deptId);
    return { ok: true as const };
  }

  /* ── 관리자: 비전·비교 ── */

  async updateVision(dto: UpdateVisionDto) {
    const rows = await this.visionRepo.find({
      order: { visionId: 'ASC' },
      take: 1,
    });
    const vision = rows[0] ?? this.visionRepo.create({});
    for (const key of [
      'officialName',
      'planPeriod',
      'structureSummary',
      'visionStatement',
      'visionGoal',
      'mission',
    ] as const) {
      if (dto[key] !== undefined) vision[key] = this.emptyToNull(dto[key]);
    }
    if (dto.keyIndicators !== undefined) {
      vision.keyIndicators = dto.keyIndicators;
    }
    if (dto.foundingPhilosophy !== undefined) {
      vision.foundingPhilosophy = dto.foundingPhilosophy;
    }
    if (dto.mottoPairs !== undefined) {
      vision.mottoPairs = dto.mottoPairs.map((p) => ({
        motto: p.motto.trim(),
        talent: p.talent.trim(),
      }));
    }
    if (dto.talent3c !== undefined) {
      vision.talent3c = dto.talent3c
        ? {
            name: dto.talent3c.name.trim() || '3C형 인재',
            items: dto.talent3c.items.map((item) => item.trim()).filter(Boolean),
          }
        : null;
    }
    if (dto.contentHtml !== undefined) {
      const cleaned = sanitizeVisionHtml(dto.contentHtml ?? '');
      vision.contentHtml = cleaned.trim() ? cleaned : null;
    }
    const saved = await this.visionRepo.save(vision);
    return this.toVisionJson(saved);
  }

  saveVisionImage(file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('업로드된 파일이 없습니다.');
    }
    const ext = VISION_IMAGE_MIME[extname(file.originalname).toLowerCase()]
      ? extname(file.originalname).toLowerCase()
      : mimeToExt(file.mimetype);
    if (!ext) {
      throw new BadRequestException(
        'jpeg, png, gif, webp 이미지만 올릴 수 있습니다.',
      );
    }
    mkdirSync(VISION_IMAGE_DIR, { recursive: true });
    const filename = `${randomUUID()}${ext}`;
    writeFileSync(join(VISION_IMAGE_DIR, filename), file.buffer);
    return {
      filename,
      url: `/strategic-plan/vision/images/${filename}`,
    };
  }

  getVisionImage(filename: string) {
    if (!VISION_IMAGE_NAME_RE.test(filename)) {
      throw new BadRequestException('잘못된 파일 이름입니다.');
    }
    const filePath = join(VISION_IMAGE_DIR, filename);
    if (!existsSync(filePath)) {
      throw new NotFoundException('이미지를 찾을 수 없습니다.');
    }
    const contentType =
      VISION_IMAGE_MIME[extname(filename).toLowerCase()] ?? 'application/octet-stream';
    return { stream: createReadStream(filePath), contentType };
  }

  private toVisionJson(v: IrSpVision) {
    return {
      officialName: v.officialName,
      planPeriod: v.planPeriod,
      structureSummary: v.structureSummary,
      visionStatement: v.visionStatement,
      visionGoal: v.visionGoal,
      mission: v.mission,
      keyIndicators: v.keyIndicators ?? [],
      foundingPhilosophy: v.foundingPhilosophy ?? [],
      mottoPairs: v.mottoPairs ?? [],
      talent3c: v.talent3c,
      contentHtml: v.contentHtml ?? null,
    };
  }

  async replaceCompare(payload: {
    years: number[];
    indicators: SpCompareIndicator[];
  }) {
    if (!payload || !Array.isArray(payload.indicators)) {
      throw new BadRequestException(
        'indicators 배열이 있는 JSON을 넣어 주세요.',
      );
    }
    const rows: IrSpCompareData[] = [];
    payload.indicators.forEach((ind, order) => {
      if (!ind?.id || !ind?.name || !ind?.years) {
        throw new BadRequestException(
          '각 지표에는 id, name, years가 있어야 합니다.',
        );
      }
      for (const [yearKey, value] of Object.entries(ind.years)) {
        const year = Number(yearKey);
        if (!Number.isFinite(year)) continue;
        const altValue = ind.alt?.years?.[year];
        rows.push(
          this.compareRepo.create({
            indicatorId: ind.id,
            indicatorName: ind.name,
            src: ind.src ?? null,
            srcLabel: ind.srcLabel ?? null,
            isPrivateBasis: Boolean(ind.priv),
            year,
            payload: value,
            altPayload:
              ind.alt && altValue
                ? { label: ind.alt.label, value: altValue }
                : null,
            displayOrder: order,
          }),
        );
      }
    });
    await this.compareRepo.clear();
    if (rows.length > 0) await this.compareRepo.save(rows);
    return this.getCompare();
  }

  /* ── helpers ── */

  private emptyToNull(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }

  private assertGrade(
    value: string | null | undefined,
    allowed: readonly string[],
    label: string,
  ) {
    if (value === undefined || value === null || value.trim() === '') return;
    if (!allowed.includes(value)) {
      throw new BadRequestException(
        `${label} 등급은 ${allowed.join(' / ')} 중 하나여야 합니다.`,
      );
    }
  }

  private async assertGoalExists(goalId: string) {
    const exists = await this.goalRepo.count({ where: { goalId } });
    if (!exists) throw new NotFoundException('발전전략을 찾을 수 없습니다.');
  }

  private async assertTaskExists(taskCode: string) {
    const exists = await this.taskRepo.count({ where: { taskCode } });
    if (!exists) throw new NotFoundException('실행과제를 찾을 수 없습니다.');
  }

  private async assertBudgetUnit(taskCode: string, subtaskCode: string) {
    await this.assertTaskExists(taskCode);
    const subCount = await this.subtaskRepo.count({ where: { taskCode } });
    if (subCount === 0) {
      if (subtaskCode !== taskCode) {
        throw new NotFoundException('TASK를 찾을 수 없습니다.');
      }
      return;
    }
    const sub = await this.subtaskRepo.findOne({
      where: { taskCode, subtaskCode },
    });
    if (!sub) throw new NotFoundException('TASK를 찾을 수 없습니다.');
  }

  private async assertKpiExists(kpiCode: string) {
    const exists = await this.kpiRepo.count({ where: { kpiCode } });
    if (!exists) throw new NotFoundException('KPI를 찾을 수 없습니다.');
  }

  private collectTaskDeptNames(tasks: IrSpTask[]): string[] {
    const names = new Set<string>();
    for (const task of tasks) {
      const primary = task.primaryDept?.trim();
      if (primary) names.add(primary);
      for (const related of task.relatedDepts ?? []) {
        const name = related.trim();
        if (name) names.add(name);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'ko'));
  }

  /** 실행과제에 남은 텍스트 부서명을 마스터에 넣어 드롭다운이 비지 않게 한다. */
  private async ensureDepartmentsFromTasks() {
    const [tasks, existing] = await Promise.all([
      this.taskRepo.find(),
      this.departmentRepo.find(),
    ]);
    const have = new Set(existing.map((d) => d.deptName));
    const missing = this.collectTaskDeptNames(tasks).filter(
      (name) => !have.has(name),
    );
    if (missing.length === 0) return;
    const maxOrder = existing.reduce((m, d) => Math.max(m, d.displayOrder), -1);
    await this.departmentRepo.save(
      missing.map((deptName, i) =>
        this.departmentRepo.create({
          deptName,
          displayOrder: maxOrder + 1 + i,
        }),
      ),
    );
  }

  private async rewriteDeptOnTasks(
    oldName: string,
    newName: string | null,
  ) {
    const tasks = await this.taskRepo.find();
    const changed: IrSpTask[] = [];
    for (const task of tasks) {
      let dirty = false;
      if (task.primaryDept === oldName) {
        task.primaryDept = newName;
        dirty = true;
      }
      const related = task.relatedDepts ?? [];
      if (related.includes(oldName)) {
        const next = newName
          ? related.map((d) => (d === oldName ? newName : d))
          : related.filter((d) => d !== oldName);
        task.relatedDepts = [...new Set(next.filter((d) => d.trim() !== ''))];
        dirty = true;
      }
      if (dirty) changed.push(task);
    }
    if (changed.length > 0) await this.taskRepo.save(changed);
  }

  private async normalizeTaskDepts(
    primaryDept: string | null | undefined,
    relatedDepts: string[],
  ) {
    const primary = this.emptyToNull(primaryDept ?? null);
    const related = [
      ...new Set(
        relatedDepts
          .map((d) => d.trim())
          .filter((d) => d !== '' && d !== primary),
      ),
    ];
    const names = primary ? [primary, ...related] : related;
    if (names.length === 0) return related;
    const found = await this.departmentRepo.find();
    const known = new Set(found.map((d) => d.deptName));
    const unknown = names.filter((n) => !known.has(n));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `등록되지 않은 부서입니다: ${unknown.join(', ')}. 부서관리에서 먼저 추가해 주세요.`,
      );
    }
    return related;
  }
}
