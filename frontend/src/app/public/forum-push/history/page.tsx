'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Tag,
  Collapse,
  Empty,
  Spin,
  Result,
  Button,
  Typography,
  Space,
  message,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import { getAccessToken } from '@/lib/api/client';
import {
  getMyApplications,
  type MyApplication,
  type ForumPushApplicationStatus,
  type ForumPushItemReviewResult,
} from '@/lib/api/forum-push';

const { Title } = Typography;

const STATUS_META: Record<
  ForumPushApplicationStatus,
  { label: string; color: string }
> = {
  pending: { label: '待審核', color: 'orange' },
  reviewed: { label: '已審核', color: 'green' },
};

const ITEM_RESULT_META: Record<
  ForumPushItemReviewResult,
  { label: string; color: string }
> = {
  pending: { label: '待審核', color: 'default' },
  passed: { label: '通過', color: 'green' },
  rejected: { label: '未通過', color: 'red' },
};

export default function ForumPushHistoryPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<MyApplication[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyApplications();
      setList(res);
    } catch {
      message.error('載入紀錄失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getAccessToken('player');
    if (!token) {
      setIsLoggedIn(false);
      setCheckingAuth(false);
      return;
    }
    setIsLoggedIn(true);
    setCheckingAuth(false);
    load();
  }, [load]);

  if (checkingAuth) {
    return (
      <div
        style={{
          paddingTop: 'calc(var(--header-total-height, 89px) + 40px)',
          textAlign: 'center',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div
        style={{
          paddingTop: 'calc(var(--header-total-height, 89px) + 40px)',
          paddingLeft: 24,
          paddingRight: 24,
          paddingBottom: 40,
        }}
      >
        <Result
          status="403"
          title="需要登入"
          extra={
            <Button type="primary" onClick={() => router.push('/auth/login')}>
              前往登入
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 860,
        margin: '0 auto',
        paddingTop: 'calc(var(--header-total-height, 89px) + 16px)',
        paddingLeft: 24,
        paddingRight: 24,
        paddingBottom: 24,
      }}
    >
      <Space style={{ marginBottom: 16 }}>
        <Link href="/public/forum-push">
          <Button icon={<ArrowLeftOutlined />} type="link">
            回到申請頁
          </Button>
        </Link>
      </Space>
      <Title level={3}>我的申請紀錄</Title>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : list.length === 0 ? (
        <Empty description="尚無申請紀錄" />
      ) : (
        <Collapse
          accordion
          items={list.map((app) => {
            const statusMeta = STATUS_META[app.status];
            return {
              key: app.id,
              label: (
                <Space wrap>
                  <span>{dayjs(app.createdAt).format('YYYY-MM-DD HH:mm')}</span>
                  <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
                  {app.status === 'reviewed' && (
                    <Tag color="blue">
                      通過 {app.passedCount} / {app.items.length}
                    </Tag>
                  )}
                  {app.rewardStatus === 'sent' && (
                    <Tag color="gold">獎勵已發放</Tag>
                  )}
                  {app.rewardStatus === 'partial' && (
                    <Tag color="orange">獎勵部分發放</Tag>
                  )}
                  {app.rewardStatus === 'failed' && (
                    <Tag color="red">獎勵發放失敗</Tag>
                  )}
                </Space>
              ),
              children: (
                <div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>FB 名稱：</strong>
                    {app.fbName}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>FB 連結：</strong>
                    <a
                      href={app.fbLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {app.fbLink}
                    </a>
                  </div>
                  {app.reviewNote && (
                    <div style={{ marginBottom: 8 }}>
                      <strong>審核備註：</strong>
                      {app.reviewNote}
                    </div>
                  )}
                  <div style={{ marginBottom: 4, fontWeight: 500 }}>
                    推文清單：
                  </div>
                  {app.items.map((it, idx) => {
                    const meta = ITEM_RESULT_META[it.reviewResult];
                    return (
                      <Card
                        size="small"
                        key={it.id}
                        style={{ marginBottom: 8 }}
                      >
                        <Space wrap>
                          <span>#{idx + 1}</span>
                          <Tag color={meta.color}>{meta.label}</Tag>
                          {it.type === 'link' ? (
                            <a
                              href={it.content}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {it.content}
                            </a>
                          ) : (
                            <a
                              href={it.content}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              查看截圖
                            </a>
                          )}
                        </Space>
                      </Card>
                    );
                  })}
                  {app.rewardPayload && app.rewardPayload.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontWeight: 500 }}>發放獎勵：</div>
                      {app.rewardPayload.map((r, i) => (
                        <div key={i} style={{ fontSize: 13 }}>
                          · {r.itemName} × {r.quantity}
                          {r.error && (
                            <span style={{ color: '#f5222d' }}>
                              （失敗：{r.error}）
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ),
            };
          })}
        />
      )}
    </div>
  );
}
