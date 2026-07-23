import { Module } from '@nestjs/common';
import { AlimiController } from './alimi.controller';
import { AlimiService } from './alimi.service';

@Module({
  controllers: [AlimiController],
  providers: [AlimiService],
  exports: [AlimiService],
})
export class AlimiModule {}
