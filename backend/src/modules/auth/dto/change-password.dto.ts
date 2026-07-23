import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Match } from './match.decorator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  @Match('newPassword', { message: '비밀번호 확인이 일치하지 않습니다.' })
  newPasswordConfirm: string;
}
