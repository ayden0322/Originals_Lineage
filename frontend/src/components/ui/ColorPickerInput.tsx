'use client';

import { useState, useRef, useEffect } from 'react';
import { RgbaColorPicker, HexColorPicker } from 'react-colorful';
import { Input, Popover, Space, Button } from 'antd';
import { BgColorsOutlined } from '@ant-design/icons';

// Preset color palettes for gaming themes
const PRESET_COLORS = [
  // Whites & Lights
  '#ffffff', '#f0f0f0', '#d9d9d9', '#bfbfbf',
  // Golds
  '#c4a24e', '#d4af37', '#ffd700', '#b8860b',
  // Reds
  '#ff4d4f', '#cf1322', '#a8071a', '#ff7875',
  // Blues
  '#1677ff', '#0958d9', '#69b1ff', '#4096ff',
  // Greens
  '#52c41a', '#389e0d', '#95de64', '#73d13d',
  // Purples
  '#722ed1', '#9254de', '#b37feb', '#531dab',
  // Cyans
  '#13c2c2', '#08979c', '#36cfc9', '#006d75',
  // Dark
  '#000000', '#141414', '#1f1f1f', '#262626',
];

// Transparent presets
const ALPHA_PRESETS = [
  'rgba(255,255,255,1)',
  'rgba(255,255,255,0.8)',
  'rgba(255,255,255,0.5)',
  'rgba(255,255,255,0.3)',
  'rgba(255,255,255,0.1)',
  'rgba(0,0,0,0.8)',
  'rgba(0,0,0,0.5)',
  'rgba(0,0,0,0.3)',
  'rgba(196,162,78,1)',
  'rgba(196,162,78,0.7)',
  'rgba(196,162,78,0.5)',
  'rgba(196,162,78,0.3)',
];

interface ColorPickerInputProps {
  value?: string;
  onChange?: (color: string) => void;
  label?: string;
  supportsAlpha?: boolean;
}

function parseRgba(color: string): { r: number; g: number; b: number; a: number } {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (match) {
    return {
      r: parseInt(match[1]),
      g: parseInt(match[2]),
      b: parseInt(match[3]),
      a: match[4] !== undefined ? parseFloat(match[4]) : 1,
    };
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}

function rgbaToString(c: { r: number; g: number; b: number; a: number }): string {
  return `rgba(${c.r},${c.g},${c.b},${c.a})`;
}

export default function ColorPickerInput({
  value = '#ffffff',
  onChange,
  supportsAlpha = false,
}: ColorPickerInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleInputChange = (val: string) => {
    setInputValue(val);
    // Only propagate valid colors
    if (val.startsWith('#') && (val.length === 7 || val.length === 4)) {
      onChange?.(val);
    } else if (val.startsWith('rgba') || val.startsWith('rgb')) {
      onChange?.(val);
    }
  };

  const handleInputBlur = () => {
    onChange?.(inputValue);
  };

  const pickerContent = (
    <div style={{ width: 260 }} ref={containerRef}>
      {/* Color picker */}
      {supportsAlpha ? (
        <RgbaColorPicker
          color={parseRgba(value)}
          onChange={(c) => {
            const str = rgbaToString(c);
            setInputValue(str);
            onChange?.(str);
          }}
          style={{ width: '100%', height: 160 }}
        />
      ) : (
        <HexColorPicker
          color={value.startsWith('#') ? value : '#ffffff'}
          onChange={(c) => {
            setInputValue(c);
            onChange?.(c);
          }}
          style={{ width: '100%', height: 160 }}
        />
      )}

      {/* Color value input */}
      <Input
        size="small"
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onBlur={handleInputBlur}
        onPressEnter={handleInputBlur}
        style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 12 }}
        prefix={
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 3,
              background: value,
              border: '1px solid #d9d9d9',
            }}
          />
        }
      />

      {/* Preset colors */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>
          預設色
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {(supportsAlpha ? ALPHA_PRESETS : PRESET_COLORS).map((c) => (
            <div
              key={c}
              onClick={() => {
                setInputValue(c);
                onChange?.(c);
              }}
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                background: c,
                border: value === c ? '2px solid #1677ff' : '1px solid #d9d9d9',
                cursor: 'pointer',
                transition: 'transform 0.1s',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.transform = 'scale(1.2)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.transform = 'scale(1)';
              }}
              title={c}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <Popover
      content={pickerContent}
      trigger="click"
      placement="bottomLeft"
    >
      <Space.Compact style={{ cursor: 'pointer' }}>
        <Button
          style={{
            width: 36,
            height: 32,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              background: value,
              border: '1px solid #d9d9d9',
            }}
          />
        </Button>
        <Input
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={handleInputBlur}
          style={{ width: 180, fontFamily: 'monospace', fontSize: 12 }}
          suffix={<BgColorsOutlined style={{ color: '#999' }} />}
        />
      </Space.Compact>
    </Popover>
  );
}
