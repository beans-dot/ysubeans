import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IrUpdateLog, type UpdateLogDetail } from '../../entities';

@Injectable()
export class UpdateLogService {
  constructor(
    @InjectRepository(IrUpdateLog)
    private readonly logRepo: Repository<IrUpdateLog>,
  ) {}

  async latest(): Promise<IrUpdateLog | null> {
    return this.logRepo.findOne({
      where: {},
      order: { updateDate: 'DESC', logId: 'DESC' },
    });
  }

  async list(limit = 100): Promise<IrUpdateLog[]> {
    return this.logRepo.find({
      order: { updateDate: 'DESC', logId: 'DESC' },
      take: limit,
    });
  }

  async add(data: {
    updateType: string;
    logText: string;
    detail?: UpdateLogDetail | null;
  }): Promise<IrUpdateLog> {
    return this.logRepo.save(this.logRepo.create(data));
  }
}
