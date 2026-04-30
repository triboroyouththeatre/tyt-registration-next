'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
}

function fmtPhone(phone) {
  if (!phone) return '—';
  const d = phone.replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  return phone;
}

function downloadCSV(filename, headers, rows) {
  const escape = v => {
    if (v === null || v === undefined) return '';
    const str = String(v);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  const csv = [headers, ...rows].map(row => row.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const REPORT_TYPES = [
  { id: 'enrollment', label: 'Enrollment',   description: 'Participant roster with grade, gender, registration and payment status' },
  { id: 'contact',    label: 'Contact/Phone', description: 'Participant and all guardian and emergency contact details' },
  { id: 'medical',    label: 'Medical',       description: 'All health flags and notes per participant' },
  { id: 'financial',  label: 'Financial',     description: 'Amount paid, balance due, and contact info' },
];

export default function ReportsPage() {
  const [activeReport, setActiveReport]   = useState('enrollment');
  const [filterProgram, setFilterProgram] = useState('');
  const [data, setData]                   = useState([]);
  const [programs, setPrograms]           = useState([]);
  const [gradeLevels, setGradeLevels]     = useState([]);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const [{ data: progs }, { data: gl }] = await Promise.all([
        supabase.from('programs').select('id, label, sessions!inner(seasons!inner(is_active))').eq('sessions.seasons.is_active', true),
        supabase.from('grade_levels').select('yog, label, seasons!inner(is_active)').eq('seasons.is_active', true),
      ]);
      setPrograms(progs || []);
      setGradeLevels(gl || []);
      await loadData('');
    }
    init();
  }, []);

  async function loadData(progId) {
    setLoading(true);
    const supabase = createClient();

    const { data: regs } = await supabase
      .from('registrations')
      .select(`
        id, registration_number, amount_paid, total_fee,
        is_financial_aid_requested, family_id, cart_id,
        participants(first_name, last_name, nickname, yog, date_of_birth, genders(label)),
        registration_statuses(label),
        payments(payment_statuses(label)),
        health_records(
          academic_flag, academic_notes, behavioral_flag, behavioral_notes,
          allergies_flag, allergies_notes, epipen, asthma,
          concussion_flag, concussion_date, general_comments
        ),
        carts(program_id, programs(label))
      `)
      .order('registration_number');

    if (!regs?.length) { setData([]); setLoading(false); return; }

    // Get unique family IDs
    const familyIds = [...new Set(regs.map(r => r.family_id).filter(Boolean))];

    // Fetch contacts for all families
    const { data: allContacts } = await supabase
      .from('contacts')
      .select('family_id, priority, first_name, last_name, phone, email')
      .in('family_id', familyIds)
      .in('priority', [1, 2, 3, 4])
      .order('priority');

    // Build contact map: family_id → { 1: contact, 2: contact, ... }
    const contactsByFamily = {};
    (allContacts || []).forEach(c => {
      if (!contactsByFamily[c.family_id]) contactsByFamily[c.family_id] = {};
      contactsByFamily[c.family_id][c.priority] = c;
    });

    // Flatten registrations into report rows
    let flat = regs.map(r => {
      const p  = r.participants;
      const h  = r.health_records?.[0] || {};
      const ct = contactsByFamily[r.family_id] || {};

      return {
        _program_id:       r.carts?.program_id || '',
        _family_id:        r.family_id,
        first_name:        p?.first_name || '',
        last_name:         p?.last_name  || '',
        nickname:          p?.nickname   || '',
        yog:               p?.yog,
        gender:            p?.genders?.label || '',
        guardian1_first:   ct[1]?.first_name || '',
        guardian1_last:    ct[1]?.last_name  || '',
        guardian1_phone:   ct[1]?.phone      || '',
        guardian1_email:   ct[1]?.email      || '',
        guardian2_first:   ct[2]?.first_name || '',
        guardian2_last:    ct[2]?.last_name  || '',
        guardian2_phone:   ct[2]?.phone      || '',
        guardian2_email:   ct[2]?.email      || '',
        ec1_first:         ct[3]?.first_name || '',
        ec1_last:          ct[3]?.last_name  || '',
        ec1_phone:         ct[3]?.phone      || '',
        ec2_first:         ct[4]?.first_name || '',
        ec2_last:          ct[4]?.last_name  || '',
        ec2_phone:         ct[4]?.phone      || '',
        registration_number: r.registration_number || '',
        amount_paid:       r.amount_paid,
        total_fee:         r.total_fee,
        is_financial_aid_requested: r.is_financial_aid_requested,
        reg_status:        r.registration_statuses?.label || '',
        pay_status:        r.payments?.[0]?.payment_statuses?.label || '',
        program_label:     r.carts?.programs?.label || '',
        academic_flag:     h.academic_flag    || false,
        academic_notes:    h.academic_notes   || '',
        behavioral_flag:   h.behavioral_flag  || false,
        behavioral_notes:  h.behavioral_notes || '',
        allergies_flag:    h.allergies_flag   || false,
        allergies_notes:   h.allergies_notes  || '',
        epipen:            h.epipen           || false,
        asthma:            h.asthma           || false,
        concussion_flag:   h.concussion_flag  || false,
        concussion_date:   h.concussion_date  || '',
        general_comments:  h.general_comments || '',
      };
    });

    // Apply program filter
    if (progId) flat = flat.filter(r => r._program_id === progId);

    // Sort alphabetically by last name
    flat.sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));

    setData(flat);
    setLoading(false);
  }

  function handleProgramChange(progId) {
    setFilterProgram(progId);
    loadData(progId);
  }

  function getGrade(yog) {
    return gradeLevels?.find(g => g.yog === yog)?.label || (yog ? `YOG ${yog}` : '—');
  }

  function displayName(r) {
    return r.nickname ? `${r.nickname} ${r.last_name}` : `${r.first_name} ${r.last_name}`;
  }

  // ── Table / CSV definitions ────────────────────────────────────────────────

  const tableDefs = {
    enrollment: {
      cols: ['Participant', 'Grade', 'Gender', 'Program', 'Reg Status', 'Pay Status', 'Fin. Aid'],
      csvHeaders: ['Last Name', 'First Name', 'Nickname', 'Grade', 'Gender', 'Program', 'Reg Status', 'Pay Status', 'Financial Aid'],
      render: r => [
        displayName(r), getGrade(r.yog), r.gender || '—',
        r.program_label || '—', r.reg_status || '—', r.pay_status || '—',
        r.is_financial_aid_requested ? 'Yes' : 'No',
      ],
      csvRow: r => [
        r.last_name, r.first_name, r.nickname,
        getGrade(r.yog), r.gender, r.program_label,
        r.reg_status, r.pay_status,
        r.is_financial_aid_requested ? 'Yes' : 'No',
      ],
    },
    contact: {
      cols: ['Participant', 'Guardian 1', 'G1 Phone', 'G1 Email', 'Guardian 2', 'G2 Phone', 'EC1', 'EC1 Phone', 'EC2', 'EC2 Phone'],
      csvHeaders: ['Last Name', 'First Name', 'Guardian 1 Name', 'G1 Phone', 'G1 Email', 'Guardian 2 Name', 'G2 Phone', 'G2 Email', 'EC1 Name', 'EC1 Phone', 'EC2 Name', 'EC2 Phone'],
      render: r => [
        displayName(r),
        `${r.guardian1_first} ${r.guardian1_last}`.trim() || '—', fmtPhone(r.guardian1_phone), r.guardian1_email || '—',
        `${r.guardian2_first} ${r.guardian2_last}`.trim() || '—', fmtPhone(r.guardian2_phone),
        `${r.ec1_first} ${r.ec1_last}`.trim() || '—', fmtPhone(r.ec1_phone),
        `${r.ec2_first} ${r.ec2_last}`.trim() || '—', fmtPhone(r.ec2_phone),
      ],
      csvRow: r => [
        r.last_name, r.first_name,
        `${r.guardian1_first} ${r.guardian1_last}`.trim(), r.guardian1_phone, r.guardian1_email,
        `${r.guardian2_first} ${r.guardian2_last}`.trim(), r.guardian2_phone, r.guardian2_email,
        `${r.ec1_first} ${r.ec1_last}`.trim(), r.ec1_phone,
        `${r.ec2_first} ${r.ec2_last}`.trim(), r.ec2_phone,
      ],
    },
    medical: {
      cols: ['Participant', 'Grade', 'Academic', 'Behavioral', 'Allergies', 'EpiPen', 'Asthma', 'Concussion', 'Comments'],
      csvHeaders: ['Last Name', 'First Name', 'Grade', 'Academic', 'Academic Notes', 'Behavioral', 'Behavioral Notes', 'Allergies', 'Allergy Notes', 'EpiPen', 'Asthma', 'Concussion', 'Comments'],
      render: r => [
        displayName(r), getGrade(r.yog),
        r.academic_flag   ? `Yes — ${r.academic_notes}`   : 'No',
        r.behavioral_flag ? `Yes — ${r.behavioral_notes}` : 'No',
        r.allergies_flag  ? `Yes — ${r.allergies_notes}`  : 'No',
        r.epipen          ? 'Yes' : 'No',
        r.asthma          ? 'Yes' : 'No',
        r.concussion_flag ? 'Yes' : 'No',
        r.general_comments || '—',
      ],
      csvRow: r => [
        r.last_name, r.first_name, getGrade(r.yog),
        r.academic_flag   ? 'Yes' : 'No', r.academic_notes,
        r.behavioral_flag ? 'Yes' : 'No', r.behavioral_notes,
        r.allergies_flag  ? 'Yes' : 'No', r.allergies_notes,
        r.epipen          ? 'Yes' : 'No',
        r.asthma          ? 'Yes' : 'No',
        r.concussion_flag ? 'Yes' : 'No',
        r.general_comments,
      ],
    },
    financial: {
      cols: ['Participant', 'Program', 'Reg #', 'Total', 'Paid', 'Balance', 'Pay Status', 'FA', 'Guardian 1', 'Phone'],
      csvHeaders: ['Last Name', 'First Name', 'Program', 'Reg #', 'Total Fee', 'Amount Paid', 'Balance Due', 'Pay Status', 'Financial Aid', 'Guardian 1', 'G1 Phone', 'G1 Email'],
      render: r => {
        const bal = (parseFloat(r.total_fee) || 0) - (parseFloat(r.amount_paid) || 0);
        return [
          displayName(r), r.program_label || '—', r.registration_number,
          fmt(r.total_fee), fmt(r.amount_paid), fmt(bal),
          r.pay_status || '—',
          r.is_financial_aid_requested ? 'Yes' : 'No',
          `${r.guardian1_first} ${r.guardian1_last}`.trim() || '—',
          fmtPhone(r.guardian1_phone),
        ];
      },
      csvRow: r => {
        const bal = (parseFloat(r.total_fee) || 0) - (parseFloat(r.amount_paid) || 0);
        return [
          r.last_name, r.first_name, r.program_label, r.registration_number,
          r.total_fee, r.amount_paid, bal.toFixed(2),
          r.pay_status, r.is_financial_aid_requested ? 'Yes' : 'No',
          `${r.guardian1_first} ${r.guardian1_last}`.trim(), r.guardian1_phone, r.guardian1_email,
        ];
      },
    },
  };

  function handleDownload() {
    const def  = tableDefs[activeReport];
    const prog = programs.find(p => p.id === filterProgram);
    const progLabel = prog ? `_${prog.label.replace(/\s+/g, '_')}` : '';
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(
      `TYT_${activeReport}${progLabel}_${date}.csv`,
      def.csvHeaders,
      data.map(r => def.csvRow(r))
    );
  }

  const def = tableDefs[activeReport];

  const thStyle = {
    padding: '0.625rem 0.875rem',
    fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600,
    letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280',
    textAlign: 'left', whiteSpace: 'nowrap', background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
  };

  const tdBase = {
    padding: '0.625rem 0.875rem',
    fontFamily: 'var(--font-body)', fontSize: '0.8rem',
    verticalAlign: 'top', borderBottom: '1px solid #f3f4f6',
    whiteSpace: 'nowrap',
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#111', margin: 0 }}>
          Reports
        </h1>
        <button onClick={handleDownload} style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#111', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', cursor: 'pointer' }}>
          ↓ Download CSV
        </button>
      </div>

      {/* Controls */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {REPORT_TYPES.map(rt => (
            <button key={rt.id} onClick={() => setActiveReport(rt.id)} style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', border: `1px solid ${activeReport === rt.id ? '#111' : '#e5e7eb'}`, background: activeReport === rt.id ? '#111' : '#fff', color: activeReport === rt.id ? '#fff' : '#6b7280' }}>
              {rt.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af' }}>Program:</span>
          <select value={filterProgram} onChange={e => handleProgramChange(e.target.value)} style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.4rem 0.75rem', background: '#fff', cursor: 'pointer' }}>
            <option value="">All Programs</option>
            {(programs || []).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {/* Description + count */}
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#9ca3af', margin: '0 0 0.75rem 0', fontStyle: 'italic' }}>
        {REPORT_TYPES.find(r => r.id === activeReport)?.description} · {loading ? '...' : `${data.length} record${data.length !== 1 ? 's' : ''}`}
      </p>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', fontFamily: 'var(--font-body)', color: '#9ca3af', fontStyle: 'italic' }}>Loading...</div>
        ) : data.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', fontFamily: 'var(--font-body)', color: '#9ca3af', fontStyle: 'italic' }}>No records found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{def.cols.map(col => <th key={col} style={thStyle}>{col}</th>)}</tr>
              </thead>
              <tbody>
                {data.map((row, i) => {
                  const cells = def.render(row);
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      {cells.map((cell, j) => {
                        const isYes = typeof cell === 'string' && cell.startsWith('Yes');
                        const isNo  = cell === 'No';
                        return (
                          <td key={j} style={{ ...tdBase, color: isYes ? '#b40000' : isNo ? '#9ca3af' : '#374151', fontWeight: isYes ? 600 : 400 }}>
                            {cell}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}