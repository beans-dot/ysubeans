import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { AFFILIATION_TYPES } from '../affiliation';

export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEmail()
  @Matches(/@yeonsung\.ac\.kr$/i, {
    message: '이메일은 yeonsung.ac.kr 도메인만 사용할 수 있습니다.',
  })
  email: string;

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
