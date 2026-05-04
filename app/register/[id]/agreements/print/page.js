import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { sanitizeHtml } from '@/lib/sanitize';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DOC_TITLES = {
  payment_agreement: 'Registration Fee Policy',
  participant_rules: 'Participation Policy & Behavior Standards',
  liability_waiver:  'Health & Safety — Liability Waiver and Release of Claims',
};

export default async function AgreementPrintPage({ params, searchParams }) {
  const { id: programId } = await params;
  const { doc: docType } = await searchParams;

  if (!docType) redirect(`/register/${programId}/agreements`);

  const { data: doc } = await admin
    .from('policy_documents')
    .select('type, title, content')
    .eq('type', docType)
    .eq('is_current', true)
    .single();

  if (!doc) redirect(`/register/${programId}/agreements`);

  const title = DOC_TITLES[doc.type] || doc.title || doc.type;
  const date = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 15px;
          line-height: 1.8;
          color: #111;
          background: #fff;
        }

        /* ── Print bar (hidden when printing) ── */
        .print-bar {
          position: fixed;
          top: 0; left: 0; right: 0;
          background: #111;
          color: #fff;
          padding: 0.75rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          z-index: 100;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }

        .print-bar-title {
          font-family: Arial, sans-serif;
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #ccc;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .print-bar-actions {
          display: flex;
          gap: 0.75rem;
          flex-shrink: 0;
          align-items: center;
        }

        .btn-print {
          font-family: Arial, sans-serif;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          background: #b8860b;
          color: #fff;
          border: none;
          border-radius: 5px;
          padding: 0.5rem 1.25rem;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
        }

        .btn-print:hover { background: #a07800; }

        .btn-back {
          font-family: Arial, sans-serif;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #aaa;
          text-decoration: none;
          border: 1px solid #444;
          border-radius: 4px;
          padding: 0.4rem 0.875rem;
        }

        .btn-back:hover { color: #fff; border-color: #888; }

        /* ── Document ── */
        .document {
          max-width: 720px;
          margin: 0 auto;
          padding: 6rem 2rem 4rem;
        }

        .doc-header {
          border-bottom: 2px solid #111;
          padding-bottom: 1rem;
          margin-bottom: 2rem;
        }

        .doc-org {
          font-family: Arial, sans-serif;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #888;
          margin-bottom: 0.5rem;
        }

        .doc-title {
          font-family: Arial, sans-serif;
          font-size: 1.4rem;
          font-weight: 800;
          color: #111;
          letter-spacing: 0.02em;
          line-height: 1.3;
        }

        /* ── Rich text content styles ── */
        .doc-content p {
          margin-bottom: 1em;
        }

        .doc-content p:last-child {
          margin-bottom: 0;
        }

        .doc-content h2 {
          font-family: Arial, sans-serif;
          font-size: 1rem;
          font-weight: 700;
          margin: 1.5em 0 0.5em;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .doc-content ul, .doc-content ol {
          padding-left: 1.75em;
          margin: 0.5em 0 1em;
        }

        .doc-content li {
          margin-bottom: 0.4em;
        }

        .doc-content strong { font-weight: 700; }
        .doc-content em { font-style: italic; }
        .doc-content u { text-decoration: underline; }

        .doc-content a {
          color: #b40000;
          text-decoration: underline;
        }

        .doc-footer {
          margin-top: 3rem;
          padding-top: 1rem;
          border-top: 1px solid #ddd;
          font-family: Arial, sans-serif;
          font-size: 0.75rem;
          color: #888;
        }

        /* ── Print styles ── */
        @media print {
          .print-bar { display: none !important; }

          .document {
            padding: 1.5rem 1rem 2rem;
            max-width: 100%;
          }

          body {
            font-size: 13px;
          }

          a { color: #111 !important; text-decoration: none !important; }
        }
      `}</style>

      {/* Print bar — hidden when printing */}
      <div className="print-bar">
        <span className="print-bar-title">{title}</span>
        <div className="print-bar-actions">
          <a href={`/register/${programId}/agreements`} className="btn-back">← Back</a>
          <button className="btn-print">
            ⎙ Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Document */}
      <div className="document">
        <div className="doc-header">
          <div className="doc-org">Triboro Youth Theatre</div>
          <h1 className="doc-title">{title}</h1>
        </div>

        <div
          className="doc-content"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(doc.content) }}
        />

        <div className="doc-footer">
          Triboro Youth Theatre &mdash; {date}
        </div>
      </div>

      {/* Inline script to wire up the print button — works without hydration */}
      <script
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener('DOMContentLoaded', function() {
              var btn = document.querySelector('.btn-print');
              if (btn) btn.addEventListener('click', function() { window.print(); });
            });
          `,
        }}
      />
    </>
  );
}