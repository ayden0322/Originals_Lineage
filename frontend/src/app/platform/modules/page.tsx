'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Switch, Tag, Spin, message } from 'antd';
import {
  AppstoreOutlined,
  DollarOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import type { ModuleConfig } from '@/lib/types';
import { getModules, togglePayment, toggleLineBot } from '@/lib/api/modules';

export default function ModulesPage() {
  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [togglingPayment, setTogglingPayment] = useState<string | null>(null);
  const [togglingLine, setTogglingLine] = useState<string | null>(null);

  const fetchModules = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getModules();
      setModules(result);
    } catch {
      message.error('載入模組列表失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const handleTogglePayment = async (moduleCode: string) => {
    setTogglingPayment(moduleCode);
    try {
      const updated = await togglePayment(moduleCode);
      setModules((prev) =>
        prev.map((m) => (m.moduleCode === moduleCode ? updated : m))
      );
      message.success('金流狀態已更新');
    } catch {
      message.error('切換金流失敗');
    } finally {
      setTogglingPayment(null);
    }
  };

  const handleToggleLineBot = async (moduleCode: string) => {
    setTogglingLine(moduleCode);
    try {
      const updated = await toggleLineBot(moduleCode);
      setModules((prev) =>
        prev.map((m) => (m.moduleCode === moduleCode ? updated : m))
      );
      message.success('Line Bot 狀態已更新');
    } catch {
      message.error('切換 Line Bot 失敗');
    } finally {
      setTogglingLine(null);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>模組管理</h2>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          {modules.map((mod) => (
            <Col xs={24} sm={12} lg={8} key={mod.id}>
              <Card
                title={
                  <span>
                    <AppstoreOutlined style={{ marginRight: 8 }} />
                    {mod.moduleName}
                  </span>
                }
                extra={
                  mod.isActive ? (
                    <Tag color="green">啟用</Tag>
                  ) : (
                    <Tag color="red">停用</Tag>
                  )
                }
              >
                <div style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>
                  模組代碼：{mod.moduleCode}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <span>
                    <DollarOutlined style={{ marginRight: 4 }} />
                    金流
                  </span>
                  <Switch
                    checked={mod.paymentEnabled}
                    loading={togglingPayment === mod.moduleCode}
                    onChange={() => handleTogglePayment(mod.moduleCode)}
                    checkedChildren="開"
                    unCheckedChildren="關"
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>
                    <MessageOutlined style={{ marginRight: 4 }} />
                    Line Bot
                  </span>
                  <Switch
                    checked={mod.lineBotEnabled}
                    loading={togglingLine === mod.moduleCode}
                    onChange={() => handleToggleLineBot(mod.moduleCode)}
                    checkedChildren="開"
                    unCheckedChildren="關"
                  />
                </div>

                <div
                  style={{
                    marginTop: 12,
                    fontSize: 12,
                    color: '#aaa',
                    textAlign: 'right',
                  }}
                >
                  更新於{' '}
                  {new Date(mod.updatedAt).toLocaleString('zh-TW')}
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        {modules.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
            目前沒有模組
          </div>
        )}
      </Spin>
    </div>
  );
}
