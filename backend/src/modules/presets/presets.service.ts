import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IrUserPreset } from '../../entities';

@Injectable()
export class PresetsService {
  constructor(
    @InjectRepository(IrUserPreset)
    private readonly presetRepo: Repository<IrUserPreset>,
  ) {}

  async list(userId = 'default'): Promise<IrUserPreset[]> {
    return this.presetRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async get(presetId: number): Promise<IrUserPreset> {
    const preset = await this.presetRepo.findOne({ where: { presetId } });
    if (!preset) throw new NotFoundException('프리셋을 찾을 수 없습니다.');
    return preset;
  }

  async save(data: {
    userId?: string;
    presetName: string;
    savedFilterJson: Record<string, unknown>;
  }): Promise<IrUserPreset> {
    return this.presetRepo.save(
      this.presetRepo.create({
        userId: data.userId || 'default',
        presetName: data.presetName,
        savedFilterJson: data.savedFilterJson,
      }),
    );
  }

  async remove(presetId: number): Promise<{ ok: true }> {
    await this.presetRepo.delete(presetId);
    return { ok: true };
  }
}
