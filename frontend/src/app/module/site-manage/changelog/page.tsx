'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Button,
  Card,
  message,
  Typography,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import ImageUpload from '@/components/ui/ImageUpload';
import { getSiteSettings, updateSiteSettings } from '@/lib/api/site-manage';
import { getCategories } from '@/lib/api/content';
import type { ArticleCategory } from '@/lib/types';

const { Title } = Typography;

const LAYOUT_OPTIONS: { key: 'magazine' | 'timeline' | 'masonry'; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    key: 'magazine',
    label: '雜誌式',
    desc: '大圖 + 摘要的經典排版',
    icon: (
      <svg width="48" height="36" viewBox="0 0 48 36" fill="none">
        <rect x="1" y="1" width="22" height="34" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <rect x="26" y="1" width="21" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <rect x="26" y="14" width="21" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <rect x="26" y="27" width="21" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    key: 'timeline',
    label: '時間軸式',
    desc: '沿時間線排列的卡片',
    icon: (
      <svg width="48" height="36" viewBox="0 0 48 36" fill="none">
        <line x1="24" y1="0" x2="24" y2="36" stroke="currentColor" strokeWidth="1.5" />
        <rect x="2" y="2" width="18" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <rect x="28" y="10" width="18" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <rect x="2" y="22" width="18" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="24" cy="6" r="2.5" fill="currentColor" />
        <circle cx="24" cy="14" r="2.5" fill="currentColor" />
        <circle cx="24" cy="26" r="2.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    key: 'masonry',
    label: '瀑布流網格',
    desc: '不規則高度的卡片網格',
    icon: (
      <svg width="48" height="36" viewBox="0 0 48 36" fill="none">
        <rect x="1" y="1" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <rect x="17" y="1" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <rect x="33" y="1" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <rect x="1" y="21" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <rect x="17" y="15" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <rect x="33" y="23" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
];

export default function ChangelogSettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [changelogLayout, setChangelogLayout] = useState<'magazine' | 'timeline' | 'masonry'>('timeline');
  const [bannerUrl, setBannerUrl] = useState('');
  const [categories, setCategories] = useState<ArticleCategory[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [settings, cats] = await Promise.all([
        getSiteSettings(),
        getCategories(),
      ]);
      form.setFieldsValue({
        changelogPageTitle: settings.changelogPageTitle || '更新歷程',
        changelogPageSubtitle: settings.changelogPageSubtitle || '',
        changelogCategorySlug: settings.changelogCategorySlug || undefined,
        changelogPerPage: settings.changelogPerPage || 12,
        changelogDefaultSort: settings.changelogDefaultSort || 'newest',
        changelogShowCover: settings.changelogShowCover !== false,
        changelogShowViewCount: settings.changelogShowViewCount !== false,
        changelogShowSearch: settings.changelogShowSearch === true,
      });
      setChangelogLayout((settings.changelogLayout as 'magazine' | 'timeline' | 'masonry') || 'timeline');
      setBannerUrl(settings.changelogBannerUrl || '');
      setCategories(cats);
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
      await updateSiteSettings({
        ...values,
        changelogLayout,
        changelogBannerUrl: bannerUrl,
      });
      message.success('更新頁面設定已儲存');
    } catch {
      message.error('儲存失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Title level={3}>更新頁面管理</Title>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* ── Layout Selection ── */}
        <Card title="版面配置" loading={loading}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {LAYOUT_OPTIONS.map((opt) => {
              const selected = changelogLayout === opt.key;
              return (
                <div
                  key={opt.key}
                  onClick={() => setChangelogLayout(opt.key)}
                  style={{
                    border: `2px solid ${selected ? '#c4a24e' : '#e8e8e8'}`,
                    borderRadius: 8,
                    padding: 20,
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: selected ? 'rgba(196,162,78,0.04)' : '#fff',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ color: selected ? '#c4a24e' : '#999', marginBottom: 12 }}>
                    {opt.icon}
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{opt.desc}</div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Banner & Binding Settings ── */}
        <Card title="Banner 與分類設定" loading={loading}>
          <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
            <Form.Item name="changelogPageTitle" label="頁面標題">
              <Input placeholder="更新歷程" />
            </Form.Item>
            <Form.Item name="changelogPageSubtitle" label="頁面副標題">
              <Input placeholder="掌握每一次改版的軌跡" />
            </Form.Item>
            <Form.Item
              name="changelogCategorySlug"
              label="綁定文章分類"
              tooltip="只顯示此分類下的文章；分類可於「內容管理 → 分類管理」維護"
              rules={[{ required: true, message: '請選擇要綁定的分類' }]}
            >
              <Select
                placeholder="請選擇分類"
                options={categories.map((c) => ({ value: c.slug, label: `${c.name}（${c.slug}）` }))}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item label="Banner 圖片上傳">
              <ImageUpload value={bannerUrl} onChange={setBannerUrl} folder="changelog" />
            </Form.Item>
          </Form>
        </Card>

        {/* ── Display Settings ── */}
        <Card title="顯示設定" loading={loading}>
          <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
            <Form.Item name="changelogPerPage" label="每頁顯示數量">
              <InputNumber min={1} max={100} style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="changelogDefaultSort" label="預設排序">
              <Select
                style={{ width: 200 }}
                options={[
                  { value: 'newest', label: '最新發布' },
                  { value: 'popular', label: '最多瀏覽' },
                  { value: 'pinned', label: '置頂優先' },
                ]}
              />
            </Form.Item>
            <Form.Item name="changelogShowCover" label="顯示封面圖" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="changelogShowViewCount" label="顯示瀏覽數" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="changelogShowSearch" label="顯示搜尋欄" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Form>
        </Card>

        {/* ── Save Button ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={submitting} size="large">
            儲存更新頁設定
          </Button>
        </div>
      </div>
    </div>
  );
}
