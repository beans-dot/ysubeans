import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('excel')
  @UseInterceptors(FileInterceptor('file'))
  async uploadExcel(
    @UploadedFile() file: Express.Multer.File,
    @Query('confirmOverwrite') confirmOverwrite?: string,
    @Query('confirmLocked') confirmLocked?: string,
  ) {
    if (!file) {
      throw new BadRequestException('업로드된 파일이 없습니다.');
    }
    return this.uploadService.processUpload(file.buffer, {
      confirmOverwrite: confirmOverwrite === 'true',
      confirmLocked: confirmLocked === 'true',
    });
  }
}
