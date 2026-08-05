import { ArrayNotEmpty, IsArray, IsInt } from 'class-validator';

export class DeleteRawCorrectionDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  rawIds: number[];
}
