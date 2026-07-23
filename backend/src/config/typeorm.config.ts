import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as entities from '../entities';

export const buildTypeOrmOptions = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'ir_user',
  password: process.env.DB_PASSWORD || 'ir_password',
  database: process.env.DB_DATABASE || 'ir_dashboard',
  entities: Object.values(entities),
  // 개발 편의를 위해 synchronize 사용 (운영 전환 시 migration 권장)
  synchronize: true,
  logging: process.env.DB_LOGGING === 'true',
});
