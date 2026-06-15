import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    try {
      const list = await this.prisma.setting.findMany();
      const result: any = {
        googleReviewLink: '',
        tripAdvisorReviewLink: '',
        depositRequired: true,
        depositAmount: 100,
      };
      for (const item of list) {
        if (item.key === 'depositRequired') {
          result.depositRequired = item.value === 'true';
        } else if (item.key === 'depositAmount') {
          result.depositAmount = Number(item.value);
        } else {
          result[item.key] = item.value;
        }
      }
      return result;
    } catch (error) {
      return {
        googleReviewLink: '',
        tripAdvisorReviewLink: '',
        depositRequired: true,
        depositAmount: 100,
      };
    }
  }

  async updateSettings(data: any) {
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null) continue;
      const valStr = String(value);
      await this.prisma.setting.upsert({
        where: { key },
        update: { value: valStr },
        create: { key, value: valStr },
      });
    }
    return this.getSettings();
  }
}
