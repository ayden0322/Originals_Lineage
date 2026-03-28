'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Dropdown,
  Button,
  Space,
  message,
} from 'antd';
import {
  DownOutlined,
  DownloadOutlined,
  TeamOutlined,
  UserAddOutlined,
  CheckCircleOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  getReservations,
  getReservationStats,
  updateReservationStatus,
  exportReservations,
} from '@/lib/api/reserve';
import type { Reservation, ReservationStats } from '@/lib/types';

const statusMap: Record<string, { label: string; color: string }> = {
  registered: { label: '已登記', color: 'blue' },
  confirmed: { label: '已確認', color: 'green' },
  converted: { label: '已轉換', color: 'purple' },
};

export default function ReservationsPage() {
  const [data, setData] = useState<Reservation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ReservationStats>({
    total: 0,
    registered: 0,
    confirmed: 0,
    converted: 0,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [res, statsRes] = await Promise.all([
        getReservations(page, pageSize),
        getReservationStats(),
      ]);
      setData(res.items);
      setTotal(res.total);
      setStats(statsRes);
    } catch {
      message.error('載入預約列表失敗');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateReservationStatus(id, status);
      message.success('狀態更新成功');
      fetchData();
    } catch {
      message.error('狀態更新失敗');
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportReservations();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reservations_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      message.success('匯出成功');
    } catch {
      message.error('匯出失敗');
    }
  };

  const columns: ColumnsType<Reservation> = [
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '暱稱',
      dataIndex: 'displayName',
      key: 'displayName',
    },
    {
      title: '手機',
      dataIndex: 'phone',
      key: 'phone',
      render: (val: string | null) => val || '-',
    },
    {
      title: 'LINE ID',
      dataIndex: 'lineId',
      key: 'lineId',
      render: (val: string | null) => val || '-',
    },
    {
      title: '推薦碼',
      dataIndex: 'referralCode',
      key: 'referralCode',
      render: (val: string | null) => val || '-',
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const s = statusMap[status] || { label: status, color: 'default' };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '時間',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => {
        const items = [
          { key: 'registered', label: '已登記' },
          { key: 'confirmed', label: '已確認' },
          { key: 'converted', label: '已轉換' },
        ].filter((item) => item.key !== record.status);

        return (
          <Dropdown
            menu={{
              items,
              onClick: ({ key }) => handleStatusChange(record.id, key),
            }}
          >
            <Button size="small">
              <Space>
                變更狀態
                <DownOutlined />
              </Space>
            </Button>
          </Dropdown>
        );
      },
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>預約管理</h2>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          匯出 CSV
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="總預約數" value={stats.total} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="已登記" value={stats.registered} prefix={<UserAddOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="已確認" value={stats.confirmed} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="已轉換" value={stats.converted} prefix={<SwapOutlined />} />
          </Card>
        </Col>
      </Row>

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
    </div>
  );
}
