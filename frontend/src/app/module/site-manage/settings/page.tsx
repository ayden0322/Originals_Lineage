'use client';

import { useEffect, useState, useCallback } from 'react';
import { Form, Input, InputNumber, Button, Switch, Select, Card, message, Typography } from 'antd';
import ImageUpload from '@/components/ui/ImageUpload';
import { getSiteSettings, updateSiteSettings } from '@/lib/api/site-manage';
import { getArticles } from '@/lib/api/content';
import type { Article } from '@/lib/types';

const { Title } = Typography;

export default function SettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [logoUrl, setLogoUrl] = useState<string>('');

  const fetchData = useCallback(async () => {
    try {
      const [settings, articleData] = await Promise.all([
        getSiteSettings(),
        getArticles(1, 100),
      ]);
      form.setFieldsValue(settings);
      setLogoUrl(settings.logoUrl || '');
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
      await updateSiteSettings({ ...values, logoUrl });
      message.success('設定已儲存');
    } catch {
      message.error('儲存失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Title level={3}>網站設定</Title>
      <Card loading={loading}>
        <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
          <Form.Item label="Logo">
            <ImageUpload value={logoUrl} onChange={setLogoUrl} folder="site" />
          </Form.Item>
          <Form.Item name="siteName" label="網站名稱" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="footerText" label="Footer 文字">
            <Input />
          </Form.Item>
          <Form.Item name="heroEnabled" label="啟用 Hero 輪播" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="newsDisplayCount" label="首頁新聞顯示數量">
            <InputNumber min={1} max={20} />
          </Form.Item>
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
        </Form>
      </Card>
    </div>
  );
}
