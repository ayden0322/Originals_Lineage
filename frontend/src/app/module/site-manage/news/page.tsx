'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Button,
  Table,
  Modal,
  Switch,
  Select,
  Popconfirm,
  Card,
  Space,
  message,
  Typography,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import ImageUpload from '@/components/ui/ImageUpload';
import { getSiteSettings, updateSiteSettings } from '@/lib/api/site-manage';
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/lib/api/content';
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

export default function NewsSettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newsLayout, setNewsLayout] = useState<'magazine' | 'timeline' | 'masonry'>('magazine');
  const [bannerUrl, setBannerUrl] = useState('');

  // Category state
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ArticleCategory | null>(null);
  const [catForm] = Form.useForm();

  const fetchData = useCallback(async () => {
    try {
      const [settings, cats] = await Promise.all([
        getSiteSettings(),
        getCategories(),
      ]);
      form.setFieldsValue({
        newsPageTitle: settings.newsPageTitle || '最新消息',
        newsPageSubtitle: settings.newsPageSubtitle || '',
        newsPerPage: settings.newsPerPage || 12,
        newsDefaultSort: settings.newsDefaultSort || 'newest',
        newsShowCover: settings.newsShowCover !== false,
        newsShowViewCount: settings.newsShowViewCount !== false,
        newsShowSearch: settings.newsShowSearch !== false,
      });
      setNewsLayout((settings.newsLayout as 'magazine' | 'timeline' | 'masonry') || 'magazine');
      setBannerUrl(settings.newsBannerUrl || '');
      setCategories(cats);
    } catch {
      message.error('載入設定失敗');
    } finally {
      setLoading(false);
      setCatLoading(false);
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
        newsLayout,
        newsBannerUrl: bannerUrl,
      });
      message.success('消息頁設定已儲存');
    } catch {
      message.error('儲存失敗');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Category CRUD ──

  const fetchCategories = useCallback(async () => {
    try {
      setCatLoading(true);
      const cats = await getCategories();
      setCategories(cats);
    } catch {
      message.error('載入分類失敗');
    } finally {
      setCatLoading(false);
    }
  }, []);

  const openCatModal = (cat?: ArticleCategory) => {
    if (cat) {
      setEditingCat(cat);
      catForm.setFieldsValue({
        name: cat.name,
        slug: cat.slug,
        color: cat.color || '#1677ff',
        sortOrder: cat.sortOrder,
        isActive: cat.isActive,
      });
    } else {
      setEditingCat(null);
      catForm.resetFields();
    }
    setCatModalOpen(true);
  };

  const handleCatSubmit = async () => {
    try {
      const values = await catForm.validateFields();
      if (editingCat) {
        await updateCategory(editingCat.id, values);
        message.success('分類已更新');
      } else {
        await createCategory(values);
        message.success('分類已新增');
      }
      setCatModalOpen(false);
      fetchCategories();
    } catch {
      message.error('操作失敗');
    }
  };

  const handleCatDelete = async (id: string) => {
    try {
      await deleteCategory(id);
      message.success('分類已刪除');
      fetchCategories();
    } catch {
      message.error('刪除失敗');
    }
  };

  return (
    <div>
      <Title level={3}>消息頁設定</Title>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* ── Layout Selection ── */}
        <Card title="版面配置" loading={loading}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {LAYOUT_OPTIONS.map((opt) => {
              const selected = newsLayout === opt.key;
              return (
                <div
                  key={opt.key}
                  onClick={() => setNewsLayout(opt.key)}
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

        {/* ── Banner Settings ── */}
        <Card title="Banner 設定" loading={loading}>
          <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
            <Form.Item name="newsPageTitle" label="新聞頁標題">
              <Input placeholder="最新消息" />
            </Form.Item>
            <Form.Item name="newsPageSubtitle" label="新聞頁副標題">
              <Input placeholder="輸入副標題" />
            </Form.Item>
            <Form.Item label="Banner 圖片上傳">
              <ImageUpload value={bannerUrl} onChange={setBannerUrl} folder="news" />
            </Form.Item>
          </Form>
        </Card>

        {/* ── Display Settings ── */}
        <Card title="顯示設定" loading={loading}>
          <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
            <Form.Item name="newsPerPage" label="每頁顯示數量">
              <InputNumber min={1} max={100} style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="newsDefaultSort" label="預設排序">
              <Select
                style={{ width: 200 }}
                options={[
                  { value: 'newest', label: '最新發布' },
                  { value: 'popular', label: '最多瀏覽' },
                  { value: 'pinned', label: '置頂優先' },
                ]}
              />
            </Form.Item>
            <Form.Item name="newsShowCover" label="顯示封面圖" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="newsShowViewCount" label="顯示瀏覽數" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="newsShowSearch" label="顯示搜尋欄" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Form>
        </Card>

        {/* ── Save Button ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={submitting} size="large">
            儲存消息頁設定
          </Button>
        </div>

        {/* ── Category Management ── */}
        <Card title="分類管理">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openCatModal()}
            style={{ marginBottom: 16 }}
          >
            新增分類
          </Button>
          <Table
            scroll={{ x: 'max-content' }}
            loading={catLoading}
            dataSource={categories}
            rowKey="id"
            columns={[
              { title: '名稱', dataIndex: 'name' },
              { title: 'Slug', dataIndex: 'slug' },
              {
                title: '顏色',
                dataIndex: 'color',
                width: 80,
                render: (v: string | null) => (
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      background: v || '#ccc',
                      border: '1px solid #e8e8e8',
                    }}
                  />
                ),
              },
              { title: '排序', dataIndex: 'sortOrder', width: 80 },
              {
                title: '啟用',
                dataIndex: 'isActive',
                width: 80,
                render: (v: boolean) => <Switch checked={v} disabled size="small" />,
              },
              {
                title: '操作',
                width: 140,
                render: (_: unknown, record: ArticleCategory) => (
                  <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openCatModal(record)} />
                    <Popconfirm title="確定刪除此分類？" onConfirm={() => handleCatDelete(record.id)}>
                      <Button size="small" icon={<DeleteOutlined />} danger />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </Card>

        {/* ── Category Modal ── */}
        <Modal
          title={editingCat ? '編輯分類' : '新增分類'}
          open={catModalOpen}
          onOk={handleCatSubmit}
          onCancel={() => setCatModalOpen(false)}
        >
          <Form form={catForm} layout="vertical">
            <Form.Item name="name" label="分類名稱" rules={[{ required: true, message: '請輸入分類名稱' }]}>
              <Input placeholder="如：遊戲更新" />
            </Form.Item>
            <Form.Item name="slug" label="Slug" rules={[{ required: true, message: '請輸入 slug' }]}>
              <Input placeholder="如：game-updates" />
            </Form.Item>
            <Form.Item name="color" label="顏色" initialValue="#1677ff">
              <Input type="color" style={{ width: 80, height: 36, padding: 2, cursor: 'pointer' }} />
            </Form.Item>
            <Form.Item name="sortOrder" label="排序" initialValue={1}>
              <InputNumber min={1} style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="isActive" label="啟用" valuePropName="checked" initialValue={true}>
              <Switch />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
}
