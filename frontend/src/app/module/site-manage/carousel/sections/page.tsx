'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Form,
  Input,
  InputNumber,
  Button,
  Table,
  Modal,
  Switch,
  Popconfirm,
  Space,
  message,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PictureOutlined,
  AppstoreAddOutlined,
} from '@ant-design/icons';
import RichTextEditor from '@/components/ui/RichTextEditor';
import {
  getSections,
  createSection,
  updateSection,
  deleteSection,
} from '@/lib/api/site-manage';
import type { SiteSection } from '@/lib/types';

const { Title } = Typography;

export default function SectionsPage() {
  const router = useRouter();
  const [sections, setSections] = useState<SiteSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<SiteSection | null>(null);
  const [form] = Form.useForm();
  const [description, setDescription] = useState('');

  const fetchSections = useCallback(async () => {
    try {
      const data = await getSections();
      setSections(data);
    } catch {
      message.error('載入區塊失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  const openModal = (section?: SiteSection) => {
    if (section) {
      setEditingSection(section);
      form.setFieldsValue(section);
      setDescription(section.description || '');
    } else {
      setEditingSection(null);
      form.resetFields();
      setDescription('');
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const dto = { ...values, description };
      if (editingSection) {
        await updateSection(editingSection.id, dto);
        message.success('已更新');
        setModalOpen(false);
        fetchSections();
      } else {
        const newSection = await createSection(dto);
        message.success('已新增區塊，前往新增輪播圖');
        setModalOpen(false);
        router.push(`/module/site-manage/carousel/sections/${newSection.id}`);
      }
    } catch {
      message.error('操作失敗');
    }
  };

  const handleDeleteSection = async (id: string) => {
    try {
      await deleteSection(id);
      message.success('已刪除');
      fetchSections();
    } catch {
      message.error('刪除失敗');
    }
  };

  return (
    <div>
      <Title level={3}>區塊輪播設定</Title>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => openModal()}
        style={{ marginBottom: 16 }}
      >
        新增區塊
      </Button>
      <Table
        scroll={{ x: 'max-content' }}
        loading={loading}
        dataSource={sections}
        rowKey="id"
        locale={{
          emptyText: (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <AppstoreAddOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
              <div style={{ fontSize: 16, color: '#999', marginBottom: 8 }}>尚未建立任何區塊</div>
              <div style={{ fontSize: 13, color: '#bbb', marginBottom: 16 }}>
                請先點擊上方「新增區塊」建立輪播區塊（如：世界觀、職業介紹），再於區塊內新增輪播圖片或影片
              </div>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
                新增第一個區塊
              </Button>
            </div>
          ),
        }}
        columns={[
          { title: '名稱', dataIndex: 'name' },
          { title: '排序', dataIndex: 'sortOrder', width: 80 },
          {
            title: '啟用',
            dataIndex: 'isActive',
            width: 80,
            render: (v: boolean) => <Switch checked={v} disabled />,
          },
          {
            title: '輪播數',
            width: 80,
            render: (_: unknown, record: SiteSection) => (
              <span>{record.slides?.length || 0}</span>
            ),
          },
          {
            title: '操作',
            width: 220,
            render: (_: unknown, record: SiteSection) => (
              <Space>
                <Button
                  icon={<PictureOutlined />}
                  onClick={() => router.push(`/module/site-manage/carousel/sections/${record.id}`)}
                >
                  管理圖片／影片
                </Button>
                <Button icon={<EditOutlined />} onClick={() => openModal(record)} />
                <Popconfirm title="確定刪除？此操作會同時刪除所有輪播圖" onConfirm={() => handleDeleteSection(record.id)}>
                  <Button icon={<DeleteOutlined />} danger />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      {/* Section Create/Edit Modal */}
      <Modal
        title={editingSection ? '編輯區塊' : '新增區塊'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={720}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="區塊名稱" rules={[{ required: true, message: '請輸入區塊名稱' }]}>
            <Input placeholder="如：世界觀" />
          </Form.Item>
          <Form.Item label="描述（支援富文本、圖片）">
            <RichTextEditor
              value={description}
              onChange={setDescription}
              folder="sections"
              minHeight={150}
            />
          </Form.Item>
          <Form.Item
            name="sortOrder"
            label={<span>排序 <span style={{ fontSize: 12, color: '#999' }}>（1 為最上方，數字越大越後面）</span></span>}
            initialValue={1}
          >
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="isActive" label="啟用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
