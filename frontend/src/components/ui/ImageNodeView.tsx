'use client';

import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { useState, useRef, useCallback } from 'react';
import { Button, Tooltip, Divider, Input, Popover } from 'antd';
import {
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
  EditOutlined,
  VerticalAlignBottomOutlined,
  VideoCameraOutlined,
  PlayCircleFilled,
} from '@ant-design/icons';

/**
 * 圖片 NodeView — 選取、拖曳調整大小、浮動工具列
 */
export function ImageNodeView({ node, updateAttributes, selected, editor, getPos }: ReactNodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [altOpen, setAltOpen] = useState(false);
  const [altValue, setAltValue] = useState(node.attrs.alt || '');
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoValue, setVideoValue] = useState(node.attrs.videoUrl || '');
  const hasVideo = !!node.attrs.videoUrl;

  // 在圖片後插入「分隔線」結束文繞圖（hr 自動 clear: both）
  const handleClearFloat = useCallback(() => {
    const pos = getPos();
    if (pos === undefined) return;
    const afterPos = pos + node.nodeSize;
    editor
      .chain()
      .focus()
      .insertContentAt(afterPos, { type: 'horizontalRule' })
      .run();
  }, [editor, getPos, node.nodeSize]);

  // 點圖片強制 NodeSelection
  // 表格 cell 內的圖片，prosemirror-tables 會把點擊解讀成 cell 的文字游標定位，
  // 導致圖片無法被選取（沒辦法叫出 resize handle / toolbar）。
  // 這裡攔下 click，明確呼叫 setNodeSelection 把選取放到圖片本身。
  const handleSelectImage = useCallback(
    (e: React.MouseEvent) => {
      const pos = getPos();
      if (pos === undefined) return;
      e.stopPropagation();
      editor.chain().setNodeSelection(pos).run();
    },
    [editor, getPos],
  );

  // 拖曳調整大小
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, corner: string) => {
      e.preventDefault();
      e.stopPropagation();

      const img = imgRef.current;
      if (!img) return;

      const startX = e.clientX;
      const startWidth = img.offsetWidth;
      const aspectRatio = (img.naturalWidth || 1) / (img.naturalHeight || 1);
      const isLeft = corner.includes('left');

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const newWidth = Math.max(80, startWidth + (isLeft ? -deltaX : deltaX));
        img.style.width = `${newWidth}px`;
        img.style.height = `${Math.round(newWidth / aspectRatio)}px`;
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        const finalWidth = img.offsetWidth;
        if (finalWidth) updateAttributes({ width: finalWidth });
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [updateAttributes],
  );

  // 寬度百分比預設值
  const handleSizePreset = useCallback(
    (pct: number) => {
      const containerWidth = editor.view.dom.offsetWidth - 32;
      updateAttributes({ width: Math.round(containerWidth * pct / 100) });
    },
    [editor, updateAttributes],
  );

  // textAlign 為 null 代表「未指定」，要保持與公開頁相同的 block 排版（不浮動、不置中）
  // 不能 fallback 'left'，否則編輯器會顯示成浮動，跟前台不一致
  const align: string | null = node.attrs.textAlign ?? null;
  const isFloat = align === 'left' || align === 'right';

  // 浮動圖片時，後續兄弟段落需要有最小高度，使用者點擊圖片左/右側才能定位游標
  // 注意：不能直接 inline-style 後續 <p>，因為 ProseMirror 會在 transaction 後重建節點
  // 解法：在 RichTextEditor 的全域 CSS 用 :has(...) + p { min-height: ... } 處理

  // 圖片樣式
  const imgStyle: React.CSSProperties = {
    width: node.attrs.width ? `${node.attrs.width}px` : 'auto',
    maxWidth: '100%',
    height: 'auto',
    display: 'block',
    borderRadius: 4,
    cursor: 'pointer',
  };

  // wrapper 樣式：
  // - 靠左/右浮動（isFloat）→ 由 CSS .react-renderer:has(...) 處理 float
  // - 明確 center → 區塊置中
  // - 未指定（null）→ 跟公開頁一樣，block-level 自然排版（不置中、不浮動）
  // - 選取時：position relative + 高 z-index，避免在表格 cell 內時，
  //   浮動工具列（top:-44px）被相鄰 row 的 cell 遮住
  const wrapperStyle: React.CSSProperties = {
    ...(isFloat
      ? { display: 'inline-block' }
      : align === 'center'
        ? { textAlign: 'center', minHeight: 20 }
        : { display: 'block', minHeight: 20 }),
    ...(selected ? { position: 'relative', zIndex: 100 } : {}),
  };

  // 圖片容器（inline-block，只包住圖片大小）
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    maxWidth: '100%',
    outline: selected ? '2px solid #1677ff' : 'none',
    outlineOffset: 2,
    borderRadius: 4,
  };

  // resize handle 的共用樣式
  const handleBase: React.CSSProperties = {
    position: 'absolute',
    width: 10,
    height: 10,
    background: '#1677ff',
    border: '1.5px solid #fff',
    borderRadius: 2,
    zIndex: 10,
  };

  const corners = [
    { key: 'top-left', style: { top: -5, left: -5, cursor: 'nwse-resize' } },
    { key: 'top-right', style: { top: -5, right: -5, cursor: 'nesw-resize' } },
    { key: 'bottom-left', style: { bottom: -5, left: -5, cursor: 'nesw-resize' } },
    { key: 'bottom-right', style: { bottom: -5, right: -5, cursor: 'nwse-resize' } },
  ];

  return (
    <NodeViewWrapper
      style={wrapperStyle}
      {...(align ? { 'data-text-align': align } : {})}
    >
      <div style={containerStyle} data-img-container data-drag-handle>
        <img
          ref={imgRef}
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          style={imgStyle}
          draggable={false}
          onClick={handleSelectImage}
          onMouseDown={handleSelectImage}
        />

        {/* 已綁定影片 → 顯示播放圖示 overlay（編輯端視覺提示，前台一致） */}
        {hasVideo && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              color: '#fff',
              textShadow: '0 2px 8px rgba(0,0,0,0.6)',
              fontSize: 'min(48px, 40%)',
              opacity: 0.85,
            }}
          >
            <PlayCircleFilled />
          </div>
        )}

        {/* 四角 resize handles */}
        {selected &&
          corners.map(({ key, style }) => (
            <div
              key={key}
              style={{ ...handleBase, ...style }}
              onMouseDown={(e) => handleResizeMouseDown(e, key)}
            />
          ))}

        {/* 浮動工具列 */}
        {selected && (
          <div
            data-toolbar
            style={{
              position: 'absolute',
              top: -44,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 2,
              background: '#fff',
              border: '1px solid #d9d9d9',
              borderRadius: 6,
              padding: '4px 6px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              zIndex: 50,
              whiteSpace: 'nowrap',
              alignItems: 'center',
            }}
            // 阻止點擊工具列時取消選取
            onMouseDown={(e) => e.preventDefault()}
          >
            {/* 對齊 */}
            <Tooltip title="靠左">
              <Button
                type={align === 'left' ? 'primary' : 'text'}
                size="small"
                icon={<AlignLeftOutlined />}
                onClick={() => updateAttributes({ textAlign: 'left' })}
              />
            </Tooltip>
            <Tooltip title="置中">
              <Button
                type={align === 'center' ? 'primary' : 'text'}
                size="small"
                icon={<AlignCenterOutlined />}
                onClick={() => updateAttributes({ textAlign: 'center' })}
              />
            </Tooltip>
            <Tooltip title="靠右">
              <Button
                type={align === 'right' ? 'primary' : 'text'}
                size="small"
                icon={<AlignRightOutlined />}
                onClick={() => updateAttributes({ textAlign: 'right' })}
              />
            </Tooltip>

            <Divider type="vertical" style={{ margin: '0 2px' }} />

            {/* 尺寸預設值 */}
            {[25, 50, 75, 100].map((pct) => (
              <Tooltip key={pct} title={`${pct}% 寬度`}>
                <Button
                  size="small"
                  type="text"
                  style={{ fontSize: 12, padding: '0 6px', minWidth: 0 }}
                  onClick={() => handleSizePreset(pct)}
                >
                  {pct}%
                </Button>
              </Tooltip>
            ))}

            <Divider type="vertical" style={{ margin: '0 2px' }} />

            {/* 結束文繞圖（只在浮動時顯示） */}
            {isFloat && (
              <Tooltip title="結束文繞圖（在下方插入新段落）">
                <Button
                  size="small"
                  type="text"
                  icon={<VerticalAlignBottomOutlined />}
                  onClick={handleClearFloat}
                />
              </Tooltip>
            )}

            <Divider type="vertical" style={{ margin: '0 2px' }} />

            {/* 替代文字 */}
            <Popover
              trigger="click"
              open={altOpen}
              onOpenChange={(open) => {
                setAltOpen(open);
                if (open) setAltValue(node.attrs.alt || '');
              }}
              content={
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Input
                    size="small"
                    value={altValue}
                    onChange={(e) => setAltValue(e.target.value)}
                    placeholder="替代文字（alt）"
                    style={{ width: 180 }}
                    onPressEnter={() => {
                      updateAttributes({ alt: altValue });
                      setAltOpen(false);
                    }}
                  />
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => {
                      updateAttributes({ alt: altValue });
                      setAltOpen(false);
                    }}
                  >
                    確定
                  </Button>
                </div>
              }
            >
              <Tooltip title="替代文字">
                <Button size="small" type="text" icon={<EditOutlined />} />
              </Tooltip>
            </Popover>

            <Divider type="vertical" style={{ margin: '0 2px' }} />

            {/* 綁定 mp4 影片：前台點擊圖片時跳出 Modal 播放 */}
            <Popover
              trigger="click"
              open={videoOpen}
              onOpenChange={(open) => {
                setVideoOpen(open);
                if (open) setVideoValue(node.attrs.videoUrl || '');
              }}
              content={
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Input
                    size="small"
                    value={videoValue}
                    onChange={(e) => setVideoValue(e.target.value)}
                    placeholder="mp4 影片網址"
                    style={{ width: 240 }}
                    onPressEnter={() => {
                      updateAttributes({ videoUrl: videoValue.trim() || null });
                      setVideoOpen(false);
                    }}
                  />
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => {
                      updateAttributes({ videoUrl: videoValue.trim() || null });
                      setVideoOpen(false);
                    }}
                  >
                    確定
                  </Button>
                  {hasVideo && (
                    <Button
                      size="small"
                      danger
                      onClick={() => {
                        updateAttributes({ videoUrl: null });
                        setVideoValue('');
                        setVideoOpen(false);
                      }}
                    >
                      清除
                    </Button>
                  )}
                </div>
              }
            >
              <Tooltip title={hasVideo ? '已綁定影片（點擊編輯）' : '綁定影片'}>
                <Button
                  size="small"
                  type={hasVideo ? 'primary' : 'text'}
                  icon={<VideoCameraOutlined />}
                />
              </Tooltip>
            </Popover>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
