'use client';

import { useEffect, useState } from 'react';
import { Modal, Button, Alert, Typography, Space, Divider, message } from 'antd';
import { CopyOutlined, BankOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { VirtualAccountInfo } from '@/lib/types';

const { Text, Paragraph } = Typography;

interface Props {
  open: boolean;
  info: VirtualAccountInfo | null;
  onClose: () => void;
}

function formatMoney(amount: number): string {
  return `NT$ ${Math.round(amount).toLocaleString('zh-TW')}`;
}

/**
 * 虛擬帳戶倒數顯示
 * expireDate 格式依金流商而定，tw92 通常回 "YYYY-MM-DD HH:mm:ss"
 */
function useCountdown(expireDate?: string) {
  const [remaining, setRemaining] = useState<string>('');

  useEffect(() => {
    if (!expireDate) {
      setRemaining('');
      return;
    }
    // 將 "YYYY-MM-DD HH:mm:ss" 轉為瀏覽器可解析格式（加 T、假設為本地時間）
    const normalized = expireDate.includes('T')
      ? expireDate
      : expireDate.replace(' ', 'T');
    const target = new Date(normalized).getTime();
    if (Number.isNaN(target)) {
      setRemaining('');
      return;
    }

    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setRemaining('已過期');
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      const parts: string[] = [];
      if (days > 0) parts.push(`${days} 天`);
      if (hours > 0 || days > 0) parts.push(`${hours} 小時`);
      parts.push(`${minutes} 分`, `${seconds} 秒`);
      setRemaining(parts.join(' '));
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expireDate]);

  return remaining;
}

export default function VirtualAccountModal({ open, info, onClose }: Props) {
  const remaining = useCountdown(info?.expireDate);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      message.success(`已複製${label}`);
    } catch {
      message.error('複製失敗，請手動選取');
    }
  };

  if (!info) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <span>
          <BankOutlined style={{ marginRight: 8 }} />
          請於期限內完成轉帳
        </span>
      }
      footer={
        <Button type="primary" onClick={onClose}>
          我已記下帳號
        </Button>
      }
      width={480}
      maskClosable={false}
    >
      <Alert
        type="warning"
        showIcon
        message="此帳號為本筆訂單專屬虛擬帳號"
        description="請務必轉帳「完全相符」的金額，金額不符將無法自動核銷。"
        style={{ marginBottom: 16 }}
      />

      <div style={{ background: '#fafafa', padding: 16, borderRadius: 8 }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <Text type="secondary">匯款銀行</Text>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>
              {info.bankName ? `${info.bankName}（${info.bankNumber}）` : info.bankNumber}
            </div>
          </div>

          <Divider style={{ margin: '4px 0' }} />

          <div>
            <Text type="secondary">虛擬帳號</Text>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 4,
              }}
            >
              <Text
                copyable={false}
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  letterSpacing: 2,
                  fontFamily: 'monospace',
                }}
              >
                {info.accountNumber}
              </Text>
              <Button
                icon={<CopyOutlined />}
                size="small"
                onClick={() => copy(info.accountNumber, '帳號')}
              >
                複製
              </Button>
            </div>
          </div>

          <Divider style={{ margin: '4px 0' }} />

          <div>
            <Text type="secondary">應繳金額</Text>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 4,
              }}
            >
              <Text strong style={{ fontSize: 22, color: '#cf1322' }}>
                {formatMoney(info.amount)}
              </Text>
              <Button
                icon={<CopyOutlined />}
                size="small"
                onClick={() => copy(String(Math.round(info.amount)), '金額')}
              >
                複製
              </Button>
            </div>
          </div>

          {info.expireDate && (
            <>
              <Divider style={{ margin: '4px 0' }} />
              <div>
                <Text type="secondary">
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  繳費期限
                </Text>
                <div style={{ marginTop: 4 }}>
                  <div>{info.expireDate}</div>
                  {remaining && (
                    <Text type={remaining === '已過期' ? 'danger' : 'warning'}>
                      剩餘：{remaining}
                    </Text>
                  )}
                </div>
              </div>
            </>
          )}
        </Space>
      </div>

      <Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12 }}>
        完成轉帳後，系統會自動核銷並發放商品。過程約需 1~3 分鐘，可於「我的訂單」查詢狀態。
      </Paragraph>
    </Modal>
  );
}
