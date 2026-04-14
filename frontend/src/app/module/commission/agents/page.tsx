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
  Tooltip,
  Popconfirm,
  Alert,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  StopOutlined,
  PlayCircleOutlined,
  ArrowUpOutlined,
  SwapOutlined,
  LinkOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
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

  // ─── 表格欄位 ──────────────────────────

  const columns: ColumnsType<AnyAgent> = [
    {
      title: '代碼',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (code: string, row) => (
        <Space>
          <strong>{code}</strong>
          {row.parentId === null && row.code.startsWith('B') && (
            <Tag color="blue">升格</Tag>
          )}
        </Space>
      ),
    },
    { title: '名稱', dataIndex: 'name', key: 'name' },
    { title: '登入帳號', dataIndex: 'loginAccount', key: 'loginAccount' },
    {
      title: '分潤比例',
      dataIndex: 'currentRate',
      key: 'currentRate',
      width: 110,
      render: (v: number) => (
        <Tag color="gold">{(Number(v) * 100).toFixed(2)}%</Tag>
      ),
    },
    {
      title: '層級',
      key: 'level',
      width: 80,
      render: (_, row) => (row.parentId ? <Tag>B</Tag> : <Tag color="purple">A</Tag>),
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s: string) =>
        s === 'active' ? <Tag color="green">啟用</Tag> : <Tag color="red">停權</Tag>,
    },
    {
      title: '自推開關',
      dataIndex: 'selfReferralAllowed',
      key: 'selfReferralAllowed',
      width: 100,
      render: (v: boolean) => (v ? <Tag color="green">允許</Tag> : <Tag>禁止</Tag>),
    },
    {
      title: '可設子%',
      dataIndex: 'canSetSubRate',
      key: 'canSetSubRate',
      width: 100,
      render: (v: boolean, row) =>
        row.parentId ? (
          <Text type="secondary">-</Text>
        ) : v ? (
          <Tag color="green">允許</Tag>
        ) : (
          <Tag>禁止</Tag>
        ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 380,
      fixed: 'right',
      render: (_, row) => (
        <Space size="small" wrap>
          <Tooltip title="調整比例">
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
          </Tooltip>
          <Button
            size="small"
            onClick={() => {
              setEditTarget(row);
              setEditOpen(true);
            }}
          >
            編輯
          </Button>
          {!row.parentId && (
            <Button
              size="small"
              icon={<PlusOutlined />}
              type="dashed"
              onClick={() => {
                setCreateParentId(row.id);
                setCreateOpen(true);
              }}
            >
              新增子代理
            </Button>
          )}
          {row.parentId && (
            <>
              <Button
                size="small"
                icon={<ArrowUpOutlined />}
                onClick={() => openPromote(row)}
              >
                升格
              </Button>
              <Button
                size="small"
                icon={<SwapOutlined />}
                onClick={() => {
                  setParentChangeTarget(row);
                  setParentChangeOpen(true);
                }}
              >
                轉組
              </Button>
            </>
          )}
          {row.status === 'active' ? (
            <Popconfirm
              title={`確定停權 ${row.code}？`}
              onConfirm={() => handleSuspend(row)}
            >
              <Button size="small" danger icon={<StopOutlined />}>
                停權
              </Button>
            </Popconfirm>
          ) : (
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleResume(row)}
            >
              恢復
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const expandable: ExpandableConfig<AnyAgent> = {
    rowExpandable: (row) => 'children' in row && Array.isArray(row.children) && row.children.length > 0,
    expandedRowRender: (row) => {
      const children = ('children' in row ? row.children : []) as AnyAgent[];
      return (
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          columns={columns}
          dataSource={children}
          showHeader={false}
        />
      );
    },
  };

  return (
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
          新增一級代理
        </Button>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="代理層級規則"
        description="一級代理（A）由管理者新增；二級代理（B）也由管理者新增並掛在某個 A 底下。B 的分潤比例可由 A 自設（需開啟「可設子%」開關）或由管理者設定。"
      />
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={tree}
        expandable={expandable}
        pagination={false}
        scroll={{ x: 1200 }}
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

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({
        parentId: parentId ?? null,
        rate: 0.3,
        selfReferralAllowed: false,
        canSetSubRate: false,
      });
    }
  }, [open, parentId, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await createAgent({
        name: values.name,
        loginAccount: values.loginAccount,
        password: values.password,
        parentId: values.parentId || null,
        rate: Number(values.rate),
        selfReferralAllowed: !!values.selfReferralAllowed,
        canSetSubRate: !!values.canSetSubRate,
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

  return (
    <Modal
      title={parentId ? '新增二級代理（B）' : '新增一級代理（A）'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
      okText="建立"
      cancelText="取消"
    >
      <Form form={form} layout="vertical">
        {!parentId && (
          <Form.Item label="父代理（選填，建立 B 時用）" name="parentId">
            <Select allowClear placeholder="不選 = 一級代理 A">
              {parentList
                .filter((a) => !a.parentId)
                .map((a) => (
                  <Select.Option key={a.id} value={a.id}>
                    {a.code} - {a.name}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>
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
          label="分潤比例"
          name="rate"
          rules={[{ required: true }]}
          extra="0.3 = 30%"
        >
          <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="允許自推自玩" name="selfReferralAllowed" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item
          label="可設定子代理比例（A 限定）"
          name="canSetSubRate"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
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
        <Form.Item label="新比例" extra="0~1 之間（0.3 = 30%）">
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
