import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

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

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  department: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  extension: string;
}
