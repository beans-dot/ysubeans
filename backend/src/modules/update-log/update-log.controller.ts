import { Body, Controller, Get, Post } from '@nestjs/common';
import type { UpdateLogDetail } from '../../entities';
import { UpdateLogService } from './update-log.service';

@Controller('update-log')
export class UpdateLogController {
  constructor(private readonly updateLogService: UpdateLogService) {}

  // 중앙 Ticker용 최신 1건
  @Get('latest')
  latest() {
    return this.updateLogService.latest();
  }

  // /update-history 페이지용 전체 목록
  @Get()
  list() {
    return this.updateLogService.list();
  }

  @Post()
  add(
    @Body()
    body: {
      updateType: string;
      logText: string;
      detail?: UpdateLogDetail | null;
    },
  ) {
    return this.updateLogService.add(body);
  }
}
