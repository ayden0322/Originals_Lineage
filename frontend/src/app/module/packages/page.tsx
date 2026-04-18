'use client';

import { useEffect, useState } from 'react';
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
  Card,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  GiftOutlined,
} from '@ant-design/icons';
import ImageUpload from '@/components/ui/ImageUpload';
import RichTextEditor from '@/components/ui/RichTextEditor';
import {
  getPackages,
  createPackage,
  updatePackage,
  deletePackage,
} from '@/lib/api/package-manage';
import type { GamePackage } from '@/lib/types';

const { Title, Paragraph } = Typography;

export default function PackagesAdminPage() {
  const [rows, setRows] = useState<GamePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GamePackage | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const data = await getPackages();
      setRows(data);
    } catch {
      message.error('載入失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      isActive: true,
      sortOrder: 0,
      currencyAmount: 1,
      contentHtml: '',
    });
    setModalOpen(true);
  };

  const openEdit = (row: GamePackage) => {
    setEditing(row);
    form.resetFields();
    form.setFieldsValue({
      name: row.name,
      description: row.description,
      imageUrl: row.imageUrl,
      largeImageUrl: row.largeImageUrl,
      currencyAmount: row.currencyAmount,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      contentHtml: row.contentHtml || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      // 不再處理 items 欄位（改由 contentHtml 管理）；後端會保留現有 items 不動
      const payload: Partial<GamePackage> = { ...values };
      if (editing) {
        await updatePackage(editing.id, payload);
        message.success('已更新');
      } else {
        await createPackage(payload);
        message.success('已建立');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      const e = err as { errorFields?: unknown; response?: { data?: { message?: string } } };
      if (e?.response?.data?.message) {
        message.error(e.response.data.message);
      } else if (!e?.errorFields) {
        message.error('儲存失敗');
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePackage(id);
      message.success('已刪除');
      load();
    } catch {
      message.error('刪除失敗');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <GiftOutlined style={{ marginRight: 8 }} />
            禮包管理
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            管理公開「禮包內容」頁面上顯示的禮包清單（純展示，不涉及金流）
          </Paragraph>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增禮包
        </Button>
      </div>

      <Card>
        <Table<GamePackage>
          rowKey="id"
          dataSource={rows}
          loading={loading}
          pagination={{ pageSize: 20 }}
          columns={[
            {
              title: '排序',
              dataIndex: 'sortOrder',
              width: 70,
              sorter: (a, b) => a.sortOrder - b.sortOrder,
              defaultSortOrder: 'ascend',
            },
            {
              title: '縮圖',
              dataIndex: 'imageUrl',
              width: 80,
              render: (v: string | null) =>
                v ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v}
                    alt=""
                    style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 4,
                      background: '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <GiftOutlined style={{ color: '#bbb' }} />
                  </div>
                ),
            },
            { title: '名稱', dataIndex: 'name' },
            {
              title: '兌換貨幣',
              dataIndex: 'currencyAmount',
              width: 120,
              render: (v: number) => <Tag color="gold">{v}</Tag>,
            },
            {
              title: '內容',
              width: 90,
              render: (_, row) =>
                row.contentHtml && row.contentHtml.trim() ? (
                  <Tag color="blue">已設定</Tag>
                ) : row.items && row.items.length > 0 ? (
                  <Tag>舊資料 {row.items.length}</Tag>
                ) : (
                  <Tag>未設定</Tag>
                ),
            },
            {
              title: '狀態',
              dataIndex: 'isActive',
              width: 80,
              render: (v: boolean) =>
                v ? <Tag color="green">上架</Tag> : <Tag>下架</Tag>,
            },
            {
              title: '操作',
              width: 150,
              render: (_, row) => (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
                    編輯
                  </Button>
                  <Popconfirm
                    title="確定刪除此禮包？"
                    onConfirm={() => handleDelete(row.id)}
                    okText="刪除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? '編輯禮包' : '新增禮包'}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText="儲存"
        cancelText="取消"
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="禮包名稱"
            name="name"
            rules={[{ required: true, message: '請輸入名稱' }]}
          >
            <Input placeholder="例：新手成長禮包" />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} placeholder="簡短描述（列表卡片顯示前 2 行）" />
          </Form.Item>

          <Form.Item
            label="兌換所需貨幣數量"
            name="currencyAmount"
            rules={[{ required: true, message: '請輸入貨幣數量' }]}
          >
            <InputNumber min={0} style={{ width: 200 }} />
          </Form.Item>

          <Form.Item label="卡片縮圖" name="imageUrl" tooltip="列表頁卡片顯示的圖">
            <ImageUpload folder="packages" />
          </Form.Item>

          <Form.Item
            label="Modal 大圖"
            name="largeImageUrl"
            tooltip="點擊卡片後 Modal 展示的大圖；未設定則沿用縮圖。上傳後可圈選裁切範圍"
          >
            <ImageUpload
              folder="packages"
              crop
              aspect={16 / 9}
              previewWidth={320}
            />
          </Form.Item>

          <Form.Item
            label="禮包內容"
            name="contentHtml"
            tooltip="前台 Modal 顯示的內容區塊。可插入圖片、表格、文字樣式等"
          >
            <RichTextEditor folder="packages" placeholder="請輸入禮包內容..." minHeight={240} />
          </Form.Item>

          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item label="上架" name="isActive" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="排序" name="sortOrder" tooltip="數字小的排前面">
              <InputNumber min={0} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
