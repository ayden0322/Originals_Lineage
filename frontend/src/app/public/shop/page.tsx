'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Row, Col, Tag, Button, Typography, Modal, Spin, Empty, message, Tabs, Space, Radio, Alert } from 'antd';
import { ShoppingCartOutlined, GiftOutlined } from '@ant-design/icons';

/** 將後端 decimal(10,2) 字串/數字格式化為「NT$ 1,234」(整數金額) */
function formatPrice(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(num)) return 'NT$ 0';
  return `NT$ ${Math.round(num).toLocaleString('zh-TW')}`;
}
import { getPublicProducts, createOrder, getPublicPaymentMethods, type PublicPaymentMethod } from '@/lib/api/shop';
import { getAccessToken } from '@/lib/api/client';
import { useShopConfig } from '@/components/providers/ShopConfigProvider';
import type { Product, PaymentResult, ProductCategory } from '@/lib/types';

const { Title, Paragraph, Text } = Typography;

const CATEGORY_TABS: { key: ProductCategory; label: string; color: string }[] = [
  { key: 'diamond', label: '鑽石', color: 'blue' },
  { key: 'game_item', label: '遊戲禮包', color: 'purple' },
  { key: 'monthly_card', label: '月卡', color: 'gold' },
];

const WEEKDAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

function formatLimits(p: Product): string[] {
  const tags: string[] = [];
  if (p.dailyLimit != null) tags.push(`每日 ${p.dailyLimit} 次`);
  if (p.weeklyLimit != null && p.weeklyResetDay != null && p.weeklyResetHour != null) {
    tags.push(`每週 ${p.weeklyLimit} 次（${WEEKDAY_LABELS[p.weeklyResetDay]} ${String(p.weeklyResetHour).padStart(2, '0')}:00 重置）`);
  }
  if (p.monthlyLimit != null) tags.push(`每月 ${p.monthlyLimit} 次`);
  if (p.accountLimit > 0) tags.push(`帳號限購 ${p.accountLimit} 次`);
  if (p.requiredLevel != null) tags.push(`需角色 Lv ≥ ${p.requiredLevel}`);
  return tags;
}

function handlePaymentRedirect(payment: PaymentResult) {
  if (payment.formAction && payment.formData) {
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
    window.location.href = payment.paymentUrl;
  }
}

