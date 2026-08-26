import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IrAnnualEvent } from '../../entities/ir-annual-event.entity';
import { AnnualEventsController } from './annual-events.controller';
import { AnnualEventsService } from './annual-events.service';

@Module({
  imports: [TypeOrmModule.forFeature([IrAnnualEvent])],
  controllers: [AnnualEventsController],
  providers: [AnnualEventsService],
  exports: [AnnualEventsService],
})
export class AnnualEventsModule {}
