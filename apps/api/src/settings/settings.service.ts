import { Injectable } from '@nestjs/common';
import { SETTING_DEFAULTS } from '@smart/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}
  async all(): Promise<Record<string, any>> {
    const rows = await this.prisma.setting.findMany();
    const out: Record<string, any> = {};
    for (const [k, d] of Object.entries(SETTING_DEFAULTS)) out[k] = d.value;
    for (const r of rows) out[r.key] = r.value;
    return out;
  }
  async public() {
    const all = await this.all();
    const out: Record<string, any> = {};
    for (const k of Object.keys(all)) if (SETTING_DEFAULTS[k]?.isPublic) out[k] = all[k];
    return out;
  }
  async get<T = any>(k: string): Promise<T> { return (await this.all())[k] as T; }
}
