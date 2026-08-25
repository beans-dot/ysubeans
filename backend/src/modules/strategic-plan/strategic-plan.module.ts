import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  IrSpChangeLog,
  IrSpCompareData,
  IrSpDepartment,
  IrSpEvaluation,
  IrSpFundSource,
  IrSpGoal,
  IrSpItemVersion,
  IrSpKpi,
  IrSpKpiResult,
  IrSpKpiTarget,
  IrSpStrategy,
  IrSpSubtask,
  IrSpTask,
  IrSpTaskBudget,
  IrSpVision,
} from '../../entities';
import { SpStructureService } from './sp-structure.service';
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
      IrSpItemVersion,
      IrSpChangeLog,
    ]),
  ],
  controllers: [StrategicPlanController],
  providers: [StrategicPlanService, SpStructureService],
  exports: [StrategicPlanService],
})
export class StrategicPlanModule {}
