'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Modal,
  Spin,
  Empty,
  Divider,
  Tag,
} from 'antd';
import { GiftOutlined } from '@ant-design/icons';
import { usePackageConfig } from '@/components/providers/PackageConfigProvider';
import type { GamePackage } from '@/lib/types';

const { Title, Paragraph, Text } = Typography;

/** 根據比例字串（"1:1"、"4:3"、"16:9"）回傳 padding-top 百分比 */
function ratioToPaddingTop(ratio: string): string {
  const [w, h] = ratio.split(':').map((n) => Number(n) || 1);
  if (!w || !h) return '100%';
  return `${(h / w) * 100}%`;
}

export default function PackagesPage() {
  const { config, loading } = usePackageConfig();
  const { settings, packages } = config;
  const [detail, setDetail] = useState<GamePackage | null>(null);

  /** 卡片欄數 → Col span (AntD 24 格) */
  const colSpan = useMemo(() => {
    const cols = Math.min(Math.max(settings.cardColumns || 4, 1), 6);
    return Math.floor(24 / cols);
  }, [settings.cardColumns]);

  /** 貨幣顯示組件（icon + 數量 + 名稱），icon 與數字靠近、數字與名稱保留較大間距 */
  const Currency = ({ amount, size = 20 }: { amount: number; size?: number }) => (
    <Text
      strong
      style={{
        color: settings.currencyColor,
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 14,
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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 120 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 'var(--header-total-height, 89px)' }}>
      {/* ─── Hero 區 ─────────────────────────────────────────── */}
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
          <Title level={2} style={{ marginBottom: 8, color: settings.heroTextColor }}>
            <GiftOutlined style={{ marginRight: 8 }} />
            {settings.heroTitle}
          </Title>
          <Paragraph
            style={{
              fontSize: 16,
              marginBottom: 0,
              color: settings.heroTextColor,
              opacity: 0.85,
            }}
          >
            {settings.heroSubtitle}
          </Paragraph>
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
        {packages.length === 0 ? (
          <Empty description="目前沒有上架的禮包" style={{ padding: '80px 0' }} />
        ) : (
          <Row gutter={[16, 16]} align="stretch">
            {packages.map((pkg) => (
              <Col
                key={pkg.id}
                xs={12}
                sm={12}
                md={colSpan < 8 ? 12 : colSpan}
                lg={colSpan}
                style={{ display: 'flex' }}
              >
                <Card
                  hoverable
                  onClick={() => setDetail(pkg)}
                  style={{
                    borderRadius: settings.cardBorderRadius,
                    border: `1px solid ${settings.cardBorderColor}`,
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
                      padding: 12,
                    },
                  }}
                  cover={
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        paddingTop: ratioToPaddingTop(settings.cardImageRatio),
                        background:
                          'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderTopLeftRadius: settings.cardBorderRadius,
                        borderTopRightRadius: settings.cardBorderRadius,
                        overflow: 'hidden',
                      }}
                    >
                      {pkg.imageUrl ? (
                        <img
                          alt={pkg.name}
                          src={pkg.imageUrl}
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
                  <Title level={5} style={{ marginBottom: 4 }}>
                    {pkg.name}
                  </Title>
                  {pkg.description && (
                    <Paragraph
                      type="secondary"
                      ellipsis={{ rows: 2 }}
                      style={{ marginBottom: 12, minHeight: 44 }}
                    >
                      {pkg.description}
                    </Paragraph>
                  )}
                  <div style={{ marginTop: 'auto' }}>
                    <Currency amount={pkg.currencyAmount} />
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </div>

      {/* ─── 詳情 Modal ──────────────────────────────────────── */}
      <Modal
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={null}
        width={720}
        title={detail?.name}
      >
        {detail && (
          <div>
            {/* 大圖：完全貼合裁切比例，不加任何底色/留白 */}
            {(detail.largeImageUrl || detail.imageUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={detail.largeImageUrl || detail.imageUrl || ''}
                alt={detail.name}
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  borderRadius: 12,
                  marginBottom: 16,
                }}
              />
            )}

            {/* 貨幣 */}
            <div style={{ marginBottom: 16 }}>
              <Text strong>兌換所需：</Text>{' '}
              <Currency amount={detail.currencyAmount} size={22} />
            </div>

            {/* 描述 */}
            {detail.description && (
              <Paragraph type="secondary">{detail.description}</Paragraph>
            )}

            {/* 內容：優先顯示富文本；沒有才 fallback 到舊結構化 items（相容舊資料） */}
            {detail.contentHtml && detail.contentHtml.trim() ? (
              <>
                <Divider orientation="left" plain>
                  禮包內容
                </Divider>
                <div
                  className="package-content-html"
                  style={{ color: 'rgba(0, 0, 0, 0.85)' }}
                  dangerouslySetInnerHTML={{ __html: detail.contentHtml }}
                />
              </>
            ) : (
              detail.items &&
              detail.items.length > 0 && (
                <>
                  <Divider orientation="left" plain>
                    禮包內容
                  </Divider>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    {detail.items.map((it, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: 10,
                          background: 'rgba(0, 0, 0, 0.04)',
                          border: '1px solid rgba(0, 0, 0, 0.08)',
                          borderRadius: 6,
                        }}
                      >
                        {it.iconUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={it.iconUrl}
                            alt={it.name}
                            style={{
                              width: 36,
                              height: 36,
                              objectFit: 'contain',
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 4,
                              background: 'rgba(0, 0, 0, 0.08)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <GiftOutlined style={{ color: '#999' }} />
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <Text strong style={{ color: 'rgba(0, 0, 0, 0.88)' }}>
                            {it.name}
                          </Text>
                          <Tag
                            style={{ marginLeft: 8 }}
                            color={settings.accentColor}
                          >
                            x {it.quantity}
                          </Tag>
                          {it.description && (
                            <div
                              style={{
                                fontSize: 12,
                                color: 'rgba(0, 0, 0, 0.55)',
                                marginTop: 2,
                              }}
                            >
                              {it.description}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )
            )}
          </div>
        )}
      </Modal>

      {/* 富文本內容 — 基本樣式，讓表格、圖片、列表能正常顯示 */}
      <style jsx global>{`
        .package-content-html img {
          max-width: 100%;
          height: auto;
          border-radius: 6px;
        }
        .package-content-html table {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0;
        }
        .package-content-html table,
        .package-content-html table td,
        .package-content-html table th,
        .package-content-html table tr {
          border-color: #ffffff !important;
        }
        .package-content-html table td,
        .package-content-html table th {
          border: 1px solid #ffffff !important;
          padding: 6px 10px;
          vertical-align: top;
        }
        .package-content-html p {
          margin: 0.5em 0;
        }
        .package-content-html ul,
        .package-content-html ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .package-content-html h1,
        .package-content-html h2,
        .package-content-html h3 {
          margin: 0.8em 0 0.4em;
        }
        .package-content-html a {
          color: #4791e1;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
