'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Card,
  Checkbox,
  Button,
  Descriptions,
  Tag,
  Spin,
  Divider,
  message,
  Space,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useParams, useRouter } from 'next/navigation';
import type { Account, Permission } from '@/lib/types';
import { getAccount } from '@/lib/api/accounts';
import {
  getAllPermissions,
  getAccountPermissionCodes,
  assignPermissions,
  revokePermissions,
} from '@/lib/api/permissions';

export default function AccountPermissionsPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [assignedCodes, setAssignedCodes] = useState<Set<string>>(new Set());
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [acct, perms, codes] = await Promise.all([
        getAccount(accountId),
        getAllPermissions(),
        getAccountPermissionCodes(accountId),
      ]);
      setAccount(acct);
      setAllPermissions(perms);

      const codeSet = new Set(codes);
      setAssignedCodes(codeSet);
      setSelectedCodes(new Set(codeSet));
    } catch {
      message.error('載入權限資料失敗');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 根據帳號層級過濾可見的權限
  const visiblePermissions = useMemo(() => {
    if (!account) return allPermissions;
    if (account.backendLevel === 'platform') return allPermissions;
    // Module 帳號只顯示 module 級別權限
    return allPermissions.filter((p) => p.backendLevel === 'module');
  }, [allPermissions, account]);

  // Group permissions by category
  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const perm of visiblePermissions) {
      const cat = perm.category || '其他';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(perm);
    }
    return map;
  }, [visiblePermissions]);

  const handleToggle = (code: string, checked: boolean) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(code);
      } else {
        next.delete(code);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const toAssign = Array.from(selectedCodes).filter((c) => !assignedCodes.has(c));
      const toRevoke = Array.from(assignedCodes).filter((c) => !selectedCodes.has(c));

      const tasks: Promise<void>[] = [];
      if (toAssign.length > 0) {
        tasks.push(assignPermissions(accountId, toAssign));
      }
      if (toRevoke.length > 0) {
        tasks.push(revokePermissions(accountId, toRevoke));
      }

      await Promise.all(tasks);
      message.success('權限已更新');
      setAssignedCodes(new Set(selectedCodes));
    } catch {
      message.error('更新權限失敗');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = useMemo(() => {
    if (selectedCodes.size !== assignedCodes.size) return true;
    const arr = Array.from(selectedCodes);
    for (let i = 0; i < arr.length; i++) {
      if (!assignedCodes.has(arr[i])) return true;
    }
    return false;
  }, [selectedCodes, assignedCodes]);

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push('/platform/accounts')}
        >
          返回帳號列表
        </Button>
      </Space>

      <Spin spinning={loading}>
        {account && (
          <Card style={{ marginBottom: 24 }}>
            <Descriptions title="帳號資訊" column={{ xs: 1, sm: 2, md: 3 }}>
              <Descriptions.Item label="Email">{account.email}</Descriptions.Item>
              <Descriptions.Item label="暱稱">{account.displayName}</Descriptions.Item>
              <Descriptions.Item label="層級">
                {account.backendLevel === 'platform' ? (
                  <Tag color="purple">Platform</Tag>
                ) : (
                  <Tag color="blue">Module</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="狀態">
                {account.isActive ? (
                  <Tag color="green">啟用</Tag>
                ) : (
                  <Tag color="red">停用</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="最後登入">
                {account.lastLoginAt
                  ? new Date(account.lastLoginAt).toLocaleString('zh-TW')
                  : '—'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        <Card
          title="權限設定"
          extra={
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              disabled={!hasChanges}
              onClick={handleSave}
            >
              儲存變更
            </Button>
          }
        >
          {Array.from(grouped.entries()).map(([category, perms]) => (
            <div key={category}>
              <Divider orientation="left" style={{ fontWeight: 600 }}>
                {category}
              </Divider>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 8,
                  paddingLeft: 16,
                }}
              >
                {perms.map((perm) => (
                  <Checkbox
                    key={perm.code}
                    checked={selectedCodes.has(perm.code)}
                    onChange={(e) => handleToggle(perm.code, e.target.checked)}
                  >
                    <span style={{ fontWeight: 500 }}>{perm.name}</span>
                    <span style={{ color: '#888', fontSize: 12, marginLeft: 4 }}>
                      ({perm.code})
                    </span>
                  </Checkbox>
                ))}
              </div>
            </div>
          ))}

          {visiblePermissions.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>
              目前沒有可設定的權限
            </div>
          )}
        </Card>
      </Spin>
    </div>
  );
}
