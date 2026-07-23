import { Body, Controller, Post } from '@nestjs/common';
import { PivotQueryDto } from './pivot.dto';
import { PivotService } from './pivot.service';

@Controller('pivot')
export class PivotController {
  constructor(private readonly pivotService: PivotService) {}

  @Post()
  pivot(@Body() body: PivotQueryDto) {
    return this.pivotService.pivot(body);
  }
}
