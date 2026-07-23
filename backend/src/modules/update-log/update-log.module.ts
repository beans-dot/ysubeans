import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IrUpdateLog } from '../../entities';
import { UpdateLogController } from './update-log.controller';
import { UpdateLogService } from './update-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([IrUpdateLog])],
  controllers: [UpdateLogController],
  providers: [UpdateLogService],
  exports: [UpdateLogService],
})
export class UpdateLogModule {}
