import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IrExportLog } from '../../entities/ir-export-log.entity';
import { IrLoginLog } from '../../entities/ir-login-log.entity';
import { IrUser } from '../../entities/ir-user.entity';
import { MailModule } from '../mail/mail.module';
import { ExportLogsController } from './export-logs.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IrUser, IrLoginLog, IrExportLog]),
    MailModule,
  ],
  controllers: [UsersController, ExportLogsController],
  providers: [UsersService],
})
export class UsersModule {}
