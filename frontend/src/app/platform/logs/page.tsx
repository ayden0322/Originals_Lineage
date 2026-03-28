'use client';

import { useEffect, useState, useCallback } from 'react';
import { Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { SystemLog } from '@/lib/types';
import { getLogs } from '@/lib/api/logs';

export default function LogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getLogs(page, limit);
      setLogs(result.items);
      setTotal(result.total);
    } catch {
      message.error('載入系統日誌失敗');
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const columns: ColumnsType<SystemLog> = [
    {
      title: '時間',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (val: string) => new Date(val).toLocaleString('zh-TW'),
    },
    {
      title: '操作者',
      dataIndex: 'actorId',
      key: 'actorId',
      width: 140,
      ellipsis: true,
    },
    {
      title: '動作',
      dataIndex: 'action',
      key: 'action',
      width: 140,
    },
    {
      title: '資源類型',
      dataIndex: 'resourceType',
      key: 'resourceType',
      width: 130,
    },
    {
      title: '資源 ID',
      dataIndex: 'resourceId',
      key: 'resourceId',
      width: 140,
      ellipsis: true,
    },
    {
      title: 'IP',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 140,
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>系統日誌</h2>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={logs}
        loading={loading}
        pagination={{
          current: page,
          pageSize: limit,
          total,
          onChange: (p) => setPage(p),
          showTotal: (t) => `共 ${t} 筆`,
        }}
        scroll={{ x: 900 }}
      />
    </div>
  );
}
