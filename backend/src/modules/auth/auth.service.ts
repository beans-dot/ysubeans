import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { IrLoginLog } from '../../entities/ir-login-log.entity';
import { IrUser } from '../../entities/ir-user.entity';
import { MailService } from '../mail/mail.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { FindAccountDto } from './dto/find-account.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtPayload } from './jwt-payload';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(IrUser)
    private readonly usersRepo: Repository<IrUser>,
    @InjectRepository(IrLoginLog)
    private readonly loginLogRepo: Repository<IrLoginLog>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async onModuleInit() {
    await this.ensureAdminSeed();
  }

  private async ensureAdminSeed() {
    const existing = await this.usersRepo.findOne({ where: { id: 'admin' } });
    if (existing) return;

    const passwordHash = await bcrypt.hash('21672167', 10);
    await this.usersRepo.save(
      this.usersRepo.create({
        id: 'admin',
        name: '관리자',
        email: 'admin@yeonsung.ac.kr',
        passwordHash,
        department: '기획처 IR센터',
        extension: '-',
        role: 'admin',
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: 'system',
      }),
    );
  }

  private toPublicUser(user: IrUser) {
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

  async register(dto: RegisterDto) {
    const id = dto.id.trim();
    const email = dto.email.trim().toLowerCase();

    const idTaken = await this.usersRepo.exist({ where: { id } });
    if (idTaken) {
      throw new ConflictException('이미 사용 중인 아이디입니다.');
    }
    const emailTaken = await this.usersRepo.exist({ where: { email } });
    if (emailTaken) {
      throw new ConflictException('이미 사용 중인 이메일입니다.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersRepo.save(
      this.usersRepo.create({
        id,
        name: dto.name.trim(),
        email,
        passwordHash,
        department: dto.department.trim(),
        extension: dto.extension.trim(),
        role: 'user',
        status: 'pending',
      }),
    );

    return {
      message: '회원가입 신청이 접수되었습니다.',
      user: this.toPublicUser(user),
    };
  }

  async login(
    dto: LoginDto,
    meta: { ip?: string | null; userAgent?: string | null },
  ) {
    const id = dto.id.trim();
    const user = await this.usersRepo.findOne({ where: { id } });

    if (!user) {
      await this.writeLoginLog({
        userId: id,
        success: false,
        failReason: 'invalid_credentials',
        ...meta,
      });
      throw new UnauthorizedException(
        '아이디 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      await this.writeLoginLog({
        userId: id,
        success: false,
        failReason: 'invalid_credentials',
        ...meta,
      });
      throw new UnauthorizedException(
        '아이디 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    if (user.status === 'pending') {
      await this.writeLoginLog({
        userId: id,
        success: false,
        failReason: 'pending',
        ...meta,
      });
      throw new UnauthorizedException(
        '관리자 승인 대기 중입니다. 승인 후 로그인할 수 있습니다.',
      );
    }

    if (user.status === 'rejected') {
      await this.writeLoginLog({
        userId: id,
        success: false,
        failReason: 'rejected',
        ...meta,
      });
      throw new UnauthorizedException(
        '회원가입 신청이 거절되었습니다. IR센터로 문의해 주세요.',
      );
    }

    await this.writeLoginLog({
      userId: id,
      success: true,
      failReason: null,
      ...meta,
    });

    const payload: JwtPayload = {
      sub: user.id,
      name: user.name,
      role: user.role,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    };
  }

  async me(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user || user.status !== 'approved') {
      throw new UnauthorizedException('유효하지 않은 세션입니다.');
    }
    return {
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email,
      department: user.department,
      extension: user.extension,
    };
  }

  async findId(dto: FindAccountDto) {
    const name = dto.name.trim();
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersRepo.findOne({ where: { name, email } });
    if (!user) {
      throw new NotFoundException('일치하는 회원 정보가 없습니다.');
    }
    return { id: user.id };
  }

  async resetPasswordByAccount(dto: FindAccountDto) {
    const name = dto.name.trim();
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersRepo.findOne({ where: { name, email } });
    if (!user) {
      throw new NotFoundException('일치하는 회원 정보가 없습니다.');
    }
    if (user.status !== 'approved') {
      throw new BadRequestException(
        '승인된 회원만 비밀번호를 재설정할 수 있습니다.',
      );
    }

    const tempPassword = this.generateTempPassword();
    user.passwordHash = await bcrypt.hash(tempPassword, 10);
    await this.usersRepo.save(user);

    await this.mailService.sendTempPassword(
      user.email,
      user.id,
      tempPassword,
      'self',
    );

    return {
      ok: true,
      message: '가입하신 이메일로 임시 비밀번호가 발급되었습니다.',
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user || user.status !== 'approved') {
      throw new UnauthorizedException('유효하지 않은 세션입니다.');
    }

    const email = dto.email.trim().toLowerCase();
    if (email !== user.email) {
      const emailTaken = await this.usersRepo.exist({ where: { email } });
      if (emailTaken) {
        throw new ConflictException('이미 사용 중인 이메일입니다.');
      }
    }

    user.name = dto.name.trim();
    user.email = email;
    user.department = dto.department.trim();
    user.extension = dto.extension.trim();
    await this.usersRepo.save(user);

    return this.me(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user || user.status !== 'approved') {
      throw new UnauthorizedException('유효하지 않은 세션입니다.');
    }

    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) {
      throw new BadRequestException('현재 비밀번호가 올바르지 않습니다.');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.usersRepo.save(user);

    return { ok: true, message: '비밀번호가 변경되었습니다.' };
  }

  private async writeLoginLog(input: {
    userId: string;
    success: boolean;
    failReason: string | null;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    await this.loginLogRepo.save(
      this.loginLogRepo.create({
        userId: input.userId,
        success: input.success,
        failReason: input.failReason,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      }),
    );
  }
}
