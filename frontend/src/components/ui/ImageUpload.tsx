'use client';

import { useState } from 'react';
import { Upload, Button, Image, message, Space } from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import { uploadFile } from '@/lib/api/site-manage';

interface ImageUploadProps {
  value?: string;
  onChange?: (url: string) => void;
  folder?: string;
}

export default function ImageUpload({
  value,
  onChange,
  folder = 'general',
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

  return (
    <div>
      {value && (
        <div style={{ marginBottom: 8 }}>
          <Image
            src={value}
            alt="preview"
            width={200}
            style={{ borderRadius: 8, objectFit: 'cover' }}
          />
        </div>
      )}
      <Space>
        <Upload
          showUploadList={false}
          customRequest={({ file }) => handleUpload({ file: file as File })}
          accept="image/*,video/*"
        >
          <Button icon={<UploadOutlined />} loading={loading}>
            {value ? '更換圖片' : '上傳圖片'}
          </Button>
        </Upload>
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
