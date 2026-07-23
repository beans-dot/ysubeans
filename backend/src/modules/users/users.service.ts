import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { IrLoginLog } from '../../entities/ir-login-log.entity';
import { IrUser } from '../../entities/ir-user.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(IrUser)
    private readonly usersRepo: Repository<IrUser>,
    @InjectRepository(IrLoginLog)
    private readonly loginLogRepo: Repository<IrLoginLog>,
    private readonly mailService: MailService,
  ) {}

  private toPublic(user: IrUser) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department,
      extension: user.extension,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      approvedAt: user.approvedAt,
      approvedBy: user.approvedBy,
    };
  }

  async list() {
    const users = await this.usersRepo.find({
      order: {
        status: 'ASC',
        createdAt: 'DESC',
      },
    });
    // pending first for admin UX
    const rank = (s: string) =>
      s === 'pending' ? 0 : s === 'approved' ? 1 : 2;
    users.sort((a, b) => {
      const d = rank(a.status) - rank(b.status);
      if (d !== 0) return d;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    return users.map((u) => this.toPublic(u));
  }

  async detail(id: string) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('회원을 찾을 수 없습니다.');

    const loginLogs = await this.loginLogRepo.find({
      where: { userId: id },
      order: { createdAt: 'DESC' },
      take: 100,
    });

    return {
      user: this.toPublic(user),
      loginLogs: loginLogs.map((l) => ({
        logId: l.logId,
        userId: l.userId,
        success: l.success,
        ip: l.ip,
        userAgent: l.userAgent,
        failReason: l.failReason,
        createdAt: l.createdAt,
      })),
    };
  }

  async approve(id: string, adminId: string) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('회원을 찾을 수 없습니다.');
    if (user.status !== 'pending') {
      throw new BadRequestException('승인 대기 상태의 회원만 승인할 수 있습니다.');
    }
    user.status = 'approved';
    user.approvedAt = new Date();
    user.approvedBy = adminId;
    await this.usersRepo.save(user);
    return this.toPublic(user);
  }

  async reject(id: string, adminId: string) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('회원을 찾을 수 없습니다.');
    if (user.status !== 'pending') {
      throw new BadRequestException('승인 대기 상태의 회원만 거절할 수 있습니다.');
    }
    if (user.role === 'admin') {
      throw new BadRequestException('관리자 계정은 거절할 수 없습니다.');
    }
    user.status = 'rejected';
    user.approvedAt = new Date();
    user.approvedBy = adminId;
    await this.usersRepo.save(user);
    return this.toPublic(user);
  }

  async resetPassword(id: string) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('회원을 찾을 수 없습니다.');
    if (user.status !== 'approved') {
      throw new BadRequestException(
        '승인된 회원만 임시 비밀번호를 재설정할 수 있습니다.',
      );
    }

    const tempPassword = this.generateTempPassword();
    user.passwordHash = await bcrypt.hash(tempPassword, 10);
    await this.usersRepo.save(user);

    const mailResult = await this.mailService.sendTempPassword(
      user.email,
      user.id,
      tempPassword,
      'admin',
    );

    return {
      ok: true,
      email: user.email,
      mail: mailResult,
      message:
        mailResult.mode === 'dev-log'
          ? '임시 비밀번호가 발급되었습니다. (개발 모드: 서버 로그 확인)'
          : `${user.email} 으로 임시 비밀번호를 발송했습니다.`,
    };
  }

  async remove(id: string, adminId: string) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('회원을 찾을 수 없습니다.');
    if (user.id === adminId) {
      throw new BadRequestException('본인 계정은 탈퇴시킬 수 없습니다.');
    }
    if (user.role === 'admin') {
      throw new BadRequestException('관리자 계정은 탈퇴시킬 수 없습니다.');
    }

    await this.loginLogRepo.delete({ userId: id });
    await this.usersRepo.delete(id);
    return { ok: true };
  }

  private generateTempPassword(): string {
    const chars =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = crypto.randomBytes(10);
    let out = '';
    for (let i = 0; i < 10; i++) {
      out += chars[bytes[i] % chars.length];
    }
    return out;
  }
}
