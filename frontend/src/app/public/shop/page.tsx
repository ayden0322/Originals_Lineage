'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Row,
  Col,
  Tag,
  Button,
  Typography,
  Modal,
  Spin,
  Empty,
  message,
  Space,
  Radio,
  Alert,
  Divider,
  InputNumber,
} from 'antd';
import { ShoppingCartOutlined, GiftOutlined } from '@ant-design/icons';

/** 將後端 decimal(10,2) 字串/數字格式化為「NT$ 1,234」(整數金額) */
function formatPrice(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(num)) return 'NT$ 0';
  return `NT$ ${Math.round(num).toLocaleString('zh-TW')}`;
}
import {
  getPublicProducts,
  createOrder,
  getPublicPaymentMethods,
  type PublicPaymentMethod,
} from '@/lib/api/shop';
import { getAccessToken } from '@/lib/api/client';
import { useShopConfig } from '@/components/providers/ShopConfigProvider';
import PublicFooter from '@/components/public/PublicFooter';
import VirtualAccountModal from '@/components/public/VirtualAccountModal';
import type { Product, PaymentResult, VirtualAccountInfo } from '@/lib/types';

const { Title, Paragraph, Text } = Typography;

const WEEKDAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

function formatLimits(p: Product): string[] {
  const tags: string[] = [];
  if (p.dailyLimit != null) tags.push(`每日 ${p.dailyLimit} 次`);
  if (
    p.weeklyLimit != null &&
    p.weeklyResetDay != null &&
    p.weeklyResetHour != null
  ) {
    tags.push(
      `每週 ${p.weeklyLimit} 次（${WEEKDAY_LABELS[p.weeklyResetDay]} ${String(
        p.weeklyResetHour,
      ).padStart(2, '0')}:00 重置）`,
    );
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
  const settings = shopConfig.settings;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 商品詳細 Modal 狀態
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  // 購買 Modal 狀態
  const [buyingProduct, setBuyingProduct] = useState<Product | null>(null);
  const [buyQuantity, setBuyQuantity] = useState<number>(1);
  const [paymentMethods, setPaymentMethods] = useState<PublicPaymentMethod[]>(
    [],
  );
  const [selectedMethod, setSelectedMethod] = useState<
    'atm' | 'cvs' | 'credit_card' | null
  >(null);
  const [virtualAccount, setVirtualAccount] = useState<VirtualAccountInfo | null>(
    null,
  );

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

  /** 貨幣顯示（icon + 數量 + 名稱），icon 與數字靠近、數字與名稱保留較大間距 */
  const Currency = ({
    amount,
    size = 20,
    fontSize = 14,
  }: {
    amount: number;
    size?: number;
    fontSize?: number;
  }) => (
    <Text
      strong
      style={{
        color: settings.currencyColor,
        display: 'inline-flex',
        alignItems: 'center',
        fontSize,
      }}
    >
      {settings.currencyIconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={settings.currencyIconUrl}
          alt={settings.currencyName}
          style={{
            width: size,
            height: size,
            objectFit: 'contain',
            marginRight: 4,
          }}
        />
      ) : null}
      <span style={{ marginRight: 8 }}>{amount}</span>
      <span>{settings.currencyName}</span>
    </Text>
  );

  function getMinQuantity(product: Product): number {
    const minAmount = Number(product.minPurchaseAmount ?? 0);
    const unitPrice = Number(product.price);
    if (!Number.isFinite(minAmount) || minAmount <= 0) return 1;
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return 1;
    return Math.max(1, Math.ceil(minAmount / unitPrice));
  }

  const openBuyModal = (product: Product) => {
    if (paymentMethods.length === 0) {
      message.error('目前沒有可用的付款方式，請聯絡管理者');
      return;
    }
    setBuyingProduct(product);
    setBuyQuantity(getMinQuantity(product));
    setSelectedMethod(paymentMethods[0].method);
  };

  const handleConfirmBuy = async () => {
    if (!buyingProduct || !selectedMethod) return;
    const minQty = getMinQuantity(buyingProduct);
    if (buyQuantity < minQty) {
      message.warning(`數量需至少 ${minQty} 個（最低購買金額 NT$ ${Number(buyingProduct.minPurchaseAmount).toLocaleString('zh-TW')}）`);
      return;
    }
    setPurchaseLoading(true);
    try {
      const result = await createOrder(
        [{ productId: buyingProduct.id, quantity: buyQuantity }],
        selectedMethod,
      );
      const { payment } = result;
      if (payment.virtualAccount) {
        // tw92 Type 7 虛擬帳戶：顯示專屬帳號資訊
        setBuyingProduct(null);
        setVirtualAccount(payment.virtualAccount);
      } else if (payment.formAction || payment.paymentUrl) {
        message.loading('正在跳轉到付款頁面...', 3);
        setTimeout(() => handlePaymentRedirect(payment), 500);
        setBuyingProduct(null);
      } else {
        const isMock = payment.transactionId?.startsWith('mock_');
        message.success(
          isMock
            ? '訂單建立成功（測試模式，數秒內將自動完成模擬付款）'
            : '訂單建立成功！',
          4,
        );
        setBuyingProduct(null);
      }
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
      {settings.heroEnabled && (
        <div
          style={{
            minHeight: settings.heroHeight,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '32px 16px',
            marginBottom: 32,
            color: settings.heroTextColor,
            background: settings.heroBgImageUrl
              ? `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url("${settings.heroBgImageUrl}") center/cover no-repeat`
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          <Title
            level={2}
            style={{ marginBottom: 8, color: settings.heroTextColor }}
          >
            <GiftOutlined style={{ marginRight: 8 }} />
            {settings.heroTitle}
          </Title>
          <Paragraph
            style={{
              fontSize: 16,
              marginBottom: 16,
              color: settings.heroTextColor,
              opacity: 0.85,
            }}
          >
            {settings.heroSubtitle}
          </Paragraph>
          {!isLoggedIn && (
            <Alert
              type="warning"
              showIcon
              message="請先登入後才能贊助"
              style={{ maxWidth: 360, margin: '0 auto' }}
            />
          )}
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
        {products.length === 0 ? (
          <Empty
            description="目前沒有上架的方案"
            style={{ padding: '80px 0' }}
          />
        ) : (
          <Row gutter={[24, 24]} align="stretch">
            {products.map((product) => {
              const limitTags = formatLimits(product);
              return (
                <Col
                  xs={24}
                  sm={12}
                  md={8}
                  lg={6}
                  key={product.id}
                  style={{ display: 'flex' }}
                >
                  <Card
                    hoverable
                    onClick={() => setDetailProduct(product)}
                    style={{
                      borderRadius: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      width: '100%',
                      cursor: 'pointer',
                    }}
                    styles={{
                      body: {
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1,
                      },
                    }}
                    cover={
                      <div
                        style={{
                          position: 'relative',
                          width: '100%',
                          // 固定 16:9 — 對應後台 ImageUpload 的裁切比例
                          paddingTop: '56.25%',
                          background:
                            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          borderTopLeftRadius: 12,
                          borderTopRightRadius: 12,
                          overflow: 'hidden',
                        }}
                      >
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt={product.name}
                            src={product.imageUrl}
                            style={{
                              position: 'absolute',
                              inset: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <GiftOutlined style={{ fontSize: 48, color: '#fff' }} />
                          </div>
                        )}
                      </div>
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
                        <Currency amount={product.diamondAmount} />
                      </div>
                      {limitTags.length > 0 && (
                        <Space size={[4, 4]} wrap style={{ marginBottom: 12 }}>
                          {limitTags.map((t) => (
                            <Tag
                              key={t}
                              color={settings.accentColor}
                              style={{ fontSize: 11 }}
                            >
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
                    <Button
                      type="primary"
                      icon={<ShoppingCartOutlined />}
                      block
                      size="large"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isLoggedIn) {
                          openBuyModal(product);
                        } else {
                          router.push('/auth/login?redirect=/public/shop');
                        }
                      }}
                    >
                      {isLoggedIn ? '贊助' : '前往登入'}
                    </Button>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </div>

      {/* ─── 商品詳細 Modal ──────────────────────────────────── */}
      <Modal
        title={detailProduct?.name}
        open={!!detailProduct}
        onCancel={() => setDetailProduct(null)}
        footer={null}
        width={720}
      >
        {detailProduct &&
          (() => {
            const limitTags = formatLimits(detailProduct);
            return (
              <div>
                {/* 商品圖片：完全貼合裁切比例（16:9），不加底色/留白 */}
                {detailProduct.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={detailProduct.name}
                    src={detailProduct.imageUrl}
                    style={{
                      width: '100%',
                      height: 'auto',
                      display: 'block',
                      borderRadius: 12,
                      marginBottom: 16,
                    }}
                  />
                )}

                {/* 貨幣（獲得銀票） */}
                <div style={{ marginBottom: 12 }}>
                  <Text strong>獲得：</Text>{' '}
                  <Currency
                    amount={detailProduct.diamondAmount}
                    size={22}
                    fontSize={15}
                  />
                </div>

                {/* 簡短描述 */}
                {detailProduct.description && (
                  <Paragraph type="secondary">{detailProduct.description}</Paragraph>
                )}

                {/* 限購 tag */}
                {limitTags.length > 0 && (
                  <Space size={[4, 6]} wrap style={{ marginBottom: 16 }}>
                    {limitTags.map((t) => (
                      <Tag
                        key={t}
                        color={settings.accentColor}
                        style={{ fontSize: 12 }}
                      >
                        {t}
                      </Tag>
                    ))}
                  </Space>
                )}

                {/* 詳細內容（富文本） */}
                {detailProduct.contentHtml && detailProduct.contentHtml.trim() && (
                  <>
                    <Divider orientation="left" plain>
                      詳細內容
                    </Divider>
                    <div
                      className="shop-content-html"
                      style={{ color: 'rgba(0, 0, 0, 0.85)', marginBottom: 16 }}
                      dangerouslySetInnerHTML={{ __html: detailProduct.contentHtml }}
                    />
                  </>
                )}

                {/* 價格 */}
                <div style={{ marginBottom: 20, marginTop: 16 }}>
                  <Text strong style={{ color: '#cf1322', fontSize: 24 }}>
                    {formatPrice(detailProduct.price)}
                  </Text>
                </div>

                <Button
                  type="primary"
                  icon={<ShoppingCartOutlined />}
                  block
                  size="large"
                  onClick={() => {
                    if (isLoggedIn) {
                      setDetailProduct(null);
                      openBuyModal(detailProduct);
                    } else {
                      router.push('/auth/login?redirect=/public/shop');
                    }
                  }}
                >
                  {isLoggedIn ? '立即贊助' : '前往登入'}
                </Button>
              </div>
            );
          })()}
      </Modal>

      {/* ─── 購買確認 Modal ──────────────────────────────────── */}
      <Modal
        title="確認贊助"
        open={!!buyingProduct}
        onCancel={() => setBuyingProduct(null)}
        onOk={handleConfirmBuy}
        confirmLoading={purchaseLoading}
        okText="確認贊助"
        cancelText="取消"
      >
        {buyingProduct && (() => {
          const minQty = getMinQuantity(buyingProduct);
          const hasMinAmount = Number(buyingProduct.minPurchaseAmount ?? 0) > 0;
          const unitPrice = Number(buyingProduct.price);
          const totalAmount = unitPrice * buyQuantity;
          const totalDiamond = buyingProduct.diamondAmount * buyQuantity;
          const belowMin = buyQuantity < minQty;
          return (
          <div>
            <Paragraph>
              您即將贊助 <Text strong>{buyingProduct.name}</Text>
            </Paragraph>
            <Paragraph style={{ marginBottom: 8 }}>
              單價：{formatPrice(buyingProduct.price)}
              {hasMinAmount && (
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  （最低購買金額 {formatPrice(buyingProduct.minPurchaseAmount)}，至少 {minQty} 個）
                </Text>
              )}
            </Paragraph>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 16px' }}>
              <Text strong>數量：</Text>
              <InputNumber
                min={1}
                value={buyQuantity}
                onChange={(v) => setBuyQuantity(typeof v === 'number' && v > 0 ? Math.floor(v) : 1)}
                style={{ width: 140 }}
              />
              {hasMinAmount && belowMin && (
                <Text type="danger" style={{ fontSize: 12 }}>
                  低於最低數量 {minQty}
                </Text>
              )}
            </div>

            <Paragraph style={{ marginBottom: 4 }}>
              總金額：
              <Text strong style={{ color: '#cf1322', fontSize: 18 }}>
                {formatPrice(totalAmount)}
              </Text>
            </Paragraph>
            <Paragraph>
              共獲得：
              <Currency amount={totalDiamond} />
            </Paragraph>
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
          );
        })()}
      </Modal>

      <VirtualAccountModal
        open={!!virtualAccount}
        info={virtualAccount}
        onClose={() => setVirtualAccount(null)}
      />

      <PublicFooter />
    </div>
  );
}
