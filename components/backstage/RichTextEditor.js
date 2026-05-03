'use client';

import dynamic from 'next/dynamic';
import { useRef, useMemo, useState } from 'react';

// Jodit must be loaded client-side only — it requires the DOM.
const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false });

const FULL_BUTTONS = [
  'bold', 'italic', 'underline', 'strikethrough', '|',
  'font', 'fontsize', 'brush', '|',
  'ul', 'ol', '|',
  'left', 'center', 'right', 'justify', '|',
  'link', 'unlink', '|',
  'hr', '|',
  'eraser', 'source',
];

const LEAN_BUTTONS = [
  'bold', 'italic', 'underline', '|',
  'ul', 'ol', '|',
  'link', 'unlink', '|',
  'eraser', 'source',
];

export default function RichTextEditor({
  value,
  onChange,
  minHeight = 200,
  placeholder = '',
  showFontSize = false,
  showColor = false,
  showAlign = false,
  // editorKey: pass the document/template ID here so the editor
  // fully remounts when you switch between documents.
  // This is the correct Jodit pattern for switching content.
  editorKey,
}) {
  const editor = useRef(null);
  // Jodit is uncontrolled — it owns its own content internally.
  // We initialize with the value prop and only read back on blur.
  const [content, setContent] = useState(value || '');
  const buttons = (showFontSize || showColor || showAlign) ? FULL_BUTTONS : LEAN_BUTTONS;

  const config = useMemo(() => ({
    readonly:             false,
    placeholder:          placeholder || '',
    minHeight:            minHeight,
    maxHeight:            600,
    buttons,
    buttonsMD:            buttons,
    buttonsSM:            buttons,
    buttonsXS:            buttons,
    toolbarAdaptive:      false,
    showCharsCounter:     false,
    showWordsCounter:     false,
    showXPathInStatusbar: false,
    askBeforePasteHTML:       false,
    askBeforePasteFromWord:   false,
    defaultActionOnPaste:     'insert_clear_html',
    cleanHTML: {
      fillEmptyParagraph: false,
      replaceNBSP:        true,
    },
    style: {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize:   '14px',
      color:      '#111111',
    },
    theme: 'default',
    enableDragAndDropFileToEditor: false,
    uploader:    { insertImageAsBase64URI: false },
    filebrowser: { ajax: { url: '' } },
    image:       { useImageEditor: false },
    license: '',
    disablePlugins: [
      'image', 'file', 'video', 'media', 'speech-recognize',
      'drag-and-drop-element', 'drag-and-drop',
      'fullsize', 'about', 'copy-format', 'table', 'xpath',
    ].join(','),
  }), [minHeight, placeholder, buttons]);

  return (
    <div style={{ border: '1px solid #d1d5db', borderRadius: '6px', overflow: 'hidden' }}>
      <style>{`
        .jodit-container { border: none !important; }
        .jodit-toolbar { border-bottom: 1px solid #e5e7eb !important; background: #f9fafb !important; }
        .jodit-workplace { background: #fff !important; }
        .jodit-status-bar { display: none !important; }
      `}</style>
      <JoditEditor
        key={editorKey}
        ref={editor}
        value={content}
        config={config}
        tabIndex={1}
        // Per official Jodit docs: ONLY use onBlur to update content.
        // Using onChange causes re-renders that reset the editor.
        onBlur={newContent => {
          setContent(newContent);
          onChange(newContent);
        }}
        onChange={() => {}}
      />
    </div>
  );
}