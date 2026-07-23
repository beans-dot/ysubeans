import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload } from '../auth/jwt-payload';
import { UsersService } from './users.service';

@Controller('users')
@Roles('admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list() {
    return this.usersService.list();
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
