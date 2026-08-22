import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IrMetricCategory, IrMetricRegistry } from '../../entities';
import { UNCATEGORIZED_CATEGORY_NAME } from './metric.constants';

export interface MetricNode {
  metricId: number;
  metricName: string;
  metricUnit: string | null;
  sourceType: 'ALIMI' | 'INTERNAL';
  displayOrder: number;
}

export interface CategoryTreeNode {
  categoryId: number;
  categoryName: string;
  displayOrder: number;
  sourceType: 'ALIMI' | 'INTERNAL';
  metrics: MetricNode[];
}

@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(IrMetricCategory)
    private readonly categoryRepo: Repository<IrMetricCategory>,
    @InjectRepository(IrMetricRegistry)
    private readonly metricRepo: Repository<IrMetricRegistry>,
  ) {}

  private domainReady = false;

  /**
   * 엑셀 업로드 대기용 「분류없음」 카테고리를 출처별로 보장하고 최상단(displayOrder=-1)으로 유지.
   */
  async ensureUncategorizedCategory(
    sourceType: 'ALIMI' | 'INTERNAL' = 'ALIMI',
  ): Promise<IrMetricCategory> {
    let cat = await this.categoryRepo.findOne({
      where: { categoryName: UNCATEGORIZED_CATEGORY_NAME, sourceType },
    });
    if (!cat) {
      cat = await this.categoryRepo.save(
        this.categoryRepo.create({
          categoryName: UNCATEGORIZED_CATEGORY_NAME,
          sourceType,
          displayOrder: -1,
        }),
      );
    } else if (cat.displayOrder !== -1) {
      await this.categoryRepo.update(cat.categoryId, { displayOrder: -1 });
      cat.displayOrder = -1;
    }
    return cat;
  }

  /**
   * 기존 카테고리/지표를 대학정보공시(ALIMI) · 대학자체데이터(INTERNAL) 위계로 분리.
   */
  private async ensureMetricDomains(): Promise<void> {
    if (this.domainReady) {
      await this.ensureUncategorizedCategory('ALIMI');
      await this.ensureUncategorizedCategory('INTERNAL');
      return;
    }

    const categories = await this.categoryRepo.find();
    const metrics = await this.metricRepo.find();

    for (const cat of categories) {
      const sourceType = cat.sourceType === 'INTERNAL' ? 'INTERNAL' : 'ALIMI';
      if (cat.sourceType !== sourceType) {
        cat.sourceType = sourceType;
        await this.categoryRepo.save(cat);
      }
    }

    await this.ensureUncategorizedCategory('ALIMI');
    await this.ensureUncategorizedCategory('INTERNAL');

    for (const metric of metrics) {
      if (metric.sourceType !== 'INTERNAL') continue;
      const current = categories.find((c) => c.categoryId === metric.categoryId);
      if (current?.sourceType === 'INTERNAL') continue;

      const name = current?.categoryName ?? UNCATEGORIZED_CATEGORY_NAME;
      let dest = await this.categoryRepo.findOne({
        where: { categoryName: name, sourceType: 'INTERNAL' },
      });
      if (!dest) {
        dest = await this.categoryRepo.save(
          this.categoryRepo.create({
            categoryName: name,
            sourceType: 'INTERNAL',
            displayOrder: current?.displayOrder ?? 0,
          }),
        );
      }
      await this.metricRepo.update(metric.metricId, {
        categoryId: dest.categoryId,
      });
    }

    this.domainReady = true;
  }

  /**
   * 업무 주제별 카테고리 기준 지표 트리.
   * sourceType이 있으면 해당 출처(공시/자체)만 반환.
   * 「분류없음」은 항상 최상단에 노출.
   */
  async getCategoryTree(
    sourceType?: 'ALIMI' | 'INTERNAL',
  ): Promise<CategoryTreeNode[]> {
    await this.ensureMetricDomains();

    const categories = await this.categoryRepo.find({
      where: sourceType ? { sourceType } : undefined,
      order: { displayOrder: 'ASC', categoryId: 'ASC' },
    });
    const metrics = await this.metricRepo.find({
      where: sourceType ? { sourceType } : undefined,
      order: { displayOrder: 'ASC', metricId: 'ASC' },
    });

    const nodes = categories.map((cat) => ({
      categoryId: cat.categoryId,
      categoryName: cat.categoryName,
      displayOrder: cat.displayOrder,
      sourceType: cat.sourceType,
      metrics: metrics
        .filter((m) => m.categoryId === cat.categoryId)
        .map((m) => ({
          metricId: m.metricId,
          metricName: m.metricName,
          metricUnit: m.metricUnit,
          sourceType: m.sourceType,
          displayOrder: m.displayOrder,
        })),
    }));

    return nodes.sort((a, b) => {
      if (a.categoryName === UNCATEGORIZED_CATEGORY_NAME) return -1;
      if (b.categoryName === UNCATEGORIZED_CATEGORY_NAME) return 1;
      return (
        a.displayOrder - b.displayOrder || a.categoryId - b.categoryId
      );
    });
  }

  async listCategories(): Promise<IrMetricCategory[]> {
    await this.ensureMetricDomains();
    return this.categoryRepo.find({
      order: { displayOrder: 'ASC' },
    });
  }

  /**
   * 업로드용 지표 코드북 (공시 ALIMI / 자체 INTERNAL 구분).
   * 관리자가 metric_name을 코드북에서 그대로 복사해 오타·띄어쓰기 중복을 줄인다.
   */
  async getCodebook(): Promise<{
    generatedAt: string;
    metrics: Array<{
      metricId: number;
      metricName: string;
      sourceType: 'ALIMI' | 'INTERNAL';
      sourceLabel: '공시' | '자체';
      categoryName: string;
      metricUnit: string | null;
    }>;
  }> {
    await this.ensureMetricDomains();

    const metrics = await this.metricRepo.find({
      relations: ['category'],
      order: {
        sourceType: 'ASC',
        metricName: 'ASC',
        metricId: 'ASC',
      },
    });

    return {
      generatedAt: new Date().toISOString(),
      metrics: metrics.map((m) => ({
        metricId: m.metricId,
        metricName: m.metricName,
        sourceType: m.sourceType,
        sourceLabel: m.sourceType === 'ALIMI' ? '공시' : '자체',
        categoryName: m.category?.categoryName ?? '',
        metricUnit: m.metricUnit,
      })),
    };
  }

  async createCategory(data: Partial<IrMetricCategory>): Promise<IrMetricCategory> {
    if (data.categoryName?.trim() === UNCATEGORIZED_CATEGORY_NAME) {
      throw new BadRequestException(
        `「${UNCATEGORIZED_CATEGORY_NAME}」은 시스템 카테고리입니다.`,
      );
    }
    const sourceType = data.sourceType === 'INTERNAL' ? 'INTERNAL' : 'ALIMI';
    return this.categoryRepo.save(
      this.categoryRepo.create({ ...data, sourceType }),
    );
  }

  async updateCategory(
    categoryId: number,
    data: { categoryName: string },
  ): Promise<IrMetricCategory> {
    const cat = await this.categoryRepo.findOne({ where: { categoryId } });
    if (!cat) {
      throw new NotFoundException('카테고리를 찾을 수 없습니다.');
    }
    if (cat.categoryName === UNCATEGORIZED_CATEGORY_NAME) {
      throw new BadRequestException(
        `「${UNCATEGORIZED_CATEGORY_NAME}」카테고리 이름은 변경할 수 없습니다.`,
      );
    }

    const name = data.categoryName?.trim();
    if (!name) {
      throw new BadRequestException('카테고리 이름을 입력해 주세요.');
    }
    if (name === UNCATEGORIZED_CATEGORY_NAME) {
      throw new BadRequestException(
        `「${UNCATEGORIZED_CATEGORY_NAME}」은 시스템 카테고리입니다.`,
      );
    }

    cat.categoryName = name;
    return this.categoryRepo.save(cat);
  }

  async createMetric(data: Partial<IrMetricRegistry>): Promise<IrMetricRegistry> {
    return this.metricRepo.save(this.metricRepo.create(data));
  }

  /**
   * 카테고리 삭제. 소속 지표는 「분류없음」으로 이동. 「분류없음」 자체는 삭제 불가.
   */
  async deleteCategory(categoryId: number): Promise<{ ok: true }> {
    const cat = await this.categoryRepo.findOne({ where: { categoryId } });
    if (!cat) {
      throw new NotFoundException('카테고리를 찾을 수 없습니다.');
    }
    if (cat.categoryName === UNCATEGORIZED_CATEGORY_NAME) {
      throw new BadRequestException(
        `「${UNCATEGORIZED_CATEGORY_NAME}」카테고리는 삭제할 수 없습니다.`,
      );
    }

    const uncategorized = await this.ensureUncategorizedCategory(
      cat.sourceType === 'INTERNAL' ? 'INTERNAL' : 'ALIMI',
    );
    await this.metricRepo.update(
      { categoryId },
      { categoryId: uncategorized.categoryId },
    );
    await this.categoryRepo.delete(categoryId);
    return { ok: true };
  }

  /**
   * TreeBuilder(관리자) 드래그&드롭 결과 반영: 카테고리/지표 display_order 및 소속 일괄 갱신.
   */
  async reorder(payload: {
    categories?: { categoryId: number; displayOrder: number }[];
    metrics?: { metricId: number; categoryId: number; displayOrder: number }[];
  }): Promise<{ ok: true }> {
    for (const c of payload.categories ?? []) {
      await this.categoryRepo.update(c.categoryId, {
        displayOrder: c.displayOrder,
      });
    }
    for (const m of payload.metrics ?? []) {
      await this.metricRepo.update(m.metricId, {
        categoryId: m.categoryId,
        displayOrder: m.displayOrder,
      });
    }
    // 「분류없음」은 항상 최상단 유지
    await this.ensureMetricDomains();
    return { ok: true };
  }
}
