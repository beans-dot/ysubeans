import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { PresetsService } from './presets.service';

@Controller('presets')
export class PresetsController {
  constructor(private readonly presetsService: PresetsService) {}

  @Get()
  list(@Query('userId') userId?: string, @Query('scope') scope?: string) {
    return this.presetsService.list(userId, scope);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.presetsService.get(id);
  }

  @Post()
  save(
    @Body()
    body: {
      userId?: string;
      presetName: string;
      savedFilterJson: Record<string, unknown>;
      scope?: string;
    },
  ) {
    return this.presetsService.save(body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.presetsService.remove(id);
  }
}
