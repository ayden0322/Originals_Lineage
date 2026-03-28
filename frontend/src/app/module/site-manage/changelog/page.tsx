'use client';

import { useEffect, useState, useCallback } from 'react';
import { Form, Input, Select, Button, Card, message, Typography } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import ImageUpload from '@/components/ui/ImageUpload';
import { getSiteSettings, updateSiteSettings } from '@/lib/api/site-manage';
import { getCategories } from '@/lib/api/content';
import type { ArticleCategory } from '@/lib/types';

const { Title } = Typography;

export default function ChangelogSettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [bannerUrl, setBannerUrl] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [settings, cats] = await Promise.all([
        getSiteSettings(),
        getCategories(),
      ]);
      form.setFieldsValue({
        changelogPageTitle: settings.changelogPageTitle || '更新歷程',
        changelogCategorySlug: settings.changelogCategorySlug || undefined,
      });
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
        changelogPageTitle: values.changelogPageTitle,
        changelogCategorySlug: values.changelogCategorySlug,
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
      <Card loading={loading}>
        <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
          <Form.Item name="changelogPageTitle" label="頁面標題">
            <Input placeholder="更新歷程" />
          </Form.Item>
          <Form.Item name="changelogCategorySlug" label="抓取文章分類">
            <Select
              placeholder="請選擇分類"
              allowClear
              options={categories.map((cat) => ({
                value: cat.slug,
                label: cat.name,
              }))}
            />
          </Form.Item>
          <Form.Item label="Banner 圖片">
            <ImageUpload value={bannerUrl} onChange={setBannerUrl} folder="changelog" />
          </Form.Item>
        </Form>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={submitting}
            size="large"
          >
            儲存更新頁面設定
          </Button>
        </div>
      </Card>
    </div>
  );
}
