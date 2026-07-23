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
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  // 업무 주제별 카테고리 지표 트리 (Dual-Listbox 모달용)
  @Get('tree')
  getTree() {
    return this.metricsService.getCategoryTree();
  }

  /** 업로드용 지표 코드북 (공시/자체 구분) */
  @Get('codebook')
  getCodebook() {
    return this.metricsService.getCodebook();
  }

  @Get('categories')
  listCategories() {
    return this.metricsService.listCategories();
  }

  @Post('categories')
  createCategory(@Body() body: { categoryName: string; displayOrder?: number }) {
    return this.metricsService.createCategory(body);
  }

  @Put('categories/:id')
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { categoryName: string },
  ) {
    return this.metricsService.updateCategory(id, body);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.metricsService.deleteCategory(id);
  }

  @Post()
  createMetric(
    @Body()
    body: {
      categoryId: number;
      sourceType: 'ALIMI' | 'INTERNAL';
      metricName: string;
      metricUnit?: string;
      aggregationType?: string;
      displayOrder?: number;
    },
  ) {
    return this.metricsService.createMetric(body);
  }

  @Put('reorder')
  reorder(
    @Body()
    body: {
      categories?: { categoryId: number; displayOrder: number }[];
      metrics?: { metricId: number; categoryId: number; displayOrder: number }[];
    },
  ) {
    return this.metricsService.reorder(body);
  }
}
