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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload } from '../auth/jwt-payload';
import { InternalOrgService } from './internal-org.service';
import { OfficeOrgService } from './office-org.service';
import { defaultOrgYear, orgYears } from './org.constants';
import { OrgVersioningService } from './org-versioning.service';

@Controller('internal-org')
export class InternalOrgController {
  constructor(
    private readonly internalOrgService: InternalOrgService,
    private readonly officeOrg: OfficeOrgService,
    private readonly versioning: OrgVersioningService,
  ) {}

  @Get('years')
  years() {
    return { years: orgYears(), defaultYear: defaultOrgYear() };
  }

  @Get('tree')
  getTree(@Query('year') year?: string) {
    return this.internalOrgService.getTree(this.parseYear(year));
  }

  @Roles('admin')
  @Post('series')
  createSeries(
    @Body() body: { seriesName: string; year: number },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.internalOrgService.createSeries(
      body.seriesName,
      body.year,
      user.sub,
    );
  }

  @Roles('admin')
  @Put('series/:id')
  updateSeries(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { seriesName: string; year: number },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.internalOrgService.updateSeries(
      id,
      body.seriesName,
      body.year,
      user.sub,
    );
  }

  @Roles('admin')
  @Delete('series/:id')
  deleteSeries(
    @Param('id', ParseIntPipe) id: number,
    @Query('year') year: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.internalOrgService.abolishSeries(
      id,
      this.requireYear(year),
      user.sub,
    );
  }

  @Roles('admin')
  @Post('departments')
  createDepartment(
    @Body() body: { seriesId: number; deptName: string; year: number },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.internalOrgService.createDepartment(
      body.seriesId,
      body.deptName,
      body.year,
      user.sub,
    );
  }

  @Roles('admin')
  @Put('departments/:id')
  updateDepartment(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: { deptName?: string; seriesId?: number; year: number },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.internalOrgService.updateDepartment(
      id,
      { deptName: body.deptName, seriesId: body.seriesId },
      body.year,
      user.sub,
    );
  }

  @Roles('admin')
  @Delete('departments/:id')
  deleteDepartment(
    @Param('id', ParseIntPipe) id: number,
    @Query('year') year: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.internalOrgService.abolishDepartment(
      id,
      this.requireYear(year),
      user.sub,
    );
  }

  @Roles('admin')
  @Put('reorder')
  reorder(
    @Body()
    body: {
      year: number;
      series?: { seriesId: number; displayOrder: number }[];
      departments?: {
        deptPk: number;
        seriesId: number;
        displayOrder: number;
      }[];
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.internalOrgService.reorder(body, body.year, user.sub);
  }

  @Get('offices')
  listOffices(@Query('year') year?: string) {
    return this.officeOrg.getTree(this.parseYear(year));
  }

  @Get('offices/selectable')
  listSelectableOffices(@Query('year') year?: string) {
    return this.officeOrg.listSelectable(this.parseYear(year));
  }

  @Roles('admin')
  @Post('offices')
  createOffice(
    @Body()
    body: {
      deptName: string;
      year: number;
      isCategory?: boolean;
      parentId?: number | null;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.officeOrg.createOffice(body, user.sub);
  }

  @Roles('admin')
  @Put('offices/reorder')
  reorderOffices(
    @Body()
    body: {
      year: number;
      items: {
        deptId: number;
        parentId: number | null;
        displayOrder: number;
      }[];
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.officeOrg.reorder(body, body.year, user.sub);
  }

  @Roles('admin')
  @Put('offices/:id')
  updateOffice(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      deptName?: string;
      year: number;
      parentId?: number | null;
      displayOrder?: number;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.officeOrg.updateOffice(id, body, user.sub);
  }

  @Roles('admin')
  @Delete('offices/:id')
  deleteOffice(
    @Param('id', ParseIntPipe) id: number,
    @Query('year') year: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.officeOrg.abolishOffice(id, this.requireYear(year), user.sub);
  }

  @Roles('admin')
  @Get('changes')
  listChanges() {
    return this.versioning.listChanges();
  }

  @Roles('admin')
  @Post('changes/:id/rollback')
  async rollback(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    const log = await this.versioning.getLog(id);
    if (log.kind === 'office') {
      return this.officeOrg.rollback(id, user.sub);
    }
    return this.internalOrgService.rollback(id, user.sub);
  }

  private parseYear(year?: string): number | undefined {
    if (year == null || year === '') return undefined;
    const parsed = Number.parseInt(year, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private requireYear(year?: string): number {
    const parsed = this.parseYear(year);
    if (parsed == null) {
      this.versioning.assertYear(NaN);
    }
    return parsed as number;
  }
}
