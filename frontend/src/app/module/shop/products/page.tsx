'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Switch,
  InputNumber,
  Popconfirm,
  message,
  Select,
  Upload,
  Row,
  Col,
  Image,
  Empty,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  UploadOutlined,
  SaveOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  moveProduct,
  getProductTemplates,
  createProductTemplate,
} from '@/lib/api/shop';
import { uploadFile, listMedia, type MediaItem } from '@/lib/api/site-manage';
import type {
  Product,
  CreateProductDto,
  ProductCategory,
  ProductTemplate,
} from '@/lib/types';

// ─── 常數 ──────────────────────────────────────────────────────────────

/**
 * 目前僅支援 diamond（四海銀票）類別。
 * 歷史上有 game_item / monthly_card，資料庫可能仍有舊資料但本頁已不顯示／不允許新建。
 */
const CATEGORY_TABS: { key: ProductCategory; label: string; color: string }[] = [
  { key: 'diamond', label: '四海銀票', color: 'gold' },
];

const WEEKDAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

type LimitKey = 'daily' | 'weekly' | 'monthly' | 'account' | 'level';

const LIMIT_OPTIONS: { key: LimitKey; label: string }[] = [
  { key: 'daily', label: '每日限購' },
  { key: 'weekly', label: '每週限購' },
  { key: 'monthly', label: '每月限購' },
  { key: 'account', label: '帳號總限購' },
  { key: 'level', label: '角色等級限制' },
];

