'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Card,
  Input,
  Button,
  Space,
  Descriptions,
  Tag,
  Modal,
  Select,
  Form,
  message,
  Empty,
  Alert,
  Tabs,
  Table,
  DatePicker,
  Switch,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SearchOutlined,
  SwapOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import {
  getPlayerAttribution,
  changePlayerAttribution,
  getAgentTree,
  listPlayerAttributions,
} from '@/lib/api/commission';
import type {
  CommissionPlayerAttribution,
  CommissionAgentTreeNode,
  CommissionAttributionListItem,
} from '@/lib/types';

const { RangePicker } = DatePicker;

const sourceLabel: Record<string, { text: string; color: string }> = {
  cookie: { text: 'Cookie 綁定', color: 'blue' },
  register: { text: '註冊時帶入', color: 'green' },
  manual: { text: '管理者手動', color: 'orange' },
  system: { text: '無歸屬', color: 'default' },
};

// ─── 列表 Tab ───────────────────────────────────────────────

function AttributionListTab({
  agents,
  onJumpToSingle,
}: {
  agents: CommissionAgentTreeNode[];
  onJumpToSingle: (playerId: string) => void;
}) {
  const [list, setList] = useState<CommissionAttributionListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterAgent, setFilterAgent] = useState<string | undefined>();
  const [filterSource, setFilterSource] = useState<
    'cookie' | 'register' | 'manual' | 'system' | undefined
  >();
  const [q, setQ] = useState('');
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [includeSystem, setIncludeSystem] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const flatAgents = agents.flatMap((a) => [
    a,
    ...((a.children as CommissionAgentTreeNode[]) ?? []),
  ]);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPlayerAttributions({
        agentId: filterAgent,
        q: q.trim() || undefined,
        from: range?.[0]?.toISOString(),
        to: range?.[1]?.toISOString(),
        linkedSource: filterSource,
        includeSystem,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setList(data);
    } catch {
      message.error('載入失敗');
    } finally {
      setLoading(false);
    }
  }, [filterAgent, filterSource, q, range, includeSystem, page, pageSize]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const columns: ColumnsType<CommissionAttributionListItem> = [
    {
      title: '玩家帳號',
      dataIndex: 'gameAccountName',
      width: 160,
      fixed: 'left',
      render: (v: string | null, row) => (
        <Space direction="vertical" size={0}>
          <strong>{v ?? '(無帳號)'}</strong>
          <Tooltip title={row.playerId}>
            <code style={{ fontSize: 11, color: '#999' }}>
              {row.playerId.slice(0, 8)}…
            </code>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '歸屬代理',
      width: 200,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Space size={4}>
            <strong>{row.agentCode}</strong>
            {row.agentIsSystem && <Tag color="orange">SYSTEM</Tag>}
            <Tag color={row.agentLevel === 1 ? 'gold' : 'cyan'}>
              {row.agentLevel === 1 ? 'A' : 'B'}
            </Tag>
          </Space>
          <span style={{ fontSize: 12, color: '#666' }}>{row.agentName}</span>
        </Space>
      ),
    },
    {
      title: '歸屬方式',
      dataIndex: 'linkedSource',
      width: 110,
      render: (v: string) => {
        const cfg = sourceLabel[v] ?? { text: v, color: 'default' };
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '歸屬時間',
      dataIndex: 'linkedAt',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: (
        <Tooltip title="已扣除退款沖銷後的淨額">
          <span>累積儲值（淨）</span>
        </Tooltip>
      ),
      key: 'netRecharge',
      width: 130,
      align: 'right',
      render: (_: unknown, row) => {
        const hasRefund = row.refundedBaseAmount > 0;
        const content = <span>{Number(row.netRecharge).toFixed(2)}</span>;
        if (!hasRefund) return content;
        return (
          <Tooltip
            title={
              <div style={{ lineHeight: 1.8 }}>
                <div>原始累積：{Number(row.totalRecharge).toFixed(2)}</div>
                <div style={{ color: '#ffa39e' }}>
                  已退款：-{Number(row.refundedBaseAmount).toFixed(2)}
                </div>
                <div style={{ borderTop: '1px solid #555', marginTop: 4, paddingTop: 4 }}>
                  淨額：{Number(row.netRecharge).toFixed(2)}
                </div>
              </div>
            }
          >
            <span style={{ borderBottom: '1px dashed #999', cursor: 'help' }}>
              {Number(row.netRecharge).toFixed(2)}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: (
        <Tooltip title="已扣除退款沖銷後的淨額">
          <span>累積分潤（淨）</span>
        </Tooltip>
      ),
      key: 'netCommission',
      width: 130,
      align: 'right',
      render: (_: unknown, row) => {
        const hasRefund = row.refundedCommission > 0;
        const net = Number(row.netCommission);
        const core =
          net > 0 ? (
            <strong style={{ color: '#cf1322' }}>{net.toFixed(2)}</strong>
          ) : (
            <span style={{ color: '#999' }}>{net.toFixed(2)}</span>
          );
        if (!hasRefund) return core;
        return (
          <Tooltip
            title={
              <div style={{ lineHeight: 1.8 }}>
                <div>原始分潤：{Number(row.totalCommission).toFixed(2)}</div>
                <div style={{ color: '#ffa39e' }}>
                  已退款：-{Number(row.refundedCommission).toFixed(2)}
                </div>
                <div style={{ borderTop: '1px solid #555', marginTop: 4, paddingTop: 4 }}>
                  淨額：{net.toFixed(2)}
                </div>
              </div>
            }
          >
            <span style={{ borderBottom: '1px dashed #999', cursor: 'help' }}>{core}</span>
          </Tooltip>
        );
      },
    },
    {
      title: '交易數',
      key: 'transactionCount',
      width: 100,
      align: 'right',
      render: (_: unknown, row) => {
        if (!row.refundedTxCount)
          return <span>{row.transactionCount}</span>;
        return (
          <Tooltip
            title={`原始 ${row.transactionCount} 筆，其中 ${row.refundedTxCount} 筆已退款`}
          >
            <span style={{ borderBottom: '1px dashed #999', cursor: 'help' }}>
              {row.transactionCount}
              <span style={{ color: '#cf1322', marginLeft: 4, fontSize: 12 }}>
                (-{row.refundedTxCount})
              </span>
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: '最後消費',
      dataIndex: 'lastPaidAt',
      width: 160,
      render: (v: string | null) =>
        v ? dayjs(v).format('YYYY-MM-DD HH:mm') : <span style={{ color: '#999' }}>未消費</span>,
    },
    {
      title: '操作',
      width: 100,
      fixed: 'right',
      render: (_, row) => (
        <Button size="small" onClick={() => onJumpToSingle(row.playerId)}>
          調整歸屬
        </Button>
      ),
    },
  ];

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="所有玩家歸屬總覽。預設包含 SYSTEM（無歸屬）玩家；可關閉下方開關以僅看有歸屬者。"
      />
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜尋：玩家帳號 / email / playerId"
          prefix={<SearchOutlined />}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onPressEnter={() => {
            setPage(1);
            fetch();
          }}
          style={{ width: 280 }}
          allowClear
        />
        <Select
          placeholder="篩選代理"
          style={{ width: 220 }}
          allowClear
          value={filterAgent}
          onChange={(v) => {
            setFilterAgent(v);
            setPage(1);
          }}
          showSearch
          optionFilterProp="label"
          options={flatAgents.map((a) => ({
            label: `${a.code} - ${a.name}（${a.parentId ? 'B' : 'A'}）${a.isSystem ? ' [SYSTEM]' : ''}`,
            value: a.id,
          }))}
        />
        <Select
          placeholder="歸屬方式"
          style={{ width: 140 }}
          allowClear
          value={filterSource}
          onChange={(v) => {
            setFilterSource(v);
            setPage(1);
          }}
          options={[
            { label: 'Cookie 綁定', value: 'cookie' },
            { label: '註冊時帶入', value: 'register' },
            { label: '管理者手動', value: 'manual' },
            { label: '無歸屬', value: 'system' },
          ]}
        />
        <RangePicker
          showTime
          placeholder={['歸屬起始', '歸屬結束']}
          onChange={(r) => {
            setRange(r as [Dayjs | null, Dayjs | null] | null);
            setPage(1);
          }}
        />
        <Space size={4}>
          <span style={{ fontSize: 13 }}>含 SYSTEM</span>
          <Switch
            size="small"
            checked={includeSystem}
            onChange={(v) => {
              setIncludeSystem(v);
              setPage(1);
            }}
          />
        </Space>
        <Button icon={<ReloadOutlined />} onClick={fetch}>
          重新整理
        </Button>
      </Space>
      <Table
        rowKey="playerId"
        scroll={{ x: 1400 }}
        loading={loading}
        columns={columns}
        dataSource={list}
        pagination={{
          current: page,
          pageSize,
          onChange: setPage,
          total:
            list.length === pageSize
              ? page * pageSize + 1
              : (page - 1) * pageSize + list.length,
          showSizeChanger: false,
        }}
      />
    </>
  );
}

// ─── 單筆查詢 / 調整 Tab ───────────────────────────────────────

function SingleQueryTab({
  agents,
  initialPlayerId,
}: {
  agents: CommissionAgentTreeNode[];
  initialPlayerId?: string;
}) {
  const [playerId, setPlayerId] = useState(initialPlayerId ?? '');
  const [searching, setSearching] = useState(false);
  const [data, setData] = useState<CommissionPlayerAttribution | null>(null);

  const [changeOpen, setChangeOpen] = useState(false);
  const [newAgentId, setNewAgentId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const flatAgents = agents.flatMap((a) => [
    a,
    ...((a.children as CommissionAgentTreeNode[]) ?? []),
  ]);
  const currentAgent = flatAgents.find((a) => a.id === data?.agentId);

  const handleSearch = useCallback(async (id?: string) => {
    const target = (id ?? playerId).trim();
    if (!target) return;
    setSearching(true);
    try {
      const attr = await getPlayerAttribution(target);
      setData(attr);
    } catch {
      message.error('查無玩家或載入失敗');
      setData(null);
    } finally {
      setSearching(false);
    }
  }, [playerId]);

  // 由列表 Tab 跳轉過來時自動查
  useEffect(() => {
    if (initialPlayerId) {
      setPlayerId(initialPlayerId);
      handleSearch(initialPlayerId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPlayerId]);

  const handleChange = async () => {
    if (!data || !newAgentId) return;
    try {
      setSubmitting(true);
      await changePlayerAttribution(
        data.playerId,
        newAgentId,
        reason.trim() || undefined,
      );
      message.success('歸屬已調整（歷史分潤不動）');
      setChangeOpen(false);
      setReason('');
      setNewAgentId(null);
      handleSearch();
    } catch {
      message.error('調整失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Alert
        type="info"
        showIcon
        message="輸入玩家 ID（website_users.id UUID）查詢歸屬，可手動調整。歷史分潤紀錄不會回溯重算，僅影響之後的新交易。"
        style={{ marginBottom: 16 }}
      />
      <Space.Compact style={{ width: '100%', maxWidth: 600, marginBottom: 24 }}>
        <Input
          placeholder="玩家 ID（UUID）"
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          onPressEnter={() => handleSearch()}
        />
        <Button
          type="primary"
          icon={<SearchOutlined />}
          loading={searching}
          onClick={() => handleSearch()}
        >
          查詢
        </Button>
      </Space.Compact>

      {data ? (
        <Descriptions bordered column={1}>
          <Descriptions.Item label="玩家 ID">{data.playerId}</Descriptions.Item>
          <Descriptions.Item label="當前歸屬代理">
            {currentAgent ? (
              <Space>
                <strong>{currentAgent.code}</strong> - {currentAgent.name}
                {currentAgent.isSystem && <Tag color="orange">SYSTEM 虛擬代理</Tag>}
              </Space>
            ) : (
              data.agentId
            )}
          </Descriptions.Item>
          <Descriptions.Item label="歸屬來源">
            <Tag>{sourceLabel[data.linkedSource]?.text ?? data.linkedSource}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="綁定時間">{data.linkedAt}</Descriptions.Item>
          <Descriptions.Item label="操作">
            <Button icon={<SwapOutlined />} onClick={() => setChangeOpen(true)}>
              調整歸屬
            </Button>
          </Descriptions.Item>
        </Descriptions>
      ) : (
        <Empty description="輸入玩家 ID 後按查詢" />
      )}

      <Modal
        title="調整玩家歸屬"
        open={changeOpen}
        onCancel={() => setChangeOpen(false)}
        onOk={handleChange}
        confirmLoading={submitting}
      >
        <Form layout="vertical">
          <Form.Item label="新代理" required>
            <Select
              showSearch
              value={newAgentId}
              onChange={setNewAgentId}
              placeholder="選擇代理"
              optionFilterProp="label"
              options={flatAgents
                .filter((a) => !a.isSystem)
                .map((a) => ({
                  label: `${a.code} - ${a.name}（${a.parentId ? 'B' : 'A'}）`,
                  value: a.id,
                }))}
            />
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
    </>
  );
}

// ─── 主元件 ───────────────────────────────────────────────

export default function CommissionPlayersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Tab 狀態 + 跳轉玩家 ID 都從 URL 讀取，讓瀏覽器上一頁能正確回到列表 Tab
  const tabFromUrl = searchParams.get('tab') === 'single' ? 'single' : 'list';
  const playerIdFromUrl = searchParams.get('playerId') ?? undefined;

  const [agents, setAgents] = useState<CommissionAgentTreeNode[]>([]);

  useEffect(() => {
    getAgentTree().then(setAgents).catch(() => {});
  }, []);

  /** 切換 Tab：用 router.push 推 history，讓上一頁能退回列表 */
  const handleTabChange = (key: string) => {
    if (key === 'list') {
      // 回列表就用 replace（或 push）把 query 清掉
      router.push(pathname);
    } else {
      // 切到單筆查詢，若已有 playerId 就保留
      const qs = playerIdFromUrl
        ? `?tab=single&playerId=${encodeURIComponent(playerIdFromUrl)}`
        : '?tab=single';
      router.push(`${pathname}${qs}`);
    }
  };

  /** 列表中點「調整歸屬」：帶 playerId 跳單筆 Tab（push 一筆 history） */
  const onJumpToSingle = (playerId: string) => {
    router.push(`${pathname}?tab=single&playerId=${encodeURIComponent(playerId)}`);
  };

  return (
    <Card title="玩家歸屬管理">
      <Tabs
        activeKey={tabFromUrl}
        onChange={handleTabChange}
        items={[
          {
            key: 'list',
            label: '所有歸屬',
            children: (
              <AttributionListTab
                agents={agents}
                onJumpToSingle={onJumpToSingle}
              />
            ),
          },
          {
            key: 'single',
            label: '單筆查詢 / 調整',
            children: (
              <SingleQueryTab agents={agents} initialPlayerId={playerIdFromUrl} />
            ),
          },
        ]}
      />
    </Card>
  );
}
