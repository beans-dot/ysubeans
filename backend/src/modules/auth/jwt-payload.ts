import { UserRole } from '../../entities/ir-user.entity';

export interface JwtPayload {
  sub: string;
  name: string;
  role: UserRole;
}
