import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { AnnualEventCategory } from '../../entities/ir-annual-event.entity';
import { AnnualEventsService } from './annual-events.service';

@Controller('annual-events')
export class AnnualEventsController {
  constructor(private readonly annualEventsService: AnnualEventsService) {}

  @Get()
  list(@Query('year') year?: string) {
    const parsed =
      year != null && year !== '' ? Number.parseInt(year, 10) : undefined;
    return this.annualEventsService.list(
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }

  @Post()
  create(
    @Body()
    body: {
      year: number;
      category: AnnualEventCategory;
      content: string;
    },
  ) {
    return this.annualEventsService.create(body);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: Partial<{
      year: number;
      category: AnnualEventCategory;
      content: string;
    }>,
  ) {
    return this.annualEventsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.annualEventsService.remove(id);
  }
}
