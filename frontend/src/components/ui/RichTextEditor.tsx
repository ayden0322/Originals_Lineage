'use client';

import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExt from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import FontFamily from '@tiptap/extension-font-family';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';

// 共用：組合 cell 的 inline style
function buildCellStyle(attrs: Record<string, unknown>): Record<string, string> {
  const parts: string[] = [];
  if (attrs.backgroundColor) parts.push(`background-color: ${attrs.backgroundColor}`);
  if (attrs.verticalAlign) parts.push(`vertical-align: ${attrs.verticalAlign}`);
  if (!parts.length) return {};
  return { style: parts.join('; ') };
}

// 共用：cell 擴展屬性（backgroundColor + verticalAlign）
const cellAttributes = {
  backgroundColor: {
    default: null,
    parseHTML: (el: HTMLElement) => el.style.backgroundColor || null,
  },
  verticalAlign: {
    default: null,
    parseHTML: (el: HTMLElement) => el.style.verticalAlign || null,
  },
};

const CustomTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellAttributes };
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['td', { ...HTMLAttributes, ...buildCellStyle(node.attrs) }, 0];
  },
});

const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellAttributes };
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['th', { ...HTMLAttributes, ...buildCellStyle(node.attrs) }, 0];
  },
});
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Button, Upload, Tooltip, Divider, Dropdown, Popover, ColorPicker, message } from 'antd';
import type { MenuProps, ColorPickerProps } from 'antd';
import { EDITOR_FONT_OPTIONS } from '@/lib/fonts';
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  StrikethroughOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
  PictureOutlined,
  LinkOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  UndoOutlined,
  RedoOutlined,
  DownOutlined,
  FontSizeOutlined,
  CodeOutlined,
  TableOutlined,
  MinusOutlined,
  InsertRowAboveOutlined,
  InsertRowBelowOutlined,
  InsertRowLeftOutlined,
  InsertRowRightOutlined,
  DeleteRowOutlined,
  DeleteColumnOutlined,
  DeleteOutlined,
  MergeCellsOutlined,
  SplitCellsOutlined,
  BgColorsOutlined,
  VerticalAlignTopOutlined,
  VerticalAlignMiddleOutlined,
  VerticalAlignBottomOutlined,
  AppstoreOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { uploadFile } from '@/lib/api/site-manage';
import { TabsBlock, TABS_BLOCK_NODE_NAME } from './extensions/TabsBlock';

interface RichTextEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  folder?: string;
  placeholder?: string;
  minHeight?: number;
  /** 是否啟用「分頁區塊」extension（預設 true；在分頁編輯 Modal 內傳 false 避免巢狀無限遞迴） */
  enableTabsBlock?: boolean;
}

// 簡易 HTML 格式化：加入縮排與換行
function formatHTML(html: string): string {
  const selfClosing = new Set(['img', 'br', 'hr', 'input', 'meta', 'link']);
  let result = '';
  let indent = 0;
  const pad = () => '  '.repeat(indent);

  // 將 HTML 拆成 tag 和文字片段
  const tokens = html.replace(/>\s*</g, '>\n<').split('\n');

  for (const raw of tokens) {
    const token = raw.trim();
    if (!token) continue;

    // 結束標籤
    if (token.startsWith('</')) {
      indent = Math.max(0, indent - 1);
      result += pad() + token + '\n';
    }
    // 自閉合標籤
    else if (token.startsWith('<') && (token.endsWith('/>') || selfClosing.has((token.match(/^<(\w+)/)?.[1] || '').toLowerCase()))) {
      result += pad() + token + '\n';
    }
    // 開始標籤（同行帶結束標籤，如 <p>text</p>）
    else if (token.startsWith('<') && token.includes('</')) {
      result += pad() + token + '\n';
    }
    // 開始標籤
    else if (token.startsWith('<')) {
      result += pad() + token + '\n';
      indent++;
    }
    // 純文字
    else {
      result += pad() + token + '\n';
    }
  }

  return result.trimEnd();
}

// 擴展 Image 節點，支援 textAlign + width + ReactNodeView
import { ImageNodeView } from './ImageNodeView';

