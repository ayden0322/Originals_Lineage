'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Popconfirm,
  message,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  getArticles,
  createArticle,
  updateArticle,
  deleteArticle,
  getCategories,
} from '@/lib/api/content';
import type { Article, CreateArticleDto, ArticleCategory } from '@/lib/types';
import RichTextEditor from '@/components/ui/RichTextEditor';
import ImageUpload from '@/components/ui/ImageUpload';

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  published: { label: '已發佈', color: 'green' },
  archived: { label: '已封存', color: 'orange' },
};

export default function ArticlesPage() {
  const [data, setData] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverMode, setCoverMode] = useState<'upload' | 'url'>('upload');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [form] = Form.useForm<CreateArticleDto>();

  // Find the changelog-related category slug (name contains "更新")
  const changelogCategorySlugs = categories
    .filter((c) => c.name.includes('更新'))
    .map((c) => c.slug);
  const showSummary = changelogCategorySlugs.includes(selectedCategory);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getArticles(page, pageSize);
      setData(res.items);
      setTotal(res.total);
    } catch {
      message.error('載入文章列表失敗');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    setContent('');
    setSummary('');
    setCoverImageUrl('');
    setCoverMode('upload');
    setSelectedCategory('');
    setModalOpen(true);
  };

  const openEdit = (record: Article) => {
    setEditingId(record.id);
    form.setFieldsValue({
      title: record.title,
      slug: record.slug,
      category: record.category,
      status: record.status,
      isPinned: record.isPinned,
    });
    setContent(record.content || '');
    setSummary(record.summary || '');
    setSelectedCategory(record.category || '');
    setCoverImageUrl(record.coverImageUrl || '');
    // Detect if existing cover is an external URL (not from MinIO)
    const url = record.coverImageUrl || '';
    setCoverMode(url && !url.includes('/originals-uploads/') ? 'url' : 'upload');
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = {
        ...values,
        slug: values.slug?.trim() || undefined,
        content: content || undefined,
        summary: showSummary ? (summary || undefined) : undefined,
        coverImageUrl: coverImageUrl || undefined,
      };
      if (editingId) {
        await updateArticle(editingId, payload);
        message.success('文章更新成功');
      } else {
        await createArticle(payload);
        message.success('文章建立成功');
      }
      setModalOpen(false);
      fetchData();
    } catch {
      message.error('操作失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteArticle(id);
      message.success('文章刪除成功');
      fetchData();
    } catch {
      message.error('刪除失敗');
    }
  };

  const columns: ColumnsType<Article> = [
    {
      title: '標題',
      dataIndex: 'title',
      key: 'title',
      width: 280,
    },
    {
      title: '分類',
      dataIndex: 'category',
      key: 'category',
      width: 80,
      render: (slug: string) => {
        const cat = categories.find((c) => c.slug === slug);
        return cat ? cat.name : slug;
      },
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      align: 'center',
      render: (status: string) => {
        const s = statusMap[status] || { label: status, color: 'default' };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '置頂',
      dataIndex: 'isPinned',
      key: 'isPinned',
      width: 70,
      align: 'center',
      render: (val: boolean) => (val ? <Tag color="blue">置頂</Tag> : '-'),
    },
    {
      title: '瀏覽數',
      dataIndex: 'viewCount',
      key: 'viewCount',
      width: 80,
      align: 'right',
    },
    {
      title: '發佈時間',
      dataIndex: 'publishedAt',
      key: 'publishedAt',
      width: 160,
      render: (val: string | null) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          >
            編輯
          </Button>
          <Popconfirm
            title="確定要刪除此文章嗎？"
            onConfirm={() => handleDelete(record.id)}
            okText="確定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              刪除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>文章管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增文章
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 筆`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
        style={{ marginTop: 16 }}
      />

      <Modal
        title={editingId ? '編輯文章' : '新增文章'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText="儲存"
        cancelText="取消"
        width={800}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ status: 'draft', isPinned: false }}>
          <Form.Item
            name="title"
            label="標題"
            rules={[{ required: true, message: '請輸入標題' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="slug" label="Slug">
            <Input placeholder="留空自動產生" />
          </Form.Item>
          <Form.Item label="內容" required>
            <RichTextEditor value={content} onChange={setContent} folder="articles" minHeight={200} />
          </Form.Item>
          <Form.Item
            name="category"
            label="分類"
            rules={[{ required: true, message: '請選擇分類' }]}
          >
            <Select
              placeholder="請選擇分類"
              options={categories.map((c) => ({ value: c.slug, label: c.name }))}
              onChange={(val) => setSelectedCategory(val)}
            />
          </Form.Item>
          {showSummary && (
            <Form.Item
              label={
                <span>
                  更新摘要 <span style={{ color: '#999', fontWeight: 400 }}>（列點式，將顯示在更新歷程時間軸）</span>
                </span>
              }
            >
              <Input.TextArea
                rows={4}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder={'• 修復登入閃退問題\n• 新增春季活動副本\n• 平衡調整：戰士技能傷害 +10%'}
              />
            </Form.Item>
          )}
          <Form.Item label="封面圖片">
            <div style={{ marginBottom: 8 }}>
              <Space>
                <Button
                  type={coverMode === 'upload' ? 'primary' : 'default'}
                  size="small"
                  icon={<UploadOutlined />}
                  onClick={() => { setCoverMode('upload'); setCoverImageUrl(''); }}
                >
                  上傳檔案
                </Button>
                <Button
                  type={coverMode === 'url' ? 'primary' : 'default'}
                  size="small"
                  icon={<LinkOutlined />}
                  onClick={() => { setCoverMode('url'); setCoverImageUrl(''); }}
                >
                  輸入網址
                </Button>
              </Space>
            </div>
            {coverMode === 'upload' ? (
              <ImageUpload value={coverImageUrl} onChange={setCoverImageUrl} folder="articles" />
            ) : (
              <div>
                <Input
                  placeholder="輸入圖片或 GIF 網址，如 https://example.com/image.gif"
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                />
                {coverImageUrl && (
                  <div style={{ marginTop: 8 }}>
                    {coverImageUrl.toLowerCase().endsWith('.gif') ? (
                      <img
                        src={coverImageUrl}
                        alt="preview"
                        style={{ maxWidth: 300, maxHeight: 180, borderRadius: 8, objectFit: 'cover' }}
                      />
                    ) : (
                      <img
                        src={coverImageUrl}
                        alt="preview"
                        style={{ maxWidth: 300, maxHeight: 180, borderRadius: 8, objectFit: 'cover' }}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </Form.Item>
          <Form.Item name="status" label="狀態">
            <Select>
              <Select.Option value="draft">草稿</Select.Option>
              <Select.Option value="published">已發佈</Select.Option>
              <Select.Option value="archived">已封存</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="isPinned" label="置頂" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
