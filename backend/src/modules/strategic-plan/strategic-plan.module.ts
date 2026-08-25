import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
} from '../../entities';
import { StrategicPlanController } from './strategic-plan.controller';
import { StrategicPlanService } from './strategic-plan.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IrSpVision,
      IrSpGoal,
      IrSpStrategy,
      IrSpTask,
      IrSpSubtask,
      IrSpKpi,
      IrSpKpiTarget,
      IrSpKpiResult,
      IrSpEvaluation,
      IrSpCompareData,
      IrSpFundSource,
      IrSpDepartment,
      IrSpTaskBudget,
    ]),
  ],
  controllers: [StrategicPlanController],
  providers: [StrategicPlanService],
  exports: [StrategicPlanService],
})
export class StrategicPlanModule {}
