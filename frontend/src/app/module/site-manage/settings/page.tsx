'use client';

import { useEffect, useState, useCallback } from 'react';
import { Form, Input, InputNumber, Button, Switch, Select, Collapse, Tabs, Slider, Table, Upload, message, Typography, Spin, Radio, Tooltip, Space } from 'antd';
import { UploadOutlined, DeleteOutlined, SoundOutlined, CustomerServiceOutlined } from '@ant-design/icons';
import ImageUpload from '@/components/ui/ImageUpload';
import ColorPickerInput from '@/components/ui/ColorPickerInput';
import { getSiteSettings, updateSiteSettings, uploadFile } from '@/lib/api/site-manage';
import { getArticles } from '@/lib/api/content';
import { SITE_FONT_OPTIONS } from '@/lib/fonts';
import type { Article } from '@/lib/types';

const { Title } = Typography;

/** 網站目前的預設配色 */
const DEFAULT_COLORS = {
  accentColor: '#c4a24e',
  accentColorLight: '#d4b76a',
  headerBgColor: 'rgba(0,0,0,0.85)',
  navActiveColor: '#ffffff',
  navInactiveColor: 'rgba(255,255,255,0.3)',
  bgPrimary: '#0a0a0a',
  bgSecondary: '#111111',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.7)',
  footerBgColor: '#111111',
  footerTextColor: 'rgba(255,255,255,0.4)',
};

/** Wireframe 區域對應的 Collapse key */
type ThemeSection = 'accent' | 'header' | 'body' | 'footer';

/** 右側可點擊的即時預覽 wireframe */
function ThemeWireframe({
  form,
  activeSection,
  onSectionClick,
}: {
  form: ReturnType<typeof Form.useForm>[0];
  activeSection: ThemeSection | null;
  onSectionClick: (section: ThemeSection) => void;
}) {
  const colors = Form.useWatch([], form) as Record<string, string | undefined> | undefined;

  const c = {
    accent: colors?.accentColor || DEFAULT_COLORS.accentColor,
    accentLight: colors?.accentColorLight || DEFAULT_COLORS.accentColorLight,
    headerBg: colors?.headerBgColor || DEFAULT_COLORS.headerBgColor,
    navActive: colors?.navActiveColor || DEFAULT_COLORS.navActiveColor,
    navInactive: colors?.navInactiveColor || DEFAULT_COLORS.navInactiveColor,
    bgPrimary: colors?.bgPrimary || DEFAULT_COLORS.bgPrimary,
    bgSecondary: colors?.bgSecondary || DEFAULT_COLORS.bgSecondary,
    textPrimary: colors?.textPrimary || DEFAULT_COLORS.textPrimary,
    textSecondary: colors?.textSecondary || DEFAULT_COLORS.textSecondary,
    footerBg: colors?.footerBgColor || DEFAULT_COLORS.footerBgColor,
    footerText: colors?.footerTextColor || DEFAULT_COLORS.footerTextColor,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    position: 'absolute',
    right: 6,
    top: 2,
    pointerEvents: 'none',
  };

  const highlightBorder = (section: ThemeSection) =>
    activeSection === section
      ? '2px solid rgba(22,119,255,0.7)'
      : '2px solid transparent';

  const sectionCursor: React.CSSProperties = {
    cursor: 'pointer',
    transition: 'outline 0.2s, box-shadow 0.2s',
  };

  return (
    <div style={{ position: 'sticky', top: 16 }}>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 8, fontWeight: 500 }}>
        點擊區域以編輯對應色系
      </div>
      <div
        style={{
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.12)',
          fontSize: 12,
          lineHeight: 1.4,
        }}
      >
        {/* Header */}
        <div
          onClick={() => onSectionClick('header')}
          style={{
            background: c.headerBg,
            padding: '10px 16px',
            position: 'relative',
            outline: highlightBorder('header'),
            outlineOffset: -2,
            ...sectionCursor,
          }}
        >
          <span style={labelStyle}>頂部選單列</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ color: c.accent, fontWeight: 700, fontSize: 14 }}>LOGO</span>
            <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
              <span style={{ color: c.navActive, fontWeight: 600, fontSize: 11 }}>首頁</span>
              <span style={{ color: c.navInactive, fontSize: 11 }}>最新消息</span>
              <span style={{ color: c.navInactive, fontSize: 11 }}>商城</span>
            </div>
          </div>
        </div>

        {/* Body — 包含主題色 + 頁面整體 */}
        <div
          style={{
            background: c.bgPrimary,
            position: 'relative',
            minHeight: 200,
          }}
        >
          {/* 主題色區域（按鈕、連結） */}
          <div
            onClick={() => onSectionClick('accent')}
            style={{
              padding: '20px 16px 0',
              position: 'relative',
              outline: highlightBorder('accent'),
              outlineOffset: -2,
              ...sectionCursor,
            }}
          >
            <span style={{ ...labelStyle, color: 'rgba(255,255,255,0.3)' }}>主題色</span>
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <div
                style={{
                  background: c.accent,
                  color: '#000',
                  padding: '5px 16px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                主題色按鈕
              </div>
              <div
                style={{
                  background: 'transparent',
                  color: c.accentLight,
                  padding: '5px 16px',
                  borderRadius: 4,
                  fontSize: 11,
                  border: `1px solid ${c.accentLight}`,
                }}
              >
                淺色主題
              </div>
            </div>
          </div>

          {/* 頁面整體區域 */}
          <div
            onClick={() => onSectionClick('body')}
            style={{
              padding: '16px 16px 20px',
              position: 'relative',
              outline: highlightBorder('body'),
              outlineOffset: -2,
              ...sectionCursor,
            }}
          >
            <span style={labelStyle}>頁面整體</span>
            <div style={{ color: c.textPrimary, fontSize: 15, fontWeight: 500, marginBottom: 6 }}>
              主要文字標題
            </div>
            <div style={{ color: c.textSecondary, fontSize: 12, marginBottom: 14 }}>
              次要文字說明內容
            </div>
            <div
              style={{
                background: c.bgSecondary,
                borderRadius: 6,
                padding: '12px 14px',
                position: 'relative',
              }}
            >
              <div style={{ color: c.textPrimary, fontSize: 13, marginBottom: 4 }}>區塊標題</div>
              <div style={{ color: c.textSecondary, fontSize: 11 }}>區塊內的次要文字</div>
              <div style={{ color: c.accent, fontSize: 11, marginTop: 6 }}>主題色連結 →</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          onClick={() => onSectionClick('footer')}
          style={{
            background: c.footerBg,
            padding: '12px 16px',
            position: 'relative',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            outline: highlightBorder('footer'),
            outlineOffset: -2,
            ...sectionCursor,
          }}
        >
          <span style={labelStyle}>底部區域</span>
          <div style={{ color: c.footerText, fontSize: 11, textAlign: 'center' }}>
            底部文字 — 始祖天堂 © 2026
          </div>
        </div>
      </div>
    </div>
  );
}

