import { Controller, Post } from '@nestjs/common';
import { AlimiService } from './alimi.service';

@Controller('alimi')
export class AlimiController {
  constructor(private readonly alimiService: AlimiService) {}

  // 수동 트리거 (정기 배치와 동일: 당해 연도만)
  @Post('batch')
  async runBatch() {
    return this.alimiService.runCurrentYearBatch();
  }
}
