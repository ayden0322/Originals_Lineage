'use client';

import { useEditor, EditorContent } from '@tiptap/react';
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
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Button, Upload, Tooltip, Divider, Dropdown, Popover, message } from 'antd';
import type { MenuProps } from 'antd';
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
} from '@ant-design/icons';
import { uploadFile } from '@/lib/api/site-manage';

interface RichTextEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  folder?: string;
  placeholder?: string;
  minHeight?: number;
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

// 擴展 Image 節點，支援 textAlign 屬性
const AlignableImage = ImageExt.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      textAlign: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-text-align') || element.style.textAlign || null,
        renderHTML: (attributes) => {
          if (!attributes.textAlign) return {};
          return {
            'data-text-align': attributes.textAlign,
            style: `display: block; margin-left: ${attributes.textAlign === 'center' ? 'auto' : attributes.textAlign === 'right' ? 'auto' : '0'}; margin-right: ${attributes.textAlign === 'center' ? 'auto' : attributes.textAlign === 'left' ? 'auto' : '0'};`,
          };
        },
      },
    };
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

export default function RichTextEditor({
  value,
  onChange,
  folder = 'editor',
  placeholder = '請輸入內容...',
  minHeight = 200,
}: RichTextEditorProps) {
  const isInternalChange = useRef(false);
  const savedSelection = useRef<{ from: number; to: number } | null>(null);
  const [htmlMode, setHtmlMode] = useState(false);
  const [htmlSource, setHtmlSource] = useState('');
  const [tablePickerOpen, setTablePickerOpen] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
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
      TableCell,
      TableHeader,
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

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editor) return;
      try {
        const result = await uploadFile(file, folder);
        editor.chain().focus().setImage({ src: result.url }).run();
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
        <Tooltip title="文字顏色">
          <input
            type="color"
            value={editor.getAttributes('textStyle').color || '#ffffff'}
            onChange={(e) =>
              editor.chain().focus().setColor(e.target.value).run()
            }
            style={{
              width: 24,
              height: 24,
              border: '1px solid #d9d9d9',
              borderRadius: 4,
              cursor: 'pointer',
              padding: 0,
            }}
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
                editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
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
          {editor.isEmpty && (
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
        }
        .tiptap p {
          margin: 0.5em 0;
        }
        .tiptap h1,
        .tiptap h2,
        .tiptap h3 {
          margin: 0.8em 0 0.4em;
        }
        .tiptap img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
          margin: 8px 0;
        }
        .tiptap img[data-text-align="center"] {
          display: block;
          margin-left: auto;
          margin-right: auto;
        }
        .tiptap img[data-text-align="right"] {
          display: block;
          margin-left: auto;
          margin-right: 0;
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
          overflow: hidden;
        }
        .tiptap table td,
        .tiptap table th {
          border: 1px solid #d9d9d9;
          padding: 8px 12px;
          min-width: 80px;
          vertical-align: top;
        }
        .tiptap table th {
          background: #f5f5f5;
          font-weight: 600;
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
