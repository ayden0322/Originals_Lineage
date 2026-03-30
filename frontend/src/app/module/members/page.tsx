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
} from 'antd';
import { LockOutlined, HistoryOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  getMembers,
  adminResetSecondPassword,
  getSecondPasswordLogs,
} from '@/lib/api/members';
import type { WebsiteUser, SecondPasswordLog } from '@/lib/types';

const { Text } = Typography;

export default function MembersPage() {
  const [data, setData] = useState<WebsiteUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMembers(page, pageSize);
      setData(res.items);
      setTotal(res.total);
    } catch {
      message.error('載入會員列表失敗');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      fetchData(); // refresh table
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

  const columns: ColumnsType<WebsiteUser> = [
    {
      title: '遊戲帳號',
      dataIndex: 'gameAccountName',
      key: 'gameAccountName',
      width: 180,
    },
    {
      title: '第二組密碼',
      dataIndex: 'secondPasswordPlain',
      key: 'secondPasswordPlain',
      width: 140,
      render: (val: string | null) =>
        val ? <Text code>{val}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: '帳號狀態',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (val: boolean) => (
        <Tag color={val ? 'green' : 'red'}>{val ? '啟用' : '停用'}</Tag>
      ),
    },
    {
      title: '最後登入',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      width: 160,
      render: (val: string | null) =>
        val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '註冊時間',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="small">
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
        scroll={{ x: 900 }}
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
    </div>
  );
}
