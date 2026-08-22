import { Controller, Get, Query } from '@nestjs/common';
import { UniversitiesService } from './universities.service';

@Controller('universities')
export class UniversitiesController {
  constructor(private readonly universitiesService: UniversitiesService) {}

  @Get()
  list() {
    return this.universitiesService.list();
  }

  // 대상 선택 Multi-depth 트리
  @Get('tree')
  getTree(@Query('scope') scope?: string) {
    return this.universitiesService.getTargetTree(
      scope === 'internal' ? 'internal' : undefined,
    );
  }

  /** 업로드용 코드북 (DB 실시간 — 알리미 배치 반영) */
  @Get('codebook')
  getCodebook() {
    return this.universitiesService.getCodebook();
  }
}
