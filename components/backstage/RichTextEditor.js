'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { useState, useEffect, useCallback } from 'react';

// ── Toolbar button ─────────────────────────────────────────────────────────────
function ToolbarButton({ onClick, active, disabled, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      disabled={disabled}
      title={title}
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        justifyContent: 'center',
        width:          '28px',
        height:         '26px',
        padding:        0,
        border:         'none',
        borderRadius:   '3px',
        cursor:         disabled ? 'default' : 'pointer',
        background:     active ? '#e5e7eb' : 'transparent',
        color:          active ? '#111' : '#374151',
        opacity:        disabled ? 0.4 : 1,
        fontSize:       '13px',
        fontWeight:     active ? 700 : 400,
        fontFamily:     'Arial, sans-serif',
        transition:     'background 0.1s',
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <div style={{
      width:      '1px',
      height:     '18px',
      background: '#d1d5db',
      margin:     '0 4px',
      flexShrink: 0,
    }} />
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function RichTextEditor({ value, onChange, minHeight = 200, placeholder = '' }) {
  const [htmlMode, setHtmlMode] = useState(false);
  const [htmlValue, setHtmlValue] = useState(value || '');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Ensure clean paragraph handling — Enter = new <p>, Shift+Enter = <br>
        hardBreak: {
          keepMarks: true,
        },
      }),
      Underline,
      Link.configure({
        openOnClick:        false,
        autolink:           true,
        defaultProtocol:    'https',
        HTMLAttributes: {
          rel:    'noopener noreferrer',
          target: '_blank',
        },
      }),
    ],
    content:       value || '',
    onUpdate:      ({ editor }) => {
      const html = editor.getHTML();
      setHtmlValue(html);
      onChange(html);
    },
    editorProps: {
      attributes: {
        style: `min-height: ${minHeight}px; padding: 0.75rem 1rem; outline: none; font-family: Arial, sans-serif; font-size: 0.875rem; line-height: 1.7; color: #111; background: #fff;`,
      },
    },
    immediatelyRender: false,
  });

  // Sync external value changes into editor (e.g. when loading a different template)
  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    if (value !== undefined && value !== currentHtml) {
      editor.commands.setContent(value || '', false);
      setHtmlValue(value || '');
    }
  }, [value, editor]);

  // Switch from HTML mode back to rich text mode — parse the HTML
  const exitHtmlMode = useCallback(() => {
    if (editor) {
      editor.commands.setContent(htmlValue, false);
      onChange(htmlValue);
    }
    setHtmlMode(false);
  }, [editor, htmlValue, onChange]);

  // Link insertion
  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href || '';
    const url  = window.prompt('Enter URL', prev);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div style={{
      border:       '1px solid #d1d5db',
      borderRadius: '6px',
      overflow:     'hidden',
      background:   '#fff',
    }}>
      {/* ── Toolbar ── */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        gap:            '2px',
        padding:        '4px 8px',
        borderBottom:   '1px solid #e5e7eb',
        background:     '#f9fafb',
        flexWrap:       'wrap',
      }}>
        {!htmlMode && (
          <>
            {/* Headings */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              active={editor.isActive('heading', { level: 2 })}
              title="Heading"
            >
              H
            </ToolbarButton>

            <Divider />

            {/* Inline marks */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive('bold')}
              title="Bold"
            >
              <strong>B</strong>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive('italic')}
              title="Italic"
            >
              <em>I</em>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              active={editor.isActive('underline')}
              title="Underline"
            >
              <span style={{ textDecoration: 'underline' }}>U</span>
            </ToolbarButton>

            <Divider />

            {/* Lists */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive('bulletList')}
              title="Bullet list"
            >
              ≡
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              active={editor.isActive('orderedList')}
              title="Numbered list"
            >
              1≡
            </ToolbarButton>

            <Divider />

            {/* Link */}
            <ToolbarButton
              onClick={setLink}
              active={editor.isActive('link')}
              title="Insert link"
            >
              🔗
            </ToolbarButton>

            <Divider />

            {/* Clear formatting */}
            <ToolbarButton
              onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
              title="Clear formatting"
            >
              ✕
            </ToolbarButton>
          </>
        )}

        {/* HTML toggle — always shown, right-aligned */}
        <div style={{ marginLeft: 'auto' }}>
          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault();
              if (htmlMode) exitHtmlMode();
              else setHtmlMode(true);
            }}
            style={{
              fontFamily:      'var(--font-display, monospace)',
              fontSize:        '0.6rem',
              fontWeight:      700,
              letterSpacing:   '0.08em',
              textTransform:   'uppercase',
              padding:         '0.2rem 0.6rem',
              border:          `1px solid ${htmlMode ? '#7c3aed' : '#d1d5db'}`,
              borderRadius:    '3px',
              background:      htmlMode ? '#ede9fe' : '#fff',
              color:           htmlMode ? '#7c3aed' : '#6b7280',
              cursor:          'pointer',
            }}
          >
            {htmlMode ? '← Rich Text' : '<> HTML'}
          </button>
        </div>
      </div>

      {/* ── Editor area ── */}
      {htmlMode ? (
        <textarea
          value={htmlValue}
          onChange={e => {
            setHtmlValue(e.target.value);
            onChange(e.target.value);
          }}
          style={{
            width:       '100%',
            minHeight:   `${minHeight}px`,
            maxHeight:   '500px',
            padding:     '0.75rem 1rem',
            border:      'none',
            outline:     'none',
            fontFamily:  'monospace',
            fontSize:    '0.8rem',
            lineHeight:  1.6,
            color:       '#111',
            background:  '#fafafa',
            resize:      'vertical',
            boxSizing:   'border-box',
          }}
          spellCheck={false}
        />
      ) : (
        <>
          <style>{`
            .tyt-rte .tiptap { outline: none; }
            .tyt-rte .tiptap p { margin: 0 0 0.5em 0; }
            .tyt-rte .tiptap p:last-child { margin-bottom: 0; }
            .tyt-rte .tiptap h2 { font-size: 1.1em; font-weight: 700; margin: 0.75em 0 0.3em; }
            .tyt-rte .tiptap ul, .tyt-rte .tiptap ol { padding-left: 1.4em; margin: 0.4em 0; }
            .tyt-rte .tiptap li { margin: 0.15em 0; }
            .tyt-rte .tiptap a { color: #b40000; text-decoration: underline; }
            .tyt-rte .tiptap a:hover { opacity: 0.8; }
            .tyt-rte .tiptap.is-editor-empty:first-child::before {
              content: attr(data-placeholder);
              float: left;
              color: #9ca3af;
              pointer-events: none;
              height: 0;
            }
          `}</style>
          <div className="tyt-rte" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <EditorContent editor={editor} />
          </div>
        </>
      )}
    </div>
  );
}