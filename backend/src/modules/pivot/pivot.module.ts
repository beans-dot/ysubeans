import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  IrDepartment,
  IrMetricRegistry,
  IrRawData,
  IrUniversityMaster,
} from '../../entities';
import { UniversitiesModule } from '../universities/universities.module';
import { PivotController } from './pivot.controller';
import { PivotService } from './pivot.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IrRawData,
      IrMetricRegistry,
      IrUniversityMaster,
      IrDepartment,
    ]),
    UniversitiesModule,
  ],
  controllers: [PivotController],
  providers: [PivotService],
})
export class PivotModule {}
