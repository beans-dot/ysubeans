import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { DeleteRawCorrectionDto } from './dto/delete-raw-correction.dto';
import { UpdateRawValueDto } from './dto/update-raw-value.dto';
import {
  type EditableSourceType,
  RawCorrectionService,
} from './raw-correction.service';

function parseEditableSourceType(raw?: string): EditableSourceType {
  if (raw == null || raw === '' || raw === 'INTERNAL') return 'INTERNAL';
  if (raw === 'MONITORING') return 'MONITORING';
  throw new BadRequestException(
    'sourceType은 INTERNAL 또는 MONITORING 이어야 합니다.',
  );
}

function clientIpFromRequest(req: Request): string | null {
  return (
    (req.headers['x-forwarded-for'] as string | undefined)
      ?.split(',')[0]
      ?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    null
  );
}

@Controller('raw-correction')
@Roles('admin')
export class RawCorrectionController {
  constructor(private readonly rawCorrectionService: RawCorrectionService) {}

  @Get('years')
  listYears(@Query('sourceType') sourceType?: string) {
    return this.rawCorrectionService.listYears(
      parseEditableSourceType(sourceType),
    );
  }

  @Get()
  list(
    @Query('year') year?: string,
    @Query('sourceType') sourceType?: string,
    @Query('univCode') univCode?: string,
    @Query('deptCode') deptCode?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const parsedYear = year != null && year !== '' ? Number.parseInt(year, 10) : NaN;
    if (!Number.isFinite(parsedYear)) {
      throw new BadRequestException('year 쿼리는 필수입니다.');
    }

    const parsedPage = page != null && page !== '' ? Number.parseInt(page, 10) : 1;
    const parsedPageSize =
      pageSize != null && pageSize !== '' ? Number.parseInt(pageSize, 10) : 100;

    const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const safePageSize = Math.min(
      500,
      Math.max(
        1,
        Number.isFinite(parsedPageSize) && parsedPageSize > 0
          ? parsedPageSize
          : 100,
      ),
    );

    return this.rawCorrectionService.list({
      year: parsedYear,
      sourceType: parseEditableSourceType(sourceType),
      univCode: univCode?.trim() || undefined,
      deptCode: deptCode?.trim() || undefined,
      q: q?.trim() || undefined,
      page: safePage,
      pageSize: safePageSize,
    });
  }

  @Delete()
  removeMany(@Body() dto: DeleteRawCorrectionDto, @Req() req: Request) {
    return this.rawCorrectionService.removeMany(
      dto.rawIds,
      clientIpFromRequest(req),
    );
  }

  @Patch(':rawId')
  update(
    @Param('rawId', ParseIntPipe) rawId: number,
    @Body() dto: UpdateRawValueDto,
    @Req() req: Request,
  ) {
    return this.rawCorrectionService.updateValue(
      rawId,
      dto.metricValue,
      clientIpFromRequest(req),
    );
  }
}
