'use client';

import { useCallback, useEffect, useState } from 'react';
import { Input, Tabs, Table, Tag, Spin, Empty, Pagination, Drawer, Button, message } from 'antd';
import { SearchOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  searchItems,
  searchMonsters,
  getMonstersDroppingItem,
  getDropsByMonster,
  type ItemSummary,
  type MonsterSummary,
  type MonsterDrop,
  type ItemDrop,
  type ItemType,
  type ItemTypeOrUnknown,
} from '@/lib/api/drop-query';
import PublicFooter from '@/components/public/PublicFooter';

const PAGE_SIZE = 20;

const ITEM_TYPE_LABEL: Record<ItemTypeOrUnknown, string> = {
  etc: '雜項',
  weapon: '武器',
  armor: '防具',
  unknown: '未知',
};
const ITEM_TYPE_COLOR: Record<ItemTypeOrUnknown, string> = {
  etc: 'default',
  weapon: 'volcano',
  armor: 'geekblue',
  unknown: '',
};

function formatRange(min: number, max: number): string {
  return min === max ? String(min) : `${min} ~ ${max}`;
}

export default function DropQueryPage() {
  const [tab, setTab] = useState<'item' | 'monster'>('item');

  return (
    <div style={{ minHeight: '100vh', paddingTop: 'var(--header-total-height, 89px)', background: 'var(--bg-primary, #0a0a0a)' }}>
      <div
        style={{
          height: 180,
          background: 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #1a1a2e 100%)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 50%, rgba(196,162,78,0.06), transparent 70%)' }} />
        <h1 style={{ fontSize: 32, fontWeight: 300, letterSpacing: 4, color: '#fff', fontFamily: 'var(--font-heading)', position: 'relative', zIndex: 1 }}>
          掉落查詢
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 8, position: 'relative', zIndex: 1 }}>
          只顯示目前開放的怪物與其掉落物
        </p>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as 'item' | 'monster')}
          items={[
            { key: 'item', label: '從道具找怪物', children: <ItemSearchPanel /> },
            { key: 'monster', label: '從怪物找掉落物', children: <MonsterSearchPanel /> },
          ]}
        />
      </div>

      <PublicFooter />
    </div>
  );
}

// ─── 從道具找怪物 ──────────────────────────────────────────────

function ItemSearchPanel() {
  const [keyword, setKeyword] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ItemSummary | null>(null);
  const [drops, setDrops] = useState<MonsterDrop[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const fetchList = useCallback(async (q: string, p: number) => {
    setLoading(true);
    try {
      const res = await searchItems(q, p, PAGE_SIZE);
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      message.error((e as Error).message || '查詢失敗');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList(search, page);
  }, [search, page, fetchList]);

  const openDetail = async (item: ItemSummary) => {
    setSelected(item);
    setDrawerLoading(true);
    try {
      const res = await getMonstersDroppingItem(item.itemId);
      setDrops(res.monsters);
    } catch (e) {
      message.error((e as Error).message || '載入掉落怪物失敗');
      setDrops([]);
    } finally {
      setDrawerLoading(false);
    }
  };

  const columns: ColumnsType<ItemSummary> = [
    { title: '道具編號', dataIndex: 'itemId', width: 110 },
    {
      title: '道具名稱',
      dataIndex: 'itemName',
      render: (v: string, r) => (
        <span>
          {v}{' '}
          <Tag color={ITEM_TYPE_COLOR[r.itemType]} style={{ marginLeft: 4 }}>
            {ITEM_TYPE_LABEL[r.itemType]}
          </Tag>
        </span>
      ),
    },
    {
      title: '',
      width: 100,
      render: (_, r) => (
        <Button type="link" onClick={() => openDetail(r)}>
          看誰掉落
        </Button>
      ),
    },
  ];

  const dropColumns: ColumnsType<MonsterDrop> = [
    {
      title: '怪物',
      dataIndex: 'name',
      render: (v: string, r) => (
        <span>
          {v}
          {r.isBoss && <Tag color="red" style={{ marginLeft: 6 }}>BOSS</Tag>}
        </span>
      ),
    },
    { title: '數量', width: 120, render: (_, r) => formatRange(r.min, r.max) },
    { title: '備註', dataIndex: 'note', responsive: ['md'] },
  ];

  return (
    <div>
      <Input.Search
        placeholder="輸入道具名稱（例：金幣、復活卷軸）"
        enterButton={<><SearchOutlined /> 搜尋</>}
        size="large"
        allowClear
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onSearch={(v) => {
          setSearch(v.trim());
          setPage(1);
        }}
        style={{ maxWidth: 480, marginBottom: 16 }}
      />

      <Spin spinning={loading}>
        {items.length === 0 && !loading ? (
          <Empty description={search ? '查無相符道具' : '輸入關鍵字開始搜尋（不輸入則顯示全部）'} />
        ) : (
          <>
            <Table
              rowKey="itemId"
              dataSource={items}
              columns={columns}
              pagination={false}
              size="middle"
              onRow={(r) => ({ onClick: () => openDetail(r), style: { cursor: 'pointer' } })}
            />
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <Pagination
                current={page}
                total={total}
                pageSize={PAGE_SIZE}
                onChange={setPage}
                showSizeChanger={false}
                showTotal={(t) => `共 ${t} 筆`}
              />
            </div>
          </>
        )}
      </Spin>

      <Drawer
        title={selected ? `「${selected.itemName}」的掉落怪物` : ''}
        open={!!selected}
        onClose={() => setSelected(null)}
        width={Math.min(720, typeof window !== 'undefined' ? window.innerWidth - 40 : 720)}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => setSelected(null)}>
            關閉
          </Button>
        }
      >
        <Spin spinning={drawerLoading}>
          {drops.length === 0 && !drawerLoading ? (
            <Empty description="目前沒有開放的怪物會掉落此道具" />
          ) : (
            <Table rowKey="npcid" dataSource={drops} columns={dropColumns} pagination={false} size="small" />
          )}
        </Spin>
      </Drawer>
    </div>
  );
}

