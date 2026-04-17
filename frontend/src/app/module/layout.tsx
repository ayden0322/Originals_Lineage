'use client';

import { useEffect, useMemo } from 'react';
import { Layout, Menu, theme, Button, Space } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import {
  DashboardOutlined,
  UserOutlined,
  FileTextOutlined,
  ShoppingOutlined,
  CalendarOutlined,
  SettingOutlined,
  LogoutOutlined,
  GlobalOutlined,
  PictureOutlined,
  AuditOutlined,
  CreditCardOutlined,
  PartitionOutlined,
} from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import { Spin } from 'antd';
import { useAuth } from '@/components/providers/AuthProvider';

const { Header, Sider, Content } = Layout;

// 選單項目與所需權限的對應
interface MenuItem {
  key: string;
  icon?: React.ReactNode;
  label: string;
  permission?: string; // 需要的權限碼（不設定 = 任何人可見）
  children?: MenuItem[];
}

const allMenuItems: MenuItem[] = [
  { key: '/module/dashboard', icon: <DashboardOutlined />, label: '儀表板' },
  { key: '/module/members', icon: <UserOutlined />, label: '會員管理', permission: 'module.originals.members.view' },
  {
    key: 'reservations',
    icon: <CalendarOutlined />,
    label: '預約管理',
    permission: 'module.originals.reserve.view',
    children: [
      { key: '/module/reservations', label: '預約名單' },
      { key: '/module/reservations/distributions', label: '發獎管理', permission: 'module.originals.reserve.manage' },
      { key: '/module/reservations/settings', label: '頁面設定', permission: 'module.originals.settings.manage' },
      { key: '/module/reservations/milestones', label: '里程碑管理', permission: 'module.originals.settings.manage' },
    ],
  },
  {
    key: 'shop',
    icon: <ShoppingOutlined />,
    label: '商城管理',
    children: [
      { key: '/module/shop/products', label: '商品管理', permission: 'module.originals.shop.view' },
      { key: '/module/shop/templates', label: '常用範本', permission: 'module.originals.shop.manage' },
      { key: '/module/shop/orders', label: '訂單管理', permission: 'module.originals.orders.view' },
      { key: '/module/shop/settings', label: '商城設定', permission: 'module.originals.shop.manage' },
    ],
  },
  {
    key: 'site-manage',
    icon: <GlobalOutlined />,
    label: '網站管理',
    permission: 'module.originals.settings.manage',
    children: [
      { key: '/module/site-manage/settings', label: '網站設定' },
      {
        key: 'carousel',
        label: '首頁輪播設定',
        children: [
          { key: '/module/site-manage/carousel/sections', label: '區塊輪播設定' },
          { key: '/module/site-manage/carousel/nav-style', label: '輪播標題樣式' },
        ],
      },
      {
        key: 'news',
        label: '版面設定',
        children: [
          { key: '/module/site-manage/news', label: '最新消息' },
        ],
      },
      { key: '/module/site-manage/changelog', label: '更新頁面管理' },
    ],
  },
  { key: '/module/media', icon: <PictureOutlined />, label: '媒體庫', permission: 'module.originals.media.view' },
  {
    key: 'content',
    icon: <FileTextOutlined />,
    label: '內容管理',
    children: [
      { key: '/module/content/categories', label: '分類管理', permission: 'module.originals.content.view' },
      { key: '/module/content/articles', label: '文章管理', permission: 'module.originals.content.view' },
      { key: '/module/content/announcements', label: '公告管理', permission: 'module.originals.content.view' },
    ],
  },
  { key: '/module/logs', icon: <AuditOutlined />, label: '操作日誌', permission: 'module.originals.logs.view' },
  {
    key: 'commission',
    icon: <PartitionOutlined />,
    label: '代理分潤',
    permission: 'module.originals.commission.view',
    children: [
      { key: '/module/commission/agents', label: '代理管理' },
      { key: '/module/commission/players', label: '玩家歸屬' },
      { key: '/module/commission/settlements', label: '結算管理' },
      { key: '/module/commission/refunds', label: '退款沖銷' },
      { key: '/module/commission/settings', label: '分潤設定' },
    ],
  },
  {
    key: 'payment',
    icon: <CreditCardOutlined />,
    label: '金流管理',
    permission: 'module.originals.settings.manage',
    children: [
      { key: '/module/payment-gateways', label: '金流商管理' },
      { key: '/module/payment-routes', label: '伺服器金流設定' },
    ],
  },
  { key: '/module/settings', icon: <SettingOutlined />, label: '模組設定', permission: 'module.originals.settings.manage' },
];

/** 根據權限過濾選單，子項目全部被過濾則父項目也隱藏 */
function filterMenuByPermissions(items: MenuItem[], permissions: string[]): ItemType[] {
  const result: ItemType[] = [];
  for (const item of items) {
    // 如果有設定權限且使用者沒有該權限，跳過
    if (item.permission && !permissions.includes(item.permission)) continue;

    if (item.children) {
      const filteredChildren = filterMenuByPermissions(item.children, permissions);
      if (filteredChildren.length === 0) continue;
      result.push({
        key: item.key,
        icon: item.icon,
        label: item.label,
        children: filteredChildren,
      } as ItemType);
    } else {
      result.push({
        key: item.key,
        icon: item.icon,
        label: item.label,
      } as ItemType);
    }
  }
  return result;
}

export default function ModuleAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { token } = theme.useToken();
  const { user, loading, logout } = useAuth();

  const menuItems = useMemo(() => {
    const permissions = user?.permissions ?? [];
    return filterMenuByPermissions(allMenuItems, permissions);
  }, [user?.permissions]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/originals/admin-login');
    }
  }, [loading, user, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/originals/admin-login');
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

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="80">
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
          始祖天堂
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
          defaultOpenKeys={['site-manage', 'carousel', 'news', 'content', 'shop', 'payment', 'commission', 'reservations']}
          items={menuItems}
          onClick={({ key }) => {
            // Only navigate for leaf items (those with actual paths)
            if (key.startsWith('/')) router.push(key);
          }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: token.colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          <Space>
            <span>{user?.displayName || '工作人員'}</span>
            <Button icon={<LogoutOutlined />} type="text" onClick={handleLogout}>
              登出
            </Button>
          </Space>
        </Header>
        <Content style={{ margin: 24 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}
