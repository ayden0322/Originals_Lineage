'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, Row, Col, Tag, Button, Typography, Modal, Spin, Empty, message } from 'antd';
import { ShoppingCartOutlined, GiftOutlined } from '@ant-design/icons';
import { getPublicProducts, createOrder } from '@/lib/api/shop';
import { getAccessToken } from '@/lib/api/client';
import type { Product, PaymentResult } from '@/lib/types';

const { Title, Paragraph, Text } = Typography;

const categoryLabelMap: Record<Product['category'], string> = {
  diamond_pack: '鑽石禮包',
  special_bundle: '特別組合',
  event_pack: '活動限定',
};

const categoryColorMap: Record<Product['category'], string> = {
  diamond_pack: 'blue',
  special_bundle: 'purple',
  event_pack: 'gold',
};

/**
 * 處理付款跳轉
 * - ECPay 等表單提交型：建立隱藏表單 → 自動 POST 到金流頁
 * - Stripe 等網址跳轉型：直接 window.location.href
 * - Mock：顯示成功訊息
 */
function handlePaymentRedirect(payment: PaymentResult) {
  if (payment.formAction && payment.formData) {
    // 表單提交模式（ECPay）
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = payment.formAction;
    form.style.display = 'none';

    for (const [key, value] of Object.entries(payment.formData)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value;
      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
  } else if (payment.paymentUrl) {
    // 網址跳轉模式
    window.location.href = payment.paymentUrl;
  }
  // Mock 模式：不跳轉，留在原頁
}

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = getAccessToken('player');
      setIsLoggedIn(!!token);
    }

    const fetchProducts = async () => {
      try {
        const result = await getPublicProducts();
        setProducts(result);
      } catch {
        message.error('載入商品失敗');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleBuy = (product: Product) => {
    Modal.confirm({
      title: '確認購買',
      content: (
        <div>
          <Paragraph>
            您即將購買 <Text strong>{product.name}</Text>
          </Paragraph>
          <Paragraph>
            價格：<Text strong style={{ color: '#cf1322' }}>NT$ {product.price}</Text>
          </Paragraph>
          <Paragraph>
            鑽石數量：<Text strong style={{ color: '#1677ff' }}>{product.diamondAmount}</Text> 顆
          </Paragraph>
        </div>
      ),
      okText: '確認購買',
      cancelText: '取消',
      onOk: async () => {
        setPurchaseLoading(true);
        try {
          const result = await createOrder([{ productId: product.id, quantity: 1 }]);
          const { payment } = result;

          // 根據金流回傳決定跳轉方式
          if (payment.formAction || payment.paymentUrl) {
            message.loading('正在跳轉到付款頁面...', 3);
            setTimeout(() => handlePaymentRedirect(payment), 500);
          } else {
            // Mock 模式
            message.success('訂單建立成功！');
          }
        } catch (err: unknown) {
          const error = err as { response?: { data?: { message?: string } } };
          message.error(error?.response?.data?.message || '購買失敗，請稍後再試');
        } finally {
          setPurchaseLoading(false);
        }
      },
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 120 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingTop: 'var(--header-total-height, 89px)' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <Title level={2}>
          <GiftOutlined style={{ marginRight: 8 }} />
          鑽石商城
        </Title>
        <Paragraph type="secondary" style={{ fontSize: 16 }}>
          選購超值鑽石禮包，開啟您的冒險之旅
        </Paragraph>
        {!isLoggedIn && (
          <Paragraph type="warning" style={{ fontSize: 14 }}>
            請先登入後才能購買商品
          </Paragraph>
        )}
      </div>

      {products.length === 0 ? (
        <Empty description="目前沒有上架商品" style={{ paddingTop: 60 }} />
      ) : (
        <Row gutter={[24, 24]}>
          {products.map((product) => (
            <Col xs={24} sm={12} md={8} lg={6} key={product.id}>
              <Card
                hoverable
                style={{ borderRadius: 12, height: '100%' }}
                styles={{ body: { display: 'flex', flexDirection: 'column', height: '100%' } }}
                cover={
                  product.imageUrl ? (
                    <img
                      alt={product.name}
                      src={product.imageUrl}
                      style={{ height: 180, objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        height: 180,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <GiftOutlined style={{ fontSize: 48, color: '#fff' }} />
                    </div>
                  )
                }
              >
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: 8 }}>
                    <Tag color={categoryColorMap[product.category]}>
                      {categoryLabelMap[product.category]}
                    </Tag>
                  </div>
                  <Title level={5} style={{ marginBottom: 4 }}>
                    {product.name}
                  </Title>
                  <Paragraph
                    type="secondary"
                    ellipsis={{ rows: 2 }}
                    style={{ marginBottom: 12, minHeight: 44 }}
                  >
                    {product.description}
                  </Paragraph>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong style={{ color: '#1677ff', fontSize: 14 }}>
                      <GiftOutlined /> {product.diamondAmount} 鑽石
                    </Text>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ color: '#cf1322', fontSize: 20 }}>
                      NT$ {product.price}
                    </Text>
                  </div>
                </div>
                <Button
                  type="primary"
                  icon={<ShoppingCartOutlined />}
                  block
                  size="large"
                  disabled={!isLoggedIn}
                  loading={purchaseLoading}
                  onClick={() => handleBuy(product)}
                >
                  {isLoggedIn ? '購買' : '請先登入'}
                </Button>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
