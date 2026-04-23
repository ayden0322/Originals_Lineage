'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Space,
  message,
  Typography,
  Select,
  DatePicker,
  Card,
  Drawer,
  Statistic,
  Row,
  Col,
  Tooltip,
} from 'antd';
import {
  LockOutlined,
  HistoryOutlined,
  SearchOutlined,
  ReloadOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import {
  getMembers,
  getMemberOrders,
  getMemberClans,
  adminResetSecondPassword,
  getSecondPasswordLogs,
  type MemberClanOption,
} from '@/lib/api/members';
import type {
  WebsiteUser,
  SecondPasswordLog,
  MemberOrder,
  MemberOrderList,
} from '@/lib/types';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const orderStatusLabel: Record<
  MemberOrder['status'],
  { text: string; color: string }
> = {
  pending: { text: '待付款', color: 'default' },
  paid: { text: '已付款', color: 'green' },
  delivering: { text: '發貨中', color: 'blue' },
  completed: { text: '已完成', color: 'cyan' },
  failed: { text: '失敗', color: 'red' },
  refunded: { text: '已退款', color: 'orange' },
};

export default function MembersPage() {
  const [data, setData] = useState<WebsiteUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  // Filters
  const [keyword, setKeyword] = useState('');
  const [isActive, setIsActive] = useState<boolean | undefined>();
  const [registeredRange, setRegisteredRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);
  const [clanName, setClanName] = useState<string | undefined>();
  const [clanOptions, setClanOptions] = useState<MemberClanOption[]>([]);

  // Reset second password modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<WebsiteUser | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetForm] = Form.useForm();

  // Logs modal
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [logsTarget, setLogsTarget] = useState<WebsiteUser | null>(null);
  const [logs, setLogs] = useState<SecondPasswordLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Orders drawer
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [ordersTarget, setOrdersTarget] = useState<WebsiteUser | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersData, setOrdersData] = useState<MemberOrderList | null>(null);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersRange, setOrdersRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMembers({
        page,
        limit: pageSize,
        keyword: keyword.trim() || undefined,
        isActive,
        registeredFrom: registeredRange?.[0]?.toISOString(),
        registeredTo: registeredRange?.[1]?.toISOString(),
        clanName,
      });
      setData(res.items);
      setTotal(res.total);
    } catch {
      message.error('載入會員列表失敗');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, isActive, registeredRange, clanName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 血盟下拉選項：頁面載入時打一次，後續血盟新增也會即時反映
  useEffect(() => {
    getMemberClans()
      .then(setClanOptions)
      .catch(() => {
        /* 遊戲庫離線時 silent fail，下拉就空著 */
      });
  }, []);

  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  const handleResetFilters = () => {
    setKeyword('');
    setIsActive(undefined);
    setRegisteredRange(null);
    setClanName(undefined);
    setPage(1);
  };

  // ─── Reset Second Password ─────────────────────────────────
  const openResetModal = (user: WebsiteUser) => {
    setResetTarget(user);
    resetForm.resetFields();
    setResetModalOpen(true);
  };

  const handleReset = async (values: { newSecondPassword: string }) => {
    if (!resetTarget) return;
    setResetLoading(true);
    try {
      await adminResetSecondPassword(resetTarget.id, values.newSecondPassword);
      message.success(`已重設 ${resetTarget.gameAccountName} 的第二組密碼`);
      setResetModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      message.error(error?.response?.data?.message || '重設失敗');
    } finally {
      setResetLoading(false);
    }
  };

  // ─── View Logs ─────────────────────────────────────────────
  const openLogsModal = async (user: WebsiteUser) => {
    setLogsTarget(user);
    setLogsModalOpen(true);
    setLogsLoading(true);
    try {
      const result = await getSecondPasswordLogs(user.id);
      setLogs(result);
    } catch {
      message.error('載入變更紀錄失敗');
    } finally {
      setLogsLoading(false);
    }
  };

  // ─── Orders Drawer ─────────────────────────────────────────
  const fetchOrders = useCallback(
    async (user: WebsiteUser, p: number, range: [Dayjs | null, Dayjs | null] | null) => {
      setOrdersLoading(true);
      try {
        const res = await getMemberOrders(user.id, {
          page: p,
          limit: 10,
          from: range?.[0]?.toISOString(),
          to: range?.[1]?.toISOString(),
        });
        setOrdersData(res);
      } catch {
        message.error('載入儲值紀錄失敗');
      } finally {
        setOrdersLoading(false);
      }
    },
    [],
  );

  const openOrdersDrawer = async (user: WebsiteUser) => {
    setOrdersTarget(user);
    setOrdersOpen(true);
    setOrdersPage(1);
    setOrdersRange(null);
    setOrdersData(null);
    await fetchOrders(user, 1, null);
  };

  const handleOrdersRangeChange = (
    r: [Dayjs | null, Dayjs | null] | null,
  ) => {
    setOrdersRange(r);
    setOrdersPage(1);
    if (ordersTarget) fetchOrders(ordersTarget, 1, r);
  };

  const handleOrdersPageChange = (p: number) => {
    setOrdersPage(p);
    if (ordersTarget) fetchOrders(ordersTarget, p, ordersRange);
  };

  const logColumns: ColumnsType<SecondPasswordLog> = [
    {
      title: '時間',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 140,
      render: (val: string) => {
        if (val === 'change-second-password') return <Tag color="blue">玩家自行修改</Tag>;
        if (val === 'admin-reset-second-password') return <Tag color="orange">管理員重設</Tag>;
        return <Tag>{val}</Tag>;
      },
    },
    {
      title: '舊密碼',
      key: 'oldPassword',
      width: 120,
      render: (_, record) => {
        const old = (record.details as Record<string, string>)?.oldSecondPassword;
        return old || '-';
      },
    },
    {
      title: '新密碼',
      key: 'newPassword',
      width: 120,
      render: (_, record) => {
        const newPw = (record.details as Record<string, string>)?.newSecondPassword;
        return newPw || '-';
      },
    },
  ];

  const orderColumns: ColumnsType<MemberOrder> = [
    {
      title: '訂單編號',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      width: 180,
      render: (val: string) => <Text code>{val}</Text>,
    },
    {
      title: '商品',
      key: 'items',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          {record.items.map((i, idx) => (
            <span key={idx} style={{ fontSize: 12 }}>
              {i.productName} × {i.quantity}
              {i.diamondAmount > 0 && (
                <Text type="secondary" style={{ marginLeft: 4 }}>
                  （{i.diamondAmount * i.quantity} 鑽）
                </Text>
              )}
            </span>
          ))}
        </Space>
      ),
    },
    {
      title: '金額',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 100,
      align: 'right',
      render: (val: number) => <strong>NT$ {val.toFixed(0)}</strong>,
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (val: MemberOrder['status']) => {
        const cfg = orderStatusLabel[val];
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '下單時間',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm'),
    },
  ];

  const columns: ColumnsType<WebsiteUser> = [
    {
      title: '遊戲帳號',
      dataIndex: 'gameAccountName',
      key: 'gameAccountName',
      width: 160,
    },
    {
      title: '角色名稱',
      dataIndex: 'charName',
      key: 'charName',
      width: 130,
      render: (val: string | null | undefined) =>
        val ? (
          <Tag color="blue" style={{ margin: 0 }}>
            {val}
          </Tag>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            未建角
          </Text>
        ),
    },
    {
      title: '血盟',
      dataIndex: 'clanName',
      key: 'clanName',
      width: 130,
      render: (val: string | null | undefined, record) => {
        if (!record.charName) return <Text type="secondary">-</Text>;
        return val ? (
          <Tag color="purple" style={{ margin: 0 }}>
            {val}
          </Tag>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            無血盟
          </Text>
        );
      },
    },
    {
      title: '官網密碼',
      dataIndex: 'passwordPlain',
      key: 'passwordPlain',
      width: 120,
      render: (val: string | null | undefined) =>
        val ? (
          <Text code copyable={{ text: val }}>
            {val}
          </Text>
        ) : (
          <Tooltip title="無法取得（遊戲庫未連線、密碼為雜湊或加密金鑰未設定）">
            <Text type="secondary">-</Text>
          </Tooltip>
        ),
    },
    {
      title: '第二組密碼',
      dataIndex: 'secondPasswordPlain',
      key: 'secondPasswordPlain',
      width: 120,
      render: (val: string | null) =>
        val ? <Text code>{val}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: '帳號狀態',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 90,
      render: (val: boolean) => (
        <Tag color={val ? 'green' : 'red'}>{val ? '啟用' : '停用'}</Tag>
      ),
    },
    {
      title: '最後登入',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      width: 140,
      render: (val: string | null) =>
        val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '註冊時間',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small" wrap>
          <Tooltip title="儲值紀錄">
            <Button
              size="small"
              icon={<DollarOutlined />}
              onClick={() => openOrdersDrawer(record)}
            >
              儲值
            </Button>
          </Tooltip>
          <Button
            size="small"
            icon={<LockOutlined />}
            onClick={() => openResetModal(record)}
          >
            重設二密
          </Button>
          <Button
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => openLogsModal(record)}
          >
            紀錄
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2>會員管理</h2>

      {/* 篩選列 */}
      <Card size="small" style={{ marginTop: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜尋：帳號 / Email / 角色"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            placeholder="血盟"
            style={{ width: 200 }}
            allowClear
            showSearch
            optionFilterProp="label"
            value={clanName}
            onChange={(v) => {
              setClanName(v);
              setPage(1);
            }}
            options={clanOptions.map((c) => ({
              label: `${c.clanName}（${c.memberCount}）`,
              value: c.clanName,
            }))}
            notFoundContent="尚無血盟資料"
          />
          <Select
            placeholder="帳號狀態"
            style={{ width: 120 }}
            allowClear
            value={isActive}
            onChange={(v) => {
              setIsActive(v);
              setPage(1);
            }}
            options={[
              { label: '啟用', value: true },
              { label: '停用', value: false },
            ]}
          />
          <RangePicker
            placeholder={['註冊起始', '註冊結束']}
            value={registeredRange}
            onChange={(r) => {
              setRegisteredRange(r as [Dayjs | null, Dayjs | null] | null);
              setPage(1);
            }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            查詢
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleResetFilters}>
            重設
          </Button>
        </Space>
      </Card>

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
        scroll={{ x: 1200 }}
      />

      {/* Reset Second Password Modal */}
      <Modal
        title={`重設第二組密碼 — ${resetTarget?.gameAccountName || ''}`}
        open={resetModalOpen}
        onCancel={() => setResetModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={resetForm} layout="vertical" onFinish={handleReset}>
          <Form.Item
            name="newSecondPassword"
            label="新的第二組密碼"
            rules={[
              { required: true, message: '請輸入新的第二組密碼' },
              { min: 6, message: '密碼至少 6 位' },
              { max: 50, message: '密碼最多 50 個字元' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="輸入新的第二組密碼"
              size="large"
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setResetModalOpen(false)}>取消</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={resetLoading}
              >
                確認重設
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Second Password Logs Modal */}
      <Modal
        title={`第二組密碼變更紀錄 — ${logsTarget?.gameAccountName || ''}`}
        open={logsModalOpen}
        onCancel={() => setLogsModalOpen(false)}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Table
          rowKey="id"
          columns={logColumns}
          dataSource={logs}
          loading={logsLoading}
          pagination={false}
          scroll={{ x: 550 }}
          locale={{ emptyText: '尚無變更紀錄' }}
        />
      </Modal>

      {/* Orders Drawer */}
      <Drawer
        title={`儲值紀錄 — ${ordersTarget?.gameAccountName || ''}`}
        open={ordersOpen}
        onClose={() => setOrdersOpen(false)}
        width={900}
        destroyOnClose
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <RangePicker
            placeholder={['下單起始', '下單結束']}
            value={ordersRange}
            onChange={handleOrdersRangeChange}
          />
        </Space>

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Card size="small">
              <Statistic
                title="已付款總額"
                value={ordersData?.summary.totalPaid ?? 0}
                precision={0}
                prefix="NT$"
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small">
              <Statistic
                title="已付款筆數"
                value={ordersData?.summary.paidCount ?? 0}
                suffix="筆"
              />
            </Card>
          </Col>
        </Row>

        <Table
          rowKey="id"
          columns={orderColumns}
          dataSource={ordersData?.items ?? []}
          loading={ordersLoading}
          pagination={{
            current: ordersPage,
            pageSize: 10,
            total: ordersData?.total ?? 0,
            showSizeChanger: false,
            showTotal: (t) => `共 ${t} 筆`,
            onChange: handleOrdersPageChange,
          }}
          scroll={{ x: 820 }}
          locale={{ emptyText: '尚無儲值紀錄' }}
        />
      </Drawer>
    </div>
  );
}
