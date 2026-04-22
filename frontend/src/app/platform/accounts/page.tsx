'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Tag,
  Space,
  Popconfirm,
  message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined, LockOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import type { ColumnsType } from 'antd/es/table';
import type { Account, CreateAccountDto, UpdateAccountDto } from '@/lib/types';
import { getAccounts, createAccount, updateAccount, deleteAccount, resetAccountPassword } from '@/lib/api/accounts';

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  // Create modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm] = Form.useForm<CreateAccountDto>();

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm] = Form.useForm<UpdateAccountDto>();
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Reset password modal
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordForm] = Form.useForm<{ password: string; confirmPassword: string }>();
  const [passwordAccount, setPasswordAccount] = useState<Account | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAccounts(page, limit);
      setAccounts(result.items);
      setTotal(result.total);
    } catch {
      message.error('載入帳號列表失敗');
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // ── Create ──────────────────────────────────────────────────
  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateLoading(true);
      await createAccount(values);
      message.success('帳號建立成功');
      setCreateModalOpen(false);
      createForm.resetFields();
      fetchAccounts();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return; // validation error
      message.error('建立帳號失敗');
    } finally {
      setCreateLoading(false);
    }
  };

  // ── Edit ────────────────────────────────────────────────────
  const openEdit = (account: Account) => {
    setEditingAccount(account);
    editForm.setFieldsValue({
      displayName: account.displayName,
      isActive: account.isActive,
    });
    setEditModalOpen(true);
  };

  const handleEdit = async () => {
    if (!editingAccount) return;
    try {
      const values = await editForm.validateFields();
      setEditLoading(true);
      await updateAccount(editingAccount.id, values);
      message.success('帳號更新成功');
      setEditModalOpen(false);
      editForm.resetFields();
      setEditingAccount(null);
      fetchAccounts();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('更新帳號失敗');
    } finally {
      setEditLoading(false);
    }
  };

  // ── Reset Password ──────────────────────────────────────────
  const openResetPassword = (account: Account) => {
    setPasswordAccount(account);
    passwordForm.resetFields();
    setPasswordModalOpen(true);
  };

  const handleResetPassword = async () => {
    if (!passwordAccount) return;
    try {
      const values = await passwordForm.validateFields();
      setPasswordLoading(true);
      await resetAccountPassword(passwordAccount.id, values.password);
      message.success('密碼已更新');
      setPasswordModalOpen(false);
      passwordForm.resetFields();
      setPasswordAccount(null);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('更新密碼失敗');
    } finally {
      setPasswordLoading(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      await deleteAccount(id);
      message.success('帳號已刪除');
      fetchAccounts();
    } catch {
      message.error('刪除帳號失敗');
    }
  };

  // ── Table columns ──────────────────────────────────────────
  const columns: ColumnsType<Account> = [
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
    },
    {
      title: '暱稱',
      dataIndex: 'displayName',
      key: 'displayName',
    },
    {
      title: '層級',
      dataIndex: 'backendLevel',
      key: 'backendLevel',
      render: (level: Account['backendLevel']) =>
        level === 'platform' ? (
          <Tag color="purple">Platform</Tag>
        ) : (
          <Tag color="blue">Module</Tag>
        ),
    },
    {
      title: '狀態',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active: boolean) =>
        active ? <Tag color="green">啟用</Tag> : <Tag color="red">停用</Tag>,
    },
    {
      title: '最後登入',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      render: (val: string | null) =>
        val ? new Date(val).toLocaleString('zh-TW') : '—',
    },
    {
      title: '操作',
      key: 'actions',
      width: 300,
      render: (_: unknown, record: Account) => (
        <Space>
          <Button
            icon={<KeyOutlined />}
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/platform/accounts/${record.id}/permissions`);
            }}
          >
            權限
          </Button>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(record);
            }}
          >
            編輯
          </Button>
          <Button
            icon={<LockOutlined />}
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              openResetPassword(record);
            }}
          >
            改密碼
          </Button>
          <Popconfirm
            title="確認刪除此帳號？"
            onConfirm={(e) => {
              e?.stopPropagation();
              handleDelete(record.id);
            }}
            onCancel={(e) => e?.stopPropagation()}
            okText="確認"
            cancelText="取消"
          >
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
              onClick={(e) => e.stopPropagation()}
            >
              刪除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>帳號管理</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalOpen(true)}
        >
          新增帳號
        </Button>
      </div>

      <Table
        scroll={{ x: 'max-content' }}
        rowKey="id"
        columns={columns}
        dataSource={accounts}
        loading={loading}
        pagination={{
          current: page,
          pageSize: limit,
          total,
          onChange: (p) => setPage(p),
          showTotal: (t) => `共 ${t} 筆`,
        }}
        onRow={(record) => ({
          onClick: () => router.push(`/platform/accounts/${record.id}/permissions`),
          style: { cursor: 'pointer' },
        })}
      />

      {/* ── Create Modal ────────────────────────────────────── */}
      <Modal
        title="新增帳號"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        confirmLoading={createLoading}
        okText="建立"
        cancelText="取消"
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: '請輸入 Email' },
              { type: 'email', message: '請輸入有效的 Email' },
            ]}
          >
            <Input placeholder="admin@example.com" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密碼"
            rules={[
              { required: true, message: '請輸入密碼' },
              { min: 6, message: '密碼至少 6 個字元' },
            ]}
          >
            <Input.Password placeholder="至少 6 個字元" />
          </Form.Item>
          <Form.Item
            name="displayName"
            label="暱稱"
            rules={[{ required: true, message: '請輸入暱稱' }]}
          >
            <Input placeholder="管理者名稱" />
          </Form.Item>
          <Form.Item
            name="backendLevel"
            label="層級"
            rules={[{ required: true, message: '請選擇層級' }]}
          >
            <Select placeholder="選擇層級">
              <Select.Option value="platform">Platform</Select.Option>
              <Select.Option value="module">Module</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Edit Modal ──────────────────────────────────────── */}
      <Modal
        title="編輯帳號"
        open={editModalOpen}
        onOk={handleEdit}
        onCancel={() => {
          setEditModalOpen(false);
          editForm.resetFields();
          setEditingAccount(null);
        }}
        confirmLoading={editLoading}
        okText="儲存"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="displayName"
            label="暱稱"
            rules={[{ required: true, message: '請輸入暱稱' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="isActive" label="帳號狀態" valuePropName="checked">
            <Switch checkedChildren="啟用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Reset Password Modal ────────────────────────────── */}
      <Modal
        title={passwordAccount ? `重設密碼 — ${passwordAccount.email}` : '重設密碼'}
        open={passwordModalOpen}
        onOk={handleResetPassword}
        onCancel={() => {
          setPasswordModalOpen(false);
          passwordForm.resetFields();
          setPasswordAccount(null);
        }}
        confirmLoading={passwordLoading}
        okText="更新密碼"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            name="password"
            label="新密碼"
            rules={[
              { required: true, message: '請輸入新密碼' },
              { min: 6, message: '密碼至少 6 個字元' },
            ]}
          >
            <Input.Password placeholder="至少 6 個字元" autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="確認新密碼"
            dependencies={['password']}
            rules={[
              { required: true, message: '請再次輸入新密碼' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve();
                  return Promise.reject(new Error('兩次輸入的密碼不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="再次輸入新密碼" autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