export default function ShopPage() {
  const router = useRouter();
  const { config: shopConfig } = useShopConfig();
  const heroSettings = shopConfig.settings;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ProductCategory>('diamond');

  // 購買 Modal 狀態
  const [buyingProduct, setBuyingProduct] = useState<Product | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PublicPaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<'atm' | 'cvs' | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsLoggedIn(!!getAccessToken('player'));
    }
    (async () => {
      try {
        const [prods, methods] = await Promise.all([
          getPublicProducts(),
          getPublicPaymentMethods().catch(() => [] as PublicPaymentMethod[]),
        ]);
        setProducts(prods);
        setPaymentMethods(methods);
      } catch {
        message.error('載入商品失敗');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredProducts = useMemo(
    () => products.filter((p) => p.category === activeCategory),
    [products, activeCategory],
  );

  const openBuyModal = (product: Product) => {
    if (paymentMethods.length === 0) {
      message.error('目前沒有可用的付款方式，請聯絡管理者');
      return;
    }
    setBuyingProduct(product);
    setSelectedMethod(paymentMethods[0].method); // 預設第一個
  };

  const handleConfirmBuy = async () => {
    if (!buyingProduct || !selectedMethod) return;
    setPurchaseLoading(true);
    try {
      const result = await createOrder(
        [{ productId: buyingProduct.id, quantity: 1 }],
        selectedMethod,
      );
      const { payment } = result;
      if (payment.formAction || payment.paymentUrl) {
        message.loading('正在跳轉到付款頁面...', 3);
        setTimeout(() => handlePaymentRedirect(payment), 500);
      } else {
        message.success('訂單建立成功！');
      }
      setBuyingProduct(null);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      message.error(error?.response?.data?.message || '購買失敗，請稍後再試');
    } finally {
      setPurchaseLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 120 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 'var(--header-total-height, 89px)' }}>
      {/* ─── Hero 區（後台美編設定） ─────────────────────────────── */}
      {heroSettings.heroEnabled && (
        <div
          style={{
            minHeight: heroSettings.heroHeight,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '32px 16px',
            marginBottom: 32,
            color: heroSettings.heroTextColor,
            background: heroSettings.heroBgImageUrl
              ? `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url("${heroSettings.heroBgImageUrl}") center/cover no-repeat`
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          <Title
            level={2}
            style={{ marginBottom: 8, color: heroSettings.heroTextColor }}
          >
            <GiftOutlined style={{ marginRight: 8 }} />
            {heroSettings.heroTitle}
          </Title>
          <Paragraph
            style={{
              fontSize: 16,
              marginBottom: 16,
              color: heroSettings.heroTextColor,
              opacity: 0.85,
            }}
          >
            {heroSettings.heroSubtitle}
          </Paragraph>
          {!isLoggedIn && (
            <Alert
              type="warning"
              showIcon
              message="請先登入後才能購買商品"
              style={{ maxWidth: 360, margin: '0 auto' }}
            />
          )}
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

      <Tabs
        activeKey={activeCategory}
        onChange={(k) => setActiveCategory(k as ProductCategory)}
        centered
        size="large"
        style={{ marginBottom: 16 }}
        items={CATEGORY_TABS.map((c) => ({ key: c.key, label: c.label }))}
      />

      {filteredProducts.length === 0 ? (
        <Empty description="此分類目前沒有商品" style={{ padding: '80px 0' }} />
      ) : (
        <Row gutter={[24, 24]} align="stretch">
          {filteredProducts.map((product) => {
            const limitTags = formatLimits(product);
            return (
              <Col xs={24} sm={12} md={8} lg={6} key={product.id} style={{ display: 'flex' }}>
                <Card
                  hoverable
                  style={{ borderRadius: 12, display: 'flex', flexDirection: 'column', width: '100%' }}
                  styles={{ body: { display: 'flex', flexDirection: 'column', flex: 1 } }}
                  cover={
                    product.imageUrl ? (
                      <img alt={product.name} src={product.imageUrl} style={{ height: 180, objectFit: 'cover' }} />
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
                    <div style={{ marginBottom: 8 }}>
                      {product.category === 'diamond' ? (
                        <Text strong style={{ color: '#1677ff', fontSize: 14 }}>
                          💎 {product.diamondAmount} 鑽石
                        </Text>
                      ) : (
                        <Text strong style={{ color: '#722ed1', fontSize: 14 }}>
                          🎁 {product.gameItemName} x{product.gameItemQuantity}
                        </Text>
                      )}
                    </div>
                    {limitTags.length > 0 && (
                      <Space size={[4, 4]} wrap style={{ marginBottom: 12 }}>
                        {limitTags.map((t) => (
                          <Tag key={t} color="orange" style={{ fontSize: 11 }}>
                            {t}
                          </Tag>
                        ))}
                      </Space>
                    )}
                    <div style={{ marginBottom: 16 }}>
                      <Text strong style={{ color: '#cf1322', fontSize: 20 }}>
                        {formatPrice(product.price)}
                      </Text>
                    </div>
                  </div>
                  {/*
                    未登入時不使用 disabled，避免 antd 深色 disabled 配色
                    （bg rgba(255,255,255,0.08) + color 0.25）在深灰 Card 上
                    對比幾乎為零、按鈕「看不到」。改成可點擊導去登入頁。
                  */}
                  <Button
                    type="primary"
                    icon={<ShoppingCartOutlined />}
                    block
                    size="large"
                    onClick={() => {
                      if (isLoggedIn) {
                        openBuyModal(product);
                      } else {
                        router.push('/auth/login?redirect=/public/shop');
                      }
                    }}
                  >
                    {isLoggedIn ? '購買' : '前往登入'}
                  </Button>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
      </div>

      {/* ─── 購買確認 Modal ──────────────────────────────────── */}
      <Modal
        title="確認購買"
        open={!!buyingProduct}
        onCancel={() => setBuyingProduct(null)}
        onOk={handleConfirmBuy}
        confirmLoading={purchaseLoading}
        okText="確認購買"
        cancelText="取消"
      >
        {buyingProduct && (
          <div>
            <Paragraph>
              您即將購買 <Text strong>{buyingProduct.name}</Text>
            </Paragraph>
            <Paragraph>
              價格：<Text strong style={{ color: '#cf1322' }}>{formatPrice(buyingProduct.price)}</Text>
            </Paragraph>
            {buyingProduct.category === 'diamond' ? (
              <Paragraph>
                鑽石數量：<Text strong style={{ color: '#1677ff' }}>{buyingProduct.diamondAmount}</Text> 顆
              </Paragraph>
            ) : (
              <Paragraph>
                發放道具：<Text strong style={{ color: '#722ed1' }}>{buyingProduct.gameItemName}</Text> x{buyingProduct.gameItemQuantity}
              </Paragraph>
            )}
            <div style={{ marginTop: 16 }}>
              <Text strong>付款方式：</Text>
              <div style={{ marginTop: 12 }}>
                <Radio.Group
                  value={selectedMethod}
                  onChange={(e) => setSelectedMethod(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    {paymentMethods.map((m) => (
                      <Radio key={m.method} value={m.method}>
                        {m.label}
                      </Radio>
                    ))}
                  </Space>
                </Radio.Group>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