const AlignableImage = ImageExt.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      textAlign: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-text-align') || null,
        renderHTML: (attributes) => {
          if (!attributes.textAlign) return {};
          // 文繞圖樣式：左/右 → float；置中 → 區塊置中
          let style = '';
          if (attributes.textAlign === 'left') {
            style = 'float: left; margin: 4px 16px 8px 0; max-width: 50%;';
          } else if (attributes.textAlign === 'right') {
            style = 'float: right; margin: 4px 0 8px 16px; max-width: 50%;';
          } else if (attributes.textAlign === 'center') {
            style = 'display: block; margin: 8px auto; clear: both;';
          }
          return {
            'data-text-align': attributes.textAlign,
            style,
          };
        },
      },
      width: {
        default: null,
        parseHTML: (element) => {
          const w = element.getAttribute('width') || element.style.width;
          return w ? parseInt(w, 10) || null : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { width: attributes.width, style: `width: ${attributes.width}px` };
        },
      },
      // 綁定影片：前台點擊圖片時跳出 Modal 播放這支 mp4
      videoUrl: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-video-url') || null,
        renderHTML: (attributes) => {
          if (!attributes.videoUrl) return {};
          return { 'data-video-url': attributes.videoUrl };
        },
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

/** 表格格子選擇器 — 滑鼠移過格子即時 highlight，點擊插入對應大小的表格 */
const MAX_GRID_ROWS = 8;
const MAX_GRID_COLS = 8;
const CELL_SIZE = 22;
const CELL_GAP = 3;

function TableGridPicker({ onSelect }: { onSelect: (rows: number, cols: number) => void }) {
  const [hover, setHover] = useState<{ r: number; c: number }>({ r: 0, c: 0 });

  return (
    <div style={{ padding: '8px 8px 4px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${MAX_GRID_COLS}, ${CELL_SIZE}px)`,
          gap: CELL_GAP,
        }}
        onMouseLeave={() => setHover({ r: 0, c: 0 })}
      >
        {Array.from({ length: MAX_GRID_ROWS * MAX_GRID_COLS }, (_, idx) => {
          const r = Math.floor(idx / MAX_GRID_COLS);
          const c = idx % MAX_GRID_COLS;
          const active = r < hover.r && c < hover.c;
          return (
            <div
              key={idx}
              onMouseEnter={() => setHover({ r: r + 1, c: c + 1 })}
              onClick={() => onSelect(r + 1, c + 1)}
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                borderRadius: 3,
                border: `1.5px solid ${active ? '#1677ff' : '#d9d9d9'}`,
                background: active ? '#e6f4ff' : '#fff',
                cursor: 'pointer',
                transition: 'all 0.08s',
              }}
            />
          );
        })}
      </div>
      <div style={{ textAlign: 'center', marginTop: 6, fontSize: 12, color: '#666', lineHeight: '20px' }}>
        {hover.r > 0 ? `${hover.r} × ${hover.c}` : '選擇表格大小'}
      </div>
    </div>
  );
}

/**
 * 色盤預設 — 依無盡天堂品牌 + 語義/中性色分組
 * 加上「最近使用」(localStorage) 與 antd 內建進階調色面板（HEX/RGB/吸管）
 */
const BRAND_PRESETS: NonNullable<ColorPickerProps['presets']> = [
  {
    label: '品牌金',
    colors: ['#c4a24e', '#d4b76a', '#f5d77a', '#7a5820', '#1a1205'],
  },
  {
    label: '深色底',
    colors: ['#0a0a0a', '#141414', '#1a1a2e', '#16213e', '#0f3460'],
  },
  {
    label: '語義',
    colors: ['#52c41a', '#faad14', '#ff4d4f', '#4791e1', '#1677ff', '#8b0000', '#06c755'],
  },
  {
    label: '中性',
    colors: ['#ffffff', '#f0f0f0', '#d9d9d9', '#8c8c8c', '#595959', '#000000'],
  },
];

const RECENT_COLORS_KEY = 'rte_recent_colors_v1';
const MAX_RECENT_COLORS = 8;

function loadRecentColors(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_COLORS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((c): c is string => typeof c === 'string').slice(0, MAX_RECENT_COLORS);
  } catch {
    return [];
  }
}

