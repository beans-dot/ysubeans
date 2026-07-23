import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateRawValueDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  metricValue: string;
}
