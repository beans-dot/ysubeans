import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  IrDepartment,
  IrInternalDepartment,
  IrInternalSeries,
  IrOrgChangeLog,
  IrOrgItemVersion,
  IrRawData,
  IrSpDepartment,
  IrSpTask,
} from '../../entities';
import { AnnualEventsModule } from '../annual-events/annual-events.module';
import { InternalOrgController } from './internal-org.controller';
import { InternalOrgService } from './internal-org.service';
import { OfficeOrgService } from './office-org.service';
import { OrgAnnualSyncService } from './org-annual-sync.service';
import { OrgVersioningService } from './org-versioning.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IrInternalSeries,
      IrInternalDepartment,
      IrDepartment,
      IrRawData,
      IrOrgItemVersion,
      IrOrgChangeLog,
      IrSpDepartment,
      IrSpTask,
    ]),
    AnnualEventsModule,
  ],
  controllers: [InternalOrgController],
  providers: [
    InternalOrgService,
    OfficeOrgService,
    OrgVersioningService,
    OrgAnnualSyncService,
  ],
  exports: [InternalOrgService, OfficeOrgService],
})
export class InternalOrgModule {}
