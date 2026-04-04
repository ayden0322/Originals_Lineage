'use client';

import { useState, useCallback, useEffect } from 'react';
import { Form, Input, InputNumber, Card, Select, Slider, Button, message, Typography } from 'antd';
import { BgColorsOutlined, FontSizeOutlined, ColumnWidthOutlined, SaveOutlined } from '@ant-design/icons';
import ColorPickerInput from '@/components/ui/ColorPickerInput';
import { getSiteSettings, updateSiteSettings } from '@/lib/api/site-manage';

const { Title } = Typography;

// Font options with grouping
const FONT_OPTIONS = [
  { label: 'Serif', options: [
    { value: "'Georgia', serif", label: 'Georgia' },
    { value: "'Times New Roman', serif", label: 'Times New Roman' },
    { value: "'Palatino Linotype', serif", label: 'Palatino Linotype' },
    { value: "'Garamond', serif", label: 'Garamond' },
    { value: "'Book Antiqua', serif", label: 'Book Antiqua' },
  ]},
  { label: 'Sans-serif', options: [
    { value: "'Arial', sans-serif", label: 'Arial' },
    { value: "'Helvetica Neue', sans-serif", label: 'Helvetica Neue' },
    { value: "'Segoe UI', sans-serif", label: 'Segoe UI' },
    { value: "'Roboto', sans-serif", label: 'Roboto' },
    { value: "'Inter', sans-serif", label: 'Inter' },
    { value: "sans-serif", label: 'System Sans-serif' },
  ]},
  { label: '中文字體', options: [
    { value: "'Noto Sans TC', sans-serif", label: 'Noto Sans TC (思源黑體)' },
    { value: "'Noto Serif TC', serif", label: 'Noto Serif TC (思源宋體)' },
    { value: "'HanWangLiSuMedium', serif", label: '王漢宗隸書體' },
    { value: "'Microsoft JhengHei', sans-serif", label: '微軟正黑體' },
    { value: "'PingFang TC', sans-serif", label: '蘋方-繁' },
  ]},
  { label: '裝飾 / 遊戲風格', options: [
    { value: "'Cinzel', serif", label: 'Cinzel (中世紀)' },
    { value: "'Cinzel Decorative', serif", label: 'Cinzel Decorative' },
    { value: "'Playfair Display', serif", label: 'Playfair Display' },
    { value: "'Cormorant Garamond', serif", label: 'Cormorant Garamond' },
    { value: "'Lora', serif", label: 'Lora' },
    { value: "'Merriweather', serif", label: 'Merriweather' },
    { value: "'Josefin Sans', sans-serif", label: 'Josefin Sans' },
    { value: "'Oswald', sans-serif", label: 'Oswald' },
    { value: "'Raleway', sans-serif", label: 'Raleway' },
    { value: "'Montserrat', sans-serif", label: 'Montserrat' },
  ]},
  { label: '等寬', options: [
    { value: "'Courier New', monospace", label: 'Courier New' },
    { value: "'Fira Code', monospace", label: 'Fira Code' },
  ]},
];

const WEIGHT_OPTIONS = [
  { value: '100', label: 'Thin' },
  { value: '200', label: 'ExtraLight' },
  { value: '300', label: 'Light' },
  { value: '400', label: 'Normal' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'SemiBold' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'ExtraBold' },
  { value: '900', label: 'Black' },
];