// ─── 主元件 ────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [activeCategory, setActiveCategory] = useState<ProductCategory>('diamond');
  const [data, setData] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  // 表單相關
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<CreateProductDto>();
  const [enabledLimits, setEnabledLimits] = useState<LimitKey[]>([]);
  // 媒體庫挑選器
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  // 儲存範本對話框
  const [saveTplOpen, setSaveTplOpen] = useState(false);
  const [saveTplName, setSaveTplName] = useState('');

  // 載入範本下拉
  const [templates, setTemplates] = useState<ProductTemplate[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getProducts(page, pageSize, activeCategory);
      setData(res.items);
      setTotal(res.total);
    } catch {
      message.error('載入商品列表失敗');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, activeCategory]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── 表單操作 ─────────────────────────────────────────────────────

  const resetForm = (category: ProductCategory) => {
    form.resetFields();
    form.setFieldsValue({
      category,
      stock: -1,
      accountLimit: 0,
      isActive: true,
      sortOrder: 0,
    });
    setEnabledLimits([]);
  };

  const openCreate = () => {
    setEditingId(null);
    resetForm(activeCategory);
    setModalOpen(true);
  };

  const openEdit = (record: Product) => {
    setEditingId(record.id);
    const limits: LimitKey[] = [];
    if (record.dailyLimit != null) limits.push('daily');
    if (record.weeklyLimit != null) limits.push('weekly');
    if (record.monthlyLimit != null) limits.push('monthly');
    if (record.accountLimit > 0) limits.push('account');
    if (record.requiredLevel != null) limits.push('level');
    setEnabledLimits(limits);

    form.resetFields();
    form.setFieldsValue({
      name: record.name,
      description: record.description ?? undefined,
      price: Number(record.price),
      category: 'diamond',
      diamondAmount: record.diamondAmount,
      imageUrl: record.imageUrl ?? undefined,
      stock: record.stock,
      accountLimit: record.accountLimit,
      dailyLimit: record.dailyLimit ?? undefined,
      weeklyLimit: record.weeklyLimit ?? undefined,
      weeklyResetDay: record.weeklyResetDay ?? undefined,
      weeklyResetHour: record.weeklyResetHour ?? undefined,
      monthlyLimit: record.monthlyLimit ?? undefined,
      requiredLevel: record.requiredLevel ?? undefined,
      isActive: record.isActive,
      sortOrder: record.sortOrder,
    });
    setModalOpen(true);
  };

  const buildDtoFromForm = async (): Promise<CreateProductDto> => {
    const values = await form.validateFields();
    // 沒勾選的限制欄位 → 設為 null/0
    const dto: CreateProductDto = {
      name: values.name,
      description: values.description,
      price: values.price,
      category: 'diamond', // 固定 diamond（四海銀票）
      diamondAmount: values.diamondAmount,
      imageUrl: values.imageUrl || undefined,
      stock: values.stock,
      accountLimit: enabledLimits.includes('account') ? values.accountLimit ?? 0 : 0,
      dailyLimit: enabledLimits.includes('daily') ? values.dailyLimit ?? null : null,
      weeklyLimit: enabledLimits.includes('weekly') ? values.weeklyLimit ?? null : null,
      weeklyResetDay: enabledLimits.includes('weekly') ? values.weeklyResetDay ?? null : null,
      weeklyResetHour: enabledLimits.includes('weekly') ? values.weeklyResetHour ?? null : null,
      monthlyLimit: enabledLimits.includes('monthly') ? values.monthlyLimit ?? null : null,
      requiredLevel: enabledLimits.includes('level') ? values.requiredLevel ?? null : null,
      isActive: values.isActive,
      sortOrder: values.sortOrder,
    };
    return dto;
  };

  const handleSubmit = async () => {
    try {
      const dto = await buildDtoFromForm();
      setSubmitting(true);
      if (editingId) {
        await updateProduct(editingId, dto);
        message.success('商品更新成功');
      } else {
        await createProduct(dto);
        message.success('商品建立成功');
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      const error = err as { errorFields?: unknown[]; response?: { data?: { message?: string } } };
      if (error?.errorFields) return; // form validation error already shown
      message.error(error?.response?.data?.message || '操作失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct(id);
      message.success('刪除成功');
      fetchData();
    } catch {
      message.error('刪除失敗');
    }
  };

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    try {
      await moveProduct(id, direction);
      fetchData();
    } catch {
      message.error('排序失敗');
    }
  };

  // ─── 範本操作 ─────────────────────────────────────────────────────

  const loadTemplates = useCallback(async () => {
    try {
      const tpls = await getProductTemplates('diamond');
      setTemplates(tpls);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (modalOpen) loadTemplates();
  }, [modalOpen, loadTemplates]);

  const handleApplyTemplate = (id: string) => {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    const snap = tpl.snapshot as Partial<CreateProductDto>;
    form.setFieldsValue(snap);
    // 同步限制 chips 狀態
    const limits: LimitKey[] = [];
    if (snap.dailyLimit != null) limits.push('daily');
    if (snap.weeklyLimit != null) limits.push('weekly');
    if (snap.monthlyLimit != null) limits.push('monthly');
    if ((snap.accountLimit ?? 0) > 0) limits.push('account');
    if (snap.requiredLevel != null) limits.push('level');
    setEnabledLimits(limits);
    message.success(`已套用範本「${tpl.name}」`);
  };

  const handleSaveTemplate = async () => {
    if (!saveTplName.trim()) {
      message.warning('請輸入範本名稱');
      return;
    }
    try {
      const dto = await buildDtoFromForm();
      await createProductTemplate({
        name: saveTplName.trim(),
        category: dto.category,
        snapshot: dto as unknown as Record<string, unknown>,
      });
      message.success('範本已儲存');
      setSaveTplOpen(false);
      setSaveTplName('');
      loadTemplates();
    } catch (err) {
      const error = err as { errorFields?: unknown[] };
      if (!error?.errorFields) message.error('儲存範本失敗');
    }
  };

  // ─── 表格欄位 ─────────────────────────────────────────────────────

  const columns: ColumnsType<Product> = useMemo(
    () => [
      {
        title: '排序',
        key: 'order',
        width: 110,
        render: (_, record) => (
          <Space size={2}>
            <Tooltip title="上移">
              <Button
                size="small"
                icon={<ArrowUpOutlined />}
                onClick={() => handleMove(record.id, 'up')}
              />
            </Tooltip>
            <Tooltip title="下移">
              <Button
                size="small"
                icon={<ArrowDownOutlined />}
                onClick={() => handleMove(record.id, 'down')}
              />
            </Tooltip>
            <span style={{ marginLeft: 4, color: '#999' }}>{record.sortOrder}</span>
          </Space>
        ),
      },
      {
        title: '圖片',
        dataIndex: 'imageUrl',
        key: 'imageUrl',
        width: 80,
        render: (url: string | null) =>
          url ? (
            <Image src={url} width={48} height={48} style={{ objectFit: 'cover' }} />
          ) : (
            <PictureOutlined style={{ fontSize: 24, color: '#ccc' }} />
          ),
      },
      { title: '商品名稱', dataIndex: 'name', key: 'name', width: 200 },
      {
        title: '價格',
        dataIndex: 'price',
        key: 'price',
        width: 100,
        align: 'right',
        render: (val: string) => `NT$ ${Number(val).toLocaleString()}`,
      },
      {
        title: '內容',
        key: 'content',
        width: 180,
        render: (_, r) => `${r.diamondAmount} 四海銀票`,
      },
      {
        title: '限購',
        key: 'limits',
        width: 200,
        render: (_, r) => {
          const tags: string[] = [];
          if (r.dailyLimit != null) tags.push(`日 ${r.dailyLimit}`);
          if (r.weeklyLimit != null) tags.push(`週 ${r.weeklyLimit}`);
          if (r.monthlyLimit != null) tags.push(`月 ${r.monthlyLimit}`);
          if (r.accountLimit > 0) tags.push(`帳 ${r.accountLimit}`);
          if (r.requiredLevel != null) tags.push(`Lv≥${r.requiredLevel}`);
          return tags.length === 0 ? (
            <span style={{ color: '#ccc' }}>無</span>
          ) : (
            <Space size={4} wrap>
              {tags.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </Space>
          );
        },
      },
      {
        title: '啟用',
        dataIndex: 'isActive',
        key: 'isActive',
        width: 70,
        align: 'center',
        render: (val: boolean) => <Tag color={val ? 'green' : 'default'}>{val ? '啟用' : '停用'}</Tag>,
      },
      {
        title: '操作',
        key: 'actions',
        width: 140,
        render: (_, record) => (
          <Space>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
              編輯
            </Button>
            <Popconfirm
              title="確定要刪除此商品嗎？"
              onConfirm={() => handleDelete(record.id)}
              okText="確定"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                刪除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>商品管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增商品
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 筆`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      {/* ─── 商品編輯 Modal ───────────────────────────── */}
      <Modal
        title={editingId ? '編輯商品' : '新增商品'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText="儲存"
        cancelText="取消"
        width={760}
        forceRender
      >
        {/* 範本工具列 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 6 }}>
          <Select
            placeholder="📋 載入常用範本..."
            style={{ flex: 1 }}
            allowClear
            onChange={(v) => v && handleApplyTemplate(v)}
            options={templates.map((t) => ({ value: t.id, label: t.name }))}
          />
          <Button icon={<SaveOutlined />} onClick={() => setSaveTplOpen(true)}>
            儲存為常用
          </Button>
        </div>

        <Form form={form} layout="vertical" preserve={false}>
          {/* 類別固定為 diamond（四海銀票），不再提供切換 */}
          <Form.Item name="category" hidden initialValue="diamond">
            <Input />
          </Form.Item>

          <Form.Item
            name="diamondAmount"
            label="四海銀票數量"
            rules={[{ required: true, message: '請輸入四海銀票數量' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="name" label="商品名稱" rules={[{ required: true, message: '請輸入商品名稱' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="price" label="價格 (NT$)" rules={[{ required: true, message: '請輸入價格' }]}>
            <InputNumber min={0} style={{ width: '100%' }} addonBefore="NT$" />
          </Form.Item>

          {/* 圖片 */}
          <Form.Item label="商品圖片">
            <Form.Item name="imageUrl" noStyle>
              <Input placeholder="圖片網址" />
            </Form.Item>
            <Space style={{ marginTop: 8 }}>
              <Upload
                showUploadList={false}
                customRequest={async ({ file, onSuccess, onError }) => {
                  try {
                    const result = await uploadFile(file as File, 'shop');
                    form.setFieldsValue({ imageUrl: result.url });
                    message.success('上傳成功');
                    onSuccess?.(result);
                  } catch (e) {
                    message.error('上傳失敗');
                    onError?.(e as Error);
                  }
                }}
              >
                <Button icon={<UploadOutlined />}>上傳新圖片</Button>
              </Upload>
              <Button icon={<PictureOutlined />} onClick={() => setMediaPickerOpen(true)}>
                從媒體庫選擇
              </Button>
            </Space>
            <Form.Item shouldUpdate noStyle>
              {() => {
                const url = form.getFieldValue('imageUrl');
                return url ? (
                  <div style={{ marginTop: 8 }}>
                    <Image src={url} width={120} />
                  </div>
                ) : null;
              }}
            </Form.Item>
          </Form.Item>

          <Form.Item name="stock" label="庫存" extra="-1 代表無限">
            <InputNumber min={-1} style={{ width: '100%' }} />
          </Form.Item>

          {/* ─── 限購區 ─────────────────────────── */}
          <div style={{ border: '1px dashed #d9d9d9', borderRadius: 6, padding: 16, marginBottom: 16 }}>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong>購買限制</strong>
              <Select<LimitKey>
                size="small"
                placeholder="+ 新增限制"
                style={{ width: 160 }}
                value={undefined}
                onChange={(v) => {
                  if (v && !enabledLimits.includes(v)) {
                    setEnabledLimits([...enabledLimits, v]);
                  }
                }}
                options={LIMIT_OPTIONS.filter((o) => !enabledLimits.includes(o.key)).map((o) => ({
                  value: o.key,
                  label: o.label,
                }))}
              />
            </div>

            {enabledLimits.length === 0 && (
              <div style={{ color: '#999' }}>尚未設定任何購買限制</div>
            )}

            {enabledLimits.includes('daily') && (
              <Row gutter={8} align="middle" style={{ marginBottom: 8 }}>
                <Col flex="120px">每日限購</Col>
                <Col flex="auto">
                  <Form.Item name="dailyLimit" noStyle rules={[{ required: true, message: '請輸入次數' }]}>
                    <InputNumber min={1} style={{ width: '100%' }} addonAfter="次" />
                  </Form.Item>
                </Col>
                <Col>
                  <Button type="link" danger size="small" onClick={() => setEnabledLimits(enabledLimits.filter((k) => k !== 'daily'))}>
                    移除
                  </Button>
                </Col>
              </Row>
            )}

            {enabledLimits.includes('weekly') && (
              <Row gutter={8} align="middle" style={{ marginBottom: 8 }}>
                <Col flex="120px">每週限購</Col>
                <Col flex="auto">
                  <Space.Compact style={{ width: '100%' }}>
                    <Form.Item name="weeklyLimit" noStyle rules={[{ required: true }]}>
                      <InputNumber min={1} placeholder="次數" style={{ width: '33%' }} addonAfter="次" />
                    </Form.Item>
                    <Form.Item name="weeklyResetDay" noStyle rules={[{ required: true }]}>
                      <Select
                        placeholder="重置星期"
                        style={{ width: '33%' }}
                        options={WEEKDAY_LABELS.map((label, i) => ({ value: i, label }))}
                      />
                    </Form.Item>
                    <Form.Item name="weeklyResetHour" noStyle rules={[{ required: true }]}>
                      <InputNumber min={0} max={23} placeholder="時" style={{ width: '34%' }} addonAfter="時" />
                    </Form.Item>
                  </Space.Compact>
                </Col>
                <Col>
                  <Button type="link" danger size="small" onClick={() => setEnabledLimits(enabledLimits.filter((k) => k !== 'weekly'))}>
                    移除
                  </Button>
                </Col>
              </Row>
            )}

            {enabledLimits.includes('monthly') && (
              <Row gutter={8} align="middle" style={{ marginBottom: 8 }}>
                <Col flex="120px">每月限購</Col>
                <Col flex="auto">
                  <Form.Item name="monthlyLimit" noStyle rules={[{ required: true }]}>
                    <InputNumber min={1} style={{ width: '100%' }} addonAfter="次（每月 1 號重置）" />
                  </Form.Item>
                </Col>
                <Col>
                  <Button type="link" danger size="small" onClick={() => setEnabledLimits(enabledLimits.filter((k) => k !== 'monthly'))}>
                    移除
                  </Button>
                </Col>
              </Row>
            )}

            {enabledLimits.includes('account') && (
              <Row gutter={8} align="middle" style={{ marginBottom: 8 }}>
                <Col flex="120px">帳號總限購</Col>
                <Col flex="auto">
                  <Form.Item name="accountLimit" noStyle rules={[{ required: true }]}>
                    <InputNumber min={1} style={{ width: '100%' }} addonAfter="次（永久）" />
                  </Form.Item>
                </Col>
                <Col>
                  <Button type="link" danger size="small" onClick={() => setEnabledLimits(enabledLimits.filter((k) => k !== 'account'))}>
                    移除
                  </Button>
                </Col>
              </Row>
            )}

            {enabledLimits.includes('level') && (
              <Row gutter={8} align="middle" style={{ marginBottom: 8 }}>
                <Col flex="120px">角色等級</Col>
                <Col flex="auto">
                  <Form.Item name="requiredLevel" noStyle rules={[{ required: true }]}>
                    <InputNumber min={1} style={{ width: '100%' }} addonBefore="Lv ≥" />
                  </Form.Item>
                </Col>
                <Col>
                  <Button type="link" danger size="small" onClick={() => setEnabledLimits(enabledLimits.filter((k) => k !== 'level'))}>
                    移除
                  </Button>
                </Col>
              </Row>
            )}
          </div>

          <Form.Item name="isActive" label="啟用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序（小的在前）">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ─── 媒體庫挑選 Modal ───────────────────── */}
      <MediaPickerModal
        open={mediaPickerOpen}
        onCancel={() => setMediaPickerOpen(false)}
        onSelect={(url) => {
          form.setFieldsValue({ imageUrl: url });
          setMediaPickerOpen(false);
        }}
      />

      {/* ─── 儲存範本對話框 ─────────────────────── */}
      <Modal
        title="儲存為常用範本"
        open={saveTplOpen}
        onCancel={() => setSaveTplOpen(false)}
        onOk={handleSaveTemplate}
        okText="儲存"
        cancelText="取消"
      >
        <p>將目前表單的所有設定儲存為共用範本，所有管理者皆可使用。</p>
        <Input
          placeholder="範本名稱（例：標準鑽石包）"
          value={saveTplName}
          onChange={(e) => setSaveTplName(e.target.value)}
        />
      </Modal>
    </div>
  );
}

// ─── 子元件：媒體庫挑選 ────────────────────────────────────────────

function MediaPickerModal({
  open,
  onCancel,
  onSelect,
}: {
  open: boolean;
  onCancel: () => void;
  onSelect: (url: string) => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listMedia('shop')
      .then((list) => setItems(list || []))
      .catch(() => message.error('載入媒體庫失敗'))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Modal
      title="從媒體庫選擇圖片（shop 資料夾）"
      open={open}
      onCancel={onCancel}
      footer={null}
      width={720}
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>載入中...</div>
      ) : items.length === 0 ? (
        <Empty description="媒體庫沒有 shop 資料夾的檔案" />
      ) : (
        <Row gutter={[12, 12]}>
          {items.map((item) => (
            <Col key={item.objectName} xs={12} sm={8} md={6}>
              <div
                style={{
                  border: '1px solid #f0f0f0',
                  borderRadius: 4,
                  padding: 4,
                  cursor: 'pointer',
                }}
                onClick={() => onSelect(item.url)}
              >
                <img
                  src={item.url}
                  alt={item.objectName}
                  style={{ width: '100%', height: 120, objectFit: 'cover' }}
                />
                <div
                  style={{
                    fontSize: 11,
                    color: '#666',
                    marginTop: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.objectName.split('/').pop()}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      )}
    </Modal>
  );
}
