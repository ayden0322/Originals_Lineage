'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Descriptions,
  message,
} from 'antd';
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { getOrders, getOrder, retryDelivery } from '@/lib/api/shop';
import type { Order, OrderItem } from '@/lib/types';

const orderStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待付款', color: 'orange' },
  paid: { label: '已付款', color: 'green' },
  failed: { label: '失敗', color: 'red' },
  cancelled: { label: '已取消', color: 'default' },
};

const deliveryStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待發貨', color: 'orange' },
  delivered: { label: '已發貨', color: 'green' },
  failed: { label: '發貨失敗', color: 'red' },
};

export default function OrdersPage() {
  const [data, setData] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getOrders(page, pageSize);
      setData(res.items);
      setTotal(res.total);
    } catch {
      message.error('載入訂單列表失敗');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const order = await getOrder(id);
      setDetailOrder(order);
    } catch {
      message.error('載入訂單詳情失敗');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRetryDelivery = async (id: string) => {
    try {
      await retryDelivery(id);
      message.success('重新發貨請求已送出');
      fetchData();
      if (detailOrder?.id === id) {
        const order = await getOrder(id);
        setDetailOrder(order);
      }
    } catch {
      message.error('重新發貨失敗');
    }
  };

  const itemColumns: ColumnsType<OrderItem> = [
    {
      title: '商品 ID',
      dataIndex: 'productId',
      key: 'productId',
      ellipsis: true,
    },
    {
      title: '數量',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right',
    },
    {
      title: '單價',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      align: 'right',
      render: (val: string) => `NT$ ${Number(val).toLocaleString()}`,
    },
    {
      title: '鑽石數量',
      dataIndex: 'diamondAmount',
      key: 'diamondAmount',
      align: 'right',
    },
  ];

  const columns: ColumnsType<Order> = [
    {
      title: '訂單編號',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      width: 200,
    },
    {
      title: '金額',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 120,
      align: 'right',
      render: (val: string) => `NT$ ${Number(val).toLocaleString()}`,
    },
    {
      title: '訂單狀態',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center',
      render: (status: string) => {
        const s = orderStatusMap[status] || { label: status, color: 'default' };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '發貨狀態',
      dataIndex: 'deliveryStatus',
      key: 'deliveryStatus',
      width: 100,
      align: 'center',
      render: (status: string) => {
        const s = deliveryStatusMap[status] || { label: status, color: 'default' };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '建立時間',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openDetail(record.id)}
          >
            詳情
          </Button>
          {record.deliveryStatus === 'failed' && (
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleRetryDelivery(record.id)}
            >
              重新發貨
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2>訂單管理</h2>

      <Table
        scroll={{ x: 'max-content' }}
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
        title="訂單詳情"
        open={detailOpen}
        onCancel={() => {
          setDetailOpen(false);
          setDetailOrder(null);
        }}
        footer={
          detailOrder?.deliveryStatus === 'failed' ? (
            <Space>
              <Button onClick={() => setDetailOpen(false)}>關閉</Button>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={() => handleRetryDelivery(detailOrder.id)}
              >
                重新發貨
              </Button>
            </Space>
          ) : (
            <Button onClick={() => setDetailOpen(false)}>關閉</Button>
          )
        }
        width={720}
        loading={detailLoading}
      >
        {detailOrder && (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="訂單編號">
                {detailOrder.orderNumber}
              </Descriptions.Item>
              <Descriptions.Item label="金額">
                NT$ {Number(detailOrder.totalAmount).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="訂單狀態">
                <Tag
                  color={
                    (orderStatusMap[detailOrder.status] || { color: 'default' }).color
                  }
                >
                  {(orderStatusMap[detailOrder.status] || { label: detailOrder.status }).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="發貨狀態">
                <Tag
                  color={
                    (deliveryStatusMap[detailOrder.deliveryStatus] || { color: 'default' }).color
                  }
                >
                  {(deliveryStatusMap[detailOrder.deliveryStatus] || { label: detailOrder.deliveryStatus }).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="建立時間">
                {dayjs(detailOrder.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="更新時間">
                {dayjs(detailOrder.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>

            <h4 style={{ marginTop: 16 }}>訂單項目</h4>
            <Table
              scroll={{ x: 'max-content' }}
              rowKey="id"
              columns={itemColumns}
              dataSource={detailOrder.items}
              pagination={false}
              size="small"
            />
          </>
        )}
      </Modal>
    </div>
  );
}
