import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IrDataAuditLog, IrRawData } from '../../entities';
import { RawCorrectionController } from './raw-correction.controller';
import { RawCorrectionService } from './raw-correction.service';

@Module({
  imports: [TypeOrmModule.forFeature([IrRawData, IrDataAuditLog])],
  controllers: [RawCorrectionController],
  providers: [RawCorrectionService],
})
export class RawCorrectionModule {}
