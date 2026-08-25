import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload';
import { CreateExportLogDto } from './dto/create-export-log.dto';
import { UsersService } from './users.service';

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

@Controller('export-logs')
export class ExportLogsController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Body() body: CreateExportLogDto,
  ) {
    return this.usersService.recordExport({
      userId: user.sub,
      userName: user.name,
      format: body.format,
      source: body.source,
      filename: body.filename,
      summary: body.summary ?? null,
      ip: clientIpFromRequest(req),
    });
  }
}
