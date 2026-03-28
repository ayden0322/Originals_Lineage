'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExt from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { useCallback, useEffect, useRef } from 'react';
import { Button, Upload, Tooltip, Divider, Dropdown, message } from 'antd';
import type { MenuProps } from 'antd';
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
} from '@ant-design/icons';
import { uploadFile } from '@/lib/api/site-manage';

interface RichTextEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  folder?: string;
  placeholder?: string;
  minHeight?: number;
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

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Enter = new paragraph, Shift+Enter = soft line break <br>
        hardBreak: true,
      }),
      Underline,
      TextStyle,
      Color,
      ImageExt.configure({ inline: false, allowBase64: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
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
      editor.commands.setContent(value || '', false);
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
      </div>

      {/* Editor content */}
      <div
        style={{ padding: '12px 16px', minHeight }}
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
      `}</style>
    </div>
  );
}
