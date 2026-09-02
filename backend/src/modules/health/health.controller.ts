import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

@Controller()
export class HealthController {
  @Public()
  @Get()
  root() {
    return { status: 'ok' };
  }

  @Public()
  @Get(['health', 'api/health'])
  health() {
    return { status: 'ok' };
  }
}