function pushRecentColor(color: string): string[] {
  if (typeof window === 'undefined') return [];
  const cur = loadRecentColors();
  const normalized = color.toLowerCase();
  const next = [normalized, ...cur.filter((c) => c.toLowerCase() !== normalized)].slice(
    0,
    MAX_RECENT_COLORS,
  );
  try {
    window.localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(next));
  } catch {
    // localStorage 失敗（隱私模式等）— 忽略
  }
  return next;
}

interface SwatchColorPickerProps {
  value?: string | null;
  onChange: (hex: string) => void;
  title: string;
  /** 觸發按鈕尺寸（正方形邊長） */
  size?: number;
  /** 觸發按鈕前綴圖示（放在色塊左側），不給則只顯示色塊 */
  leadingIcon?: React.ReactNode;
}

/**
 * 色盤選擇器：一鍵選品牌常用色 + 最近使用記憶 + 高階面板（HEX/RGB/吸管）
 * - 使用 onChangeComplete（不在拖曳過程中持續觸發 editor 更新，避免灌爆 history）
 */
function SwatchColorPicker({
  value,
  onChange,
  title,
  size = 24,
  leadingIcon,
}: SwatchColorPickerProps) {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(loadRecentColors());
  }, []);

  const presets = useMemo<NonNullable<ColorPickerProps['presets']>>(() => {
    if (!recent.length) return BRAND_PRESETS;
    return [{ label: '最近使用', colors: recent }, ...BRAND_PRESETS];
  }, [recent]);

  const handleComplete: ColorPickerProps['onChangeComplete'] = (c) => {
    const hex = c.toHexString();
    onChange(hex);
    setRecent(pushRecentColor(hex));
  };

  const swatchBg = value || '#ffffff';
  const trigger = leadingIcon ? (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: size,
        padding: '0 6px',
        border: '1px solid #d9d9d9',
        borderRadius: 4,
        cursor: 'pointer',
        background: '#fff',
      }}
    >
      {leadingIcon}
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 2,
          background: swatchBg,
          border: '1px solid rgba(0,0,0,0.08)',
        }}
      />
      <DownOutlined style={{ fontSize: 8, color: '#999' }} />
    </span>
  ) : (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: '1px solid #d9d9d9',
        borderRadius: 4,
        cursor: 'pointer',
        background: swatchBg,
        boxShadow: 'inset 0 0 0 2px #fff',
      }}
    />
  );

  return (
    <Tooltip title={title}>
      <ColorPicker
        value={value || undefined}
        presets={presets}
        onChangeComplete={handleComplete}
        size="small"
        disabledAlpha
        placement="bottomLeft"
        // 關鍵：把面板整體用容器包起來並設 max-height，讓 antd 測量到較小的尺寸
        // 才會正確 autoAdjustOverflow 往上翻 / 裡面的內容超出就捲動
        panelRender={(panel) => (
          <div
            style={{
              maxHeight: 'min(72vh, 420px)',
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingRight: 4,
            }}
          >
            {panel}
          </div>
        )}
      >
        {trigger}
      </ColorPicker>
    </Tooltip>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  folder = 'editor',
  placeholder = '請輸入內容...',
  minHeight = 200,
  enableTabsBlock = true,
}: RichTextEditorProps) {
  const isInternalChange = useRef(false);
  const savedSelection = useRef<{ from: number; to: number } | null>(null);
  const [htmlMode, setHtmlMode] = useState(false);
  const [htmlSource, setHtmlSource] = useState('');
  const [tablePickerOpen, setTablePickerOpen] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    // 讓游標移動／選取變更時，工具列同步重繪（字色、粗體 active、字型等狀態才會即時反映）
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        // hardBreak 預設已啟用（Shift+Enter = <br>）
      }),
      Underline,
      TextStyle,
      FontFamily,
      Color,
      AlignableImage.configure({ inline: false, allowBase64: false }),
      TextAlign.configure({ types: ['heading', 'paragraph', 'image'] }),
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      CustomTableCell,
      CustomTableHeader,
      ...(enableTabsBlock ? [TabsBlock] : []),
    ],
    content: value || '',
    onUpdate: ({ editor: ed }) => {
      isInternalChange.current = true;
      onChange?.(ed.getHTML());
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (!editor) return;
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    const currentHTML = editor.getHTML();
    if (value !== currentHTML) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  // Bug #4：浮動圖片如果是文件最末節點，自動在後面插一個空段落
  // 否則使用者沒地方點擊輸入文字。
  // 注意：不能用 inline-style 動態設定 <p> 的 min-height — ProseMirror 會立刻
  // 因為偵測到 DOM 與 state 不同步而重建 <p>，導致死循環 / 樣式被覆蓋。
  // → 改用 CSS fallback（min-height: 120px）即可，雖然不是像素級精確但對點擊夠用。
  useEffect(() => {
    if (!editor) return;

    const ensureTrailingParagraph = () => {
      const lastNode = editor.state.doc.lastChild;
      if (lastNode?.type.name === 'image') {
        const docEnd = editor.state.doc.content.size;
        editor.chain().insertContentAt(docEnd, { type: 'paragraph' }).run();
      }
    };

    const handler = () => ensureTrailingParagraph();
    editor.on('update', handler);
    // 初次載入也檢查一次
    ensureTrailingParagraph();

    return () => {
      editor.off('update', handler);
    };
  }, [editor]);

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editor) return;
      try {
        const result = await uploadFile(file, folder);
        editor.chain().focus().setImage({ src: result.url }).createParagraphNear().run();
        message.success('圖片已插入');
      } catch {
        message.error('圖片上傳失敗');
      }
    },
    [editor, folder],
  );

  const handleAddLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href || '';
    const url = window.prompt('輸入連結 URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div style={{ border: '1px solid #d9d9d9', borderRadius: 6 }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          padding: '6px 8px',
          borderBottom: '1px solid #d9d9d9',
          background: '#fafafa',
          borderRadius: '6px 6px 0 0',
          alignItems: 'center',
        }}
      >
        {/* Heading dropdown — preserves editor selection */}
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              { key: '0', label: '正文' },
              { key: '1', label: <span style={{ fontSize: 20, fontWeight: 700 }}>標題 1</span> },
              { key: '2', label: <span style={{ fontSize: 16, fontWeight: 600 }}>標題 2</span> },
              { key: '3', label: <span style={{ fontSize: 14, fontWeight: 500 }}>標題 3</span> },
            ] as MenuProps['items'],
            onClick: ({ key }) => {
              const level = parseInt(key);
              // Restore saved selection then apply
              if (savedSelection.current && editor) {
                editor.commands.setTextSelection(savedSelection.current);
              }
              if (level === 0) {
                editor.chain().focus().setParagraph().run();
              } else {
                editor.chain().focus().setHeading({ level: level as 1 | 2 | 3 }).run();
              }
            },
          }}
        >
          <Button
            size="small"
            style={{ fontSize: 13, minWidth: 80 }}
            onMouseDown={(e) => {
              // Save selection BEFORE dropdown steals focus
              e.preventDefault();
              if (editor) {
                const { from, to } = editor.state.selection;
                savedSelection.current = { from, to };
              }
            }}
          >
            <FontSizeOutlined />
            {editor.isActive('heading', { level: 1 })
              ? ' 標題 1'
              : editor.isActive('heading', { level: 2 })
                ? ' 標題 2'
                : editor.isActive('heading', { level: 3 })
                  ? ' 標題 3'
                  : ' 正文'}
            <DownOutlined style={{ fontSize: 10, marginLeft: 4 }} />
          </Button>
        </Dropdown>

        {/* Font family dropdown */}
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              { key: '__default', label: '預設字體' },
              ...EDITOR_FONT_OPTIONS.map((f) => ({
                key: f.value,
                label: <span style={{ fontFamily: f.value }}>{f.label}</span>,
              })),
            ] as MenuProps['items'],
            onClick: ({ key }) => {
              if (savedSelection.current && editor) {
                editor.commands.setTextSelection(savedSelection.current);
              }
              if (key === '__default') {
                editor.chain().focus().unsetFontFamily().run();
              } else {
                editor.chain().focus().setFontFamily(key).run();
              }
            },
            style: { maxHeight: 300, overflowY: 'auto' },
          }}
        >
          <Button
            size="small"
            style={{ fontSize: 13, minWidth: 80, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            onMouseDown={(e) => {
              e.preventDefault();
              if (editor) {
                const { from, to } = editor.state.selection;
                savedSelection.current = { from, to };
              }
            }}
          >
            {(() => {
              const currentFont = editor.getAttributes('textStyle').fontFamily;
              if (!currentFont) return '字體';
              const match = EDITOR_FONT_OPTIONS.find((f) => f.value === currentFont);
              return match ? match.label : '字體';
            })()}
            <DownOutlined style={{ fontSize: 10, marginLeft: 4 }} />
          </Button>
        </Dropdown>

        <Divider type="vertical" style={{ margin: '0 4px' }} />

        {/* Text formatting */}
        <Tooltip title="粗體">
          <Button
            type={editor.isActive('bold') ? 'primary' : 'text'}
            size="small"
            icon={<BoldOutlined />}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
        </Tooltip>
        <Tooltip title="斜體">
          <Button
            type={editor.isActive('italic') ? 'primary' : 'text'}
            size="small"
            icon={<ItalicOutlined />}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
        </Tooltip>
        <Tooltip title="底線">
          <Button
            type={editor.isActive('underline') ? 'primary' : 'text'}
            size="small"
            icon={<UnderlineOutlined />}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
        </Tooltip>
        <Tooltip title="刪除線">
          <Button
            type={editor.isActive('strike') ? 'primary' : 'text'}
            size="small"
            icon={<StrikethroughOutlined />}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          />
        </Tooltip>

        {/* Text color */}
        <SwatchColorPicker
          title="文字顏色"
          value={editor.getAttributes('textStyle').color}
          onChange={(hex) => editor.chain().focus().setColor(hex).run()}
        />
        {/* 清除文字顏色：把選取段還原成「無 inline color」，繼承前後台主題 */}
        <Tooltip title="清除文字顏色">
          <Button
            type="text"
            size="small"
            icon={<ClearOutlined />}
            disabled={!editor.getAttributes('textStyle').color}
            onClick={() => editor.chain().focus().unsetColor().run()}
          />
        </Tooltip>

        <Divider type="vertical" style={{ margin: '0 4px' }} />

        {/* Alignment */}
        <Tooltip title="靠左">
          <Button
            type={editor.isActive({ textAlign: 'left' }) ? 'primary' : 'text'}
            size="small"
            icon={<AlignLeftOutlined />}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
          />
        </Tooltip>
        <Tooltip title="置中">
          <Button
            type={
              editor.isActive({ textAlign: 'center' }) ? 'primary' : 'text'
            }
            size="small"
            icon={<AlignCenterOutlined />}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
          />
        </Tooltip>
        <Tooltip title="靠右">
          <Button
            type={editor.isActive({ textAlign: 'right' }) ? 'primary' : 'text'}
            size="small"
            icon={<AlignRightOutlined />}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
          />
        </Tooltip>

        <Divider type="vertical" style={{ margin: '0 4px' }} />

        {/* Lists */}
        <Tooltip title="有序列表">
          <Button
            type={editor.isActive('orderedList') ? 'primary' : 'text'}
            size="small"
            icon={<OrderedListOutlined />}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
        </Tooltip>
        <Tooltip title="無序列表">
          <Button
            type={editor.isActive('bulletList') ? 'primary' : 'text'}
            size="small"
            icon={<UnorderedListOutlined />}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
        </Tooltip>

        <Divider type="vertical" style={{ margin: '0 4px' }} />

        {/* Link */}
        <Tooltip title="插入連結">
          <Button
            type={editor.isActive('link') ? 'primary' : 'text'}
            size="small"
            icon={<LinkOutlined />}
            onClick={handleAddLink}
          />
        </Tooltip>

        {/* Image upload */}
        <Upload
          showUploadList={false}
          accept="image/*"
          customRequest={({ file }) => handleImageUpload(file as File)}
        >
          <Tooltip title="插入圖片">
            <Button type="text" size="small" icon={<PictureOutlined />} />
          </Tooltip>
        </Upload>

        {/* Horizontal Rule */}
        <Tooltip title="水平線">
          <Button
            type="text"
            size="small"
            icon={<MinusOutlined />}
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          />
        </Tooltip>

        {/* Table — Grid Picker */}
        <Popover
          open={tablePickerOpen}
          onOpenChange={setTablePickerOpen}
          trigger="click"
          placement="bottom"
          arrow={false}
          content={
            <TableGridPicker
              onSelect={(rows, cols) => {
                editor.chain().focus().insertTable({ rows, cols, withHeaderRow: false }).run();
                setTablePickerOpen(false);
              }}
            />
          }
        >
          <Tooltip title="插入表格">
            <Button
              type={editor.isActive('table') ? 'primary' : 'text'}
              size="small"
              icon={<TableOutlined />}
            />
          </Tooltip>
        </Popover>

        {/* 分頁區塊 */}
        {enableTabsBlock && (
          <Tooltip title="插入分頁區塊">
            <Button
              type="text"
              size="small"
              icon={<AppstoreOutlined />}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .insertContent({
                    type: TABS_BLOCK_NODE_NAME,
                    attrs: {
                      panels: [
                        { title: '分頁 1', html: '<p>內容...</p>' },
                        { title: '分頁 2', html: '<p>內容...</p>' },
                      ],
                    },
                  })
                  .run()
              }
            />
          </Tooltip>
        )}

        <Divider type="vertical" style={{ margin: '0 4px' }} />

        {/* Undo/Redo */}
        <Tooltip title="復原">
          <Button
            type="text"
            size="small"
            icon={<UndoOutlined />}
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          />
        </Tooltip>
        <Tooltip title="重做">
          <Button
            type="text"
            size="small"
            icon={<RedoOutlined />}
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          />
        </Tooltip>

        <Divider type="vertical" style={{ margin: '0 4px' }} />

        {/* HTML 原始碼模式 */}
        <Tooltip title={htmlMode ? '切換為視覺化編輯' : '切換為 HTML 原始碼'}>
          <Button
            type={htmlMode ? 'primary' : 'text'}
            size="small"
            icon={<CodeOutlined />}
            onClick={() => {
              if (!htmlMode) {
                // 進入 HTML 模式：格式化後同步到編輯區
                setHtmlSource(formatHTML(editor.getHTML()));
              } else {
                // 離開 HTML 模式：將 textarea 內容寫回編輯器
                isInternalChange.current = true;
                editor.commands.setContent(htmlSource, { emitUpdate: false });
                onChange?.(htmlSource);
              }
              setHtmlMode(!htmlMode);
            }}
          />
        </Tooltip>
      </div>

      {/* ═══ 表格上下文工具列 — 僅在游標於表格內時顯示 ═══ */}
      {editor.isActive('table') && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            padding: '4px 8px',
            borderBottom: '1px solid #d9d9d9',
            background: '#f0f7ff',
            alignItems: 'center',
            fontSize: 12,
          }}
        >
          <span style={{ color: '#666', marginRight: 4, fontSize: 11, userSelect: 'none' }}>表格：</span>

          <Tooltip title="上方插入列">
            <Button type="text" size="small" icon={<InsertRowAboveOutlined />}
              disabled={!editor.can().addRowBefore()}
              onClick={() => editor.chain().focus().addRowBefore().run()} />
          </Tooltip>
          <Tooltip title="下方插入列">
            <Button type="text" size="small" icon={<InsertRowBelowOutlined />}
              disabled={!editor.can().addRowAfter()}
              onClick={() => editor.chain().focus().addRowAfter().run()} />
          </Tooltip>
          <Tooltip title="左方插入欄">
            <Button type="text" size="small" icon={<InsertRowLeftOutlined />}
              disabled={!editor.can().addColumnBefore()}
              onClick={() => editor.chain().focus().addColumnBefore().run()} />
          </Tooltip>
          <Tooltip title="右方插入欄">
            <Button type="text" size="small" icon={<InsertRowRightOutlined />}
              disabled={!editor.can().addColumnAfter()}
              onClick={() => editor.chain().focus().addColumnAfter().run()} />
          </Tooltip>

          <Divider type="vertical" style={{ margin: '0 2px' }} />

          <Tooltip title="刪除列">
            <Button type="text" size="small" icon={<DeleteRowOutlined />}
              disabled={!editor.can().deleteRow()}
              onClick={() => editor.chain().focus().deleteRow().run()} />
          </Tooltip>
          <Tooltip title="刪除欄">
            <Button type="text" size="small" icon={<DeleteColumnOutlined />}
              disabled={!editor.can().deleteColumn()}
              onClick={() => editor.chain().focus().deleteColumn().run()} />
          </Tooltip>

          <Divider type="vertical" style={{ margin: '0 2px' }} />

          <Tooltip title="合併儲存格">
            <Button type="text" size="small" icon={<MergeCellsOutlined />}
              disabled={!editor.can().mergeCells()}
              onClick={() => editor.chain().focus().mergeCells().run()} />
          </Tooltip>
          <Tooltip title="分割儲存格">
            <Button type="text" size="small" icon={<SplitCellsOutlined />}
              disabled={!editor.can().splitCell()}
              onClick={() => editor.chain().focus().splitCell().run()} />
          </Tooltip>

          <Divider type="vertical" style={{ margin: '0 2px' }} />

          {/* 儲存格背景色 */}
          <SwatchColorPicker
            title="儲存格背景色"
            size={22}
            leadingIcon={<BgColorsOutlined style={{ fontSize: 13, color: '#666' }} />}
            value={
              editor.getAttributes('tableCell').backgroundColor ||
              editor.getAttributes('tableHeader').backgroundColor
            }
            onChange={(hex) => {
              editor.chain().focus().setCellAttribute('backgroundColor', hex).run();
            }}
          />
          <Tooltip title="清除背景色">
            <Button type="text" size="small"
              style={{ fontSize: 11, padding: '0 4px', color: '#999' }}
              onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', null).run()}
            >
              清除
            </Button>
          </Tooltip>

          <Divider type="vertical" style={{ margin: '0 2px' }} />

          {/* 儲存格垂直對齊 */}
          <Tooltip title="靠上">
            <Button
              type={(editor.getAttributes('tableCell').verticalAlign || editor.getAttributes('tableHeader').verticalAlign || 'top') === 'top' ? 'primary' : 'text'}
              size="small" icon={<VerticalAlignTopOutlined />}
              onClick={() => editor.chain().focus().setCellAttribute('verticalAlign', 'top').run()} />
          </Tooltip>
          <Tooltip title="置中">
            <Button
              type={(editor.getAttributes('tableCell').verticalAlign || editor.getAttributes('tableHeader').verticalAlign) === 'middle' ? 'primary' : 'text'}
              size="small" icon={<VerticalAlignMiddleOutlined />}
              onClick={() => editor.chain().focus().setCellAttribute('verticalAlign', 'middle').run()} />
          </Tooltip>
          <Tooltip title="靠下">
            <Button
              type={(editor.getAttributes('tableCell').verticalAlign || editor.getAttributes('tableHeader').verticalAlign) === 'bottom' ? 'primary' : 'text'}
              size="small" icon={<VerticalAlignBottomOutlined />}
              onClick={() => editor.chain().focus().setCellAttribute('verticalAlign', 'bottom').run()} />
          </Tooltip>

          <Divider type="vertical" style={{ margin: '0 2px' }} />

          <Tooltip title="刪除表格">
            <Button type="text" size="small" danger icon={<DeleteOutlined />}
              onClick={() => editor.chain().focus().deleteTable().run()} />
          </Tooltip>
        </div>
      )}

      {/* Editor content */}
      {htmlMode ? (
        <HtmlSourceEditor
          value={htmlSource}
          onChange={setHtmlSource}
          minHeight={minHeight}
        />
      ) : (
        <div
          style={{ padding: '12px 16px', minHeight, position: 'relative' }}
          onClick={() => editor.chain().focus().run()}
        >
          <EditorContent
            editor={editor}
            style={{
              minHeight,
            }}
          />
          {editor.isEmpty && !editor.getJSON().content?.some((n) => n.type === 'table') && (
            <div
              style={{
                position: 'absolute',
                top: 12,
                left: 16,
                color: '#bfbfbf',
                pointerEvents: 'none',
              }}
            >
              {placeholder}
            </div>
          )}
        </div>
      )}

      {/* Basic editor styles */}
      <style jsx global>{`
        .tiptap {
          outline: none;
          /* 建立 BFC，讓編輯器自動撐高去包住浮動圖片，避免溢出 */
          display: flow-root;
        }
        .tiptap p {
          margin: 0.5em 0;
        }
        .tiptap h1,
        .tiptap h2,
        .tiptap h3 {
          margin: 0.8em 0 0.4em;
        }
        .tiptap [data-node-view-wrapper] img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
        }
        /* 文繞圖：套在 Tiptap 的 react-renderer 包裹層上，因為它才是區塊兄弟 */
        /* position: relative + z-index 確保圖片堆疊在後續段落之上，避免段落 bbox 蓋住圖片點擊區 */
        .tiptap .react-renderer.node-image:has([data-text-align="left"]) {
          float: left;
          margin: 4px 16px 8px 0;
          max-width: 50%;
          position: relative;
          z-index: 1;
        }
        .tiptap .react-renderer.node-image:has([data-text-align="right"]) {
          float: right;
          margin: 4px 0 8px 16px;
          max-width: 50%;
          position: relative;
          z-index: 1;
        }
        .tiptap .react-renderer.node-image:has([data-text-align="center"]) {
          display: block;
          text-align: center;
          clear: both;
          margin: 8px 0;
        }
        /* 浮動圖片旁的段落需要最小高度，使用者點擊圖片左/右側才能定位游標 */
        /* 因為 ProseMirror 會在 transaction 後重建 <p>，inline style 不可靠，必須用 CSS 規則 */
        .tiptap .react-renderer.node-image:has([data-text-align="left"]) + p,
        .tiptap .react-renderer.node-image:has([data-text-align="right"]) + p {
          min-height: 120px;
        }
        /* 標題、表格、引言、分隔線自動清除浮動 */
        .tiptap h1,
        .tiptap h2,
        .tiptap h3,
        .tiptap table,
        .tiptap blockquote,
        .tiptap hr {
          clear: both;
        }
        .tiptap a {
          color: #1677ff;
          text-decoration: underline;
        }
        .tiptap ul,
        .tiptap ol {
          padding-left: 1.5em;
        }
        .tiptap blockquote {
          border-left: 3px solid #d9d9d9;
          padding-left: 12px;
          margin-left: 0;
          color: #666;
        }
        .tiptap hr {
          border: none;
          border-top: 2px solid #d9d9d9;
          margin: 1em 0;
        }
        .tiptap table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
          /* 不設 overflow:hidden — 否則 cell 內圖片的浮動工具列（top:-44px）
             一旦超出表格邊界就會被切掉 */
        }
        .tiptap table td,
        .tiptap table th {
          border: 1px solid #d9d9d9;
          padding: 8px 12px;
          min-width: 80px;
          vertical-align: top;
        }
        .tiptap table th {
          font-weight: 600;
        }
        .tiptap table td[style*="background-color"],
        .tiptap table th[style*="background-color"] {
          background: none;
        }
        .tiptap table .selectedCell {
          background: #e6f4ff;
        }
        .tiptap table .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: -2px;
          width: 4px;
          background-color: #1677ff;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

/** 帶行號的 HTML 原始碼編輯器 */
function HtmlSourceEditor({
  value,
  onChange,
  minHeight,
}: {
  value: string;
  onChange: (v: string) => void;
  minHeight: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const lineCount = useMemo(() => value.split('\n').length, [value]);

  // 同步行號區域的捲動
  const handleScroll = useCallback(() => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  return (
    <div style={{ display: 'flex', borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
      {/* 行號 */}
      <div
        ref={gutterRef}
        style={{
          minHeight,
          maxHeight: 500,
          overflow: 'hidden',
          padding: '12px 0',
          background: '#f0f0f0',
          borderRight: '1px solid #d9d9d9',
          userSelect: 'none',
          textAlign: 'right',
          fontFamily: 'monospace',
          fontSize: 13,
          lineHeight: '20px',
          color: '#999',
          flexShrink: 0,
        }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} style={{ padding: '0 8px 0 12px' }}>
            {i + 1}
          </div>
        ))}
      </div>
      {/* 程式碼區 */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        spellCheck={false}
        style={{
          flex: 1,
          minHeight,
          maxHeight: 500,
          padding: '12px 16px',
          fontFamily: 'monospace',
          fontSize: 13,
          lineHeight: '20px',
          border: 'none',
          outline: 'none',
          resize: 'none',
          background: '#fafafa',
          color: '#333',
          tabSize: 2,
          whiteSpace: 'pre',
          overflowX: 'auto',
          overflowY: 'auto',
        }}
        placeholder="在此編輯 HTML 原始碼..."
      />
    </div>
  );
}
