'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Form,
  Input,
  Button,
  Switch,
  Table,
  InputNumber,
  message,
  Typography,
  Space,
  Popconfirm,
  Modal,
  Select,
  Alert,
  Tag,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import ImageUpload from '@/components/ui/ImageUpload';
import RichTextEditor from '@/components/ui/RichTextEditor';
import {
  getMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  getMilestoneEditability,
  searchGameItems,
  type MilestoneFormDto,
} from '@/lib/api/reserve';
import type {
  GameItemOption,
  MilestoneEditability,
  ReservationMilestone,
} from '@/lib/types';

const { Title, Text } = Typography;

interface ItemOption {
  value: number;
  label: string;
}

export default function ReserveMilestonesPage() {
  const [milestones, setMilestones] = useState<ReservationMilestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ReservationMilestone | null>(null);
  const [form] = Form.useForm();
  const [editability, setEditability] =
    useState<MilestoneEditability | null>(null);
  const [itemOptions, setItemOptions] = useState<ItemOption[]>([]);
  const [itemSearchLoading, setItemSearchLoading] = useState(false);

  const fetchMilestones = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMilestones();
      setMilestones(data);
    } catch {
      message.error('載入里程碑失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  const handleItemSearch = useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return (text: string) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        if (!text || text.length < 1) {
          setItemOptions([]);
          return;
        }
        setItemSearchLoading(true);
        try {
          const { items } = await searchGameItems({ search: text, limit: 30 });
          setItemOptions(
            items.map((it: GameItemOption) => ({
              value: it.itemId,
              label: `[${it.itemId}] ${it.name}`,
            })),
          );
        } catch {
          setItemOptions([]);
        } finally {
          setItemSearchLoading(false);
        }
      }, 300);
    };
  }, []);

  const openModal = async (milestone?: ReservationMilestone) => {
    setEditing(milestone || null);
    form.resetFields();
    setEditability(null);
    setItemOptions([]);

    if (milestone) {
      form.setFieldsValue({
        threshold: milestone.threshold,
        rewardName: milestone.rewardName,
        rewardDescription: milestone.rewardDescription || '',
        imageUrl: milestone.imageUrl || '',
        sortOrder: milestone.sortOrder ?? 0,
        isActive: milestone.isActive,
        gameItemId: milestone.gameItemId ?? null,
        gameItemQuantity: milestone.gameItemQuantity ?? 1,
      });
      // 預載已綁定的道具到下拉選項，讓顯示有名稱
      if (milestone.gameItemId && milestone.gameItemName) {
        setItemOptions([
          {
            value: milestone.gameItemId,
            label: `[${milestone.gameItemId}] ${milestone.gameItemName}`,
          },
        ]);
      }
      // 查此里程碑目前的編輯鎖狀態
      try {
        const ed = await getMilestoneEditability(milestone.id);
        setEditability(ed);
      } catch {
        // ignore
      }
    } else {
      form.setFieldsValue({
        threshold: 100,
        sortOrder: 0,
        isActive: true,
        gameItemQuantity: 1,
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      // 要把 gameItemId 對應的名稱一起送，以便後端存快照
      const selectedOption = itemOptions.find(
        (o) => o.value === values.gameItemId,
      );
      const gameItemName = selectedOption
        ? selectedOption.label.replace(/^\[\d+\]\s*/, '')
        : null;

      const payload: MilestoneFormDto = {
        threshold: values.threshold,
        rewardName: values.rewardName,
        rewardDescription: values.rewardDescription || undefined,
        imageUrl: values.imageUrl || undefined,
        sortOrder: values.sortOrder ?? 0,
        isActive: !!values.isActive,
        gameItemId: values.gameItemId ?? null,
        gameItemName,
        gameItemQuantity: values.gameItemQuantity ?? 1,
      };
      if (editing) {
        await updateMilestone(editing.id, payload);
        message.success('更新成功');
      } else {
        await createMilestone(payload);
        message.success('新增成功');
      }
      setModalOpen(false);
      fetchMilestones();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      // 後端可能回「不可變更道具」的 400
      const axiosErr = err as {
        response?: { data?: { message?: string | { message?: string } } };
      };
      const responseMsg = axiosErr?.response?.data?.message;
      const msg =
        typeof responseMsg === 'string'
          ? responseMsg
          : responseMsg?.message ?? '儲存失敗';
      message.error(msg);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMilestone(id);
      message.success('刪除成功');
      fetchMilestones();
    } catch {
      message.error('刪除失敗');
    }
  };

  const columns = [
    {
      title: '排序',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 70,
      sorter: (a: ReservationMilestone, b: ReservationMilestone) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    },
    {
      title: '門檻（人數）',
      dataIndex: 'threshold',
      key: 'threshold',
      width: 120,
      sorter: (a: ReservationMilestone, b: ReservationMilestone) =>
        a.threshold - b.threshold,
    },
    {
      title: '獎勵名稱',
      dataIndex: 'rewardName',
      key: 'rewardName',
    },
    {
      title: '綁定道具',
      key: 'gameItem',
      width: 220,
      render: (_: unknown, record: ReservationMilestone) =>
        record.gameItemId ? (
          <Space direction="vertical" size={0}>
            <Text>
              [{record.gameItemId}] {record.gameItemName ?? '—'}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              × {record.gameItemQuantity}
            </Text>
          </Space>
        ) : (
          <Tag color="warning">未綁定</Tag>
        ),
    },
    {
      title: '圖片',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 80,
      render: (url: string | null) =>
        url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
          />
        ) : (
          '-'
        ),
    },
    {
      title: '啟用',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (val: boolean, record: ReservationMilestone) => (
        <Switch
          size="small"
          checked={val}
          onChange={async (checked) => {
            await updateMilestone(record.id, { isActive: checked });
            fetchMilestones();
          }}
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: ReservationMilestone) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openModal(record)}
          />
          <Popconfirm
            title="確定刪除此里程碑？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 編輯時，若里程碑已鎖定綁定道具，disable select
  const itemBindingLocked = !!editing && editability && !editability.canEdit;

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
        <Title level={4} style={{ margin: 0 }}>
          新兵報到 — 里程碑管理
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          新增里程碑
        </Button>
      </div>

      <Table
        scroll={{ x: 'max-content' }}
        rowKey="id"
        columns={columns}
        dataSource={milestones}
        loading={loading}
        pagination={false}
      />

      <Modal
        title={editing ? '編輯里程碑' : '新增里程碑'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="threshold"
            label="門檻（達成人數）"
            rules={[{ required: true, message: '請輸入門檻人數' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="rewardName"
            label="獎勵名稱"
            rules={[{ required: true, message: '請輸入獎勵名稱' }]}
          >
            <Input placeholder="限定坐騎" />
          </Form.Item>

          {/* ─── 綁定遊戲道具 ─── */}
          <Form.Item
            label={
              <Space>
                <span>綁定遊戲道具</span>
                {editing && editability && (
                  <>
                    {editability.sentCount > 0 && (
                      <Tag color="error">
                        🔒 已寄送 {editability.sentCount} 筆
                      </Tag>
                    )}
                    {editability.processingCount > 0 && (
                      <Tag color="processing">
                        ⏳ 寄送中 {editability.processingCount}
                      </Tag>
                    )}
                    {editability.pendingCount > 0 && (
                      <Tag color="warning">
                        ⚠️ 待寄送 {editability.pendingCount}
                      </Tag>
                    )}
                  </>
                )}
              </Space>
            }
          >
            {itemBindingLocked && editability?.reason && (
              <Alert
                type="error"
                showIcon
                message={editability.reason}
                style={{ marginBottom: 8 }}
              />
            )}
            {!itemBindingLocked &&
              editing &&
              editability &&
              editability.pendingCount > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  message={`變更道具將同步更新 ${editability.pendingCount} 筆待寄送紀錄的道具快照`}
                  style={{ marginBottom: 8 }}
                />
              )}
            <Form.Item name="gameItemId" noStyle>
              <Select
                placeholder="輸入關鍵字搜尋道具（例：事前預約）"
                showSearch
                allowClear
                filterOption={false}
                onSearch={handleItemSearch}
                loading={itemSearchLoading}
                options={itemOptions}
                disabled={!!itemBindingLocked}
                notFoundContent={
                  itemSearchLoading ? '搜尋中...' : '請輸入關鍵字'
                }
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Form.Item>

          <Form.Item
            name="gameItemQuantity"
            label="每人發放數量"
            rules={[
              { required: true, message: '請輸入數量' },
              { type: 'number', min: 1, message: '數量需 ≥ 1' },
            ]}
          >
            <InputNumber min={1} style={{ width: '100%' }} disabled={!!itemBindingLocked} />
          </Form.Item>

          <Form.Item name="rewardDescription" label="獎勵詳細說明">
            <RichTextEditor />
          </Form.Item>

          <Form.Item name="imageUrl" label="獎勵圖片">
            <ImageUpload folder="reserve" />
          </Form.Item>

          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="isActive" label="啟用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
