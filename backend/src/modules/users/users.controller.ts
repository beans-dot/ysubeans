import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload } from '../auth/jwt-payload';
import { type UserStatus } from '../../entities/ir-user.entity';
import { type ActivityKind, UsersService } from './users.service';

function parseStatus(raw?: string): UserStatus | undefined {
  if (raw === 'pending' || raw === 'approved' || raw === 'rejected') return raw;
  return undefined;
}

function parseKind(raw?: string): ActivityKind {
  if (raw === 'login' || raw === 'export') return raw;
  return 'all';
}

@Controller('users')
@Roles('admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.usersService.list(parseStatus(status));
  }

  @Get('activity')
  activity(@Query('kind') kind?: string) {
    return this.usersService.activity(parseKind(kind));
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.usersService.detail(id);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.usersService.approve(id, admin.sub);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.usersService.reject(id, admin.sub);
  }

  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string) {
    return this.usersService.resetPassword(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.usersService.remove(id, admin.sub);
  }
}
