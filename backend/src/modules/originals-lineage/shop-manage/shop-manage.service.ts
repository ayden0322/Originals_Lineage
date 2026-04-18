import { Injectable, NotFoundException } from '@nestjs/common';
import { ModuleConfigService } from '../../../core/module-config/module-config.service';
import { UpdateShopSettingsDto } from './dto/update-shop-settings.dto';

const MODULE_CODE = 'originals-lineage';
const SETTINGS_KEY = 'shopSettings';

/** 商城美編設定預設值 */
export const DEFAULT_SHOP_SETTINGS = {
  // Hero
  heroEnabled: true,
  heroTitle: '贊助支持',
  heroSubtitle: '選購四海銀票，支持伺服器營運',
  heroBgImageUrl: null as string | null,
  heroHeight: 240,
  heroTextColor: '#ffffff',
  // 貨幣顯示（與 packages 頁一致，統一用四海銀票）
  currencyName: '四海銀票',
  currencyIconUrl: null as string | null,
  currencyColor: '#c4a24e',
  // 主色（Tag / 強調色）
  accentColor: '#c4a24e',
};

export type ShopSettings = typeof DEFAULT_SHOP_SETTINGS;

@Injectable()
export class ShopManageService {
  constructor(private readonly moduleConfigService: ModuleConfigService) {}

  /**
   * 取得商城美編設定（與預設值合併，確保前端永遠拿到完整欄位）。
   */
  async getShopSettings(): Promise<ShopSettings> {
    const config = await this.moduleConfigService.findByCode(MODULE_CODE);
    if (!config) throw new NotFoundException('Module config not found');
    const stored = (config.configJson?.[SETTINGS_KEY] as Partial<ShopSettings>) || {};
    return { ...DEFAULT_SHOP_SETTINGS, ...stored };
  }

  /**
   * 更新商城美編設定。
   * 與既有 site-manage 一致：值為 null 的欄位會從儲存中移除（清除語意）。
   */
  async updateShopSettings(dto: UpdateShopSettingsDto): Promise<ShopSettings> {
    const config = await this.moduleConfigService.findByCode(MODULE_CODE);
    if (!config) throw new NotFoundException('Module config not found');

    const current = (config.configJson?.[SETTINGS_KEY] as Record<string, unknown>) || {};
    const merged = { ...current, ...dto };
    const shopSettings = Object.fromEntries(
      Object.entries(merged).filter(([, v]) => v !== null),
    );
    const configJson = { ...config.configJson, [SETTINGS_KEY]: shopSettings };
    await this.moduleConfigService.update(MODULE_CODE, { configJson });
    return { ...DEFAULT_SHOP_SETTINGS, ...(shopSettings as Partial<ShopSettings>) };
  }

  /** 公開頁聚合：目前只有 settings，將來擴展（公告、卡片視覺等）一併加在這裡 */
  async getPublicShopConfig() {
    const settings = await this.getShopSettings();
    return { settings };
  }
}
