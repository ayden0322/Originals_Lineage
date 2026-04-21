'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Space,
  Popconfirm,
  message,
  Typography,
  Tag,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/lib/api/content';
import type { ArticleCategory } from '@/lib/types';

const { Title } = Typography;

export default function CategoriesPage() {
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ArticleCategory | null>(null);
  const [form] = Form.useForm();

  const fetchCategories = useCallback(async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch {
      message.error('載入分類失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openModal = (cat?: ArticleCategory) => {
    if (cat) {
      setEditing(cat);
      form.setFieldsValue(cat);
    } else {
      setEditing(null);
      form.resetFields();
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await updateCategory(editing.id, values);
        message.success('已更新');
      } else {
        await createCategory(values);
        message.success('已新增');
      }
      setModalOpen(false);
      fetchCategories();
    } catch {
      message.error('操作失敗');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory(id);
      message.success('已刪除');
      fetchCategories();
    } catch {
      message.error('刪除失敗');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>分類管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          新增分類
        </Button>
      </div>

      <Table
        scroll={{ x: 'max-content' }}
        loading={loading}
        dataSource={categories}
        rowKey="id"
        columns={[
          { title: '名稱', dataIndex: 'name' },
          { title: 'Slug', dataIndex: 'slug' },
          {
            title: '顏色',
            dataIndex: 'color',
            width: 80,
            render: (color: string | null) =>
              color ? (
                <Tag color={color} style={{ width: 40, height: 20 }} />
              ) : (
                '-'
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
            width: 150,
            render: (_: unknown, record: ArticleCategory) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>
                  編輯
                </Button>
                <Popconfirm title="確定刪除？" onConfirm={() => handleDelete(record.id)}>
                  <Button size="small" icon={<DeleteOutlined />} danger>
                    刪除
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? '編輯分類' : '新增分類'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={480}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名稱" rules={[{ required: true }]}>
            <Input placeholder="如：新聞" />
          </Form.Item>
          <Form.Item name="slug" label="Slug" rules={[{ required: true }]}>
            <Input placeholder="如：news" />
          </Form.Item>
          <Form.Item name="color" label="顏色">
            <Input type="color" style={{ width: 60, height: 32, padding: 2 }} />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序" initialValue={0}>
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="isActive" label="啟用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
