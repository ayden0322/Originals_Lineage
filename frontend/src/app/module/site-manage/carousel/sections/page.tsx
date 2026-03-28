'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Button,
  Table,
  Modal,
  Switch,
  Select,
  Popconfirm,
  Card,
  Space,
  Image,
  message,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import ImageUpload from '@/components/ui/ImageUpload';
import RichTextEditor from '@/components/ui/RichTextEditor';
import {
  getSections,
  createSection,
  updateSection,
  deleteSection,
  getSectionSlides,
  createSectionSlide,
  updateSlide,
  deleteSlide,
} from '@/lib/api/site-manage';
import type { SiteSection, CarouselSlide } from '@/lib/types';

const { Title } = Typography;

// ═══════════════════════════════════════════════════════════════
// Slides Modal (for managing section slides)
// ═══════════════════════════════════════════════════════════════

function SlidesModal({
  section,
  open,
  onClose,
}: {
  section: SiteSection;
  open: boolean;
  onClose: () => void;
}) {
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<CarouselSlide | null>(null);
  const [form] = Form.useForm();
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [linkEnabled, setLinkEnabled] = useState(false);

  const fetchSlides = useCallback(async () => {
    try {
      const data = await getSectionSlides(section.id);
      setSlides(data);
    } catch {
      message.error('載入輪播失敗');
    } finally {
      setLoading(false);
    }
  }, [section.id]);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchSlides();
    }
  }, [open, fetchSlides]);

  const openEditModal = (slide?: CarouselSlide) => {
    if (slide) {
      setEditingSlide(slide);
      setMediaType(slide.mediaType || 'image');
      setImageUrl(slide.imageUrl || '');
      setVideoUrl(slide.videoUrl || '');
      setLinkEnabled(slide.linkEnabled || false);
      form.setFieldsValue({
        autoPlaySeconds: slide.autoPlaySeconds || 6,
        linkUrl: slide.linkUrl,
        sortOrder: slide.sortOrder,
        isActive: slide.isActive,
      });
    } else {
      setEditingSlide(null);
      setMediaType('image');
      setImageUrl('');
      setVideoUrl('');
      setLinkEnabled(false);
      form.resetFields();
    }
    setEditModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const dto = {
        ...values,
        mediaType,
        imageUrl: mediaType === 'image' ? imageUrl : undefined,
        videoUrl: mediaType === 'video' ? videoUrl : undefined,
        linkEnabled,
        linkUrl: linkEnabled ? values.linkUrl : undefined,
      };

      // 驗證：必須有對應的媒體內容
      if (mediaType === 'image' && !imageUrl) {
        message.error('請上傳圖片');
        return;
      }
      if (mediaType === 'video' && !videoUrl) {
        message.error('請輸入影片網址');
        return;
      }

      if (editingSlide) {
        await updateSlide(editingSlide.id, dto);
        message.success('已更新');
      } else {
        await createSectionSlide(section.id, dto);
        message.success('已新增');
      }
      setEditModalOpen(false);
      fetchSlides();
    } catch {
      message.error('操作失敗');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSlide(id);
      message.success('已刪除');
      fetchSlides();
    } catch {
      message.error('刪除失敗');
    }
  };

  return (
    <Modal
      title={`管理「${section.name}」的輪播`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={850}
    >
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => openEditModal()}
        style={{ marginBottom: 16 }}
      >
        新增輪播
      </Button>
      <Table
        loading={loading}
        dataSource={slides}
        rowKey="id"
        size="small"
        columns={[
          {
            title: '媒體',
            width: 110,
            render: (_: unknown, record: CarouselSlide) =>
              record.mediaType === 'video' && record.videoUrl ? (
                <div style={{ position: 'relative', width: 80, height: 50 }}>
                  <video src={record.videoUrl} width={80} height={50} style={{ objectFit: 'cover', borderRadius: 4 }} muted />
                  <PlayCircleOutlined style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 18, color: '#fff' }} />
                </div>
              ) : record.imageUrl ? (
                <Image src={record.imageUrl} width={80} height={50} style={{ objectFit: 'cover', borderRadius: 4 }} />
              ) : (
                <PictureOutlined style={{ fontSize: 24, color: '#ccc' }} />
              ),
          },
          {
            title: '類型',
            dataIndex: 'mediaType',
            width: 70,
            render: (v: string) => v === 'video' ? '影片' : '圖片',
          },
          {
            title: '秒數',
            dataIndex: 'autoPlaySeconds',
            width: 60,
            render: (v: number) => `${v}s`,
          },
          {
            title: '連結',
            width: 60,
            render: (_: unknown, record: CarouselSlide) => (
              <Switch checked={record.linkEnabled} disabled size="small" />
            ),
          },
          {
            title: <span>排序 <span style={{ fontSize: 11, color: '#999' }}>(1為最上)</span></span>,
            dataIndex: 'sortOrder',
            width: 90,
          },
          {
            title: '啟用',
            dataIndex: 'isActive',
            width: 60,
            render: (v: boolean) => <Switch checked={v} disabled size="small" />,
          },
          {
            title: '操作',
            width: 100,
            render: (_: unknown, record: CarouselSlide) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
                <Popconfirm title="確定刪除？" onConfirm={() => handleDelete(record.id)}>
                  <Button size="small" icon={<DeleteOutlined />} danger />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editingSlide ? '編輯輪播' : '新增輪播'}
        open={editModalOpen}
        onOk={handleSubmit}
        onCancel={() => setEditModalOpen(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          {/* 媒體類型選擇 */}
          <Form.Item label="媒體類型" required>
            <Select
              value={mediaType}
              onChange={(val) => setMediaType(val)}
              options={[
                { value: 'image', label: <span><PictureOutlined /> 圖片上傳</span> },
                { value: 'video', label: <span><VideoCameraOutlined /> 影片網址</span> },
              ]}
            />
          </Form.Item>

          {/* 圖片上傳 or 影片網址 — 二擇一 */}
          {mediaType === 'image' ? (
            <Form.Item label="上傳圖片" required>
              <ImageUpload value={imageUrl} onChange={setImageUrl} folder="sections" />
            </Form.Item>
          ) : (
            <Form.Item label="影片網址" required>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://example.com/video.mp4"
                prefix={<VideoCameraOutlined />}
              />
              {videoUrl && (
                <video
                  src={videoUrl}
                  controls
                  muted
                  style={{ width: '100%', maxHeight: 200, marginTop: 8, borderRadius: 4 }}
                />
              )}
            </Form.Item>
          )}

          {/* 自動輪播秒數 */}
          <Form.Item name="autoPlaySeconds" label="自動輪播秒數" initialValue={6}>
            <InputNumber min={1} max={60} addonAfter="秒" style={{ width: 160 }} />
          </Form.Item>

          {/* 連結開關 */}
          <Form.Item label="點擊是否連結">
            <Switch
              checked={linkEnabled}
              onChange={setLinkEnabled}
              checkedChildren="開"
              unCheckedChildren="關"
            />
          </Form.Item>

          {/* 連結 URL — 只在開啟時顯示 */}
          {linkEnabled && (
            <Form.Item name="linkUrl" label="連結網址（點擊後開啟新分頁）" rules={[{ required: true, message: '請輸入連結網址' }]}>
              <Input placeholder="https://example.com" />
            </Form.Item>
          )}

          {/* 排序 */}
          <Form.Item
            name="sortOrder"
            label={<span>排序 <span style={{ fontSize: 12, color: '#999' }}>（設定 1 為最上方，數字越大權重越小）</span></span>}
            initialValue={1}
          >
            <InputNumber min={1} style={{ width: 160 }} />
          </Form.Item>

          {/* 啟用 */}
          <Form.Item name="isActive" label="啟用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════

export default function SectionsPage() {
  const [sections, setSections] = useState<SiteSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<SiteSection | null>(null);
  const [slidesModalOpen, setSlidesModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SiteSection | null>(null);
  const [form] = Form.useForm();
  const [description, setDescription] = useState('');

  const fetchSections = useCallback(async () => {
    try {
      const data = await getSections();
      setSections(data);
    } catch {
      message.error('載入區塊失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  const openModal = (section?: SiteSection) => {
    if (section) {
      setEditingSection(section);
      form.setFieldsValue(section);
      setDescription(section.description || '');
    } else {
      setEditingSection(null);
      form.resetFields();
      setDescription('');
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const dto = { ...values, description };
      if (editingSection) {
        await updateSection(editingSection.id, dto);
        message.success('已更新');
      } else {
        await createSection(dto);
        message.success('已新增');
      }
      setModalOpen(false);
      fetchSections();
    } catch {
      message.error('操作失敗');
    }
  };

  const handleDeleteSection = async (id: string) => {
    try {
      await deleteSection(id);
      message.success('已刪除');
      fetchSections();
    } catch {
      message.error('刪除失敗');
    }
  };

  return (
    <div>
      <Title level={3}>輪播設定</Title>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => openModal()}
        style={{ marginBottom: 16 }}
      >
        新增區塊
      </Button>
      <Table
        loading={loading}
        dataSource={sections}
        rowKey="id"
        columns={[
          { title: '名稱', dataIndex: 'name' },
          { title: '排序', dataIndex: 'sortOrder', width: 80 },
          {
            title: '啟用',
            dataIndex: 'isActive',
            width: 80,
            render: (v: boolean) => <Switch checked={v} disabled />,
          },
          {
            title: 'Slides',
            width: 80,
            render: (_: unknown, record: SiteSection) => (
              <span>{record.slides?.length || 0}</span>
            ),
          },
          {
            title: '操作',
            width: 220,
            render: (_: unknown, record: SiteSection) => (
              <Space>
                <Button
                  icon={<PictureOutlined />}
                  onClick={() => {
                    setActiveSection(record);
                    setSlidesModalOpen(true);
                  }}
                >
                  輪播
                </Button>
                <Button icon={<EditOutlined />} onClick={() => openModal(record)} />
                <Popconfirm title="確定刪除？" onConfirm={() => handleDeleteSection(record.id)}>
                  <Button icon={<DeleteOutlined />} danger />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      {/* Section Modal */}
      <Modal
        title={editingSection ? '編輯區塊' : '新增區塊'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={720}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="區塊名稱" rules={[{ required: true, message: '請輸入區塊名稱' }]}>
            <Input placeholder="如：世界觀" />
          </Form.Item>
          <Form.Item label="描述（支援富文本、圖片）">
            <RichTextEditor
              value={description}
              onChange={setDescription}
              folder="sections"
              minHeight={150}
            />
          </Form.Item>
          <Form.Item
            name="sortOrder"
            label={<span>排序 <span style={{ fontSize: 12, color: '#999' }}>（1 為最上方，數字越大越後面）</span></span>}
            initialValue={1}
          >
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="isActive" label="啟用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Slides Management Modal */}
      {activeSection && (
        <SlidesModal
          section={activeSection}
          open={slidesModalOpen}
          onClose={() => {
            setSlidesModalOpen(false);
            fetchSections();
          }}
        />
      )}
    </div>
  );
}
