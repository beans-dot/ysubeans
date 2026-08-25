import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AFFILIATION_TYPES } from '../affiliation';
import { Match } from './match.decorator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9._-]{3,50}$/, {
    message: '아이디는 영문/숫자/._- 3~50자여야 합니다.',
  })
  id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEmail()
  @Matches(/@yeonsung\.ac\.kr$/i, {
    message: '이메일은 yeonsung.ac.kr 도메인만 사용할 수 있습니다.',
  })
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password: string;

  @IsString()
  @IsNotEmpty()
  @Match('password', { message: '비밀번호 확인이 일치하지 않습니다.' })
  passwordConfirm: string;

  @IsIn(AFFILIATION_TYPES, {
    message: '소속 유형은 학과, 부서, 기타 중 하나여야 합니다.',
  })
  affiliationType: (typeof AFFILIATION_TYPES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  department: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  extension: string;
}
