'use client';

import { useState } from 'react';
import { Upload, Button, Image, message, Space } from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import ImgCrop from 'antd-img-crop';
import { uploadFile } from '@/lib/api/site-manage';

interface ImageUploadProps {
  value?: string;
  onChange?: (url: string) => void;
  folder?: string;
  /** 啟用上傳前圈選裁切（預設關閉）。若為 true 以正方形 1:1 裁切 */
  crop?: boolean;
  /** 自訂裁切比例，例如 16/9、4/3；僅在 crop=true 時生效 */
  aspect?: number;
  /** 是否允許自由調整長寬比（預設 true） */
  cropAllowFreeAspect?: boolean;
  /** 預覽寬度（px），預設 200 */
  previewWidth?: number;
}

export default function ImageUpload({
  value,
  onChange,
  folder = 'general',
  crop = false,
  aspect = 1,
  cropAllowFreeAspect = true,
  previewWidth = 200,
}: ImageUploadProps) {
  const [loading, setLoading] = useState(false);

  const handleUpload = async (options: { file: File }) => {
    setLoading(true);
    try {
      const result = await uploadFile(options.file, folder);
      onChange?.(result.url);
      message.success('上傳成功');
    } catch {
      message.error('上傳失敗');
    } finally {
      setLoading(false);
    }
  };

  const uploader = (
    <Upload
      showUploadList={false}
      customRequest={({ file }) => handleUpload({ file: file as File })}
      accept="image/*"
    >
      <Button icon={<UploadOutlined />} loading={loading}>
        {value ? '更換圖片' : '上傳圖片'}
      </Button>
    </Upload>
  );

  return (
    <div>
      {value && (
        <div style={{ marginBottom: 8 }}>
          <Image
            src={value}
            alt="preview"
            width={previewWidth}
            style={{ borderRadius: 8, objectFit: 'cover' }}
          />
        </div>
      )}
      <Space>
        {crop ? (
          <ImgCrop
            aspect={aspect}
            aspectSlider={cropAllowFreeAspect}
            showGrid
            showReset
            rotationSlider
            modalTitle="裁切圖片"
            modalOk="確定"
            modalCancel="取消"
          >
            {uploader}
          </ImgCrop>
        ) : (
          uploader
        )}
        {value && (
          <Button
            icon={<DeleteOutlined />}
            danger
            onClick={() => onChange?.('')}
          >
            移除
          </Button>
        )}
      </Space>
    </div>
  );
}
