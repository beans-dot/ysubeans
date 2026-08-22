import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IrDepartment, IrUniversityMaster } from '../../entities';
import { InternalOrgModule } from '../internal-org/internal-org.module';
import { UniversitiesController } from './universities.controller';
import { UniversitiesService } from './universities.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IrUniversityMaster, IrDepartment]),
    InternalOrgModule,
  ],
  controllers: [UniversitiesController],
  providers: [UniversitiesService],
  exports: [UniversitiesService],
})
export class UniversitiesModule {}
