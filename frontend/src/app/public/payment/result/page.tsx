'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Result, Button, Spin, Card, Typography } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import Link from 'next/link';

const { Text } = Typography;

function PaymentResultContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const rtnCode = searchParams.get('RtnCode');
  const rtnMsg = searchParams.get('RtnMsg');

  // 判斷付款結果
  // ECPay OrderResultURL 會帶 RtnCode, RtnMsg 等參數
  // 也可能只帶 orderId（內部跳轉）
  const getStatus = () => {
    if (rtnCode === '1') return 'success';
    if (rtnCode && rtnCode !== '1') return 'failed';
    // 沒有 rtnCode 但有 orderId，表示從商城跳轉過來，狀態待確認
    if (orderId) return 'pending';
    return 'unknown';
  };

  const status = getStatus();

  if (status === 'success') {
    return (
      <Result
        icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
        title="付款成功！"
        subTitle={
          <div>
            <p>您的訂單已付款成功，鑽石將自動發放到您的遊戲帳號。</p>
            {orderId && (
              <p>
                訂單編號：<Text code>{orderId}</Text>
              </p>
            )}
          </div>
        }
        extra={[
          <Link href="/public/shop" key="shop">
            <Button type="primary" size="large">
              繼續購物
            </Button>
          </Link>,
          <Link href="/public/profile" key="profile">
            <Button size="large">查看訂單</Button>
          </Link>,
        ]}
      />
    );
  }

  if (status === 'failed') {
    return (
      <Result
        icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
        title="付款失敗"
        subTitle={
          <div>
            <p>很抱歉，您的付款未成功。</p>
            {rtnMsg && (
              <p>
                錯誤訊息：<Text type="danger">{rtnMsg}</Text>
              </p>
            )}
            <p>請稍後再試，或選擇其他付款方式。</p>
          </div>
        }
        extra={[
          <Link href="/public/shop" key="shop">
            <Button type="primary" size="large">
              返回商城
            </Button>
          </Link>,
        ]}
      />
    );
  }

  if (status === 'pending') {
    return (
      <Result
        icon={<ClockCircleOutlined style={{ color: '#faad14' }} />}
        title="付款處理中"
        subTitle={
          <div>
            <p>您的付款正在處理中，請稍候。</p>
            {orderId && (
              <p>
                訂單編號：<Text code>{orderId}</Text>
              </p>
            )}
            <p>付款成功後，鑽石將自動發放到您的遊戲帳號。</p>
          </div>
        }
        extra={[
          <Link href="/public/profile" key="profile">
            <Button type="primary" size="large">
              查看訂單狀態
            </Button>
          </Link>,
          <Link href="/public/shop" key="shop">
            <Button size="large">返回商城</Button>
          </Link>,
        ]}
      />
    );
  }

  return (
    <Result
      title="頁面載入異常"
      subTitle="找不到訂單資訊，請返回商城重新操作。"
      extra={
        <Link href="/public/shop">
          <Button type="primary" size="large">
            返回商城
          </Button>
        </Link>
      }
    />
  );
}

export default function PaymentResultPage() {
  return (
    <div style={{ maxWidth: 800, margin: '60px auto', padding: '0 16px' }}>
      <Card>
        <Suspense
          fallback={
            <div style={{ textAlign: 'center', padding: 60 }}>
              <Spin size="large" />
            </div>
          }
        >
          <PaymentResultContent />
        </Suspense>
      </Card>
    </div>
  );
}
