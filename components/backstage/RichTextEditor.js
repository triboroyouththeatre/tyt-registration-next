'use client';

import dynamic from 'next/dynamic';
import { useRef, useMemo } from 'react';

// Jodit must be loaded client-side only — it requires the DOM (window/document).
// next/dynamic with ssr:false ensures it never runs on the server.
const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false });

// ── Toolbar configs ────────────────────────────────────────────────────────────
// Full toolbar: for program descriptions and policy documents
const FULL_BUTTONS = [
  'bold', 'italic', 'underline', 'strikethrough', '|',
  'font', 'fontsize', 'brush', '|',
  'ul', 'ol', '|',
  'left', 'center', 'right', 'justify', '|',
  'link', 'unlink', '|',
  'hr', '|',
  'eraser', 'source',
];

// Lean toolbar: for email templates (no font size/color — email clients strip them)
const LEAN_BUTTONS = [
  'bold', 'italic', 'underline', '|',
  'ul', 'ol', '|',
  'link', 'unlink', '|',
  'eraser', 'source',
];

// ── Main component ─────────────────────────────────────────────────────────────
export default function RichTextEditor({
  value,
  onChange,
  minHeight = 200,
  placeholder = '',
  showFontSize = false,
  showColor = false,
  showAlign = false,
}) {
  const editorRef = useRef(null);

  // Determine toolbar based on props
  const buttons = (showFontSize || showColor || showAlign) ? FULL_BUTTONS : LEAN_BUTTONS;

  // Jodit config — memoized so it doesn't recreate the editor on every render.
  // This is the critical pattern for Jodit in React: stable config reference.
  const config = useMemo(() => ({
    readonly:        false,
    placeholder:     placeholder || '',
    minHeight:       minHeight,
    maxHeight:       600,
    buttons:         buttons,
    buttonsMD:       buttons,
    buttonsSM:       buttons,
    buttonsXS:       buttons,
    toolbarAdaptive: false,
    showCharsCounter: false,
    showWordsCounter: false,
    showXPathInStatusbar: false,
    askBeforePasteHTML:   false,
    askBeforePasteFromWord: false,
    defaultActionOnPaste: 'insert_clear_html',
    // Clean output: strip Word/Google Docs garbage, keep clean HTML
    cleanHTML: {
      fillEmptyParagraph: false,
      replaceNBSP:        true,
    },
    // Style the editor to match your admin UI
    style: {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize:   '14px',
      color:      '#111111',
    },
    theme: 'default',
    // Disable features we don't need
    enableDragAndDropFileToEditor: false,
    uploader: { insertImageAsBase64URI: false },
    filebrowser: { ajax: { url: '' } },
    image: { useImageEditor: false },
    // Remove the powered-by link
    license: '',
    disablePlugins: [
      'image',
      'file',
      'video',
      'media',
      'speech-recognize',
      'drag-and-drop-element',
      'drag-and-drop',
      'fullsize',
      'about',
      'print',
      'preview',
      'copy-format',
      'table',
      'xpath',
    ].join(','),
  }), [minHeight, placeholder, buttons]);

  // Jodit manages its own internal state and calls onBlur/onChange.
  // We use onBlur for the final value capture to avoid excessive re-renders,
  // but also wire onChange for real-time updates.
  return (
    <div style={{ border: '1px solid #d1d5db', borderRadius: '6px', overflow: 'hidden' }}>
      <style>{`
        .jodit-container { border: none !important; }
        .jodit-toolbar { border-bottom: 1px solid #e5e7eb !important; background: #f9fafb !important; }
        .jodit-workplace { background: #fff !important; }
        .jodit-status-bar { display: none !important; }
      `}</style>
      <JoditEditor
        ref={editorRef}
        value={value || ''}
        config={config}
        onBlur={newContent => onChange(newContent)}
        onChange={newContent => onChange(newContent)}
      />
    </div>
  );
}