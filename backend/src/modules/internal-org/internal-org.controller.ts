import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { InternalOrgService } from './internal-org.service';

@Controller('internal-org')
export class InternalOrgController {
  constructor(private readonly internalOrgService: InternalOrgService) {}

  @Get('tree')
  getTree() {
    return this.internalOrgService.getTree();
  }

  @Post('series')
  createSeries(@Body() body: { seriesName: string }) {
    return this.internalOrgService.createSeries(body.seriesName);
  }

  @Put('series/:id')
  updateSeries(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { seriesName: string },
  ) {
    return this.internalOrgService.updateSeries(id, body.seriesName);
  }

  @Delete('series/:id')
  deleteSeries(@Param('id', ParseIntPipe) id: number) {
    return this.internalOrgService.deleteSeries(id);
  }

  @Post('departments')
  createDepartment(@Body() body: { seriesId: number; deptName: string }) {
    return this.internalOrgService.createDepartment(
      body.seriesId,
      body.deptName,
    );
  }

  @Put('departments/:id')
  updateDepartment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { deptName?: string; seriesId?: number },
  ) {
    return this.internalOrgService.updateDepartment(id, body);
  }

  @Delete('departments/:id')
  deleteDepartment(@Param('id', ParseIntPipe) id: number) {
    return this.internalOrgService.deleteDepartment(id);
  }

  @Put('reorder')
  reorder(
    @Body()
    body: {
      series?: { seriesId: number; displayOrder: number }[];
      departments?: {
        deptPk: number;
        seriesId: number;
        displayOrder: number;
      }[];
    },
  ) {
    return this.internalOrgService.reorder(body);
  }
}
