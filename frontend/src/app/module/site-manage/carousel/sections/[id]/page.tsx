'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  Spin,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  PlayCircleOutlined,
  ArrowLeftOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import ImageUpload from '@/components/ui/ImageUpload';
import RichTextEditor from '@/components/ui/RichTextEditor';
import {
  getSections,
  updateSection,
  getSectionSlides,
  createSectionSlide,
  updateSlide,
  deleteSlide,
} from '@/lib/api/site-manage';
import type { SiteSection, CarouselSlide } from '@/lib/types';

const { Title, Text } = Typography;

export default function SectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sectionId = params.id as string;

  // Section state
  const [section, setSection] = useState<SiteSection | null>(null);
  const [sectionLoading, setSectionLoading] = useState(true);
  const [sectionForm] = Form.useForm();
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Slides state
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [slidesLoading, setSlidesLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<CarouselSlide | null>(null);
  const [slideForm] = Form.useForm();
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [linkEnabled, setLinkEnabled] = useState(false);

  // Fetch section info
  const fetchSection = useCallback(async () => {
    try {
      const sections = await getSections();
      const found = sections.find((s) => s.id === sectionId);
      if (!found) {
        message.error('找不到該區塊');
        router.push('/module/site-manage/carousel/sections');
        return;
      }
      setSection(found);
      sectionForm.setFieldsValue(found);
      setDescription(found.description || '');
    } catch {
      message.error('載入區塊失敗');
    } finally {
      setSectionLoading(false);
    }
  }, [sectionId, sectionForm, router]);

  // Fetch slides
  const fetchSlides = useCallback(async () => {
    try {
      const data = await getSectionSlides(sectionId);
      setSlides(data);
    } catch {
      message.error('載入輪播失敗');
    } finally {
      setSlidesLoading(false);
    }
  }, [sectionId]);

  useEffect(() => {
    fetchSection();
    fetchSlides();
  }, [fetchSection, fetchSlides]);

  // Save section info
  const handleSaveSection = async () => {
    try {
      setSaving(true);
      const values = await sectionForm.validateFields();
      const dto = { ...values, description };
      await updateSection(sectionId, dto);
      message.success('區塊資訊已更新');
      fetchSection();
    } catch {
      message.error('更新失敗');
    } finally {
      setSaving(false);
    }
  };

  // Slide modal
  const openSlideModal = (slide?: CarouselSlide) => {
    if (slide) {
      setEditingSlide(slide);
      setMediaType(slide.mediaType || 'image');
      setImageUrl(slide.imageUrl || '');
      setVideoUrl(slide.videoUrl || '');
      setLinkEnabled(slide.linkEnabled || false);
      slideForm.setFieldsValue({
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
      slideForm.resetFields();
    }
    setEditModalOpen(true);
  };

  const handleSlideSubmit = async () => {
    try {
      const values = await slideForm.validateFields();
      const dto = {
        ...values,
        mediaType,
        imageUrl: mediaType === 'image' ? imageUrl : undefined,
        videoUrl: mediaType === 'video' ? videoUrl : undefined,
        linkEnabled,
        linkUrl: linkEnabled ? values.linkUrl : undefined,
      };

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
        await createSectionSlide(sectionId, dto);
        message.success('已新增');
      }
      setEditModalOpen(false);
      fetchSlides();
    } catch {
      message.error('操作失敗');
    }
  };

  const handleDeleteSlide = async (id: string) => {
    try {
      await deleteSlide(id);
      message.success('已刪除');
      fetchSlides();
    } catch {
      message.error('刪除失敗');
    }
  };

  if (sectionLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!section) return null;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push('/module/site-manage/carousel/sections')}
        >
          返回列表
        </Button>
        <Title level={3} style={{ margin: 0 }}>
          {section.name}
        </Title>
      </div>

      {/* Section Info Card */}
      <Card title="區塊資訊" style={{ marginBottom: 24 }}>
        <Form form={sectionForm} layout="vertical">
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
          <Space>
            <Form.Item
              name="sortOrder"
              label={<span>排序 <span style={{ fontSize: 12, color: '#999' }}>（1 為最上方）</span></span>}
              style={{ marginBottom: 0 }}
            >
              <InputNumber min={1} />
            </Form.Item>
            <Form.Item name="isActive" label="啟用" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Switch />
            </Form.Item>
          </Space>
        </Form>
        <div style={{ marginTop: 16 }}>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveSection} loading={saving}>
            儲存區塊資訊
          </Button>
        </div>
      </Card>

      {/* Slides Card */}
      <Card
        title={`圖片／影片輪播管理（${slides.length} 張）`}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openSlideModal()}>
            新增輪播
          </Button>
        }
      >
        <Table
          loading={slidesLoading}
          dataSource={slides}
          rowKey="id"
          size="small"
          locale={{
            emptyText: (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <PictureOutlined style={{ fontSize: 40, color: '#d9d9d9', marginBottom: 12 }} />
                <div style={{ fontSize: 14, color: '#999', marginBottom: 8 }}>尚未新增輪播</div>
                <div style={{ fontSize: 12, color: '#bbb', marginBottom: 16 }}>
                  點擊上方「新增輪播」按鈕新增圖片或影片
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openSlideModal()}>
                  新增第一張輪播
                </Button>
              </div>
            ),
          }}
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
              render: (v: string) => (v === 'video' ? '影片' : '圖片'),
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
                  <Button size="small" icon={<EditOutlined />} onClick={() => openSlideModal(record)} />
                  <Popconfirm title="確定刪除？" onConfirm={() => handleDeleteSlide(record.id)}>
                    <Button size="small" icon={<DeleteOutlined />} danger />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* Slide Edit Modal */}
      <Modal
        title={editingSlide ? '編輯輪播' : '新增輪播'}
        open={editModalOpen}
        onOk={handleSlideSubmit}
        onCancel={() => setEditModalOpen(false)}
        width={600}
      >
        <Form form={slideForm} layout="vertical">
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

          <Form.Item name="autoPlaySeconds" label="自動輪播秒數" initialValue={6}>
            <InputNumber min={1} max={60} addonAfter="秒" style={{ width: 160 }} />
          </Form.Item>

          <Form.Item label="點擊是否連結">
            <Switch
              checked={linkEnabled}
              onChange={setLinkEnabled}
              checkedChildren="開"
              unCheckedChildren="關"
            />
          </Form.Item>

          {linkEnabled && (
            <Form.Item name="linkUrl" label="連結網址（點擊後開啟新分頁）" rules={[{ required: true, message: '請輸入連結網址' }]}>
              <Input placeholder="https://example.com" />
            </Form.Item>
          )}

          <Form.Item
            name="sortOrder"
            label={<span>排序 <span style={{ fontSize: 12, color: '#999' }}>（設定 1 為最上方，數字越大權重越小）</span></span>}
            initialValue={1}
          >
            <InputNumber min={1} style={{ width: 160 }} />
          </Form.Item>

          <Form.Item name="isActive" label="啟用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
