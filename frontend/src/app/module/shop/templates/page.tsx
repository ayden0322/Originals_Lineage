'use client';

import { useEffect, useState, useCallback } from 'react';
import { Table, Tag, Button, Space, Popconfirm, message, Modal, Tabs } from 'antd';
import { DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getProductTemplates, deleteProductTemplate } from '@/lib/api/shop';
import type { ProductTemplate, ProductCategory } from '@/lib/types';

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  diamond: '鑽石',
  game_item: '遊戲禮包',
  monthly_card: '月卡',
};

const CATEGORY_COLOR: Record<ProductCategory, string> = {
  diamond: 'blue',
  game_item: 'purple',
  monthly_card: 'gold',
};

export default function ProductTemplatesPage() {
  const [activeCategory, setActiveCategory] = useState<ProductCategory | 'all'>('all');
  const [data, setData] = useState<ProductTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<ProductTemplate | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const tpls = await getProductTemplates(activeCategory === 'all' ? undefined : activeCategory);
      setData(tpls);
    } catch {
      message.error('載入範本失敗');
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    try {
      await deleteProductTemplate(id);
      message.success('刪除成功');
      fetchData();
    } catch {
      message.error('刪除失敗');
    }
  };

  const columns: ColumnsType<ProductTemplate> = [
    { title: '範本名稱', dataIndex: 'name', key: 'name' },
    {
      title: '分類',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (cat: ProductCategory) => (
        <Tag color={CATEGORY_COLOR[cat]}>{CATEGORY_LABEL[cat]}</Tag>
      ),
    },
    {
      title: '建立時間',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (v: string) => new Date(v).toLocaleString('zh-TW'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setPreviewItem(record);
              setPreviewOpen(true);
            }}
          >
            預覽
          </Button>
          <Popconfirm
            title="確定要刪除此範本嗎？"
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
      <h2>商品範本（常用設定）</h2>
      <p style={{ color: '#666', marginBottom: 16 }}>
        在「商品管理」新增/編輯商品時，可將欄位儲存為範本，所有管理者皆可載入再做小幅調整。
      </p>

      <Tabs
        activeKey={activeCategory}
        onChange={(k) => setActiveCategory(k as ProductCategory | 'all')}
        items={[
          { key: 'all', label: '全部' },
          { key: 'diamond', label: '鑽石' },
          { key: 'game_item', label: '遊戲禮包' },
          { key: 'monthly_card', label: '月卡' },
        ]}
      />

      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} />

      <Modal
        title={`範本預覽：${previewItem?.name ?? ''}`}
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        width={600}
      >
        <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, overflow: 'auto', maxHeight: 480 }}>
          {JSON.stringify(previewItem?.snapshot ?? {}, null, 2)}
        </pre>
      </Modal>
    </div>
  );
}
