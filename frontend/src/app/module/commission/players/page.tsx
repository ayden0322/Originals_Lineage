'use client';

import { useState } from 'react';
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
} from 'antd';
import { SearchOutlined, SwapOutlined } from '@ant-design/icons';
import {
  getPlayerAttribution,
  changePlayerAttribution,
  getAgentTree,
} from '@/lib/api/commission';
import type {
  CommissionPlayerAttribution,
  CommissionAgentTreeNode,
} from '@/lib/types';

const sourceLabel: Record<string, string> = {
  cookie: 'Cookie 綁定',
  register: '註冊時直接帶',
  manual: '管理者手動',
  system: '無歸屬（SYSTEM）',
};

export default function CommissionPlayersPage() {
  const [playerId, setPlayerId] = useState('');
  const [searching, setSearching] = useState(false);
  const [data, setData] = useState<CommissionPlayerAttribution | null>(null);
  const [agents, setAgents] = useState<CommissionAgentTreeNode[]>([]);

  const [changeOpen, setChangeOpen] = useState(false);
  const [newAgentId, setNewAgentId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSearch = async () => {
    if (!playerId.trim()) return;
    setSearching(true);
    try {
      const [attr, tree] = await Promise.all([
        getPlayerAttribution(playerId.trim()),
        getAgentTree(),
      ]);
      setData(attr);
      setAgents(tree);
    } catch (e) {
      message.error('查無玩家或載入失敗');
      setData(null);
    } finally {
      setSearching(false);
    }
  };

  const handleChange = async () => {
    if (!data || !newAgentId) return;
    try {
      setSubmitting(true);
      await changePlayerAttribution(data.playerId, newAgentId, reason.trim() || undefined);
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

  // 把 tree 攤平成所有 agent 列表（含 B）供選擇
  const flatAgents = agents.flatMap((a) => [a, ...((a.children as CommissionAgentTreeNode[]) ?? [])]);
  const currentAgent = flatAgents.find((a) => a.id === data?.agentId);

  return (
    <Card title="玩家歸屬管理">
      <Alert
        type="info"
        showIcon
        message="輸入玩家 ID 查詢歸屬，可手動調整。歷史分潤紀錄不會回溯重算，僅影響之後的新交易。"
        style={{ marginBottom: 16 }}
      />
      <Space.Compact style={{ width: '100%', maxWidth: 600, marginBottom: 24 }}>
        <Input
          placeholder="輸入玩家 ID（website_users.id UUID）"
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          onPressEnter={handleSearch}
        />
        <Button
          type="primary"
          icon={<SearchOutlined />}
          loading={searching}
          onClick={handleSearch}
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
            <Tag>{sourceLabel[data.linkedSource] ?? data.linkedSource}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="綁定時間">{data.linkedAt}</Descriptions.Item>
          <Descriptions.Item label="操作">
            <Button icon={<SwapOutlined />} onClick={() => setChangeOpen(true)}>
              調整歸屬
            </Button>
          </Descriptions.Item>
        </Descriptions>
      ) : (
        <Empty description="尚未查詢" />
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
    </Card>
  );
}
