import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class EmailService {
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
    const secure = process.env.SMTP_SECURE === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || 'noreply@prm-system.com';

    if (host && user && pass && !to.endsWith('@example.com')) {
      try {
        const transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: {
            user,
            pass
          }
        });

        await transporter.sendMail({
          from,
          to,
          subject,
          text: body
        });
        console.log(`[EmailService] Sent email via SMTP to ${to}: ${subject}`);
      } catch (smtpError) {
        console.error('SMTP email dispatch failed:', smtpError);
      }
    } else {
      const timestamp = new Date().toISOString();
      const logMessage = `
========================================
[EMAIL SENT AT: ${timestamp}]
To: ${to}
Subject: ${subject}
Body:
${body}
========================================
`;
      console.log(`[EmailService] [Mock] Sent email to ${to}: ${subject}`);
      try {
        const logsDir = path.join(__dirname, '..', '..', 'logs');
        await fs.mkdir(logsDir, { recursive: true });
        const logFilePath = path.join(logsDir, 'emails.log');
        await fs.appendFile(logFilePath, logMessage, 'utf-8');
      } catch (error) {
        console.error('Failed to write to email log file:', error);
      }
    }
  }
}

export const emailService = new EmailService();
