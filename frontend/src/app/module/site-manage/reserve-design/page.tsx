'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Form,
  Input,
  Button,
  Switch,
  Tabs,
  Table,
  InputNumber,
  message,
  Typography,
  Spin,
  DatePicker,
  Space,
  Popconfirm,
  Modal,
  Checkbox,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import ImageUpload from '@/components/ui/ImageUpload';
import ColorPickerInput from '@/components/ui/ColorPickerInput';
import { getSiteSettings, updateSiteSettings } from '@/lib/api/site-manage';
import {
  getMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
} from '@/lib/api/reserve';
import type { ReservationMilestone, ReserveFieldConfig } from '@/lib/types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const DEFAULT_FIELD_CONFIG: ReserveFieldConfig = {
  displayName: { visible: true, required: false },
  phone: { visible: true, required: false },
  lineId: { visible: true, required: false },
};

export default function ReserveDesignPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 里程碑
  const [milestones, setMilestones] = useState<ReservationMilestone[]>([]);
  const [milestoneLoading, setMilestoneLoading] = useState(false);
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<ReservationMilestone | null>(null);
  const [milestoneForm] = Form.useForm();

  // 表單欄位設定
  const [fieldConfig, setFieldConfig] = useState<ReserveFieldConfig>(DEFAULT_FIELD_CONFIG);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [settings, milestonesData] = await Promise.all([
        getSiteSettings(),
        getMilestones(),
      ]);

      const s = settings as Record<string, unknown>;
      const fc = (s.reserveFieldConfig as ReserveFieldConfig) || DEFAULT_FIELD_CONFIG;
      setFieldConfig(fc);
      setMilestones(milestonesData);

      form.setFieldsValue({
        reserveEnabled: s.reserveEnabled ?? false,
        reserveLaunchDate: s.reserveLaunchDate ? dayjs(s.reserveLaunchDate as string) : null,
        reserveBannerUrl: s.reserveBannerUrl ?? '',
        reserveBgImageUrl: s.reserveBgImageUrl ?? '',
        reserveTitle: s.reserveTitle ?? '事前預約',
        reserveSubtitle: s.reserveSubtitle ?? '',
        reserveDescription: s.reserveDescription ?? '',
        reserveButtonText: s.reserveButtonText ?? '立即預約',
        reserveAccentColor: s.reserveAccentColor ?? '#c4a24e',
        reserveMilestonesEnabled: s.reserveMilestonesEnabled ?? false,
        reserveEmailVerificationEnabled: s.reserveEmailVerificationEnabled ?? false,
        reserveSuccessMessage: s.reserveSuccessMessage ?? '',
      });
    } catch {
      message.error('載入設定失敗');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      const payload: Record<string, unknown> = {
        ...values,
        reserveLaunchDate: values.reserveLaunchDate
          ? values.reserveLaunchDate.toISOString()
          : null,
        reserveFieldConfig: fieldConfig,
      };
      await updateSiteSettings(payload);
      message.success('儲存成功');
    } catch {
      message.error('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  // ─── 里程碑操作 ────────────────────────────────────────────────

  const fetchMilestones = async () => {
    setMilestoneLoading(true);
    try {
      const data = await getMilestones();
      setMilestones(data);
    } catch {
      message.error('載入里程碑失敗');
    } finally {
      setMilestoneLoading(false);
    }
  };

  const openMilestoneModal = (milestone?: ReservationMilestone) => {
    setEditingMilestone(milestone || null);
    milestoneForm.resetFields();
    if (milestone) {
      milestoneForm.setFieldsValue(milestone);
    }
    setMilestoneModalOpen(true);
  };

  const handleMilestoneSubmit = async () => {
    try {
      const values = await milestoneForm.validateFields();
      if (editingMilestone) {
        await updateMilestone(editingMilestone.id, values);
        message.success('更新成功');
      } else {
        await createMilestone(values);
        message.success('新增成功');
      }
      setMilestoneModalOpen(false);
      fetchMilestones();
    } catch {
      // validation error
    }
  };

  const handleDeleteMilestone = async (id: string) => {
    try {
      await deleteMilestone(id);
      message.success('刪除成功');
      fetchMilestones();
    } catch {
      message.error('刪除失敗');
    }
  };

  // ─── 表單欄位設定 ──────────────────────────────────────────────

  const updateFieldConfig = (
    field: string,
    key: 'visible' | 'required',
    value: boolean,
  ) => {
    setFieldConfig((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [key]: value,
        // 如果取消顯示，也取消必填
        ...(key === 'visible' && !value ? { required: false } : {}),
      },
    }));
  };

  const milestoneColumns = [
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
      title: '圖片',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 80,
      render: (url: string | null) =>
        url ? (
          <img src={url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
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
            onClick={() => openMilestoneModal(record)}
          />
          <Popconfirm
            title="確定刪除此里程碑？"
            onConfirm={() => handleDeleteMilestone(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const fieldLabels: Record<string, string> = {
    displayName: '暱稱',
    phone: '手機號碼',
    lineId: 'LINE ID',
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>事前預約 — 設計與設定</Title>
        <Button type="primary" onClick={handleSave} loading={saving}>
          儲存設定
        </Button>
      </div>

      <Form form={form} layout="vertical">
        <Tabs
          defaultActiveKey="basic"
          items={[
            {
              key: 'basic',
              label: '基本設定',
              children: (
                <div style={{ maxWidth: 600 }}>
                  <Form.Item name="reserveEnabled" label="啟用事前預約頁面" valuePropName="checked">
                    <Switch />
                  </Form.Item>

                  <Form.Item name="reserveTitle" label="頁面標題">
                    <Input placeholder="事前預約" />
                  </Form.Item>

                  <Form.Item name="reserveSubtitle" label="副標題">
                    <Input placeholder="搶先預約，開服即享獨家好禮！" />
                  </Form.Item>

                  <Form.Item name="reserveDescription" label="說明文字">
                    <TextArea rows={3} placeholder="詳細說明..." />
                  </Form.Item>

                  <Form.Item name="reserveButtonText" label="按鈕文字">
                    <Input placeholder="立即預約" />
                  </Form.Item>

                  <Form.Item name="reserveSuccessMessage" label="預約成功訊息">
                    <TextArea rows={2} placeholder="預約成功！我們將在開服前通知您。" />
                  </Form.Item>

                  <Form.Item name="reserveLaunchDate" label="開服日期（倒數計時用）">
                    <DatePicker showTime style={{ width: '100%' }} />
                  </Form.Item>

                  <Form.Item name="reserveEmailVerificationEnabled" label="啟用 Email 驗證" valuePropName="checked">
                    <Switch />
                  </Form.Item>

                  <Form.Item name="reserveMilestonesEnabled" label="啟用里程碑顯示" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </div>
              ),
            },
            {
              key: 'visual',
              label: '視覺設計',
              children: (
                <div style={{ maxWidth: 600 }}>
                  <Form.Item name="reserveBannerUrl" label="Hero Banner 圖片">
                    <ImageUpload folder="reserve" />
                  </Form.Item>

                  <Form.Item name="reserveBgImageUrl" label="頁面背景圖">
                    <ImageUpload folder="reserve" />
                  </Form.Item>

                  <Form.Item name="reserveAccentColor" label="強調色">
                    <ColorPickerInput />
                  </Form.Item>
                </div>
              ),
            },
            {
              key: 'fields',
              label: '表單欄位',
              children: (
                <div style={{ maxWidth: 600 }}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                    Email 為必填欄位，無法關閉。以下為可設定的額外欄位：
                  </Text>

                  <Table
                    dataSource={Object.entries(fieldConfig).map(([key, val]) => ({
                      key,
                      field: key,
                      label: fieldLabels[key] || key,
                      visible: val.visible,
                      required: val.required,
                    }))}
                    pagination={false}
                    columns={[
                      { title: '欄位', dataIndex: 'label', key: 'label' },
                      {
                        title: '顯示',
                        dataIndex: 'visible',
                        key: 'visible',
                        width: 80,
                        render: (val: boolean, record: { field: string }) => (
                          <Checkbox
                            checked={val}
                            onChange={(e) =>
                              updateFieldConfig(record.field, 'visible', e.target.checked)
                            }
                          />
                        ),
                      },
                      {
                        title: '必填',
                        dataIndex: 'required',
                        key: 'required',
                        width: 80,
                        render: (val: boolean, record: { field: string; visible: boolean }) => (
                          <Checkbox
                            checked={val}
                            disabled={!record.visible}
                            onChange={(e) =>
                              updateFieldConfig(record.field, 'required', e.target.checked)
                            }
                          />
                        ),
                      },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'milestones',
              label: '里程碑',
              children: (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => openMilestoneModal()}
                    >
                      新增里程碑
                    </Button>
                  </div>

                  <Table
                    rowKey="id"
                    columns={milestoneColumns}
                    dataSource={milestones}
                    loading={milestoneLoading}
                    pagination={false}
                  />
                </div>
              ),
            },
          ]}
        />
      </Form>

      {/* 里程碑編輯 Modal */}
      <Modal
        title={editingMilestone ? '編輯里程碑' : '新增里程碑'}
        open={milestoneModalOpen}
        onOk={handleMilestoneSubmit}
        onCancel={() => setMilestoneModalOpen(false)}
        destroyOnClose
      >
        <Form form={milestoneForm} layout="vertical">
          <Form.Item
            name="threshold"
            label="門檻（人數）"
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

          <Form.Item name="imageUrl" label="獎勵圖片">
            <ImageUpload folder="reserve" />
          </Form.Item>

          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="isActive" label="啟用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
