import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { EmailService } from './email/email.service';
import { WhatsAppService } from './whatsapp/whatsapp.service';
import { baseEmailTemplate } from './templates/base.template';
import * as fs from 'fs';
import * as path from 'path';

// Resolve templates.json path in src or dist
const getTemplatePath = () => {
  const altPath = path.join(process.cwd(), 'src', 'notifications', 'templates', 'templates.json');
  if (fs.existsSync(altPath)) return altPath;
  return path.join(__dirname, 'templates', 'templates.json');
};

@ApiTags('Notifications')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly emailService: EmailService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  private readTemplates() {
    const targetPath = getTemplatePath();
    try {
      if (fs.existsSync(targetPath)) {
        return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
      }
    } catch (e) {
      console.error('Failed to read templates.json', e);
    }
    return {};
  }

  private writeTemplates(data: any) {
    const targetPath = getTemplatePath();
    fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), 'utf8');
    
    // If we wrote to src, copy it to dist/compiled folder too to make it active instantly
    const compiledPath = path.join(__dirname, 'templates', 'templates.json');
    if (targetPath !== compiledPath) {
      try {
        const distTemplatesDir = path.dirname(compiledPath);
        if (!fs.existsSync(distTemplatesDir)) {
          fs.mkdirSync(distTemplatesDir, { recursive: true });
        }
        fs.writeFileSync(compiledPath, JSON.stringify(data, null, 2), 'utf8');
      } catch (e) {
        // Safe to ignore if compile directory is write-protected
      }
    }
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get all notification templates' })
  getTemplates() {
    return { success: true, data: this.readTemplates() };
  }

  @Patch('templates')
  @ApiOperation({ summary: 'Update notification templates' })
  updateTemplates(@Body() dto: any) {
    const current = this.readTemplates();
    const updated = { ...current, ...dto };
    this.writeTemplates(updated);
    return { success: true, message: 'Templates updated successfully', data: updated };
  }

  @Post('send-custom')
  @ApiOperation({ summary: 'Send custom manual email or WhatsApp message' })
  async sendCustom(@Body() dto: { type: 'email' | 'whatsapp'; to: string; subject?: string; message: string }) {
    if (dto.type === 'email') {
      await this.emailService.send({
        to: dto.to,
        subject: dto.subject ?? 'Update from Migga Rentals',
        html: baseEmailTemplate(dto.message.replace(/\n/g, '<br/>'), {
          name: this.emailService.getBizName(),
          systemName: this.emailService.getBizSystemName(),
          supportEmail: this.emailService.getBizSupportEmail(),
          website: this.emailService.getBizWebsite(),
        }),
      });
      return { success: true, message: 'Custom email sent successfully' };
    } else {
      await this.whatsAppService.sendText(dto.to, dto.message);
      return { success: true, message: 'Custom WhatsApp message sent successfully' };
    }
  }
}
