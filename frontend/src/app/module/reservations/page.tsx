'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Input,
  message,
} from 'antd';
import {
  DownloadOutlined,
  TeamOutlined,
  PlusCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  getReservations,
  getReservationStats,
  exportReservations,
  type ReservationRecord,
  type ReservationStats,
} from '@/lib/api/reserve';

export default function ReservationsPage() {
  const [data, setData] = useState<ReservationRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ReservationStats>({
    actualCount: 0,
    countBase: 0,
    displayCount: 0,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [res, statsRes] = await Promise.all([
        getReservations(page, pageSize, keyword || undefined),
        getReservationStats(),
      ]);
      setData((res as any).data || res.items || []);
      setTotal(res.total);
      setStats(statsRes);
    } catch {
      message.error('載入預約列表失敗');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const columns: ColumnsType<ReservationRecord> = [
    {
      title: '遊戲帳號',
      dataIndex: 'gameAccountName',
      key: 'gameAccountName',
      width: 180,
    },
    {
      title: '網站帳號 ID',
      dataIndex: 'websiteUserId',
      key: 'websiteUserId',
      width: 280,
      render: (val: string) => (
        <span style={{ fontSize: 12, opacity: 0.7 }}>{val}</span>
      ),
    },
    {
      title: 'IP 位址',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 140,
      render: (val: string | null) => val || '-',
    },
    {
      title: '預約時間',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm'),
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
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="實際預約人數"
              value={stats.actualCount}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="種子基數"
              value={stats.countBase}
              prefix={<PlusCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="顯示人數"
              value={stats.displayCount}
              prefix={<EyeOutlined />}
              valueStyle={{ color: '#c4a24e' }}
            />
          </Card>
        </Col>
      </Row>

      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <Input.Search
          placeholder="搜尋遊戲帳號"
          allowClear
          onSearch={(val) => {
            setKeyword(val);
            setPage(1);
          }}
          style={{ maxWidth: 300 }}
        />
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
      />
    </div>
  );
}
