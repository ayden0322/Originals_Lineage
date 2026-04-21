'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Descriptions,
  Input,
  message,
  Popconfirm,
  Alert,
} from 'antd';
import {
  EyeOutlined,
  ReloadOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  getOrders,
  getOrder,
  retryDelivery,
  refundOrder,
} from '@/lib/api/shop';
import type { Order, OrderItem } from '@/lib/types';

const orderStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待付款', color: 'orange' },
  paid: { label: '已付款', color: 'green' },
  failed: { label: '失敗', color: 'red' },
  cancelled: { label: '已取消', color: 'default' },
  refunded: { label: '已退款', color: 'purple' },
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

  // Refund modal state
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);

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

  const openRefund = (order: Order) => {
    setRefundTarget(order);
    setRefundReason('');
    setRefundOpen(true);
  };

  const handleRefund = async () => {
    if (!refundTarget) return;
    setRefundSubmitting(true);
    try {
      const res = await refundOrder(refundTarget.id, refundReason.trim() || undefined);
      message.success(
        `退款完成：訂單已標記為已退款，沖銷 ${res.adjustmentsCreated} 筆分潤`,
      );
      setRefundOpen(false);
      setRefundTarget(null);
      setRefundReason('');
      fetchData();
      if (detailOrder?.id === refundTarget.id) {
        const order = await getOrder(refundTarget.id);
        setDetailOrder(order);
      }
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data
        ?.message;
      message.error(msg || '退款失敗');
    } finally {
      setRefundSubmitting(false);
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

  const renderMember = (record: Order) => {
    const game = record.gameAccountName;
    if (!game) {
      return <span style={{ color: '#999' }}>—</span>;
    }
    return <span style={{ fontWeight: 500 }}>{game}</span>;
  };

  const columns: ColumnsType<Order> = [
    {
      title: '訂單編號',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      width: 200,
    },
    {
      title: '遊戲帳號',
      key: 'member',
      width: 160,
      render: (_, record) => renderMember(record),
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
      width: 220,
      fixed: 'right',
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
          {record.status === 'paid' && (
            <Button
              type="link"
              size="small"
              danger
              icon={<RollbackOutlined />}
              onClick={() => openRefund(record)}
            >
              退款
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
          detailOrder ? (
            <Space>
              <Button
                onClick={() => {
                  setDetailOpen(false);
                  setDetailOrder(null);
                }}
              >
                關閉
              </Button>
              {detailOrder.deliveryStatus === 'failed' && (
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => handleRetryDelivery(detailOrder.id)}
                >
                  重新發貨
                </Button>
              )}
              {detailOrder.status === 'paid' && (
                <Button
                  danger
                  type="primary"
                  icon={<RollbackOutlined />}
                  onClick={() => {
                    setDetailOpen(false);
                    openRefund(detailOrder);
                  }}
                >
                  退款
                </Button>
              )}
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
              <Descriptions.Item label="遊戲帳號">
                {detailOrder.gameAccountName || '—'}
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

      <Modal
        title="訂單退款"
        open={refundOpen}
        onCancel={() => {
          if (refundSubmitting) return;
          setRefundOpen(false);
          setRefundTarget(null);
          setRefundReason('');
        }}
        footer={
          <Space>
            <Button
              onClick={() => {
                setRefundOpen(false);
                setRefundTarget(null);
                setRefundReason('');
              }}
              disabled={refundSubmitting}
            >
              取消
            </Button>
            <Popconfirm
              title="確定要退款？"
              description="訂單將被標記為『已退款』，並沖銷該筆交易的代理分潤。此操作不會回收遊戲內已發放的道具/鑽石。"
              okText="確定退款"
              okButtonProps={{ danger: true }}
              cancelText="再想想"
              onConfirm={handleRefund}
            >
              <Button
                type="primary"
                danger
                icon={<RollbackOutlined />}
                loading={refundSubmitting}
              >
                執行退款
              </Button>
            </Popconfirm>
          </Space>
        }
        width={560}
      >
        {refundTarget && (
          <>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="此操作將同時：①把訂單狀態改為已退款 ②沖銷對應分潤（當期加負值加減項）"
              description="冪等保證：同一訂單若已退款，系統會阻擋重複執行。"
            />
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="訂單編號">
                {refundTarget.orderNumber}
              </Descriptions.Item>
              <Descriptions.Item label="遊戲帳號">
                {refundTarget.gameAccountName || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="金額">
                NT$ {Number(refundTarget.totalAmount).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="發貨狀態">
                <Tag
                  color={
                    (deliveryStatusMap[refundTarget.deliveryStatus] || { color: 'default' })
                      .color
                  }
                >
                  {
                    (deliveryStatusMap[refundTarget.deliveryStatus] || {
                      label: refundTarget.deliveryStatus,
                    }).label
                  }
                </Tag>
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 6, fontWeight: 500 }}>退款原因（選填）</div>
              <Input.TextArea
                rows={3}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="例如：玩家申請退款，已通過審核"
                maxLength={500}
                showCount
              />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
