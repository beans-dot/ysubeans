import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { IrUser } from '../../entities/ir-user.entity';
import { JwtPayload } from './jwt-payload';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(IrUser)
    private readonly usersRepo: Repository<IrUser>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'dev-jwt-secret-change-me',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.usersRepo.findOne({ where: { id: payload.sub } });
    if (!user || user.status !== 'approved') {
      throw new UnauthorizedException('유효하지 않은 세션입니다.');
    }
    return {
      sub: user.id,
      name: user.name,
      role: user.role,
    };
  }
}