/** 字體即時預覽 — 模擬實際網站的深色風格 */
function FontPreview({ form }: { form: ReturnType<typeof Form.useForm>[0] }) {
  const values = Form.useWatch([], form) as Record<string, string | undefined> | undefined;
  const heading = values?.headingFontFamily || "'Georgia', 'Times New Roman', serif";
  const body = values?.bodyFontFamily || 'sans-serif';
  const accent = values?.accentColor || DEFAULT_COLORS.accentColor;

  return (
    <div style={{ position: 'sticky', top: 16 }}>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 8, fontWeight: 500 }}>
        即時預覽
      </div>
      <div
        style={{
          background: '#0c0c0c',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        {/* 模擬 Header */}
        <div style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: accent, fontFamily: heading, fontSize: 14, fontWeight: 600, letterSpacing: 1 }}>LOGO</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
            <span style={{ fontFamily: body, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>首頁</span>
            <span style={{ fontFamily: body, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>最新消息</span>
          </div>
        </div>

        {/* 模擬 Hero 區 */}
        <div style={{
          padding: '36px 24px 28px',
          background: 'linear-gradient(180deg, rgba(20,20,30,1) 0%, #0c0c0c 100%)',
          textAlign: 'center',
        }}>
          <div style={{ fontFamily: heading, fontSize: 26, fontWeight: 300, color: '#fff', letterSpacing: 3, marginBottom: 8 }}>
            標題字體預覽
          </div>
          <div style={{ fontFamily: heading, fontSize: 16, fontWeight: 300, color: 'rgba(255,255,255,0.5)', letterSpacing: 1 }}>
            Heading Font Preview
          </div>
        </div>

        {/* 模擬內文區 */}
        <div style={{ padding: '20px 24px 24px' }}>
          <div style={{ fontFamily: body, fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.9, marginBottom: 16 }}>
            這是內文字體的預覽，展示選擇的字體在實際頁面上的呈現效果。
          </div>
          <div style={{ fontFamily: body, fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.8 }}>
            The quick brown fox jumps over the lazy dog. 1234567890
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <span style={{
              fontFamily: body,
              fontSize: 12,
              background: accent,
              color: '#000',
              padding: '4px 14px',
              borderRadius: 4,
              fontWeight: 600,
            }}>
              按鈕文字
            </span>
            <span style={{
              fontFamily: body,
              fontSize: 12,
              color: accent,
              padding: '4px 14px',
              borderRadius: 4,
              border: `1px solid ${accent}`,
            }}>
              連結文字
            </span>
          </div>
        </div>

        {/* 模擬 Footer */}
        <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <span style={{ fontFamily: body, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>Footer 底部文字 © 2026</span>
        </div>
      </div>
    </div>
  );
}

/** 前台頁面路徑對照 */
const PAGE_ROUTES = [
  { path: '/public', label: '首頁' },
  { path: '/public/news', label: '最新消息' },
  { path: '/public/shop', label: '線上商城' },
  { path: '/public/sponsor', label: '贊助專區' },
  { path: '/public/events', label: '活動內容' },
  { path: '/public/drops', label: '掉落查詢' },
  { path: '/public/changelog', label: '更新歷程' },
  { path: '/public/support', label: '聯繫客服' },
];

/** 音訊上傳元件 */
function AudioUploadBtn({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);

  return (
    <Space size="small">
      {value && (
        <>
          <audio src={value} controls style={{ height: 32, maxWidth: 180 }} />
          <Tooltip title="移除">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => onChange(null)}
            />
          </Tooltip>
        </>
      )}
      <Upload
        accept="audio/*"
        showUploadList={false}
        customRequest={async ({ file, onSuccess, onError }) => {
          setUploading(true);
          try {
            const result = await uploadFile(file as File, 'bgm');
            onChange(result.url);
            onSuccess?.(null);
            message.success('音樂上傳成功');
          } catch (e) {
            onError?.(e as Error);
            message.error('上傳失敗');
          } finally {
            setUploading(false);
          }
        }}
      >
        <Button size="small" icon={<UploadOutlined />} loading={uploading}>
          {value ? '更換' : '上傳音樂'}
        </Button>
      </Upload>
    </Space>
  );
}

export default function SettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [activeSection, setActiveSection] = useState<ThemeSection | null>('accent');
  const [pageBgm, setPageBgm] = useState<Record<string, string | null>>({});
  const watchedDefaultBgm = Form.useWatch('defaultBgm', form) as string | undefined;

  const fetchData = useCallback(async () => {
    try {
      const [settings, articleData] = await Promise.all([
        getSiteSettings(),
        getArticles(1, 100),
      ]);
      const merged = { fontScale: 1, ...DEFAULT_COLORS, ...settings };
      form.setFieldsValue(merged);
      setLogoUrl(settings.logoUrl || '');
      setPageBgm(settings.pageBgm || {});
      setArticles(articleData.items);
    } catch {
      message.error('載入設定失敗');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      // 明確帶入 defaultBgm（可能為 null 表示要清除）
      const payload = { ...values, logoUrl, pageBgm };
      if (!payload.defaultBgm) payload.defaultBgm = null;
      await updateSiteSettings(payload);
      message.success('設定已儲存');
    } catch {
      message.error('儲存失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWireframeClick = (section: ThemeSection) => {
    setActiveSection(section);
  };

  const handleCollapseChange = (keys: string | string[]) => {
    const arr = Array.isArray(keys) ? keys : [keys];
    setActiveSection((arr[0] as ThemeSection) || null);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  const collapseItems = [
    {
      key: 'accent',
      label: '網站主題色',
      children: (
        <>
          <Form.Item name="accentColor" label="主題色" style={{ marginBottom: 16 }}>
            <ColorPickerInput />
          </Form.Item>
          <Form.Item name="accentColorLight" label="主題色（淺色）" style={{ marginBottom: 0 }}>
            <ColorPickerInput />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'header',
      label: '頂部選單列',
      children: (
        <>
          <Form.Item name="headerBgColor" label="選單列背景色" style={{ marginBottom: 16 }}>
            <ColorPickerInput supportsAlpha />
          </Form.Item>
          <Form.Item name="navActiveColor" label="目前頁面的文字顏色" style={{ marginBottom: 16 }}>
            <ColorPickerInput supportsAlpha />
          </Form.Item>
          <Form.Item name="navInactiveColor" label="其他頁面的文字顏色" style={{ marginBottom: 0 }}>
            <ColorPickerInput supportsAlpha />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'body',
      label: '頁面整體',
      children: (
        <>
          <Form.Item name="bgPrimary" label="頁面背景色" style={{ marginBottom: 16 }}>
            <ColorPickerInput />
          </Form.Item>
          <Form.Item name="bgSecondary" label="區塊背景色" style={{ marginBottom: 16 }}>
            <ColorPickerInput />
          </Form.Item>
          <Form.Item name="textPrimary" label="主要文字顏色" style={{ marginBottom: 16 }}>
            <ColorPickerInput supportsAlpha />
          </Form.Item>
          <Form.Item name="textSecondary" label="次要文字顏色" style={{ marginBottom: 0 }}>
            <ColorPickerInput supportsAlpha />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'footer',
      label: '底部區域',
      children: (
        <>
          <Form.Item name="footerBgColor" label="底部背景色" style={{ marginBottom: 16 }}>
            <ColorPickerInput />
          </Form.Item>
          <Form.Item name="footerTextColor" label="底部文字顏色" style={{ marginBottom: 0 }}>
            <ColorPickerInput supportsAlpha />
          </Form.Item>
        </>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>網站設定</Title>
      <Form form={form} layout="vertical">
        <Tabs
          defaultActiveKey="basic"
          items={[
            {
              key: 'basic',
              label: '基本設定',
              children: (
                <div style={{ maxWidth: 600 }}>
                  <Form.Item label="Logo">
                    <ImageUpload value={logoUrl} onChange={setLogoUrl} folder="site" />
                  </Form.Item>
                  <Form.Item name="siteName" label="網站名稱" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="footerText" label="Footer 文字">
                    <Input />
                  </Form.Item>
                  <Form.Item name="logoSize" label="Logo 大小">
                    <Radio.Group
                      optionType="button"
                      buttonStyle="solid"
                      options={[
                        { label: '小', value: 'small' },
                        { label: '中', value: 'medium' },
                        { label: '大', value: 'large' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item name="fontScale" label="全站文字縮放比例" tooltip="調整 Header、Footer、新聞區等文字大小，不影響富文本內容及輪播標題">
                    <Slider
                      min={0.8}
                      max={1.5}
                      step={0.05}
                      marks={{ 0.8: '80%', 1: '100%', 1.25: '125%', 1.5: '150%' }}
                      tooltip={{ formatter: (v) => `${Math.round((v || 1) * 100)}%` }}
                    />
                  </Form.Item>
                  <Form.Item name="heroEnabled" label="啟用 Hero 輪播" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name="newsDisplayCount" label="首頁新聞顯示數量">
                    <InputNumber min={1} max={20} />
                  </Form.Item>
                  <Button type="primary" onClick={handleSave} loading={submitting}>
                    儲存設定
                  </Button>
                </div>
              ),
            },
            {
              key: 'links',
              label: '連結設定',
              children: (
                <div style={{ maxWidth: 600 }}>
                  <Form.Item name="featuredArticleIds" label="精選文章">
                    <Select
                      mode="multiple"
                      placeholder="選擇要在首頁顯示的文章"
                      options={articles.map((a) => ({
                        value: a.id,
                        label: `${a.title} (${a.status})`,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name="lineOfficialUrl" label="官方 Line 連結">
                    <Input placeholder="https://line.me/R/ti/p/@yourline" />
                  </Form.Item>
                  <Form.Item name="gameDownloadUrl" label="遊戲下載連結">
                    <Input placeholder="https://drive.google.com/file/xxx 或其他頁面連結" />
                  </Form.Item>
                  <Button type="primary" onClick={handleSave} loading={submitting}>
                    儲存設定
                  </Button>
                </div>
              ),
            },
            {
              key: 'theme',
              label: '色系設定',
              children: (
                <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
                  {/* 左側：手風琴式顏色面板 */}
                  <div style={{ flex: '1 1 0', minWidth: 0, maxWidth: 480 }}>
                    <Collapse
                      accordion
                      activeKey={activeSection || undefined}
                      onChange={handleCollapseChange}
                      items={collapseItems}
                      style={{ marginBottom: 20 }}
                    />
                    <Button type="primary" onClick={handleSave} loading={submitting}>
                      儲存設定
                    </Button>
                  </div>

                  {/* 右側：可點擊的 Wireframe 即時預覽 */}
                  <div style={{ flex: '0 0 320px' }}>
                    <ThemeWireframe
                      form={form}
                      activeSection={activeSection}
                      onSectionClick={handleWireframeClick}
                    />
                  </div>
                </div>
              ),
            },
            {
              key: 'font',
              label: '字體設定',
              children: (
                <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
                  {/* 左側：字體選擇 */}
                  <div style={{ flex: '1 1 0', minWidth: 0, maxWidth: 400 }}>
                    <div style={{ marginBottom: 24, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                      選擇網站的標題與內文字體，支援 Google Fonts 自動載入
                    </div>
                    <Form.Item name="headingFontFamily" label="標題字體">
                      <Select
                        placeholder="選擇標題字體"
                        options={SITE_FONT_OPTIONS.map((f) => ({
                          value: f.value,
                          label: (
                            <span style={{ fontFamily: f.value }}>
                              {f.label}
                            </span>
                          ),
                        }))}
                      />
                    </Form.Item>
                    <Form.Item name="bodyFontFamily" label="內文字體">
                      <Select
                        placeholder="選擇內文字體"
                        options={SITE_FONT_OPTIONS.map((f) => ({
                          value: f.value,
                          label: (
                            <span style={{ fontFamily: f.value }}>
                              {f.label}
                            </span>
                          ),
                        }))}
                      />
                    </Form.Item>
                    <Button type="primary" onClick={handleSave} loading={submitting}>
                      儲存設定
                    </Button>
                  </div>

                  {/* 右側：字體即時預覽（sticky 跟隨） */}
                  <div style={{ flex: '0 0 380px' }}>
                    <FontPreview form={form} />
                  </div>
                </div>
              ),
            },
            {
              key: 'bgm',
              label: '背景音樂',
              children: (
                <div style={{ maxWidth: 700 }}>
                  <div style={{ marginBottom: 24, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                    設定各頁面的背景音樂，僅在桌面裝置播放。支援 mp3 / ogg / wav 格式。
                  </div>

                  {/* 全站預設 */}
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '16px 20px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CustomerServiceOutlined /> 全站預設音樂
                    </div>
                    <Form.Item name="defaultBgm" noStyle>
                      <Input style={{ display: 'none' }} />
                    </Form.Item>
                    <AudioUploadBtn
                      value={watchedDefaultBgm}
                      onChange={(url) => form.setFieldValue('defaultBgm', url || null)}
                    />
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>
                      當頁面未指定音樂時，會播放此預設音樂
                    </div>
                  </div>

                  {/* 播放設定 */}
                  <div style={{ display: 'flex', gap: 32, marginBottom: 24 }}>
                    <Form.Item name="bgmVolume" label="預設音量" style={{ flex: 1, marginBottom: 0 }}>
                      <Slider
                        min={0}
                        max={1}
                        step={0.05}
                        tooltip={{ formatter: (v) => `${Math.round((v || 0) * 100)}%` }}
                      />
                    </Form.Item>
                    <Form.Item name="bgmAutoPlay" label="自動播放" valuePropName="checked" style={{ marginBottom: 0 }}>
                      <Switch />
                    </Form.Item>
                  </div>

                  {/* 各頁面音樂 */}
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>各頁面音樂設定</div>
                  <Table
                    dataSource={PAGE_ROUTES}
                    rowKey="path"
                    pagination={false}
                    size="small"
                    columns={[
                      { title: '頁面', dataIndex: 'label', key: 'label', width: 120 },
                      { title: '路徑', dataIndex: 'path', key: 'path', width: 160, render: (v: string) => <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{v}</span> },
                      {
                        title: '音樂',
                        key: 'bgm',
                        render: (_, record) => (
                          <AudioUploadBtn
                            value={pageBgm[record.path]}
                            onChange={(url) => setPageBgm((prev) => ({ ...prev, [record.path]: url }))}
                          />
                        ),
                      },
                    ]}
                    style={{ marginBottom: 20 }}
                  />

                  <Button type="primary" onClick={handleSave} loading={submitting}>
                    儲存設定
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Form>
    </div>
  );
}
