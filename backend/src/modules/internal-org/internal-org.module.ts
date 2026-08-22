import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  IrDepartment,
  IrInternalDepartment,
  IrInternalSeries,
  IrRawData,
} from '../../entities';
import { InternalOrgController } from './internal-org.controller';
import { InternalOrgService } from './internal-org.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IrInternalSeries,
      IrInternalDepartment,
      IrDepartment,
      IrRawData,
    ]),
  ],
  controllers: [InternalOrgController],
  providers: [InternalOrgService],
  exports: [InternalOrgService],
})
export class InternalOrgModule {}
