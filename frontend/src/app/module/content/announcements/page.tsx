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
  ColorPicker,
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

const typeDefaultColors: Record<string, { bg: string; border: string }> = {
  urgent: { bg: '#8b0000', border: '#ff4d4f' },
  maintenance: { bg: '#7a6a2e', border: '#c4a24e' },
  event: { bg: '#1050c8', border: '#1677ff' },
  notice: { bg: '#1e6e3c', border: '#52c41a' },
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
    const defaults = typeDefaultColors[record.type] || typeDefaultColors.notice;
    form.setFieldsValue({
      title: record.title,
      content: record.content,
      type: record.type,
      priority: record.priority,
      isActive: record.isActive,
      barBgColor: record.barBgColor || defaults.bg,
      barBorderColor: record.barBorderColor || defaults.border,
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
        barBgColor: typeof values.barBgColor === 'string' ? values.barBgColor : values.barBgColor?.toHexString?.() || undefined,
        barBorderColor: typeof values.barBorderColor === 'string' ? values.barBorderColor : values.barBorderColor?.toHexString?.() || undefined,
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
      width: 240,
    },
    {
      title: '類型',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      align: 'center',
      render: (type: string) => {
        const t = typeMap[type] || { label: type, color: 'default' };
        return <Tag color={t.color}>{t.label}</Tag>;
      },
    },
    {
      title: '優先級',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      align: 'right',
    },
    {
      title: '啟用',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      align: 'center',
      render: (val: boolean) => (
        <Tag color={val ? 'green' : 'default'}>{val ? '啟用' : '停用'}</Tag>
      ),
    },
    {
      title: '開始時間',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 160,
      render: (val: string | null) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '結束時間',
      dataIndex: 'endTime',
      key: 'endTime',
      width: 160,
      render: (val: string | null) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
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
          initialValues={{
            type: 'notice',
            priority: 0,
            isActive: true,
            barBgColor: typeDefaultColors.notice.bg,
            barBorderColor: typeDefaultColors.notice.border,
          }}
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
            <Select
              onChange={(val: string) => {
                const colors = typeDefaultColors[val] || typeDefaultColors.notice;
                form.setFieldsValue({
                  barBgColor: colors.bg,
                  barBorderColor: colors.border,
                });
              }}
            >
              <Select.Option value="maintenance">維護</Select.Option>
              <Select.Option value="event">活動</Select.Option>
              <Select.Option value="notice">公告</Select.Option>
              <Select.Option value="urgent">緊急</Select.Option>
            </Select>
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="barBgColor" label="通知列背景色" style={{ flex: 1 }}>
              <ColorPicker
                showText
                format="hex"
                onChange={(_, hex) => form.setFieldValue('barBgColor', hex)}
              />
            </Form.Item>
            <Form.Item name="barBorderColor" label="通知列外框色" style={{ flex: 1 }}>
              <ColorPicker
                showText
                format="hex"
                onChange={(_, hex) => form.setFieldValue('barBorderColor', hex)}
              />
            </Form.Item>
            <div style={{ flex: 2, paddingTop: 30 }}>
              <Form.Item noStyle shouldUpdate={(prev, cur) => prev.barBgColor !== cur.barBgColor || prev.barBorderColor !== cur.barBorderColor || prev.title !== cur.title || prev.type !== cur.type}>
                {() => {
                  const rawBg = form.getFieldValue('barBgColor');
                  const rawBorder = form.getFieldValue('barBorderColor');
                  const bg = (typeof rawBg === 'string' ? rawBg : rawBg?.toHexString?.()) || '#1e6e3c';
                  const border = (typeof rawBorder === 'string' ? rawBorder : rawBorder?.toHexString?.()) || '#52c41a';
                  const title = form.getFieldValue('title') || '公告標題預覽';
                  const type = form.getFieldValue('type') || 'notice';
                  const label = typeMap[type]?.label || type;
                  return (
                    <div
                      style={{
                        background: bg,
                        border: `2px solid ${border}`,
                        borderRadius: 4,
                        height: 36,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '0 12px',
                      }}
                    >
                      <span style={{ fontSize: 11, color: '#fff', background: 'rgba(255,255,255,0.15)', borderRadius: 3, padding: '1px 6px', whiteSpace: 'nowrap' }}>
                        {label}
                      </span>
                      <span style={{ fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {title}
                      </span>
                    </div>
                  );
                }}
              </Form.Item>
            </div>
          </div>
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
