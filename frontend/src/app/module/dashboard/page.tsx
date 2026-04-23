'use client';

import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin } from 'antd';
import {
  UserOutlined,
  ShoppingOutlined,
  CalendarOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/components/providers/AuthProvider';
import { getMembers } from '@/lib/api/members';
import { getReservationStats } from '@/lib/api/reserve';
import { getOrders, getProducts } from '@/lib/api/shop';

interface StatCard {
  key: string;
  title: string;
  permission: string;
  icon: React.ReactNode;
  fetch: () => Promise<number>;
}

const statCards: StatCard[] = [
  {
    key: 'members',
    title: '會員數',
    permission: 'module.originals.members.view',
    icon: <UserOutlined />,
    fetch: async () => (await getMembers({ page: 1, limit: 1 })).total,
  },
  {
    key: 'reservations',
    title: '預約人數',
    permission: 'module.originals.reserve.view',
    icon: <CalendarOutlined />,
    fetch: async () => (await getReservationStats()).displayCount,
  },
  {
    key: 'orders',
    title: '訂單數',
    permission: 'module.originals.orders.view',
    icon: <ShoppingCartOutlined />,
    fetch: async () => (await getOrders(1, 1)).total,
  },
  {
    key: 'products',
    title: '商品數',
    permission: 'module.originals.shop.view',
    icon: <ShoppingOutlined />,
    fetch: async () => (await getProducts(1, 1)).total,
  },
];

export default function ModuleDashboard() {
  const { hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, number>>({});

  // 只取有權限的卡片
  const visibleCards = statCards.filter((c) => hasPermission(c.permission));

  useEffect(() => {
    const fetchData = async () => {
      if (visibleCards.length === 0) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const results: Record<string, number> = {};
      await Promise.all(
        visibleCards.map(async (card) => {
          try {
            results[card.key] = await card.fetch();
          } catch {
            results[card.key] = 0;
          }
        }),
      );
      setStats(results);
      setLoading(false);
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCards.length]);

  return (
    <div>
      <h2>始祖天堂 — 模組總覽</h2>
      <Spin spinning={loading}>
        {visibleCards.length > 0 ? (
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            {visibleCards.map((card) => (
              <Col xs={24} sm={12} md={6} key={card.key}>
                <Card>
                  <Statistic
                    title={card.title}
                    value={stats[card.key] ?? 0}
                    prefix={card.icon}
                  />
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
            歡迎使用始祖天堂管理後台
          </div>
        )}
      </Spin>
    </div>
  );
}
