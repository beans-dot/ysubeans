import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IrLoginLog } from '../../entities/ir-login-log.entity';
import { IrUser } from '../../entities/ir-user.entity';
import { MailModule } from '../mail/mail.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([IrUser, IrLoginLog]), MailModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
