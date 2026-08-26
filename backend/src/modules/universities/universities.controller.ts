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
  getTree(
    @Query('scope') scope?: string,
    @Query('year') year?: string,
    @Query('years') years?: string,
  ) {
    const parsedYear =
      year != null && year !== '' ? Number.parseInt(year, 10) : undefined;
    const parsedYears = years
      ?.split(',')
      .map((v) => Number.parseInt(v.trim(), 10))
      .filter((v) => Number.isFinite(v));
    return this.universitiesService.getTargetTree(
      scope === 'internal' ? 'internal' : undefined,
      Number.isFinite(parsedYear) ? parsedYear : undefined,
      parsedYears && parsedYears.length > 0 ? parsedYears : undefined,
    );
  }

  /** 업로드용 코드북 (DB 실시간 — 알리미 배치 반영) */
  @Get('codebook')
  getCodebook(@Query('year') year?: string) {
    const parsed =
      year != null && year !== '' ? Number.parseInt(year, 10) : undefined;
    return this.universitiesService.getCodebook(
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }
}
