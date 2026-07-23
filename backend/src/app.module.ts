import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildTypeOrmOptions } from './config/typeorm.config';
import { AlimiModule } from './modules/alimi/alimi.module';
import { AnnualEventsModule } from './modules/annual-events/annual-events.module';
import { AuthModule } from './modules/auth/auth.module';
import { MailModule } from './modules/mail/mail.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { PivotModule } from './modules/pivot/pivot.module';
import { PresetsModule } from './modules/presets/presets.module';
import { UniversitiesModule } from './modules/universities/universities.module';
import { UpdateLogModule } from './modules/update-log/update-log.module';
import { RawCorrectionModule } from './modules/raw-correction/raw-correction.module';
import { UploadModule } from './modules/upload/upload.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(buildTypeOrmOptions()),
    AuthModule,
    UsersModule,
    MailModule,
    MetricsModule,
    UniversitiesModule,
    PivotModule,
    PresetsModule,
    UpdateLogModule,
    AlimiModule,
    UploadModule,
    AnnualEventsModule,
    RawCorrectionModule,
  ],
})
export class AppModule {}
