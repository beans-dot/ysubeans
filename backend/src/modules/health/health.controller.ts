import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

@Public()
@Controller()
export class HealthController {
  @Get()
  root() {
    return { status: 'ok' };
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('api/health')
  apiHealth() {
    return { status: 'ok' };
  }
}
