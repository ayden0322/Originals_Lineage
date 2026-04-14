'use client';

import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin, Empty, Tag, Space, message } from 'antd';
import {
  DollarOutlined,
  RiseOutlined,
  TransactionOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { agentCurrentPeriod, agentMe } from '@/lib/api/commission';
import type { CommissionCurrentPeriodSummary, CommissionAgentSelf } from '@/lib/types';

export default function AgentDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<CommissionAgentSelf | null>(null);
  const [period, setPeriod] = useState<CommissionCurrentPeriodSummary | null>(null);

  useEffect(() => {
    Promise.all([agentMe(), agentCurrentPeriod()])
      .then(([m, p]) => {
        setMe(m);
        setPeriod(p);
      })
      .catch(() => message.error('載入失敗'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Spin />;
  }
  if (!me || !period) return <Empty />;

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <Space size="large" wrap>
          <Statistic title="代理代碼" value={me.code} />
          <Statistic title="代理名稱" value={me.name} />
          <Statistic
            title="目前比例"
            value={(me.currentRate * 100).toFixed(2)}
            suffix="%"
          />
          <div>
            <div style={{ color: '#888', fontSize: 14 }}>身份</div>
            <Tag color={me.level === 1 ? 'purple' : 'blue'} style={{ fontSize: 14, padding: '4px 12px', marginTop: 8 }}>
              {me.level === 1 ? '一級代理（A）' : '二級代理（B）'}
            </Tag>
          </div>
        </Space>
      </Card>

      <Card title={<><CalendarOutlined /> 本期預估</>}>
        <div style={{ color: '#888', marginBottom: 16 }}>
          期別 <Tag>{period.periodKey}</Tag>{' '}
          範圍 {period.periodStart.slice(0, 10)} ~ {period.periodEnd.slice(0, 10)}
        </div>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="本期預估分潤"
                value={period.myCommission}
                precision={2}
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="本期業績總額"
                value={period.totalBaseAmount}
                precision={2}
                prefix={<RiseOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="交易筆數"
                value={period.transactionCount}
                prefix={<TransactionOutlined />}
              />
            </Card>
          </Col>
        </Row>
        <div style={{ marginTop: 16, color: '#888', fontSize: 12 }}>
          * 預估數字為本期截至目前累計的分潤，實際應付以結算確認後為準（含管理者手動加減項）
        </div>
      </Card>
    </>
  );
}
