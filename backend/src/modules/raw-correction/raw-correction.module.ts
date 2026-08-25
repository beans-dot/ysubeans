import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  IrDataAuditLog,
  IrDepartment,
  IrRawData,
  IrUniversityMaster,
} from '../../entities';
import { InternalOrgModule } from '../internal-org/internal-org.module';
import { RawCorrectionController } from './raw-correction.controller';
import { RawCorrectionService } from './raw-correction.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IrRawData,
      IrDataAuditLog,
      IrUniversityMaster,
      IrDepartment,
    ]),
    InternalOrgModule,
  ],
  controllers: [RawCorrectionController],
  providers: [RawCorrectionService],
})
export class RawCorrectionModule {}
