import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload } from '../auth/jwt-payload';
import {
  CreateFundSourceDto,
  KpiValueDto,
  ReplaceSubtasksDto,
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
  YearQueryDto,
} from './dto/strategic-plan.dto';
import {
  StrategicPlanService,
  type SpCompareIndicator,
} from './strategic-plan.service';

@Controller('strategic-plan')
export class StrategicPlanController {
  constructor(private readonly service: StrategicPlanService) {}

  /* ── 대시보드: 로그인 사용자 전원 ── */

  @Get('tree')
  getTree() {
    return this.service.getTree();
  }

  @Get('compare')
  getCompare() {
    return this.service.getCompare();
  }

  @Get('fund-sources')
  listFundSources(@Query('includeInactive') includeInactive?: string) {
    return this.service.listFundSources(includeInactive === 'true');
  }

  @Get('evaluations')
  listEvaluations(@Query() query: YearQueryDto) {
    return this.service.listEvaluations(query.year);
  }

  @Put('evaluations')
  upsertEvaluation(
    @Body() dto: UpsertEvaluationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.upsertEvaluation(dto, user.sub);
  }

  @Get('budgets')
  listBudgets(@Query() query: YearQueryDto) {
    return this.service.listBudgets(query.year);
  }

  @Put('budgets')
  upsertBudget(@Body() dto: UpsertBudgetDto, @CurrentUser() user: JwtPayload) {
    return this.service.upsertBudget(dto, user.sub);
  }

  /* ── 관리자: 체계 ── */

  @Roles('admin')
  @Post('goals')
  createGoal(@Body() dto: UpsertGoalDto) {
    return this.service.createGoal(dto);
  }

  @Roles('admin')
  @Put('goals/:goalId')
  updateGoal(@Param('goalId') goalId: string, @Body() dto: UpdateGoalDto) {
    return this.service.updateGoal(goalId, dto);
  }

  @Roles('admin')
  @Delete('goals/:goalId')
  deleteGoal(@Param('goalId') goalId: string) {
    return this.service.deleteGoal(goalId);
  }

  @Roles('admin')
  @Post('strategies')
  createStrategy(@Body() dto: UpsertStrategyDto) {
    return this.service.createStrategy(dto);
  }

  @Roles('admin')
  @Put('strategies/:strategyId')
  updateStrategy(
    @Param('strategyId') strategyId: string,
    @Body() dto: UpdateStrategyDto,
  ) {
    return this.service.updateStrategy(strategyId, dto);
  }

  @Roles('admin')
  @Delete('strategies/:strategyId')
  deleteStrategy(@Param('strategyId') strategyId: string) {
    return this.service.deleteStrategy(strategyId);
  }

  @Roles('admin')
  @Post('tasks')
  createTask(@Body() dto: UpsertTaskDto) {
    return this.service.createTask(dto);
  }

  @Roles('admin')
  @Put('tasks/:taskCode')
  updateTask(@Param('taskCode') taskCode: string, @Body() dto: UpdateTaskDto) {
    return this.service.updateTask(taskCode, dto);
  }

  @Roles('admin')
  @Delete('tasks/:taskCode')
  deleteTask(@Param('taskCode') taskCode: string) {
    return this.service.deleteTask(taskCode);
  }

  @Roles('admin')
  @Put('tasks/:taskCode/subtasks')
  replaceSubtasks(
    @Param('taskCode') taskCode: string,
    @Body() dto: ReplaceSubtasksDto,
  ) {
    return this.service.replaceSubtasks(taskCode, dto);
  }

  /* ── 관리자: KPI 목표·실적 ── */

  @Roles('admin')
  @Post('kpis')
  createKpi(@Body() dto: UpsertKpiDto) {
    return this.service.createKpi(dto);
  }

  @Roles('admin')
  @Put('kpis/:kpiCode')
  updateKpi(@Param('kpiCode') kpiCode: string, @Body() dto: UpdateKpiDto) {
    return this.service.updateKpi(kpiCode, dto);
  }

  @Roles('admin')
  @Delete('kpis/:kpiCode')
  deleteKpi(@Param('kpiCode') kpiCode: string) {
    return this.service.deleteKpi(kpiCode);
  }

  @Roles('admin')
  @Put('kpis/:kpiCode/targets/:year')
  setKpiTarget(
    @Param('kpiCode') kpiCode: string,
    @Param('year', ParseIntPipe) year: number,
    @Body() dto: KpiValueDto,
  ) {
    return this.service.setKpiTarget(kpiCode, year, dto.value ?? null);
  }

  @Roles('admin')
  @Put('kpis/:kpiCode/results/:year')
  setKpiResult(
    @Param('kpiCode') kpiCode: string,
    @Param('year', ParseIntPipe) year: number,
    @Body() dto: KpiValueDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.setKpiResult(kpiCode, year, dto.value ?? null, user.sub);
  }

  /* ── 관리자: 재원 유형 ── */

  @Roles('admin')
  @Post('fund-sources')
  createFundSource(@Body() dto: CreateFundSourceDto) {
    return this.service.createFundSource(dto);
  }

  @Roles('admin')
  @Put('fund-sources/:fundSourceId')
  updateFundSource(
    @Param('fundSourceId', ParseIntPipe) fundSourceId: number,
    @Body() dto: UpdateFundSourceDto,
  ) {
    return this.service.updateFundSource(fundSourceId, dto);
  }

  @Roles('admin')
  @Delete('fund-sources/:fundSourceId')
  deleteFundSource(
    @Param('fundSourceId', ParseIntPipe) fundSourceId: number,
  ) {
    return this.service.deleteFundSource(fundSourceId);
  }

  /* ── 관리자: 비전·비교 ── */

  @Roles('admin')
  @Put('vision')
  updateVision(@Body() dto: UpdateVisionDto) {
    return this.service.updateVision(dto);
  }

  @Roles('admin')
  @Put('compare')
  replaceCompare(
    @Body() body: { years: number[]; indicators: SpCompareIndicator[] },
  ) {
    return this.service.replaceCompare(body);
  }
}
