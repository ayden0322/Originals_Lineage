'use client';

import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin, message } from 'antd';
import {
  UserOutlined,
  AppstoreOutlined,
  ShoppingOutlined,
  LoginOutlined,
} from '@ant-design/icons';
import { getAccounts } from '@/lib/api/accounts';
import { getModules } from '@/lib/api/modules';

export default function PlatformDashboard() {
  const [loading, setLoading] = useState(true);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [activeModules, setActiveModules] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [todayLogins, setTodayLogins] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [accountsResult, modulesResult] = await Promise.all([
          getAccounts(1, 1),
          getModules(),
        ]);

        setTotalAccounts(accountsResult.total);
        setActiveModules(modulesResult.filter((m) => m.isActive).length);

        // TODO: replace with real API when transaction/login endpoints exist
        setTotalTransactions(0);
        setTodayLogins(0);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        message.error('載入儀表板資料失敗');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div>
      <h2>平台總覽</h2>
      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="總帳號數"
                value={totalAccounts}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="活躍模組"
                value={activeModules}
                prefix={<AppstoreOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="總交易數"
                value={totalTransactions}
                prefix={<ShoppingOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="今日登入"
                value={todayLogins}
                prefix={<LoginOutlined />}
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}