export default function NavStylePage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewActive, setPreviewActive] = useState(0);

  const [pv, setPv] = useState({
    navActiveColor: '#ffffff',
    navInactiveColor: 'rgba(255,255,255,0.3)',
    navActiveFontSize: 24,
    navInactiveFontSize: 14,
    navActiveFontWeight: '700',
    navInactiveFontWeight: '400',
    navLetterSpacing: 2,
    navFontFamily: "'Georgia', serif",
  });

  const fetchData = useCallback(async () => {
    try {
      const settings = await getSiteSettings();
      const navFields = {
        navActiveColor: settings.navActiveColor || '#ffffff',
        navInactiveColor: settings.navInactiveColor || 'rgba(255,255,255,0.3)',
        navActiveFontSize: settings.navActiveFontSize || 24,
        navInactiveFontSize: settings.navInactiveFontSize || 14,
        navActiveFontWeight: settings.navActiveFontWeight || '700',
        navInactiveFontWeight: settings.navInactiveFontWeight || '400',
        navLetterSpacing: settings.navLetterSpacing || 2,
        navFontFamily: settings.navFontFamily || "'Georgia', serif",
      };
      form.setFieldsValue(navFields);
      setPv(navFields);
    } catch {
      message.error('載入設定失敗');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await updateSiteSettings(values);
      message.success('導航樣式已儲存');
    } catch {
      message.error('儲存失敗');
    } finally {
      setSubmitting(false);
    }
  };

  // Update both form and preview state
  const update = (key: string, val: unknown) => {
    form.setFieldValue(key, val);
    setPv((prev) => ({ ...prev, [key]: val }));
  };

  const previewSections = ['世界觀', '世界', '職業', '遊戲特色'];

  const cardHeadStyle = {
    fontSize: 14,
    fontWeight: 600 as const,
    borderBottom: '1px solid #f0f0f0',
    padding: '12px 16px',
    minHeight: 'auto' as const,
  };

  return (
    <div>
      <Title level={3}>輪播標題樣式</Title>
      <Card loading={loading} styles={{ body: { padding: 0 } }}>
        <Form form={form} layout="vertical">
          {/* Hidden fields for form submission */}
          <Form.Item name="navActiveColor" hidden><Input /></Form.Item>
          <Form.Item name="navInactiveColor" hidden><Input /></Form.Item>
          <Form.Item name="navActiveFontSize" hidden><InputNumber /></Form.Item>
          <Form.Item name="navInactiveFontSize" hidden><InputNumber /></Form.Item>
          <Form.Item name="navActiveFontWeight" hidden><Input /></Form.Item>
          <Form.Item name="navInactiveFontWeight" hidden><Input /></Form.Item>
          <Form.Item name="navLetterSpacing" hidden><InputNumber /></Form.Item>
          <Form.Item name="navFontFamily" hidden><Input /></Form.Item>
        </Form>

        {/* ═══ Preview Area ═══ */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0a0a0a 0%, #141420 50%, #0d1117 100%)',
            borderRadius: '8px 8px 0 0',
            padding: '40px 48px',
            minHeight: 260,
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Decorative elements */}
          <div style={{ position: 'absolute', right: 60, top: '50%', transform: 'translateY(-50%) rotate(45deg)', width: 120, height: 120, border: '1px solid rgba(196,162,78,0.12)', borderRadius: 4 }} />
          <div style={{ position: 'absolute', right: 100, top: '50%', transform: 'translateY(-50%) rotate(45deg)', width: 80, height: 80, border: '1px solid rgba(196,162,78,0.08)', borderRadius: 4 }} />
          <div style={{ position: 'absolute', right: 30, bottom: 30, width: 200, height: 1, background: 'linear-gradient(90deg, transparent, rgba(196,162,78,0.15))' }} />

          {/* Nav preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, letterSpacing: 2, marginBottom: 4, textTransform: 'uppercase' }}>
              Navigation Preview
            </div>
            {previewSections.map((name, idx) => {
              const isActive = idx === previewActive;
              return (
                <div
                  key={name}
                  onClick={() => setPreviewActive(idx)}
                  style={{
                    color: isActive ? (pv.navActiveColor || '#fff') : (pv.navInactiveColor || 'rgba(255,255,255,0.3)'),
                    fontSize: isActive ? `${pv.navActiveFontSize || 24}px` : `${pv.navInactiveFontSize || 14}px`,
                    fontWeight: isActive ? (pv.navActiveFontWeight || '700') : (pv.navInactiveFontWeight || '400'),
                    letterSpacing: `${pv.navLetterSpacing || 2}px`,
                    fontFamily: pv.navFontFamily || "'Georgia', serif",
                    opacity: isActive ? 1 : 0.5,
                    transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                    padding: '4px 0',
                    borderLeft: isActive ? '2px solid rgba(196,162,78,0.6)' : '2px solid transparent',
                    paddingLeft: 12,
                  }}
                >
                  {name}
                </div>
              );
            })}
            <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 8, letterSpacing: 0.5 }}>
              Click items to switch active state
            </div>
          </div>
        </div>

        {/* ═══ Control Panel — 3 Column Cards ═══ */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            padding: 20,
          }}
        >
          {/* Card A: Colors */}
          <Card
            size="small"
            title={<span><BgColorsOutlined style={{ marginRight: 8, color: '#c4a24e' }} />顏色設定</span>}
            styles={{ header: cardHeadStyle, body: { padding: '16px' } }}
          >
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>當前項目</div>
              <ColorPickerInput
                value={pv.navActiveColor}
                onChange={(c) => update('navActiveColor', c)}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>非當前項目</div>
              <ColorPickerInput
                value={pv.navInactiveColor}
                onChange={(c) => update('navInactiveColor', c)}
                supportsAlpha
              />
            </div>
          </Card>

          {/* Card B: Font */}
          <Card
            size="small"
            title={<span><FontSizeOutlined style={{ marginRight: 8, color: '#c4a24e' }} />字體設定</span>}
            styles={{ header: cardHeadStyle, body: { padding: '16px' } }}
          >
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>字體</div>
              <Select
                value={pv.navFontFamily}
                onChange={(v) => update('navFontFamily', v)}
                style={{ width: '100%' }}
                showSearch
                optionFilterProp="label"
                options={FONT_OPTIONS}
                optionRender={(option) => (
                  <span style={{ fontFamily: option.value as string }}>
                    {option.label}
                  </span>
                )}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                字距 <span style={{ float: 'right', color: '#1677ff' }}>{pv.navLetterSpacing}px</span>
              </div>
              <Slider
                min={0}
                max={20}
                step={0.5}
                value={pv.navLetterSpacing}
                onChange={(v) => update('navLetterSpacing', v)}
              />
            </div>
          </Card>

          {/* Card C: Size & Weight */}
          <Card
            size="small"
            title={<span><ColumnWidthOutlined style={{ marginRight: 8, color: '#c4a24e' }} />大小與粗細</span>}
            styles={{ header: cardHeadStyle, body: { padding: '16px' } }}
          >
            {/* Two column layout: Active vs Inactive */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ textAlign: 'center', padding: '4px 8px', background: '#f6f6f6', borderRadius: 4, fontSize: 12, fontWeight: 600, color: '#333' }}>
                當前
              </div>
              <div style={{ textAlign: 'center', padding: '4px 8px', background: '#f6f6f6', borderRadius: 4, fontSize: 12, fontWeight: 600, color: '#333' }}>
                非當前
              </div>

              {/* Font size */}
              <div>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>
                  大小 <span style={{ color: '#1677ff' }}>{pv.navActiveFontSize}px</span>
                </div>
                <Slider min={12} max={72} value={pv.navActiveFontSize} onChange={(v) => update('navActiveFontSize', v)} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>
                  大小 <span style={{ color: '#1677ff' }}>{pv.navInactiveFontSize}px</span>
                </div>
                <Slider min={10} max={48} value={pv.navInactiveFontSize} onChange={(v) => update('navInactiveFontSize', v)} />
              </div>

              {/* Font weight */}
              <div>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>粗細</div>
                <Select
                  size="small"
                  value={pv.navActiveFontWeight}
                  onChange={(v) => update('navActiveFontWeight', v)}
                  style={{ width: '100%' }}
                  options={WEIGHT_OPTIONS}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>粗細</div>
                <Select
                  size="small"
                  value={pv.navInactiveFontWeight}
                  onChange={(v) => update('navInactiveFontWeight', v)}
                  style={{ width: '100%' }}
                  options={WEIGHT_OPTIONS}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Save button */}
        <div style={{ padding: '0 20px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={submitting} size="large">
            儲存導航樣式
          </Button>
        </div>
      </Card>
    </div>
  );
}
