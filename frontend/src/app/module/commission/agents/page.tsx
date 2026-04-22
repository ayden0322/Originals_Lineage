'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  message,
  Popconfirm,
  Alert,
  Typography,
  Dropdown,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  StopOutlined,
  PlayCircleOutlined,
  ArrowUpOutlined,
  SwapOutlined,
  MoreOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { ColumnsType, ExpandableConfig } from 'antd/es/table/interface';
import {
  getAgentTree,
  createAgent,
  updateAgent,
  updateAgentRate,
  suspendAgent,
  resumeAgent,
  promoteAgent,
  changeAgentParent,
  resetAgentPassword,
} from '@/lib/api/commission';
import type { CommissionAgent, CommissionAgentTreeNode } from '@/lib/types';

const { Text } = Typography;

type AnyAgent = CommissionAgentTreeNode | (CommissionAgent & { currentRate: number });

export default function CommissionAgentsPage() {
  const [tree, setTree] = useState<CommissionAgentTreeNode[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AnyAgent | null>(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [rateTarget, setRateTarget] = useState<AnyAgent | null>(null);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteStep, setPromoteStep] = useState<1 | 2>(1);
  const [promoteTarget, setPromoteTarget] = useState<{
    agent: AnyAgent;
    parentRate: number;
  } | null>(null);
  const [parentChangeOpen, setParentChangeOpen] = useState(false);
  const [parentChangeTarget, setParentChangeTarget] = useState<AnyAgent | null>(null);
  const [pwdResetOpen, setPwdResetOpen] = useState(false);
  const [pwdResetTarget, setPwdResetTarget] = useState<AnyAgent | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAgentTree();
      setTree(data);
    } catch {
      message.error('載入代理列表失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // ─── 操作 handlers ──────────────────────────

  const handleSuspend = async (agent: AnyAgent) => {
    try {
      await suspendAgent(agent.id);
      message.success(`${agent.code} 已停權`);
      fetch();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      message.error(msg || '停權失敗');
    }
  };

  const handleResume = async (agent: AnyAgent) => {
    try {
      await resumeAgent(agent.id);
      message.success(`${agent.code} 已恢復`);
      fetch();
    } catch {
      message.error('恢復失敗');
    }
  };

  const openPromote = (agent: AnyAgent) => {
    if (!agent.parentId) {
      message.warning('一級代理不需升格');
      return;
    }
    const parent = tree.find((a) => a.id === agent.parentId);
    setPromoteTarget({ agent, parentRate: parent?.currentRate ?? 0 });
    setPromoteStep(1);
    setPromoteOpen(true);
  };

  // ─── 操作按鈕 helpers ──────────────────────────

  /** 產生主要操作（比例、編輯）+ 更多下拉選單 */
  const renderActions = (row: AnyAgent) => {
    const moreItems: MenuProps['items'] = [];

    if (!row.parentId) {
      moreItems.push({
        key: 'add-sub',
        icon: <PlusOutlined />,
        label: '新增子代理',
        onClick: () => {
          setCreateParentId(row.id);
          setCreateOpen(true);
        },
      });
    }
    if (row.parentId) {
      moreItems.push(
        {
          key: 'promote',
          icon: <ArrowUpOutlined />,
          label: '升格為 A',
          onClick: () => openPromote(row),
        },
        {
          key: 'change-parent',
          icon: <SwapOutlined />,
          label: '轉組',
          onClick: () => {
            setParentChangeTarget(row);
            setParentChangeOpen(true);
          },
        },
      );
    }
    moreItems.push({
      key: 'reset-pwd',
      icon: <KeyOutlined />,
      label: '重設密碼',
      onClick: () => {
        setPwdResetTarget(row);
        setPwdResetOpen(true);
      },
    });
    moreItems.push({ type: 'divider' });
    if (row.status === 'active') {
      moreItems.push({
        key: 'suspend',
        icon: <StopOutlined />,
        label: '停權',
        danger: true,
        onClick: () => {
          Modal.confirm({
            title: `確定停權 ${row.code}？`,
            onOk: () => handleSuspend(row),
          });
        },
      });
    } else {
      moreItems.push({
        key: 'resume',
        icon: <PlayCircleOutlined />,
        label: '恢復啟用',
        onClick: () => handleResume(row),
      });
    }

    return (
      <Space size={4}>
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => {
            setRateTarget(row);
            setRateOpen(true);
          }}
        >
          比例
        </Button>
        <Button
          size="small"
          onClick={() => {
            setEditTarget(row);
            setEditOpen(true);
          }}
        >
          編輯
        </Button>
        <Dropdown menu={{ items: moreItems }} trigger={['click']}>
          <Button size="small" icon={<MoreOutlined />} />
        </Dropdown>
      </Space>
    );
  };

  // ─── 一級代理（A）表格欄位 ──────────────────────────

  const columns: ColumnsType<AnyAgent> = [
    {
      title: '代碼',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (code: string, row) => (
        <Space>
          <Tag color="purple" style={{ margin: 0 }}>A</Tag>
          <strong>{code}</strong>
          {row.parentId === null && row.code.startsWith('B') && (
            <Tag color="blue" style={{ margin: 0 }}>升格</Tag>
          )}
        </Space>
      ),
    },
    { title: '名稱', dataIndex: 'name', key: 'name', width: 120 },
    { title: '登入帳號', dataIndex: 'loginAccount', key: 'loginAccount', width: 140 },
    {
      title: '分潤比例',
      dataIndex: 'currentRate',
      key: 'currentRate',
      width: 100,
      render: (v: number) => (
        <Tag color="gold">{(Number(v) * 100).toFixed(2)}%</Tag>
      ),
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (s: string) =>
        s === 'active' ? <Tag color="green">啟用</Tag> : <Tag color="red">停權</Tag>,
    },
    {
      title: '自推',
      dataIndex: 'selfReferralAllowed',
      key: 'selfReferralAllowed',
      width: 70,
      render: (v: boolean) => (v ? <Tag color="green">允許</Tag> : <Tag>禁止</Tag>),
    },
    {
      title: '設子%',
      dataIndex: 'canSetSubRate',
      key: 'canSetSubRate',
      width: 70,
      render: (v: boolean) => v ? <Tag color="green">允許</Tag> : <Tag>禁止</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, row) => renderActions(row),
    },
  ];

  // ─── 二級代理（B）子表格欄位 ──────────────────────────

  const subColumns: ColumnsType<AnyAgent> = [
    {
      title: '代碼',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (code: string) => (
        <Space>
          <Tag style={{ margin: 0, color: '#8c8c8c', borderColor: '#d9d9d9' }}>B</Tag>
          <span>{code}</span>
        </Space>
      ),
    },
    { title: '名稱', dataIndex: 'name', key: 'name', width: 120 },
    { title: '登入帳號', dataIndex: 'loginAccount', key: 'loginAccount', width: 140 },
    {
      title: '分潤比例',
      dataIndex: 'currentRate',
      key: 'currentRate',
      width: 100,
      render: (v: number) => (
        <Tag color="gold">{(Number(v) * 100).toFixed(2)}%</Tag>
      ),
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (s: string) =>
        s === 'active' ? <Tag color="green">啟用</Tag> : <Tag color="red">停權</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, row) => renderActions(row),
    },
  ];

  const expandable: ExpandableConfig<AnyAgent> = {
    rowExpandable: (row) => 'children' in row && Array.isArray(row.children) && row.children.length > 0,
    expandedRowRender: (row) => {
      const children = ('children' in row ? row.children : []) as AnyAgent[];
      return (
        <div className="sub-agent-wrapper">
          <Table
            scroll={{ x: 'max-content' }}
            rowKey="id"
            size="small"
            pagination={false}
            columns={subColumns}
            dataSource={children}
            showHeader={false}
            style={{ background: 'transparent' }}
            rowClassName={() => 'sub-agent-row'}
          />
        </div>
      );
    },
  };

  return (
    <>
    <style>{`
      .sub-agent-wrapper {
        background: #f8f9fb;
        border-left: 3px solid #597ef7;
        border-radius: 0 8px 8px 0;
        padding: 6px 0;
        margin: -8px 0 -8px 24px;
      }
      .sub-agent-row td {
        background: transparent !important;
        color: rgba(0, 0, 0, 0.55) !important;
        font-size: 13px;
      }
      .sub-agent-row:hover td {
        background: rgba(89, 126, 247, 0.06) !important;
      }
      .sub-agent-row .ant-tag {
        opacity: 0.85;
      }
    `}</style>
    <Card
      title="代理管理"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setCreateParentId(null);
            setCreateOpen(true);
          }}
        >
          新增代理
        </Button>
      }
    >
      <Alert
        type="success"
        showIcon
        style={{ marginBottom: 12 }}
        message="代理登入網址"
        description={
          <Typography.Link
            href="https://originalslineage.zeabur.app/agent/login"
            target="_blank"
            rel="noopener noreferrer"
            copyable={{ text: 'https://originalslineage.zeabur.app/agent/login' }}
          >
            https://originalslineage.zeabur.app/agent/login
          </Typography.Link>
        }
      />
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="代理層級規則（加法模型）"
        description="一級代理（A）的比例 = A 線團隊分潤上限（例如 30% 即每筆儲值最多拿 A 線 30%）。二級代理（B）的比例 = B 直接抽成（例如 15% = 每筆儲值直抽 15%），A 實拿 = A 上限 − B 直抽。約束：B 比例不可高於 A 比例。B 由管理者新增並掛在 A 底下；若 A 開啟「可設子%」，A 也可在代理後台調整旗下 B 的比例（仍受 B ≤ A 限制）。"
      />
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={tree}
        expandable={expandable}
        pagination={false}
        scroll={{ x: 960 }}
        // 關掉 antd Table 預設把 `children` 當樹狀資料的行為，
        // 避免 B 既被自動當 tree 子節點渲染、又被 expandedRowRender 渲染一次（重複）
        childrenColumnName="__noop__"
      />

      {/* ─── 新增代理 Modal ─── */}
      <CreateAgentModal
        open={createOpen}
        parentId={createParentId}
        parentList={tree.filter((a) => a.status === 'active')}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          fetch();
        }}
      />

      {/* ─── 編輯代理 Modal ─── */}
      <EditAgentModal
        open={editOpen}
        agent={editTarget}
        onClose={() => setEditOpen(false)}
        onSuccess={() => {
          setEditOpen(false);
          fetch();
        }}
      />

      {/* ─── 調整 rate Modal ─── */}
      <RateAdjustModal
        open={rateOpen}
        agent={rateTarget}
        onClose={() => setRateOpen(false)}
        onSuccess={() => {
          setRateOpen(false);
          fetch();
        }}
      />

      {/* ─── 升格 Modal ─── */}
      <PromoteModal
        open={promoteOpen}
        step={promoteStep}
        target={promoteTarget}
        onStepChange={setPromoteStep}
        onClose={() => setPromoteOpen(false)}
        onSuccess={() => {
          setPromoteOpen(false);
          fetch();
        }}
      />

      {/* ─── 重設密碼 Modal ─── */}
      <ResetPasswordModal
        open={pwdResetOpen}
        agent={pwdResetTarget}
        onClose={() => setPwdResetOpen(false)}
        onSuccess={() => {
          setPwdResetOpen(false);
        }}
      />

      {/* ─── 轉組 Modal ─── */}
      <ChangeParentModal
        open={parentChangeOpen}
        agent={parentChangeTarget}
        candidates={tree.filter(
          (a) => a.status === 'active' && a.id !== parentChangeTarget?.parentId,
        )}
        onClose={() => setParentChangeOpen(false)}
        onSuccess={() => {
          setParentChangeOpen(false);
          fetch();
        }}
      />
    </Card>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Modals
