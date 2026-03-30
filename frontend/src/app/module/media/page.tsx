'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Button, Upload, Select, Card, Space, message, Modal, Spin, Empty, Tooltip, Input, Popconfirm,
} from 'antd';
import {
  UploadOutlined, CopyOutlined, DeleteOutlined, PlayCircleOutlined,
  FileImageOutlined, VideoCameraOutlined, EyeOutlined, InboxOutlined,
} from '@ant-design/icons';
import { uploadFile, listMedia, deleteMedia } from '@/lib/api/site-manage';
import type { MediaItem } from '@/lib/api/site-manage';
import { useAuth } from '@/components/providers/AuthProvider';

const { Title, Text } = Typography;
const { Dragger } = Upload;

/** 從 objectName 解析資料夾名稱 */
function getFolder(objectName: string): string {
  const parts = objectName.split('/');
  return parts.length > 1 ? parts[0] : 'general';
}

/** 從 objectName 取得檔案名稱 */
function getFileName(objectName: string): string {
  const parts = objectName.split('/');
  return parts[parts.length - 1];
}

/** 判斷是否為影片 */
function isVideo(objectName: string): boolean {
  return /\.(mp4|webm|mov|avi|mkv)$/i.test(objectName);
}

/** 格式化檔案大小 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FOLDER_OPTIONS = [
  { value: '', label: '全部資料夾' },
  { value: 'hero', label: '輪播素材' },
  { value: 'general', label: '一般' },
  { value: 'products', label: '商品' },
  { value: 'site', label: '網站設定' },
  { value: 'articles', label: '文章' },
];

const TYPE_OPTIONS = [
  { value: '', label: '全部類型' },
  { value: 'image', label: '圖片' },
  { value: 'video', label: '影片' },
];

export default function MediaLibraryPage() {
  const { user } = useAuth();
  const hasManage = user?.permissions?.includes('module.originals.media.manage');
  const canUpload = hasManage && user?.permissions?.includes('module.originals.content.create');

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [folder, setFolder] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewIsVideo, setPreviewIsVideo] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMedia(folder || undefined);
      // 按最新修改排序
      data.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
      setItems(data);
    } catch {
      message.error('載入媒體庫失敗');
    } finally {
      setLoading(false);
    }
  }, [folder]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // 前端類型篩選
  const filteredItems = typeFilter
    ? items.filter((item) => (typeFilter === 'video' ? isVideo(item.objectName) : !isVideo(item.objectName)))
    : items;

  const handleUpload = async (file: File) => {
    const targetFolder = folder || 'general';
    setUploading(true);
    try {
      await uploadFile(file, targetFolder);
      message.success('上傳成功');
      fetchItems();
    } catch {
      message.error('上傳失敗');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (objectName: string) => {
    try {
      await deleteMedia(objectName);
      message.success('已刪除');
      setItems((prev) => prev.filter((i) => i.objectName !== objectName));
    } catch {
      message.error('刪除失敗');
    }
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    message.success('已複製連結');
  };

  const handlePreview = (item: MediaItem) => {
    setPreviewUrl(item.url);
    setPreviewIsVideo(isVideo(item.objectName));
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>媒體庫</Title>
        <Space>
          <Select
            value={folder}
            onChange={setFolder}
            options={FOLDER_OPTIONS}
            style={{ width: 140 }}
          />
          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            options={TYPE_OPTIONS}
            style={{ width: 120 }}
          />
        </Space>
      </div>

      {/* 上傳區域 */}
      {canUpload && (
        <Card size="small" style={{ marginBottom: 20 }}>
          <Dragger
            accept="image/*,video/*"
            multiple
            showUploadList={false}
            customRequest={async ({ file, onSuccess, onError }) => {
              try {
                await handleUpload(file as File);
                onSuccess?.(null);
              } catch (e) {
                onError?.(e as Error);
              }
            }}
            disabled={uploading}
            style={{ padding: '8px 0' }}
          >
            <p style={{ marginBottom: 8 }}>
              <InboxOutlined style={{ fontSize: 36, color: '#1677ff' }} />
            </p>
            <p style={{ fontSize: 14 }}>
              {uploading ? '上傳中...' : '點擊或拖曳檔案上傳（圖片 / 影片，最大 100MB）'}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
              上傳至：{FOLDER_OPTIONS.find((f) => f.value === (folder || 'general'))?.label || folder || 'general'}
            </p>
          </Dragger>
        </Card>
      )}

      {/* 檔案列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : filteredItems.length === 0 ? (
        <Empty description="此篩選條件下尚無檔案" />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16,
          }}
        >
          {filteredItems.map((item) => {
            const video = isVideo(item.objectName);
            return (
              <Card
                key={item.objectName}
                size="small"
                hoverable
                style={{ overflow: 'hidden' }}
                cover={
                  <div
                    style={{
                      height: 140,
                      background: '#1a1a1a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      cursor: 'pointer',
                      overflow: 'hidden',
                    }}
                    onClick={() => handlePreview(item)}
                  >
                    {video ? (
                      <>
                        <video
                          src={item.url}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          muted
                          preload="metadata"
                        />
                        <PlayCircleOutlined
                          style={{
                            position: 'absolute',
                            fontSize: 36,
                            color: 'rgba(255,255,255,0.8)',
                            textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                          }}
                        />
                      </>
                    ) : (
                      <img
                        src={item.url}
                        alt={getFileName(item.objectName)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}
                    {/* 類型標籤 */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 6,
                        left: 6,
                        background: video ? 'rgba(114,46,209,0.85)' : 'rgba(22,119,255,0.85)',
                        borderRadius: 4,
                        padding: '2px 6px',
                        fontSize: 10,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      {video ? <VideoCameraOutlined /> : <FileImageOutlined />}
                      {video ? '影片' : '圖片'}
                    </div>
                    {/* 資料夾標籤 */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        background: 'rgba(0,0,0,0.6)',
                        borderRadius: 4,
                        padding: '2px 6px',
                        fontSize: 10,
                        color: 'rgba(255,255,255,0.7)',
                      }}
                    >
                      {getFolder(item.objectName)}
                    </div>
                  </div>
                }
                actions={[
                  <Tooltip title="預覽" key="preview">
                    <EyeOutlined onClick={() => handlePreview(item)} />
                  </Tooltip>,
                  <Tooltip title="複製連結" key="copy">
                    <CopyOutlined onClick={() => handleCopy(item.url)} />
                  </Tooltip>,
                  ...(hasManage
                    ? [
                        <Popconfirm
                          key="delete"
                          title="確定刪除此檔案？"
                          onConfirm={() => handleDelete(item.objectName)}
                          okText="刪除"
                          cancelText="取消"
                        >
                          <Tooltip title="刪除">
                            <DeleteOutlined style={{ color: '#ff4d4f' }} />
                          </Tooltip>
                        </Popconfirm>,
                      ]
                    : []),
                ]}
              >
                <Card.Meta
                  title={
                    <Tooltip title={getFileName(item.objectName)}>
                      <Text ellipsis style={{ fontSize: 12 }}>
                        {getFileName(item.objectName)}
                      </Text>
                    </Tooltip>
                  }
                  description={
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                      {formatSize(item.size)} &middot;{' '}
                      {new Date(item.lastModified).toLocaleDateString('zh-TW')}
                    </div>
                  }
                />
                {/* 點擊複製的 URL 欄位 */}
                <Input
                  size="small"
                  value={item.url}
                  readOnly
                  style={{ marginTop: 8, fontSize: 11, fontFamily: 'monospace' }}
                  suffix={
                    <CopyOutlined
                      style={{ color: '#1677ff', cursor: 'pointer' }}
                      onClick={() => handleCopy(item.url)}
                    />
                  }
                  onClick={() => handleCopy(item.url)}
                />
              </Card>
            );
          })}
        </div>
      )}

      {/* 預覽 Modal */}
      <Modal
        open={!!previewUrl}
        footer={
          previewUrl ? (
            <Space>
              <Button
                icon={<CopyOutlined />}
                onClick={() => handleCopy(previewUrl)}
              >
                複製連結
              </Button>
              <Button onClick={() => setPreviewUrl(null)}>關閉</Button>
            </Space>
          ) : null
        }
        onCancel={() => setPreviewUrl(null)}
        width={800}
        centered
        destroyOnClose
      >
        {previewUrl && (
          previewIsVideo ? (
            <video
              src={previewUrl}
              controls
              autoPlay
              style={{ width: '100%', borderRadius: 8 }}
            />
          ) : (
            <img
              src={previewUrl}
              alt="preview"
              style={{ width: '100%', borderRadius: 8 }}
            />
          )
        )}
      </Modal>
    </div>
  );
}
