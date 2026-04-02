'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Typography, Table, Card, Space, Input, Select, DatePicker, Button, Tag, Tooltip,
} from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { getModuleLogs, type LogQueryParams } from '@/lib/api/logs';
import type { SystemLog } from '@/lib/types';
import { useAuth } from '@/components/providers/AuthProvider';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

/** 將 action 顯示為友善的中文標籤 */
function renderActionTag(action: string) {
  if (action === 'UPLOAD_FILE') return <Tag color="green">上傳檔案</Tag>;
  if (action === 'DELETE_FILE') return <Tag color="red">刪除檔案</Tag>;
  if (action.startsWith('DELETE')) return <Tag color="red">{action}</Tag>;
  if (action.startsWith('POST')) return <Tag color="blue">{action}</Tag>;
  if (action.startsWith('PUT') || action.startsWith('PATCH')) return <Tag color="orange">{action}</Tag>;
  return <Tag>{action}</Tag>;
}

/** 將 details 物件格式化為可讀文字 */
function renderDetails(details: Record<string, unknown> | null) {
  if (!details) return '-';
  const items: string[] = [];
  if (details.originalName) items.push(`檔案: ${details.originalName}`);
  if (details.objectName) items.push(`路徑: ${details.objectName}`);
  if (details.folder) items.push(`資料夾: ${details.folder}`);
  if (details.actorEmail) items.push(`帳號: ${details.actorEmail}`);
  if (details.size) items.push(`大小: ${formatSize(details.size as number)}`);
  if (items.length > 0) return items.join(' | ');
  // 通用 fallback: 顯示 body 摘要
  if (details.body && typeof details.body === 'object') {
    const bodyStr = JSON.stringify(details.body);
    return bodyStr.length > 100 ? bodyStr.substring(0, 100) + '...' : bodyStr;
  }
  return JSON.stringify(details).substring(0, 120);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ACTION_OPTIONS = [
  { value: '', label: '全部操作' },
  { value: 'UPLOAD_FILE', label: '上傳檔案' },
  { value: 'DELETE_FILE', label: '刪除檔案' },
  { value: 'POST', label: 'POST 請求' },
  { value: 'PUT', label: 'PUT 請求' },
  { value: 'PATCH', label: 'PATCH 請求' },
  { value: 'DELETE', label: 'DELETE 請求' },
];

const RESOURCE_TYPE_OPTIONS = [
  { value: '', label: '全部資源' },
  { value: 'storage', label: '媒體庫' },
  { value: 'modules', label: '模組功能' },
  { value: 'auth', label: '認證' },
];

export default function LogsPage() {
  const { user, hasPermission } = useAuth();
  const canView = hasPermission('module.originals.logs.view');

  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<LogQueryParams>({ page: 1, limit: 20 });

  // 篩選狀態
  const [ipFilter, setIpFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const fetchLogs = useCallback(async (params: LogQueryParams) => {
    if (!canView) return;
    setLoading(true);
    try {
      const result = await getModuleLogs(params);
      setLogs(result.items);
      setTotal(result.total);
    } catch {
      // 靜默處理
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    fetchLogs(query);
  }, [query, fetchLogs]);

  const handleSearch = () => {
    const newQuery: LogQueryParams = {
      page: 1,
      limit: query.limit,
    };
    if (ipFilter) newQuery.ipAddress = ipFilter;
    if (actionFilter) newQuery.action = actionFilter;
    if (resourceTypeFilter) newQuery.resourceType = resourceTypeFilter;
    if (dateRange?.[0]) newQuery.startDate = dateRange[0].startOf('day').toISOString();
    if (dateRange?.[1]) newQuery.endDate = dateRange[1].endOf('day').toISOString();
    setQuery(newQuery);
  };

  const handleReset = () => {
    setIpFilter('');
    setActionFilter('');
    setResourceTypeFilter('');
    setDateRange(null);
    setQuery({ page: 1, limit: 20 });
  };

  const columns: ColumnsType<SystemLog> = [
    {
      title: '時間',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: 'IP 位址',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 140,
      render: (ip: string) => <Text copyable={{ text: ip }}>{ip || '-'}</Text>,
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 200,
      render: (action: string) => renderActionTag(action),
    },
    {
      title: '資源類型',
      dataIndex: 'resourceType',
      key: 'resourceType',
      width: 100,
    },
    {
      title: '詳細資訊',
      dataIndex: 'details',
      key: 'details',
      ellipsis: true,
      render: (details: Record<string, unknown> | null) => (
        <Tooltip title={details ? JSON.stringify(details, null, 2) : '-'} overlayStyle={{ maxWidth: 500 }}>
          <span>{renderDetails(details)}</span>
        </Tooltip>
      ),
    },
    {
      title: 'User Agent',
      dataIndex: 'userAgent',
      key: 'userAgent',
      width: 150,
      ellipsis: true,
      render: (ua: string) => (
        <Tooltip title={ua}>
          <span>{ua ? ua.substring(0, 30) + '...' : '-'}</span>
        </Tooltip>
      ),
    },
  ];

  if (!canView) {
    return (
      <Card>
        <Title level={4}>操作日誌</Title>
        <Text type="secondary">您沒有權限查看操作日誌</Text>
      </Card>
    );
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>操作日誌</Title>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <Input
            placeholder="搜尋 IP 位址"
            value={ipFilter}
            onChange={(e) => setIpFilter(e.target.value)}
            style={{ width: 160 }}
            allowClear
          />
          <Select
            value={actionFilter}
            onChange={setActionFilter}
            options={ACTION_OPTIONS}
            style={{ width: 140 }}
          />
          <Select
            value={resourceTypeFilter}
            onChange={setResourceTypeFilter}
            options={RESOURCE_TYPE_OPTIONS}
            style={{ width: 140 }}
          />
          <RangePicker
            value={dateRange}
            onChange={(vals) => setDateRange(vals as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜尋
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={logs}
          loading={loading}
          pagination={{
            current: query.page,
            pageSize: query.limit,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 筆記錄`,
            onChange: (page, pageSize) => {
              setQuery((prev) => ({ ...prev, page, limit: pageSize }));
            },
          }}
          scroll={{ x: 1000 }}
          size="middle"
        />
      </Card>
    </div>
  );
}