// ═══════════════════════════════════════════════════════════════

function CreateAgentModal({
  open,
  parentId,
  parentList,
  onClose,
  onSuccess,
}: {
  open: boolean;
  parentId: string | null;
  parentList: CommissionAgentTreeNode[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  // 追蹤表單中的 parentId，用來動態切換 A/B 模式的欄位顯示
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const isSubAgent = !!(parentId || selectedParentId);

  useEffect(() => {
    if (open) {
      form.resetFields();
      setSelectedParentId(parentId);
      form.setFieldsValue({
        parentId: parentId ?? undefined,
        rate: parentId ? 0.6 : 0.3,
        selfReferralAllowed: false,
        canSetSubRate: false,
      });
    }
  }, [open, parentId, form]);

  const handleParentChange = (value: string | undefined) => {
    const newParent = value ?? null;
    setSelectedParentId(newParent);
    // 切換 A/B 時自動調整預設比例
    form.setFieldsValue({
      rate: newParent ? 0.6 : 0.3,
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const effectiveParentId = parentId ?? values.parentId ?? null;
      await createAgent({
        name: values.name,
        loginAccount: values.loginAccount,
        password: values.password,
        parentId: effectiveParentId,
        rate: Number(values.rate),
        selfReferralAllowed: effectiveParentId ? false : !!values.selfReferralAllowed,
        canSetSubRate: effectiveParentId ? false : !!values.canSetSubRate,
      });
      message.success('代理已建立（並產生預設推廣連結）');
      onSuccess();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (msg) message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const modalTitle = parentId
    ? `新增二級代理（掛在 ${parentList.find((a) => a.id === parentId)?.code ?? ''}）`
    : '新增代理';

  return (
    <Modal
      title={modalTitle}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
      okText="建立"
      cancelText="取消"
    >
      <Form form={form} layout="vertical">
        {!parentId && (
          <Form.Item
            label="上層代理"
            name="parentId"
            extra="不選 = 建立一級代理（A）；選了 = 建立二級代理（B）掛在該 A 底下"
          >
            <Select
              allowClear
              placeholder="不選 = 一級代理（A）"
              onChange={handleParentChange}
            >
              {parentList
                .filter((a) => !a.parentId)
                .map((a) => (
                  <Select.Option key={a.id} value={a.id}>
                    {a.code} - {a.name}（{(a.currentRate * 100).toFixed(0)}%）
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>
        )}
        {parentId && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={`此代理將掛在 ${parentList.find((a) => a.id === parentId)?.code ?? ''} 底下（二級代理 B）`}
          />
        )}
        <Form.Item label="名稱" name="name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="登入帳號" name="loginAccount" rules={[{ required: true }]}>
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item
          label="密碼"
          name="password"
          rules={[{ required: true, min: 6 }]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          label={isSubAgent ? '分潤比例（B 直接抽成，須 ≤ 上層 A 的比例）' : '分潤比例（A 線團隊分潤上限）'}
          name="rate"
          rules={[{ required: true }]}
          extra={isSubAgent ? '0.15 = 每筆儲值 B 直抽 15%；A 實拿 = A 上限 − B 直抽' : '0.3 = A 線團隊最多拿每筆儲值的 30%'}
        >
          <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
        </Form.Item>
        {!isSubAgent && (
          <Form.Item label="允許自推自玩" name="selfReferralAllowed" valuePropName="checked">
            <Switch />
          </Form.Item>
        )}
        {!isSubAgent && (
          <Form.Item
            label="可設定子代理比例"
            name="canSetSubRate"
            valuePropName="checked"
            extra="開啟後，此 A 可在代理後台自行調整旗下 B 的比例"
          >
            <Switch />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}

function EditAgentModal({
  open,
  agent,
  onClose,
  onSuccess,
}: {
  open: boolean;
  agent: AnyAgent | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && agent) {
      form.setFieldsValue({
        name: agent.name,
        selfReferralAllowed: agent.selfReferralAllowed,
        canSetSubRate: agent.canSetSubRate,
      });
    }
  }, [open, agent, form]);

  if (!agent) return null;

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await updateAgent(agent.id, values);
      message.success('已更新');
      onSuccess();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (msg) message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={`編輯 ${agent.code} ${agent.name}`}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="名稱" name="name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="允許自推自玩" name="selfReferralAllowed" valuePropName="checked">
          <Switch />
        </Form.Item>
        {!agent.parentId && (
          <Form.Item
            label="可設定子代理比例"
            name="canSetSubRate"
            valuePropName="checked"
            extra="關閉後該 A 在自己後台看不到調整 B 比例的 UI"
          >
            <Switch />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}

function RateAdjustModal({
  open,
  agent,
  onClose,
  onSuccess,
}: {
  open: boolean;
  agent: AnyAgent | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [rate, setRate] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && agent) setRate(Number(agent.currentRate));
  }, [open, agent]);

  if (!agent) return null;

  const handleSubmit = async () => {
    if (rate === null) return;
    try {
      setSubmitting(true);
      await updateAgentRate(agent.id, rate);
      message.success('比例已即時生效');
      onSuccess();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      message.error(msg || '更新失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={`調整比例 - ${agent.code}`}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="即時生效"
        description="變更立即套用到新交易，歷史分潤紀錄不受影響（採時段快照）。"
      />
      <Form layout="vertical">
        <Form.Item label="目前比例">
          <Tag color="gold">{(Number(agent.currentRate) * 100).toFixed(2)}%</Tag>
        </Form.Item>
        <Form.Item label="新比例" extra="A：A 線團隊分潤上限；B：B 直抽比例（必須 ≤ 上層 A 的比例）">
          <InputNumber
            min={0}
            max={1}
            step={0.05}
            value={rate}
            onChange={(v) => setRate(v as number)}
            style={{ width: '100%' }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function PromoteModal({
  open,
  step,
  target,
  onStepChange,
  onClose,
  onSuccess,
}: {
  open: boolean;
  step: 1 | 2;
  target: { agent: AnyAgent; parentRate: number } | null;
  onStepChange: (s: 1 | 2) => void;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [newRate, setNewRate] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && target) {
      // 預設帶入「等價值 rate」= parentRate × 自己的 rate
      const equivalent =
        Number(target.parentRate) * Number(target.agent.currentRate);
      setNewRate(Math.round(equivalent * 10000) / 10000);
      setReason('');
    }
  }, [open, target]);

  if (!target) return null;
  const { agent, parentRate } = target;
  const currentB = Number(agent.currentRate);
  const equivalent = parentRate * currentB;
  const exampleAmount = 100;
  const trial = newRate !== null ? exampleAmount * newRate : 0;

  const handleSubmit = async () => {
    if (newRate === null) {
      message.error('請填寫新比例');
      return;
    }
    if (!reason.trim()) {
      message.error('請填寫升格原因');
      return;
    }
    try {
      setSubmitting(true);
      await promoteAgent(agent.id, newRate, reason.trim());
      message.success(`${agent.code} 已升格為一級代理`);
      onSuccess();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      message.error(msg || '升格失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={`升格 ${agent.code} 為一級代理`}
      open={open}
      onCancel={onClose}
      footer={
        step === 1 ? (
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" onClick={() => onStepChange(2)}>
              下一步
            </Button>
          </Space>
        ) : (
          <Space>
            <Button onClick={() => onStepChange(1)}>上一步</Button>
            <Button
              type="primary"
              loading={submitting}
              onClick={handleSubmit}
            >
              確認升格
            </Button>
          </Space>
        )
      }
    >
      {step === 1 ? (
        <>
          <Alert
            type="warning"
            showIcon
            message={`即將把 ${agent.code} ${agent.name} 升格為一級代理（A）`}
            style={{ marginBottom: 16 }}
          />
          <Typography.Paragraph>
            <strong>此操作將：</strong>
            <ul style={{ marginTop: 8 }}>
              <li>移除上層代理（直接從管理者拿分潤）</li>
              <li>必須重設分潤比例（原比例為 A 切下，需重設）</li>
            </ul>
          </Typography.Paragraph>
          <Typography.Paragraph>
            <strong>保留事項：</strong>
            <ul style={{ marginTop: 8 }}>
              <li>旗下所有玩家歸屬不變</li>
              <li>歷史分潤紀錄完整保留</li>
              <li>過去結算紀錄不受影響</li>
              <li>推廣連結與 QR Code 繼續有效</li>
            </ul>
          </Typography.Paragraph>
          <Alert
            type="info"
            showIcon
            message="此操作可逆（之後可改回掛回某個 A 底下），但歷史分潤計算邏輯不會回溯重算。"
          />
        </>
      ) : (
        <>
          <Alert
            type="info"
            showIcon
            message={
              <>
                目前比例（從上層 A 切下）：<strong>{(currentB * 100).toFixed(2)}%</strong>
                <br />
                上層 A 比例：<strong>{(parentRate * 100).toFixed(2)}%</strong>
                <br />
                等價值升格比例 = {(parentRate * 100).toFixed(2)}% ×{' '}
                {(currentB * 100).toFixed(2)}% ={' '}
                <strong>{(equivalent * 100).toFixed(4)}%</strong>
              </>
            }
            style={{ marginBottom: 16 }}
          />
          <Form layout="vertical">
            <Form.Item label="新分潤比例" required>
              <Space>
                <InputNumber
                  min={0}
                  max={1}
                  step={0.01}
                  value={newRate}
                  onChange={(v) => setNewRate(v as number)}
                  style={{ width: 200 }}
                />
                <Button onClick={() => setNewRate(equivalent)}>
                  等同升格前
                </Button>
              </Space>
            </Form.Item>
            <Alert
              type="success"
              message={
                <>
                  即時試算：玩家儲值 {exampleAmount} 元 → 此代理拿{' '}
                  <strong>{trial.toFixed(2)}</strong> 元
                </>
              }
              style={{ marginBottom: 16 }}
            />
            <Form.Item label="升格原因（必填，稽核用）" required>
              <Input.TextArea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="例如：A001 離職、業績獨立經營"
              />
            </Form.Item>
          </Form>
        </>
      )}
    </Modal>
  );
}

function ChangeParentModal({
  open,
  agent,
  candidates,
  onClose,
  onSuccess,
}: {
  open: boolean;
  agent: AnyAgent | null;
  candidates: CommissionAgentTreeNode[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [newParentId, setNewParentId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setNewParentId(null);
      setReason('');
    }
  }, [open]);

  if (!agent) return null;

  const handleSubmit = async () => {
    if (!newParentId) {
      message.error('請選擇新父代理');
      return;
    }
    try {
      setSubmitting(true);
      await changeAgentParent(agent.id, newParentId, reason.trim() || undefined);
      message.success('已轉組');
      onSuccess();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      message.error(msg || '轉組失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={`轉組 ${agent.code}`}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
    >
      <Alert
        type="info"
        showIcon
        message="歷史分潤紀錄保留，僅之後的新交易算給新父代理。"
        style={{ marginBottom: 16 }}
      />
      <Form layout="vertical">
        <Form.Item label="新父代理（A）" required>
          <Select
            value={newParentId}
            onChange={setNewParentId}
            placeholder="選擇新的一級代理"
          >
            {candidates
              .filter((a) => !a.parentId)
              .map((a) => (
                <Select.Option key={a.id} value={a.id}>
                  {a.code} - {a.name}（{(a.currentRate * 100).toFixed(2)}%）
                </Select.Option>
              ))}
          </Select>
        </Form.Item>
        <Form.Item label="原因（選填）">
          <Input.TextArea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function ResetPasswordModal({
  open,
  agent,
  onClose,
  onSuccess,
}: {
  open: boolean;
  agent: AnyAgent | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  if (!agent) return null;

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await resetAgentPassword(agent.id, values.newPassword);
      message.success(`${agent.code} 密碼已重設`);
      onSuccess();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (msg) message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={`重設密碼 - ${agent.code} ${agent.name}`}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
      okText="確認重設"
      cancelText="取消"
    >
      <Alert
        type="warning"
        showIcon
        message="此操作將直接覆蓋代理的登入密碼"
        style={{ marginBottom: 16 }}
      />
      <Form form={form} layout="vertical">
        <Form.Item
          label="新密碼"
          name="newPassword"
          rules={[
            { required: true, message: '請輸入新密碼' },
            { min: 6, message: '密碼至少 6 位' },
          ]}
        >
          <Input.Password placeholder="輸入新密碼" autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          label="確認新密碼"
          name="confirmPassword"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '請再次輸入新密碼' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('兩次密碼不一致'));
              },
            }),
          ]}
        >
          <Input.Password placeholder="再次輸入新密碼" autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
