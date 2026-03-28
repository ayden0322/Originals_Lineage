'use client';

import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin, message } from 'antd';
import {
  UserOutlined,
  ShoppingOutlined,
  CalendarOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import { getMembers } from '@/lib/api/members';
import { getReservationStats } from '@/lib/api/reserve';
import { getOrders, getProducts } from '@/lib/api/shop';

export default function ModuleDashboard() {
  const [loading, setLoading] = useState(true);
  const [memberCount, setMemberCount] = useState(0);
  const [reservationCount, setReservationCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [productCount, setProductCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [membersRes, statsRes, ordersRes, productsRes] = await Promise.all([
          getMembers(1, 1),
          getReservationStats(),
          getOrders(1, 1),
          getProducts(1, 1),
        ]);
        setMemberCount(membersRes.total);
        setReservationCount(statsRes.total);
        setOrderCount(ordersRes.total);
        setProductCount(productsRes.total);
      } catch {
        message.error('載入統計資料失敗');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div>
      <h2>始祖天堂 — 模組總覽</h2>
      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic title="會員數" value={memberCount} prefix={<UserOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic title="預約人數" value={reservationCount} prefix={<CalendarOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic title="訂單數" value={orderCount} prefix={<ShoppingCartOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic title="商品數" value={productCount} prefix={<ShoppingOutlined />} />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}