// ─── 從怪物找掉落物 ─────────────────────────────────────────────

function MonsterSearchPanel() {
  const [keyword, setKeyword] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<MonsterSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<MonsterSummary | null>(null);
  const [drops, setDrops] = useState<ItemDrop[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const fetchList = useCallback(async (q: string, p: number) => {
    setLoading(true);
    try {
      const res = await searchMonsters(q, p, PAGE_SIZE);
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      message.error((e as Error).message || '查詢失敗');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList(search, page);
  }, [search, page, fetchList]);

  const openDetail = async (mon: MonsterSummary) => {
    setSelected(mon);
    setDrawerLoading(true);
    try {
      const res = await getDropsByMonster(mon.npcid);
      setDrops(res.drops);
    } catch (e) {
      message.error((e as Error).message || '載入掉落物失敗');
      setDrops([]);
    } finally {
      setDrawerLoading(false);
    }
  };

  const columns: ColumnsType<MonsterSummary> = [
    { title: '編號', dataIndex: 'npcid', width: 90 },
    {
      title: '怪物名稱',
      dataIndex: 'name',
      render: (v: string, r) => (
        <span>
          {v}
          {r.isBoss && <Tag color="red" style={{ marginLeft: 6 }}>BOSS</Tag>}
        </span>
      ),
    },
    {
      title: '',
      width: 110,
      render: (_, r) => (
        <Button type="link" onClick={() => openDetail(r)}>
          看掉落物
        </Button>
      ),
    },
  ];

  const dropColumns: ColumnsType<ItemDrop> = [
    {
      title: '道具',
      dataIndex: 'itemName',
      render: (v: string, r) => (
        <span>
          {v}{' '}
          <Tag color={ITEM_TYPE_COLOR[r.itemType]} style={{ marginLeft: 4 }}>
            {ITEM_TYPE_LABEL[r.itemType]}
          </Tag>
        </span>
      ),
    },
    { title: '數量', width: 120, render: (_, r) => formatRange(r.min, r.max) },
    { title: '備註', dataIndex: 'note', responsive: ['md'] },
  ];

  return (
    <div>
      <Input.Search
        placeholder="輸入怪物名稱（例：哥布林、巴風特）"
        enterButton={<><SearchOutlined /> 搜尋</>}
        size="large"
        allowClear
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onSearch={(v) => {
          setSearch(v.trim());
          setPage(1);
        }}
        style={{ maxWidth: 480, marginBottom: 16 }}
      />

      <Spin spinning={loading}>
        {items.length === 0 && !loading ? (
          <Empty description={search ? '查無相符的開放怪物' : '輸入關鍵字開始搜尋（不輸入則顯示全部開放怪物）'} />
        ) : (
          <>
            <Table
              rowKey="npcid"
              dataSource={items}
              columns={columns}
              pagination={false}
              size="middle"
              onRow={(r) => ({ onClick: () => openDetail(r), style: { cursor: 'pointer' } })}
            />
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <Pagination
                current={page}
                total={total}
                pageSize={PAGE_SIZE}
                onChange={setPage}
                showSizeChanger={false}
                showTotal={(t) => `共 ${t} 筆`}
              />
            </div>
          </>
        )}
      </Spin>

      <Drawer
        title={
          selected ? (
            <span>
              「{selected.name}」的掉落物{selected.isBoss && <Tag color="red" style={{ marginLeft: 6 }}>BOSS</Tag>}
            </span>
          ) : (
            ''
          )
        }
        open={!!selected}
        onClose={() => setSelected(null)}
        width={Math.min(720, typeof window !== 'undefined' ? window.innerWidth - 40 : 720)}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => setSelected(null)}>
            關閉
          </Button>
        }
      >
        <Spin spinning={drawerLoading}>
          {drops.length === 0 && !drawerLoading ? (
            <Empty description="此怪物無掉落物紀錄" />
          ) : (
            <Table rowKey="itemId" dataSource={drops} columns={dropColumns} pagination={false} size="small" />
          )}
        </Spin>
      </Drawer>
    </div>
  );
}
