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
  InputNumber,
  Popconfirm,
  message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '@/lib/api/shop';
import type { Product, CreateProductDto } from '@/lib/types';

const categoryMap: Record<string, { label: string; color: string }> = {
  diamond_pack: { label: '鑽石包', color: 'blue' },
  special_bundle: { label: '特殊禮包', color: 'purple' },
  event_pack: { label: '活動包', color: 'orange' },
};

export default function ProductsPage() {
  const [data, setData] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getProducts(page, pageSize);
      setData(res.items);
      setTotal(res.total);
    } catch {
      message.error('載入商品列表失敗');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: Product) => {
    setEditingId(record.id);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      price: Number(record.price),
      diamondAmount: record.diamondAmount,
      category: record.category,
      imageUrl: record.imageUrl || undefined,
      stock: record.stock,
      maxPerUser: record.maxPerUser,
      isActive: record.isActive,
      sortOrder: record.sortOrder,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const dto: CreateProductDto = {
        name: values.name,
        description: values.description,
        price: values.price,
        diamondAmount: values.diamondAmount,
        category: values.category,
        imageUrl: values.imageUrl || undefined,
        stock: values.stock,
        maxPerUser: values.maxPerUser,
        isActive: values.isActive,
        sortOrder: values.sortOrder,
      };

      if (editingId) {
        await updateProduct(editingId, dto);
        message.success('商品更新成功');
      } else {
        await createProduct(dto);
        message.success('商品建立成功');
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
      await deleteProduct(id);
      message.success('商品刪除成功');
      fetchData();
    } catch {
      message.error('刪除失敗');
    }
  };

  const columns: ColumnsType<Product> = [
    {
      title: '商品名稱',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '價格',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      align: 'right',
      render: (val: string) => `NT$ ${Number(val).toLocaleString()}`,
    },
    {
      title: '鑽石數量',
      dataIndex: 'diamondAmount',
      key: 'diamondAmount',
      width: 100,
      align: 'right',
    },
    {
      title: '分類',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (cat: string) => {
        const c = categoryMap[cat] || { label: cat, color: 'default' };
        return <Tag color={c.color}>{c.label}</Tag>;
      },
    },
    {
      title: '庫存',
      dataIndex: 'stock',
      key: 'stock',
      width: 80,
      align: 'right',
      render: (val: number) => (val === -1 ? '無限' : val),
    },
    {
      title: '啟用',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      align: 'center',
      render: (val: boolean) => (
        <Tag color={val ? 'green' : 'default'}>{val ? '啟用' : '停用'}</Tag>
      ),
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 70,
      align: 'right',
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
            title="確定要刪除此商品嗎？"
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
        <h2>商品管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增商品
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
        title={editingId ? '編輯商品' : '新增商品'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText="儲存"
        cancelText="取消"
        width={640}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            category: 'diamond_pack',
            stock: -1,
            maxPerUser: 0,
            isActive: true,
            sortOrder: 0,
          }}
        >
          <Form.Item
            name="name"
            label="商品名稱"
            rules={[{ required: true, message: '請輸入商品名稱' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
            rules={[{ required: true, message: '請輸入描述' }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="price"
            label="價格"
            rules={[{ required: true, message: '請輸入價格' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} addonBefore="NT$" />
          </Form.Item>
          <Form.Item
            name="diamondAmount"
            label="鑽石數量"
            rules={[{ required: true, message: '請輸入鑽石數量' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="category"
            label="分類"
            rules={[{ required: true, message: '請選擇分類' }]}
          >
            <Select>
              <Select.Option value="diamond_pack">鑽石包</Select.Option>
              <Select.Option value="special_bundle">特殊禮包</Select.Option>
              <Select.Option value="event_pack">活動包</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="imageUrl" label="圖片網址">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item
            name="stock"
            label="庫存"
            extra="-1 代表無限"
          >
            <InputNumber min={-1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maxPerUser" label="每人購買上限" extra="0 代表不限">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isActive" label="啟用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
