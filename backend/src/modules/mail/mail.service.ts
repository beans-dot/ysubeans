import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export type TempPasswordReason = 'admin' | 'self';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  private isConfigured(): boolean {
    return Boolean(this.config.get<string>('SMTP_HOST'));
  }

  async sendTempPassword(
    to: string,
    userId: string,
    tempPassword: string,
    reason: TempPasswordReason = 'admin',
  ) {
    const subject = '[연성대학교 IR] 임시 비밀번호 안내';
    const reasonLine =
      reason === 'admin'
        ? '관리자에 의해 임시 비밀번호가 발급되었습니다.'
        : '비밀번호 찾기로 임시 비밀번호가 발급되었습니다.';
    const text = [
      `${userId} 님께`,
      '',
      reasonLine,
      `임시 비밀번호: ${tempPassword}`,
      '',
      '로그인 후 회원정보관리에서 비밀번호를 변경해 주세요.',
      '',
      '※ 문의 : 연성대학교 기획처 IR센터',
    ].join('\n');

    if (!this.isConfigured()) {
      const isProd = this.config.get<string>('NODE_ENV') === 'production';
      if (isProd) {
        throw new ServiceUnavailableException(
          '메일 서버(SMTP)가 설정되지 않아 임시 비밀번호를 발송할 수 없습니다.',
        );
      }
      this.logger.warn(
        `[DEV] SMTP 미설정 — 임시 비밀번호를 로그로 출력합니다. to=${to} userId=${userId} tempPassword=${tempPassword}`,
      );
      return { delivered: false, mode: 'dev-log' as const };
    }

    const port = parseInt(this.config.get<string>('SMTP_PORT') || '587', 10);
    const transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port,
      secure: port === 465,
      auth: {
        user: this.config.get<string>('SMTP_USER') || undefined,
        pass: this.config.get<string>('SMTP_PASS') || undefined,
      },
    });

    const from =
      this.config.get<string>('SMTP_FROM') || 'noreply@yeonsung.ac.kr';

    await transporter.sendMail({ from, to, subject, text });
    return { delivered: true, mode: 'smtp' as const };
  }
}
