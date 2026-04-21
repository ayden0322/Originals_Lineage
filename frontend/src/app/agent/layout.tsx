'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Layout,
  Menu,
  theme,
  Button,
  Space,
  Spin,
  Tag,
  Drawer,
  Grid,
} from 'antd';
import {
  DashboardOutlined,
  LinkOutlined,
  TeamOutlined,
  FileDoneOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { agentMe } from '@/lib/api/commission';
import { clearTokens, getAccessToken } from '@/lib/api/client';
import type { CommissionAgentSelf } from '@/lib/types';

const { Header, Sider, Content } = Layout;

const baseMenu = [
  { key: '/agent/dashboard', icon: <DashboardOutlined />, label: '總覽' },
  { key: '/agent/links', icon: <LinkOutlined />, label: '推廣連結' },
  { key: '/agent/settlements', icon: <FileDoneOutlined />, label: '結算紀錄' },
  { key: '/agent/players', icon: <UserOutlined />, label: '玩家明細' },
  { key: '/agent/settings', icon: <SettingOutlined />, label: '帳號設定' },
];

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token } = theme.useToken();
  const [me, setMe] = useState<CommissionAgentSelf | null>(null);
  const [loading, setLoading] = useState(true);
  const screens = Grid.useBreakpoint();
  const isMobile = screens.lg === false;
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // 登入頁不套用 layout
  const isLoginPage = pathname === '/agent/login';

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }
    const t = getAccessToken('agent');
    if (!t) {
      router.replace('/agent/login');
      return;
    }
    agentMe()
      .then(setMe)
      .catch(() => {
        router.replace('/agent/login');
      })
      .finally(() => setLoading(false));
  }, [isLoginPage, router]);

  const handleLogout = () => {
    clearTokens('agent');
    router.push('/agent/login');
  };

  if (isLoginPage) return <>{children}</>;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }
  if (!me) return null;

  // A 才看得到「子代理」選單
  const menuItems =
    me.level === 1
      ? [
          baseMenu[0],
          baseMenu[1],
          { key: '/agent/subordinates', icon: <TeamOutlined />, label: '子代理' },
          baseMenu[2],
          baseMenu[3],
        ]
      : baseMenu;

  const brand = (
    <div
      style={{
        height: 64,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        padding: '8px 0',
      }}
    >
      <div style={{ fontWeight: 'bold', fontSize: 14 }}>始祖天堂 代理</div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{me.code}</div>
    </div>
  );

  const sideMenu = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[pathname]}
      items={menuItems}
      onClick={({ key }) => router.push(key)}
      style={{ borderRight: 0 }}
    />
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {isMobile ? (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={240}
          styles={{ body: { padding: 0, background: '#001529' }, header: { display: 'none' } }}
        >
          {brand}
          {sideMenu}
        </Drawer>
      ) : (
        <Sider breakpoint="lg" collapsedWidth="80">
          {brand}
          {sideMenu}
        </Sider>
      )}
      <Layout>
        <Header
          style={{
            padding: isMobile ? '0 12px' : '0 24px',
            background: token.colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          {isMobile ? (
            <Button
              type="text"
              icon={<MenuOutlined style={{ fontSize: 20 }} />}
              onClick={() => setDrawerOpen(true)}
              aria-label="開啟選單"
            />
          ) : (
            <span />
          )}
          <Space size={isMobile ? 4 : 8} style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Tag color={me.level === 1 ? 'purple' : 'blue'} style={{ margin: 0 }}>
              {me.level === 1 ? '一級代理（A）' : '二級代理（B）'}
            </Tag>
            {!isMobile && <span>{me.name}</span>}
            <Tag color="gold" style={{ margin: 0 }}>{(me.currentRate * 100).toFixed(2)}%</Tag>
            <Button icon={<LogoutOutlined />} type="text" onClick={handleLogout}>
              {isMobile ? '' : '登出'}
            </Button>
          </Space>
        </Header>
        <Content style={{ margin: isMobile ? 12 : 24 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}
