'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Card,
  Table,
  Form,
  InputNumber,
  Select,
  Button,
  Space,
  Switch,
  Modal,
  Typography,
  Alert,
  Spin,
  message,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import Link from 'next/link';
import {
  getRewardConfigs,
  createRewardConfig,
  updateRewardConfig,
  deleteRewardConfig,
  searchGameItems,
  type ForumPushRewardConfig,
  type GameItemOption,
} from '@/lib/api/forum-push';

const { Title, Paragraph } = Typography;

interface ItemChoice {
  itemId: number;
  name: string;
}

export default function RewardConfigPage() {
  const [data, setData] = useState<ForumPushRewardConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ForumPushRewardConfig | null>(null);
  const [form] = Form.useForm();

  // 遊戲道具搜尋
  const [searchOptions, setSearchOptions] = useState<GameItemOption[]>([]);
  const [searchFetching, setSearchFetching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeqRef = useRef(0);
  /** 保留當前選中道具（或編輯時的初始道具），避免 Select 重新 render 時下拉消失 */
  const [currentChoice, setCurrentChoice] = useState<ItemChoice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRewardConfigs();
      setData(res);
    } catch {
      message.error('載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** debounce 搜尋遊戲庫道具 */
  const doSearch = useCallback((keyword: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      const seq = ++searchSeqRef.current;
      setSearchFetching(true);
      try {
        const res = await searchGameItems(keyword || undefined, 1, 30);
        // 只採用最後一次搜尋結果，避免舊結果覆蓋新結果
        if (seq === searchSeqRef.current) {
          setSearchOptions(res.items);
        }
      } catch {
        if (seq === searchSeqRef.current) {
          setSearchOptions([]);
          message.error('搜尋遊戲道具失敗，請確認遊戲庫已連線');
        }
      } finally {
        if (seq === searchSeqRef.current) {
          setSearchFetching(false);
        }
      }
    }, 300);
  }, []);

  const openCreate = () => {
    setEditing(null);
    setCurrentChoice(null);
    setSearchOptions([]);
    form.resetFields();
    form.setFieldsValue({ quantityPerPass: 1, sortOrder: 0, isActive: true });
    setModalOpen(true);
    doSearch('');
  };

  const openEdit = (row: ForumPushRewardConfig) => {
    setEditing(row);
    setCurrentChoice({ itemId: row.itemCode, name: row.itemName });
    setSearchOptions([]);
    form.setFieldsValue({
      itemCode: row.itemCode,
      itemName: row.itemName,
      quantityPerPass: row.quantityPerPass,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    });
    setModalOpen(true);
    doSearch('');
  };

  const handleSelectItem = (
    itemId: number,
    option: GameItemOption | undefined,
  ) => {
    if (!option) return;
    setCurrentChoice({ itemId: option.itemId, name: option.name });
    form.setFieldsValue({ itemCode: option.itemId, itemName: option.name });
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await updateRewardConfig(editing.id, values);
        message.success('已更新');
      } else {
        await createRewardConfig(values);
        message.success('已新增');
      }
      setModalOpen(false);
      load();
    } catch {
      message.error('儲存失敗');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRewardConfig(id);
      message.success('已刪除');
      load();
    } catch {
      message.error('刪除失敗');
    }
  };

  const handleToggleActive = async (
    row: ForumPushRewardConfig,
    active: boolean,
  ) => {
    try {
      await updateRewardConfig(row.id, { isActive: active });
      load();
    } catch {
      message.error('更新失敗');
    }
  };

  const columns: ColumnsType<ForumPushRewardConfig> = [
    { title: '道具編號', dataIndex: 'itemCode', width: 120 },
    { title: '道具名稱', dataIndex: 'itemName' },
    {
      title: '每通過 1 筆發',
      dataIndex: 'quantityPerPass',
      width: 140,
      render: (v: number) => `× ${v}`,
    },
    { title: '排序', dataIndex: 'sortOrder', width: 80 },
    {
      title: '啟用',
      dataIndex: 'isActive',
      width: 80,
      render: (v: boolean, r) => (
        <Switch
          checked={v}
          onChange={(checked) => handleToggleActive(r, checked)}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => openEdit(r)}>
            編輯
          </Button>
          <Popconfirm title="確定刪除？" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger>
              刪除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /** 合併「當前選中道具」跟「搜尋結果」，避免選中後下拉不顯示選中項 */
  const mergedOptions = (() => {
    const map = new Map<number, GameItemOption>();
    if (currentChoice) {
      map.set(currentChoice.itemId, {
        itemId: currentChoice.itemId,
        name: currentChoice.name,
      });
    }
    for (const o of searchOptions) map.set(o.itemId, o);
    return Array.from(map.values()).map((o) => ({
      value: o.itemId,
      label: `[${o.itemId}] ${o.name}`,
      name: o.name,
    }));
  })();

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Link href="/module/forum-push">
          <Button icon={<ArrowLeftOutlined />}>返回列表</Button>
        </Link>
      </Space>

      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            獎勵道具設定
          </Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增道具
          </Button>
        </div>

        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="發放邏輯"
          description={
            <Paragraph style={{ margin: 0 }}>
              審核通過時，系統會針對<strong>每個啟用中的道具</strong>
              呼叫遊戲庫寫入一筆獎勵記錄：
              <br />
              <code>
                insertGiftReward(帳號, 道具編號, 道具名稱, 每通過 1 筆發 × 通過數量)
              </code>
              <br />
              例如此處設定「80033 × 5 / 筆」，審核通過 3 筆 → 玩家會收到「80033 × 15」。
            </Paragraph>
          }
        />

        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title={editing ? '編輯道具' : '新增道具'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="儲存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="道具"
            name="itemCode"
            rules={[{ required: true, message: '請選擇道具' }]}
            extra="輸入關鍵字可從遊戲庫搜尋（依 item_id 或名稱）"
          >
            <Select
              showSearch
              placeholder="輸入關鍵字搜尋遊戲道具…"
              filterOption={false}
              onSearch={doSearch}
              notFoundContent={
                searchFetching ? <Spin size="small" /> : '找不到結果'
              }
              options={mergedOptions}
              onChange={(value, option) => {
                const opt = Array.isArray(option) ? option[0] : option;
                handleSelectItem(
                  value as number,
                  opt
                    ? { itemId: opt.value as number, name: opt.name }
                    : undefined,
                );
              }}
            />
          </Form.Item>

          {/* itemName 仍需提交到後端，以隱藏欄位同步帶入 */}
          <Form.Item name="itemName" hidden>
            <input type="hidden" />
          </Form.Item>

          <Form.Item
            name="quantityPerPass"
            label="每通過 1 筆發放數量"
            rules={[{ required: true, message: '請輸入數量' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isActive" label="啟用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
