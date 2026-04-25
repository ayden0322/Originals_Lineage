'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Card,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Tag,
  Popconfirm,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import Link from 'next/link';
import {
  getApplications,
  deleteApplication,
  type ForumPushApplication,
} from '@/lib/api/forum-push';

const { RangePicker } = DatePicker;
const { Title } = Typography;

const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待審核' },
  { value: 'reviewed', label: '已審核' },
];

function statusTag(s: string) {
  if (s === 'pending') return <Tag color="orange">待審核</Tag>;
  if (s === 'reviewed') return <Tag color="green">已審核</Tag>;
  return <Tag>{s}</Tag>;
}

function rewardTag(s: string) {
  if (s === 'sent') return <Tag color="gold">已發放</Tag>;
  if (s === 'partial') return <Tag color="orange">部分發放</Tag>;
  if (s === 'failed') return <Tag color="red">發放失敗</Tag>;
  return <Tag>未發放</Tag>;
}

export default function ForumPushListPage() {
  const [data, setData] = useState<ForumPushApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [range, setRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getApplications({
        page,
        limit: pageSize,
        status: status || undefined,
        keyword: keyword || undefined,
        from: range?.[0] ? range[0].startOf('day').toISOString() : undefined,
        to: range?.[1] ? range[1].endOf('day').toISOString() : undefined,
      });
      setData(res.data);
      setTotal(res.total);
    } catch {
      message.error('載入列表失敗');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status, keyword, range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    try {
      await deleteApplication(id);
      message.success('已刪除');
      fetchData();
    } catch {
      message.error('刪除失敗');
    }
  };

  const columns: ColumnsType<ForumPushApplication> = [
    {
      title: '申請時間',
      dataIndex: 'createdAt',
      width: 170,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    { title: '遊戲帳號', dataIndex: 'gameAccount', width: 140 },
    { title: '角色', dataIndex: 'gameCharacter', width: 120 },
    { title: 'FB 名稱', dataIndex: 'fbName', width: 160 },
    {
      title: 'FB 連結',
      dataIndex: 'fbLink',
      ellipsis: true,
      render: (v: string) => (
        <a href={v} target="_blank" rel="noopener noreferrer">
          {v}
        </a>
      ),
    },
    {
      title: '通過',
      dataIndex: 'passedCount',
      width: 80,
      align: 'center',
      render: (v: number, r) => (r.status === 'reviewed' ? v : '—'),
    },
    {
      title: '審核狀態',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => statusTag(v),
    },
    {
      title: '獎勵狀態',
      dataIndex: 'rewardStatus',
      width: 110,
      render: (v: string) => rewardTag(v),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Link href={`/module/forum-push/${r.id}`}>
            <Button type="primary" size="small" icon={<EyeOutlined />}>
              審核
            </Button>
          </Link>
          <Popconfirm
            title="確定要刪除這筆申請？"
            onConfirm={() => handleDelete(r.id)}
          >
            <Button danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          每日推廣審核
        </Title>
        <Space>
          <Link href="/module/forum-push/reward-config">
            <Button>獎勵道具設定</Button>
          </Link>
          <Link href="/module/forum-push/settings">
            <Button>審核設定</Button>
          </Link>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
            style={{ width: 140 }}
          />
          <RangePicker
            value={range ?? undefined}
            onChange={(v) => {
              setRange(v as [dayjs.Dayjs | null, dayjs.Dayjs | null]);
              setPage(1);
            }}
          />
          <Input.Search
            placeholder="搜尋遊戲帳號 / 角色 / FB 名稱"
            allowClear
            onSearch={(v) => {
              setKeyword(v);
              setPage(1);
            }}
            style={{ width: 280 }}
          />
        </Space>
      </Card>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 'max-content' }}
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
