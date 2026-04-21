'use client';

import { useEffect, useState } from 'react';
import { Layout, Menu, theme, Button, Space, Spin, Drawer, Grid } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/platform/dashboard', icon: <DashboardOutlined />, label: '儀表板' },
  { key: '/platform/accounts', icon: <UserOutlined />, label: '帳號管理' },
  { key: '/platform/modules', icon: <AppstoreOutlined />, label: '模組管理' },
  { key: '/platform/logs', icon: <FileTextOutlined />, label: '系統日誌' },
];

export default function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { token } = theme.useToken();
  const { user, loading, logout } = useAuth();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.lg === false;
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/admin/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    router.push('/admin/login');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const brand = (
    <div
      style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
      }}
    >
      主後台
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
          <Space>
            <span>{user?.displayName || '管理者'}</span>
            <Button icon={<LogoutOutlined />} type="text" onClick={handleLogout}>
              登出
            </Button>
          </Space>
        </Header>
        <Content style={{ margin: isMobile ? 12 : 24 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}
