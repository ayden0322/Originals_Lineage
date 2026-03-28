'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  DatePicker,
  Popconfirm,
  message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '@/lib/api/content';
import type { Announcement, CreateAnnouncementDto } from '@/lib/types';

const typeMap: Record<string, { label: string; color: string }> = {
  maintenance: { label: '維護', color: 'orange' },
  event: { label: '活動', color: 'blue' },
  notice: { label: '公告', color: 'default' },
  urgent: { label: '緊急', color: 'red' },
};

export default function AnnouncementsPage() {
  const [data, setData] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAnnouncements(page, pageSize);
      setData(res.items);
      setTotal(res.total);
    } catch {
      message.error('載入公告列表失敗');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: Announcement) => {
    setEditingId(record.id);
    form.setFieldsValue({
      title: record.title,
      content: record.content,
      type: record.type,
      priority: record.priority,
      isActive: record.isActive,
      startTime: record.startTime ? dayjs(record.startTime) : null,
      endTime: record.endTime ? dayjs(record.endTime) : null,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const dto: CreateAnnouncementDto = {
        title: values.title,
        content: values.content,
        type: values.type,
        priority: values.priority,
        isActive: values.isActive,
        startTime: values.startTime ? values.startTime.toISOString() : undefined,
        endTime: values.endTime ? values.endTime.toISOString() : undefined,
      };

      if (editingId) {
        await updateAnnouncement(editingId, dto);
        message.success('公告更新成功');
      } else {
        await createAnnouncement(dto);
        message.success('公告建立成功');
      }
      setModalOpen(false);
      fetchData();
    } catch {
      message.error('操作失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAnnouncement(id);
      message.success('公告刪除成功');
      fetchData();
    } catch {
      message.error('刪除失敗');
    }
  };

  const columns: ColumnsType<Announcement> = [
    {
      title: '標題',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '類型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const t = typeMap[type] || { label: type, color: 'default' };
        return <Tag color={t.color}>{t.label}</Tag>;
      },
    },
    {
      title: '優先級',
      dataIndex: 'priority',
      key: 'priority',
      align: 'right',
    },
    {
      title: '啟用',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (val: boolean) => (
        <Tag color={val ? 'green' : 'default'}>{val ? '啟用' : '停用'}</Tag>
      ),
    },
    {
      title: '開始時間',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (val: string | null) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '結束時間',
      dataIndex: 'endTime',
      key: 'endTime',
      render: (val: string | null) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          >
            編輯
          </Button>
          <Popconfirm
            title="確定要刪除此公告嗎？"
            onConfirm={() => handleDelete(record.id)}
            okText="確定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              刪除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>公告管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增公告
        </Button>
      </div>

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
      />

      <Modal
        title={editingId ? '編輯公告' : '新增公告'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText="儲存"
        cancelText="取消"
        width={640}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ type: 'notice', priority: 0, isActive: true }}
        >
          <Form.Item
            name="title"
            label="標題"
            rules={[{ required: true, message: '請輸入標題' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="content"
            label="內容"
            rules={[{ required: true, message: '請輸入內容' }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item
            name="type"
            label="類型"
            rules={[{ required: true, message: '請選擇類型' }]}
          >
            <Select>
              <Select.Option value="maintenance">維護</Select.Option>
              <Select.Option value="event">活動</Select.Option>
              <Select.Option value="notice">公告</Select.Option>
              <Select.Option value="urgent">緊急</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="priority" label="優先級">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isActive" label="啟用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="startTime" label="開始時間">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="endTime" label="結束時間">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
