'use client';

import { useEffect, useState, useCallback } from 'react';
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
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import ImageUpload from '@/components/ui/ImageUpload';
import RichTextEditor from '@/components/ui/RichTextEditor';
import {
  getMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
} from '@/lib/api/reserve';
import type { ReservationMilestone } from '@/lib/types';

const { Title } = Typography;

export default function ReserveMilestonesPage() {
  const [milestones, setMilestones] = useState<ReservationMilestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ReservationMilestone | null>(null);
  const [form] = Form.useForm();

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

  const openModal = (milestone?: ReservationMilestone) => {
    setEditing(milestone || null);
    form.resetFields();
    if (milestone) {
      form.setFieldsValue({
        threshold: milestone.threshold,
        rewardName: milestone.rewardName,
        rewardDescription: milestone.rewardDescription || '',
        imageUrl: milestone.imageUrl || '',
        sortOrder: milestone.sortOrder ?? 0,
        isActive: milestone.isActive,
      });
    } else {
      form.setFieldsValue({
        threshold: 100,
        sortOrder: 0,
        isActive: true,
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        threshold: values.threshold,
        rewardName: values.rewardName,
        rewardDescription: values.rewardDescription || undefined,
        imageUrl: values.imageUrl || undefined,
        sortOrder: values.sortOrder ?? 0,
        isActive: !!values.isActive,
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
      message.error('儲存失敗');
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
