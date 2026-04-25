'use client';

import {
  Node,
  mergeAttributes,
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type ReactNodeViewProps,
} from '@tiptap/react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Modal, Tabs, Button, Input, Tooltip, Popconfirm, message } from 'antd';
import { EditOutlined, DeleteOutlined, AppstoreOutlined } from '@ant-design/icons';
import RichTextEditor from '../RichTextEditor';

export interface TabPanelData {
  title: string;
  html: string;
}

export const TABS_BLOCK_NODE_NAME = 'tabsBlock';

const DEFAULT_PANELS: TabPanelData[] = [
  { title: '分頁 1', html: '<p>內容...</p>' },
];

/**
 * 文章可切換內容區塊（分頁）
 *
 * 儲存格式：
 * <div data-type="tabs">
 *   <div data-type="tab-panel" data-title="A">...HTML...</div>
 *   <div data-type="tab-panel" data-title="B">...HTML...</div>
 * </div>
 */
export const TabsBlock = Node.create({
  name: TABS_BLOCK_NODE_NAME,
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      panels: {
        default: DEFAULT_PANELS,
        parseHTML: (el) => {
          // 來源 1：data-panels JSON（getHTML 序列化的格式）
          const json = el.getAttribute('data-panels');
          if (json) {
            try {
              const parsed = JSON.parse(json) as TabPanelData[];
              if (Array.isArray(parsed) && parsed.length) return parsed;
            } catch {
              /* fallthrough */
            }
          }
          // 來源 2：展開的 <div data-type="tab-panel"> 子節點（人工 HTML）
          const fromDom: TabPanelData[] = [];
          el.querySelectorAll(':scope > [data-type="tab-panel"]').forEach((panel) => {
            fromDom.push({
              title: panel.getAttribute('data-title') || '',
              html: panel.innerHTML,
            });
          });
          return fromDom.length ? fromDom : DEFAULT_PANELS;
        },
        renderHTML: (attrs) => {
          const panels = (attrs.panels || []) as TabPanelData[];
          return { 'data-panels': JSON.stringify(panels) };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="tabs"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'tabs' }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TabsBlockView);
  },
});

/* ──────────────── NodeView：編輯器內的預覽 + 編輯按鈕 ──────────────── */

function TabsBlockView({ node, updateAttributes, deleteNode, selected }: ReactNodeViewProps) {
  const panels = (node.attrs.panels || []) as TabPanelData[];
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeKey, setActiveKey] = useState('0');

  // 預覽分頁項目（顯示 panel.html，但不可編輯）
  const previewItems = useMemo(
    () =>
      panels.map((p, i) => ({
        key: String(i),
        label: p.title || `分頁 ${i + 1}`,
        children: (
          <div
            style={{ padding: '4px 0', minHeight: 40 }}
            dangerouslySetInnerHTML={{ __html: p.html || '<p style="color:#bbb">（無內容）</p>' }}
          />
        ),
      })),
    [panels],
  );

  const handleSave = useCallback(
    (next: TabPanelData[]) => {
      updateAttributes({ panels: next });
      setEditorOpen(false);
      message.success('分頁區塊已更新');
    },
    [updateAttributes],
  );

  // 防止 React Portal（Modal）內的事件透過 React tree bubble 到外層
  // RichTextEditor 的 onClick={editor.focus()}，造成輸入時焦點被搶走
  const stopBubble = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <NodeViewWrapper data-type="tabs-block-wrapper">
      <div
        contentEditable={false}
        onClick={stopBubble}
        onMouseDown={stopBubble}
        onKeyDown={stopBubble}
        style={{
          position: 'relative',
          border: `2px ${selected ? 'solid #1677ff' : 'dashed #d9d9d9'}`,
          borderRadius: 6,
          padding: '8px 12px',
          margin: '12px 0',
          background: '#fafafa',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
            fontSize: 12,
            color: '#888',
          }}
        >
          <span>
            <AppstoreOutlined /> 分頁區塊（{panels.length} 個分頁）
          </span>
          <span style={{ display: 'flex', gap: 4 }}>
            <Tooltip title="編輯分頁">
              <Button size="small" icon={<EditOutlined />} onClick={() => setEditorOpen(true)}>
                編輯
              </Button>
            </Tooltip>
            <Popconfirm
              title="刪除整個分頁區塊？"
              description="此操作無法復原（可用 Ctrl+Z 還原）"
              onConfirm={() => deleteNode()}
              okText="刪除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="刪除分頁區塊">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </span>
        </div>

        <Tabs
          size="small"
          activeKey={activeKey}
          onChange={setActiveKey}
          items={previewItems}
        />
      </div>

      {editorOpen && (
        <TabsEditorModal
          panels={panels}
          onCancel={() => setEditorOpen(false)}
          onSave={handleSave}
        />
      )}
    </NodeViewWrapper>
  );
}

