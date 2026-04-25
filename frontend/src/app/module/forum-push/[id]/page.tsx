'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  Descriptions,
  Switch,
  Button,
  Input,
  Tag,
  Space,
  Image as AntImage,
  Alert,
  Spin,
  Typography,
  message,
  Popconfirm,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import Link from 'next/link';
import {
  getApplicationDetail,
  reviewApplication,
  type ForumPushApplication,
  type ForumPushItemWithDuplicates,
} from '@/lib/api/forum-push';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function ForumPushReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState<ForumPushApplication | null>(
    null,
  );
  const [items, setItems] = useState<ForumPushItemWithDuplicates[]>([]);
  const [itemResults, setItemResults] = useState<
    Record<string, 'passed' | 'rejected'>
  >({});
  const [reviewNote, setReviewNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getApplicationDetail(id);
      setApplication(res.application);
      setItems(res.items);
      setReviewNote(res.application.reviewNote ?? '');
      const initial: Record<string, 'passed' | 'rejected'> = {};
      for (const it of res.items) {
        if (it.reviewResult === 'passed' || it.reviewResult === 'rejected') {
          initial[it.id] = it.reviewResult;
        } else {
          initial[it.id] = 'passed'; // 預設通過，管理員再切換
        }
      }
      setItemResults(initial);
    } catch {
      message.error('載入失敗');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async () => {
    if (!application) return;
    setSubmitting(true);
    try {
      const res = await reviewApplication(id, {
        items: items.map((it) => ({
          itemId: it.id,
          result: itemResults[it.id] ?? 'rejected',
        })),
        reviewNote: reviewNote || undefined,
      });
      const passed = res.application.passedCount;
      const rewardMsg =
        res.application.rewardStatus === 'sent'
          ? '獎勵已發送'
          : res.application.rewardStatus === 'partial'
            ? '部分獎勵發送失敗，請檢視詳情'
            : res.application.rewardStatus === 'failed'
              ? '獎勵發送失敗，請至遊戲庫檢查'
              : '尚無獎勵設定或無通過項目';
      message.success(`審核完成，通過 ${passed} 筆，${rewardMsg}`);
      load();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      message.error(e.response?.data?.message || '審核失敗');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !application) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  const alreadyReviewed = application.status === 'reviewed';
  const passedPreview = Object.values(itemResults).filter(
    (v) => v === 'passed',
  ).length;

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Link href="/module/forum-push">
          <Button icon={<ArrowLeftOutlined />}>返回列表</Button>
        </Link>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Title level={4}>申請資訊</Title>
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="申請時間">
            {dayjs(application.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="狀態">
            {alreadyReviewed ? (
              <Tag color="green">已審核</Tag>
            ) : (
              <Tag color="orange">待審核</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="遊戲帳號">
            {application.gameAccount}
          </Descriptions.Item>
          <Descriptions.Item label="角色名稱">
            {application.gameCharacter || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="FB 名稱">
            {application.fbName}
          </Descriptions.Item>
          <Descriptions.Item label="FB 連結">
            <a
              href={application.fbLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              {application.fbLink}
            </a>
          </Descriptions.Item>
          {alreadyReviewed && (
            <>
              <Descriptions.Item label="通過數量">
                {application.passedCount} / {items.length}
              </Descriptions.Item>
              <Descriptions.Item label="獎勵狀態">
                {application.rewardStatus}
              </Descriptions.Item>
              {application.rewardPayload && (
                <Descriptions.Item label="發放內容" span={2}>
                  {application.rewardPayload.length === 0
                    ? '無'
                    : application.rewardPayload.map((r, i) => (
                        <div key={i}>
                          · {r.itemName}(#{r.itemCode}) × {r.quantity}
                          {r.error && (
                            <span style={{ color: '#f5222d' }}>
                              — 失敗：{r.error}
                            </span>
                          )}
                          {r.insertId && (
                            <span style={{ color: '#8c8c8c' }}>
                              — insertId: {r.insertId}
                            </span>
                          )}
                        </div>
                      ))}
                </Descriptions.Item>
              )}
            </>
          )}
        </Descriptions>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Title level={4}>推文清單（逐筆審核）</Title>
        {alreadyReviewed && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="此申請已審核完成，以下顯示為最終結果"
          />
        )}
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {items.map((it, idx) => {
            const currentResult = itemResults[it.id] ?? 'rejected';
            const hasDup = (it.duplicates?.length ?? 0) > 0;
            return (
              <Card key={it.id} size="small" type="inner">
                <Space
                  align="start"
                  style={{
                    width: '100%',
                    justifyContent: 'space-between',
                  }}
                  wrap
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 500,
                        marginBottom: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>第 {idx + 1} 筆</span>
                      <Tag>{it.type === 'link' ? '分享連結' : '截圖'}</Tag>
                      {hasDup && <Tag color="red">重複連結</Tag>}
                    </div>
                    {it.type === 'link' ? (
                      <a
                        href={it.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ wordBreak: 'break-all' }}
                      >
                        {it.content}
                      </a>
                    ) : (
                      <AntImage
                        src={it.content}
                        alt={`截圖 ${idx + 1}`}
                        style={{ maxWidth: 200 }}
                      />
                    )}
                    {hasDup && (
                      <div style={{ marginTop: 8, fontSize: 12 }}>
                        <Text type="secondary">
                          此連結先前出現於：
                          {it.duplicates!.map((d) => (
                            <div key={d.applicationId}>
                              <Link
                                href={`/module/forum-push/${d.applicationId}`}
                              >
                                {dayjs(d.createdAt).format('YYYY-MM-DD HH:mm')}
                              </Link>
                              （{d.reviewResult}）
                            </div>
                          ))}
                        </Text>
                      </div>
                    )}
                  </div>
                  <Space>
                    <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                      {currentResult === 'passed' ? '通過' : '未通過'}
                    </span>
                    <Switch
                      checked={currentResult === 'passed'}
                      disabled={alreadyReviewed}
                      onChange={(checked) =>
                        setItemResults((prev) => ({
                          ...prev,
                          [it.id]: checked ? 'passed' : 'rejected',
                        }))
                      }
                    />
                  </Space>
                </Space>
              </Card>
            );
          })}
        </Space>
      </Card>

      <Card>
        <Title level={4}>審核備註 / 未通過原因</Title>
        <TextArea
          rows={3}
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          disabled={alreadyReviewed}
          placeholder="選填，會顯示於玩家的申請紀錄上"
        />

        <div style={{ marginTop: 16 }}>
          {alreadyReviewed ? (
            <Alert type="success" message="此申請已完成審核" showIcon />
          ) : (
            <Alert
              type="info"
              showIcon
              message={
                <>
                  目前設定通過 <strong>{passedPreview}</strong> 筆 / 共{' '}
                  <strong>{items.length}</strong> 筆，按「儲存並發放獎勵」後系統會依獎勵道具設定自動寫入遊戲庫
                </>
              }
            />
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <Popconfirm
            title="確認送出審核並發放獎勵？"
            description={`共通過 ${passedPreview} 筆，發放後無法修改`}
            onConfirm={handleSubmit}
            disabled={alreadyReviewed || submitting}
          >
            <Button
              type="primary"
              size="large"
              loading={submitting}
              disabled={alreadyReviewed}
            >
              儲存並發放獎勵
            </Button>
          </Popconfirm>
        </div>
      </Card>
    </div>
  );
}
