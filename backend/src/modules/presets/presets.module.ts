import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IrUserPreset } from '../../entities';
import { PresetsController } from './presets.controller';
import { PresetsService } from './presets.service';

@Module({
  imports: [TypeOrmModule.forFeature([IrUserPreset])],
  controllers: [PresetsController],
  providers: [PresetsService],
})
export class PresetsModule {}
