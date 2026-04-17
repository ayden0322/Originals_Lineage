// ═══════════════════════════════════════════════════════════════
// API Response wrapper
// ═══════════════════════════════════════════════════════════════

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ═══════════════════════════════════════════════════════════════
// Auth
// ═══════════════════════════════════════════════════════════════

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  backendLevel: 'platform' | 'module';
  isActive: boolean;
  permissions: string[];
  lastLoginAt: string | null;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════
// Account (Admin)
// ═══════════════════════════════════════════════════════════════

export interface Account {
  id: string;
  email: string;
  displayName: string;
  backendLevel: 'platform' | 'module';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountDto {
  email: string;
  password: string;
  displayName: string;
  backendLevel: 'platform' | 'module';
}

export interface UpdateAccountDto {
  displayName?: string;
  isActive?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Permission
// ═══════════════════════════════════════════════════════════════

export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  backendLevel: 'platform' | 'module';
  moduleCode: string | null;
}

// ═══════════════════════════════════════════════════════════════
// Module Config
// ═══════════════════════════════════════════════════════════════

export interface ModuleConfig {
  id: string;
  moduleCode: string;
  moduleName: string;
  isActive: boolean;
  paymentEnabled: boolean;
  lineBotEnabled: boolean;
  configJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════
// System Log
// ═══════════════════════════════════════════════════════════════

export interface SystemLog {
  id: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════
// Member (Originals Lineage)
// ═══════════════════════════════════════════════════════════════

export interface MemberBinding {
  id: string;
  websiteAccountId: string;
  gameAccountName: string;
  gameCharacterId: string | null;
  bindingStatus: 'pending' | 'verified' | 'unbound';
  boundAt: string | null;
  createdAt: string;
  updatedAt: string;
  websiteUser?: WebsiteUser;
}

export interface WebsiteUser {
  id: string;
  email: string | null;
  gameAccountName: string;
  displayName: string | null;
  phone: string | null;
  lineId: string | null;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  secondPasswordPlain?: string | null;
}

export interface PlayerProfile {
  id: string;
  gameAccountName: string;
  email: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CheckGameAccountResult {
  exists: boolean;
  message: string;
}

export interface ChangePasswordDto {
  secondPassword: string;
  newPassword: string;
}

export interface ChangeSecondPasswordDto {
  password: string;
  currentSecondPassword: string;
  newSecondPassword: string;
}

export interface SecondPasswordLog {
  id: string;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown>;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════
// Content (Article & Announcement)
// ═══════════════════════════════════════════════════════════════

export interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  summary: string | null;
  coverImageUrl: string | null;
  musicUrl: string | null;
  authorId: string | null;
  status: 'draft' | 'published' | 'archived';
  isPinned: boolean;
  publishedAt: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateArticleDto {
  title: string;
  content?: string;
  category?: string;
  summary?: string;
  slug?: string;
  coverImageUrl?: string;
  musicUrl?: string;
  status?: 'draft' | 'published' | 'archived';
  isPinned?: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'maintenance' | 'event' | 'notice' | 'urgent';
  priority: number;
  isActive: boolean;
  barBgColor: string | null;
  barBorderColor: string | null;
  startTime: string | null;
  endTime: string | null;
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnnouncementDto {
  title: string;
  content: string;
  type: 'maintenance' | 'event' | 'notice' | 'urgent';
  priority?: number;
  isActive?: boolean;
  barBgColor?: string;
  barBorderColor?: string;
  startTime?: string;
  endTime?: string;
}

// ═══════════════════════════════════════════════════════════════
// Reservation
// ═══════════════════════════════════════════════════════════════

export interface Reservation {
  id: string;
  websiteUserId: string;
  gameAccountName: string;
  ipAddress: string | null;
  createdAt: string;
}

export interface ReservationMilestone {
  id: string;
  threshold: number;
  rewardName: string;
  rewardDescription: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationStats {
  actualCount: number;
  countBase: number;
  displayCount: number;
}

/** @deprecated 舊版預約欄位設定，新版登入制預約不再使用；保留型別僅供後端 DTO 相容。 */
export interface ReserveFieldConfig {
  [key: string]: { visible: boolean; required: boolean };
}

// ─── 發獎系統 ────────────────────────────────────────────────────

export type RewardClaimStatus = 'pending' | 'sent' | 'failed';

export interface RewardClaim {
  id: string;
  reservationId: string;
  milestoneId: string;
  gameAccountSnapshot: string;
  rewardNameSnapshot: string;
  status: RewardClaimStatus;
  note: string | null;
  sentAt: string | null;
  sentBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MilestoneDistribution {
  milestoneId: string;
  rewardName: string;
  threshold: number;
  pending: number;
  sent: number;
  failed: number;
  total: number;
}

export interface MyReward {
  id: string;
  milestoneId: string;
  rewardName: string;
  status: RewardClaimStatus;
  sentAt: string | null;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════
// Shop (Product & Order)
// ═══════════════════════════════════════════════════════════════

export type ProductCategory = 'diamond' | 'game_item' | 'monthly_card';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  category: ProductCategory;
  // 鑽石類專用
  diamondAmount: number;
  // 遊戲禮包/月卡類專用
  gameItemId: number | null;
  gameItemName: string | null;
  gameItemQuantity: number;
  imageUrl: string | null;
  stock: number;
  // 限購
  accountLimit: number;
  dailyLimit: number | null;
  weeklyLimit: number | null;
  weeklyResetDay: number | null;
  weeklyResetHour: number | null;
  monthlyLimit: number | null;
  requiredLevel: number | null;
  isActive: boolean;
  sortOrder: number;
  startTime: string | null;
  endTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductDto {
  name: string;
  description?: string;
  price: number;
  category: ProductCategory;
  diamondAmount?: number;
  gameItemId?: number;
  gameItemName?: string;
  gameItemQuantity?: number;
  imageUrl?: string;
  stock?: number;
  accountLimit?: number;
  dailyLimit?: number | null;
  weeklyLimit?: number | null;
  weeklyResetDay?: number | null;
  weeklyResetHour?: number | null;
  monthlyLimit?: number | null;
  requiredLevel?: number | null;
  isActive?: boolean;
  sortOrder?: number;
  startTime?: string;
  endTime?: string;
}

export interface GameItem {
  itemId: number;
  name: string;
}

export interface ProductTemplate {
  id: string;
  name: string;
  category: ProductCategory;
  snapshot: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductTemplateDto {
  name: string;
  category: ProductCategory;
  snapshot: Record<string, unknown>;
}

export interface Order {
  id: string;
  orderNumber: string;
  memberBindingId: string;
  totalAmount: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  paymentTransactionId: string | null;
  deliveryStatus: 'pending' | 'delivered' | 'failed';
  deliveryDetails: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  diamondAmount: number;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════
// Payment
// ═══════════════════════════════════════════════════════════════

export interface PaymentTransaction {
  id: string;
  moduleCode: string;
  orderId: string;
  providerName: string;
  providerTransactionId: string;
  amount: string;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentMethod: string | null;
  callbackData: Record<string, unknown> | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentResult {
  transactionId: string;
  status: string;
  paymentUrl?: string;
  formAction?: string;
  formData?: Record<string, string>;
}

export type PaymentVendorType = 'smilepay' | 'ecpay' | 'antpay' | 'tx2' | 'mock';

export type PaymentMethod = 'atm' | 'cvs' | 'credit_card';

/** 實名制欄位開關（哪些欄位玩家結帳時必填） */
export interface RealNameSettings {
  name?: boolean;
  phone?: boolean;
  email?: boolean;
  idNumber?: boolean;
  bankAccount?: boolean;
  address?: boolean;
}

/** 通道級別設定（ATM / 超商，含啟用、限額） */
export interface ChannelSettings {
  atm?: {
    enabled: boolean;
    displayName?: string;
    minAmount?: number;
    maxAmount?: number;
  };
  cvs?: {
    enabled: boolean;
    channels?: Array<{
      code: string;
      displayName: string;
      enabled: boolean;
      minAmount?: number;
      maxAmount?: number;
    }>;
  };
  creditCard?: {
    enabled: boolean;
    minAmount?: number;
    maxAmount?: number;
  };
}

export interface PaymentGateway {
  id: string;
  moduleCode: string;
  providerCode: string;
  displayName: string;
  credentials: Record<string, unknown>;
  supportedMethods: string[];
  vendorType: PaymentVendorType;
  productName: string;
  minAmount: number;
  orderInterval: number;
  realNameSettings: RealNameSettings;
  channelSettings: ChannelSettings;
  isActive: boolean;
  isSandbox: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGatewayDto {
  moduleCode: string;
  providerCode: string;
  displayName: string;
  credentials: Record<string, unknown>;
  supportedMethods?: string[];
  vendorType?: PaymentVendorType;
  productName?: string;
  minAmount?: number;
  orderInterval?: number;
  realNameSettings?: RealNameSettings;
  channelSettings?: ChannelSettings;
  isActive?: boolean;
  isSandbox?: boolean;
  priority?: number;
}

export interface UpdateGatewayDto {
  displayName?: string;
  credentials?: Record<string, unknown>;
  supportedMethods?: string[];
  vendorType?: PaymentVendorType;
  productName?: string;
  minAmount?: number;
  orderInterval?: number;
  realNameSettings?: RealNameSettings;
  channelSettings?: ChannelSettings;
  isActive?: boolean;
  isSandbox?: boolean;
  priority?: number;
}

export interface PaymentRouteItem {
  paymentMethod: PaymentMethod;
  gatewayId: string | null;
}

export interface UpdatePaymentRoutesDto {
  routes: PaymentRouteItem[];
}

// ═══════════════════════════════════════════════════════════════
// Settings
// ═══════════════════════════════════════════════════════════════

export interface ModuleSettings {
  moduleCode: string;
  moduleName: string;
  isActive: boolean;
  paymentEnabled: boolean;
  lineBotEnabled: boolean;
  payment: Record<string, unknown>;
  lineBot: Record<string, unknown>;
  gameDb: Record<string, unknown>;
  gameDbConnected: boolean;
  gameTableMapping: GameTableMappingDto | null;
}

export interface PaymentSettingsDto {
  providerName?: string;
  merchantId?: string;
  hashKey?: string;
  hashIv?: string;
  sandboxMode?: boolean;
}

export interface LineBotSettingsDto {
  channelId?: string;
  channelSecret?: string;
  channelAccessToken?: string;
}

export interface GameDbSettingsDto {
  connectionName: string;
  host: string;
  port?: number;
  database: string;
  username: string;
  password: string;
}

export interface GameDbTestResult {
  success: boolean;
  message: string;
}

// ═══════════════════════════════════════════════════════════════
// Game Table Mapping
// ═══════════════════════════════════════════════════════════════

export type PasswordEncryption = 'plaintext' | 'md5' | 'sha1' | 'sha256' | 'bcrypt';

export interface GameTableMappingDto {
  tableName: string;
  columns: {
    username: string;
    password: string;
    email?: string | null;
    status?: string | null;
  };
  passwordEncryption: PasswordEncryption;
  hasEmailColumn: boolean;
  hasStatusColumn: boolean;
}

export interface FetchColumnsResult {
  success: boolean;
  columns: string[];
  message?: string;
}

// ═══════════════════════════════════════════════════════════════
// Site Management
// ═══════════════════════════════════════════════════════════════

export interface ArticleCategory {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SiteSettings {
  siteName: string;
  siteSlogan?: string;
  siteDescription?: string;
  logoUrl: string | null;
  footerText: string;
  heroEnabled: boolean;
  newsDisplayCount: number;
  featuredArticleIds: string[];
  // Font & Logo
  headingFontFamily?: string;
  bodyFontFamily?: string;
  logoSize?: string;
  // Color theme
  accentColor?: string;
  accentColorLight?: string;
  headerBgColor?: string;
  bgPrimary?: string;
  bgSecondary?: string;
  textPrimary?: string;
  textSecondary?: string;
  footerBgColor?: string;
  footerTextColor?: string;
  // BGM
  defaultBgm?: string;
  pageBgm?: Record<string, string | null>;
  bgmVolume?: number;
  bgmAutoPlay?: boolean;
  // Font scale
  fontScale?: number;
  // Nav style
  navActiveColor?: string;
  navInactiveColor?: string;
  navActiveFontSize?: number;
  navInactiveFontSize?: number;
  navActiveFontWeight?: string;
  navInactiveFontWeight?: string;
  navLetterSpacing?: number;
  navFontFamily?: string;
  // News page settings
  newsLayout?: 'magazine' | 'timeline' | 'masonry';
  newsPageTitle?: string;
  newsPageSubtitle?: string;
  newsBannerUrl?: string;
  newsPerPage?: number;
  newsDefaultSort?: 'newest' | 'popular' | 'pinned';
  newsShowCover?: boolean;
  newsShowViewCount?: boolean;
  newsShowSearch?: boolean;
  // Changelog page
  changelogBannerUrl?: string;
  changelogCategorySlug?: string;
  changelogPageTitle?: string;
  // Support page
  lineOfficialUrl?: string;
  // Download
  gameDownloadUrl?: string;
  // Reserve page
  reserveEnabled?: boolean;
  reserveLaunchDate?: string;
  reserveBannerUrl?: string;
  reserveBgImageUrl?: string;
  reserveTitle?: string;
  reserveSubtitle?: string;
  reserveDescription?: string;
  reserveButtonText?: string;
  reserveAccentColor?: string;
  reserveMilestonesEnabled?: boolean;
  reserveEmailVerificationEnabled?: boolean;
  reserveSuccessMessage?: string;
  reserveFieldConfig?: ReserveFieldConfig;
}

export interface SiteSection {
  id: string;
  name: string;
  slug: string;
  displayName: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  slides?: CarouselSlide[];
  createdAt: string;
  updatedAt: string;
}

export interface CarouselSlide {
  id: string;
  sectionId: string | null;
  mediaType: 'image' | 'video';
  imageUrl: string | null;
  videoUrl: string | null;
  autoPlaySeconds: number;
  linkEnabled: boolean;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicSiteConfig {
  settings: SiteSettings;
  heroSlides: CarouselSlide[];
  sections: (SiteSection & { slides: CarouselSlide[] })[];
  featuredArticles: Article[];
}

// ═══════════════════════════════════════════════════════════════
// Shop Manage (商城美編設定)
// ═══════════════════════════════════════════════════════════════

export interface ShopSettings {
  // Hero
  heroEnabled: boolean;
  heroTitle: string;
  heroSubtitle: string;
  heroBgImageUrl: string | null;
  heroHeight: number;
  heroTextColor: string;
}

export interface PublicShopConfig {
  settings: ShopSettings;
}

// ═══════════════════════════════════════════════════════════════
// Commission (代理分潤系統)
// ═══════════════════════════════════════════════════════════════

export interface CommissionAgent {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  loginAccount: string;
  contactInfo: Record<string, unknown> | null;
  status: 'active' | 'suspended';
  selfReferralAllowed: boolean;
  canSetSubRate: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  /** 由 GET /agents/:id 帶回 */
  currentRate?: number;
}

export interface CommissionAgentTreeNode extends CommissionAgent {
  currentRate: number;
  children: (CommissionAgent & { currentRate: number })[];
}

export interface CommissionAgentRate {
  id: string;
  agentId: string;
  rate: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface CommissionReferralLink {
  id: string;
  agentId: string;
  code: string;
  label: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionPlayerAttribution {
  playerId: string;
  agentId: string;
  linkId: string | null;
  linkedSource: 'cookie' | 'register' | 'manual' | 'system';
  linkedAt: string;
  updatedAt: string;
}

export interface CommissionRecord {
  id: string;
  transactionId: string;
  agentId: string;
  level: number;
  baseAmount: number;
  rateSnapshot: number;
  upstreamRateSnapshot: number | null;
  commissionAmount: number;
  periodKey: string;
  settlementId: string | null;
  paidAt: string;
  createdAt: string;
}

export interface CommissionSettlement {
  id: string;
  agentId: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  totalCommission: number;
  totalAdjustment: number;
  finalAmount: number;
  status: 'pending' | 'settled' | 'paid';
  settledAt: string | null;
  settledBy: string | null;
  paidAt: string | null;
  paidBy: string | null;
  note: string | null;
  createdAt: string;
}

export interface CommissionSettlementAdjustment {
  id: string;
  settlementId: string;
  amount: number;
  reason: string;
  sourceType: 'refund' | 'manual' | 'bonus';
  sourceTransactionId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface CommissionSettlementDetail {
  settlement: CommissionSettlement;
  adjustments: CommissionSettlementAdjustment[];
  records: CommissionRecord[];
}

export interface CommissionAgentParentHistory {
  id: string;
  agentId: string;
  fromParentId: string | null;
  toParentId: string | null;
  action: 'promote' | 'change_parent';
  oldRateSnapshot: number | null;
  newRateSnapshot: number | null;
  reason: string | null;
  changedBy: string | null;
  changedAt: string;
}

export interface CommissionCurrentPeriodSummary {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  transactionCount: number;
  totalBaseAmount: number;
  myCommission: number;
}

export interface CommissionSubordinateReport {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'suspended';
  bringInAmount: number;
  bSelfCommission: number;
  transactionCount: number;
}

export interface CommissionPlayerTransaction {
  id: string;
  transactionId: string;
  playerId: string;
  baseAmount: number;
  commissionAmount: number;
  paidAt: string;
  agentId: string;
}

export interface CommissionAgentSelf {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  level: 1 | 2;
  status: 'active' | 'suspended';
  canSetSubRate: boolean;
  currentRate: number;
}

export interface AgentLoginResponse {
  accessToken: string;
  agent: {
    id: string;
    code: string;
    name: string;
    parentId: string | null;
    canSetSubRate: boolean;
    level: 1 | 2;
  };
}