/* ──────────────── Modal：編輯分頁內容 ──────────────── */

interface TabsEditorModalProps {
  panels: TabPanelData[];
  onCancel: () => void;
  onSave: (panels: TabPanelData[]) => void;
}

function TabsEditorModal({ panels: initialPanels, onCancel, onSave }: TabsEditorModalProps) {
  const [panels, setPanels] = useState<TabPanelData[]>(() =>
    initialPanels.length ? initialPanels.map((p) => ({ ...p })) : [{ title: '分頁 1', html: '' }],
  );
  const [activeKey, setActiveKey] = useState('0');
  const [renaming, setRenaming] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // 切到不存在的 key 時，重置回第一個
  useEffect(() => {
    if (Number(activeKey) >= panels.length) {
      setActiveKey('0');
    }
  }, [panels.length, activeKey]);

  const updatePanel = (idx: number, patch: Partial<TabPanelData>) => {
    setPanels((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const addPanel = () => {
    setPanels((prev) => {
      const next = [...prev, { title: `分頁 ${prev.length + 1}`, html: '<p></p>' }];
      setActiveKey(String(next.length - 1));
      return next;
    });
  };

  const removePanel = (idx: number) => {
    if (panels.length <= 1) {
      message.warning('至少需保留一個分頁');
      return;
    }
    setPanels((prev) => prev.filter((_, i) => i !== idx));
    setActiveKey('0');
  };

  const startRename = (idx: number) => {
    setRenaming(idx);
    setRenameValue(panels[idx].title);
  };

  const commitRename = () => {
    if (renaming === null) return;
    const trimmed = renameValue.trim() || `分頁 ${renaming + 1}`;
    updatePanel(renaming, { title: trimmed });
    setRenaming(null);
  };

  const handleEdit = (key: React.MouseEvent | React.KeyboardEvent | string, action: 'add' | 'remove') => {
    if (action === 'add') {
      addPanel();
    } else if (action === 'remove' && typeof key === 'string') {
      removePanel(Number(key));
    }
  };

  const handleSave = () => {
    // 過濾掉完全空白的分頁，保留至少一個
    const cleaned = panels
      .map((p) => ({ title: (p.title || '').trim() || '未命名', html: p.html || '' }))
      .filter((p, i, arr) => arr.length === 1 || p.html.trim() !== '');
    onSave(cleaned.length ? cleaned : panels);
  };

  const items = panels.map((p, idx) => ({
    key: String(idx),
    label:
      renaming === idx ? (
        <Input
          autoFocus
          size="small"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={commitRename}
          onBlur={commitRename}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          // AntD editable-card 在 tab btn 上監聽 keydown，會把 Delete/Backspace
          // 當成「刪除分頁」。要在 input 內擋下 keydown bubble，避免按 Delete
          // 想刪文字時整個分頁被刪。Esc 也擋避免關 modal。
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') {
              setRenaming(null);
            }
          }}
          style={{ width: 120 }}
        />
      ) : (
        <span
          onDoubleClick={() => startRename(idx)}
          title="點鉛筆或雙擊文字可重新命名"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <span>{p.title || `分頁 ${idx + 1}`}</span>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined style={{ fontSize: 13 }} />}
            aria-label="重新命名"
            onClick={(e) => {
              e.stopPropagation();
              startRename(idx);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              padding: '0 4px',
              height: 22,
              minWidth: 22,
              color: '#999',
            }}
          />
        </span>
      ),
    children: (
      <RichTextEditor
        key={`panel-${idx}`}
        value={p.html}
        onChange={(html) => updatePanel(idx, { html })}
        enableTabsBlock={false}
        minHeight={240}
      />
    ),
  }));

  // Portal 出去的 modal，仍會 React-bubble 事件到外層 RichTextEditor 的
  // onClick={editor.focus()}。包一層 stopPropagation 攔下，避免每次輸入焦點被搶。
  const stopBubble = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <Modal
      open
      title="編輯分頁區塊"
      onCancel={onCancel}
      onOk={handleSave}
      okText="儲存"
      cancelText="取消"
      width={920}
      destroyOnClose
      maskClosable={false}
    >
      <div onClick={stopBubble} onMouseDown={stopBubble} onKeyDown={stopBubble}>
        <div style={{ marginBottom: 8, fontSize: 12, color: '#888' }}>
          點分頁名稱旁的鉛筆 ✏️ 可重新命名；右上角的 + 新增分頁、X 刪除分頁。
        </div>
        <Tabs
          type="editable-card"
          activeKey={activeKey}
          onChange={setActiveKey}
          onEdit={handleEdit}
          items={items}
          hideAdd={false}
        />
      </div>
    </Modal>
  );
}
