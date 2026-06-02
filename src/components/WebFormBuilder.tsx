"use client";

import React, { useState } from 'react';
import { useData } from '@/context/DataContext';
import { WebForm, WebFormField } from '@/types/crm';
import { 
  Plus, Copy, Check, Trash2, Code2, Eye, ArrowLeft, 
  GripVertical, ToggleLeft, ToggleRight, Globe, Pencil,
  ChevronDown, ChevronUp, Sparkles
} from 'lucide-react';

const DEFAULT_FIELDS: WebFormField[] = [
  { key: 'name',                 label: 'Full Name',             type: 'text',   required: true,  enabled: true  },
  { key: 'phone',                label: 'Phone Number',          type: 'tel',    required: true,  enabled: true  },
  { key: 'email',                label: 'Email Address',         type: 'email',  required: false, enabled: true  },
  { key: 'parent_contact',       label: 'Parent Contact Number', type: 'tel',    required: false, enabled: false },
  { key: 'neet_marks',           label: 'NEET Score',            type: 'number', required: false, enabled: true  },
  { key: 'budget',               label: 'Budget (in Lakhs)',     type: 'number', required: false, enabled: false },
  { key: 'preferred_destination',label: 'Preferred Country/State',type: 'text', required: false, enabled: true  },
  { key: 'course',               label: 'Course Interested In',  type: 'select', required: false, enabled: true,
    options: ['MBBS', 'MBBS Abroad', 'BDS', 'BAMS', 'Nursing', 'MBA', 'B.Tech', 'Other'] },
];

const PRESET_COLORS = [
  '#4F46E5', '#2563EB', '#7C3AED', '#DB2777', '#DC2626',
  '#D97706', '#059669', '#0891B2', '#1D4ED8', '#374151',
];

function generateEmbedCode(form: WebForm, webhookUrl: string): string {
  const enabledFields = form.fields.filter(f => f.enabled);
  const fieldsJson = JSON.stringify(enabledFields);
  const color = form.primary_color;

  return `<!-- Perfect Scholar CRM: ${form.name} -->
<div id="ps-form-${form.id}"></div>
<script>
(function() {
  var cfg = {
    formId: "${form.id}",
    formName: ${JSON.stringify(form.name)},
    webhookUrl: "${webhookUrl}",
    leadSource: ${JSON.stringify(form.lead_source)},
    buttonText: ${JSON.stringify(form.button_text)},
    successMsg: ${JSON.stringify(form.success_message)},
    color: "${color}",
    fields: ${fieldsJson}
  };

  var style = document.createElement('style');
  style.textContent = [
    '#ps-form-'+cfg.formId+'{font-family:system-ui,sans-serif;max-width:480px;margin:0 auto}',
    '#ps-form-'+cfg.formId+' .ps-field{margin-bottom:14px}',
    '#ps-form-'+cfg.formId+' label{display:block;font-size:12px;font-weight:600;color:#475569;margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em}',
    '#ps-form-'+cfg.formId+' input,#ps-form-'+cfg.formId+' select{width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;box-sizing:border-box;background:#f8fafc;color:#0f172a;transition:border-color .2s}',
    '#ps-form-'+cfg.formId+' input:focus,#ps-form-'+cfg.formId+' select:focus{border-color:'+cfg.color+';background:#fff;box-shadow:0 0 0 3px '+cfg.color+'22}',
    '#ps-form-'+cfg.formId+' .ps-btn{width:100%;padding:13px;background:'+cfg.color+';color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;margin-top:6px;transition:opacity .2s}',
    '#ps-form-'+cfg.formId+' .ps-btn:hover{opacity:.88}',
    '#ps-form-'+cfg.formId+' .ps-btn:disabled{opacity:.6;cursor:not-allowed}',
    '#ps-form-'+cfg.formId+' .ps-success{text-align:center;padding:24px;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;color:#166534;font-weight:600;font-size:15px}',
    '#ps-form-'+cfg.formId+' .ps-error{color:#dc2626;font-size:12px;margin-top:4px}',
  ].join('');
  document.head.appendChild(style);

  var container = document.getElementById('ps-form-'+cfg.formId);
  if (!container) return;

  var formEl = document.createElement('form');
  formEl.id = 'ps-inner-'+cfg.formId;

  cfg.fields.forEach(function(f) {
    var wrap = document.createElement('div');
    wrap.className = 'ps-field';
    var lbl = document.createElement('label');
    lbl.textContent = f.label + (f.required ? ' *' : '');
    var inp;
    if (f.type === 'select' && f.options) {
      inp = document.createElement('select');
      var placeholder = document.createElement('option');
      placeholder.value = ''; placeholder.textContent = 'Select...';
      inp.appendChild(placeholder);
      f.options.forEach(function(o) {
        var opt = document.createElement('option');
        opt.value = o; opt.textContent = o;
        inp.appendChild(opt);
      });
    } else {
      inp = document.createElement('input');
      inp.type = f.type;
    }
    inp.name = f.key;
    inp.required = f.required;
    inp.placeholder = f.label;
    wrap.appendChild(lbl);
    wrap.appendChild(inp);
    formEl.appendChild(wrap);
  });

  var btn = document.createElement('button');
  btn.type = 'submit';
  btn.className = 'ps-btn';
  btn.textContent = cfg.buttonText;
  formEl.appendChild(btn);

  container.appendChild(formEl);

  formEl.addEventListener('submit', function(e) {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = 'Submitting...';
    var data = { lead_source: cfg.leadSource, landing_page_url: window.location.href };
    var params = new URLSearchParams(window.location.search);
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function(k) {
      if (params.get(k)) data[k] = params.get(k);
    });
    cfg.fields.forEach(function(f) {
      var el = formEl.elements[f.key];
      if (el && el.value) data[f.key] = el.value;
    });
    fetch(cfg.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function(r) {
      if (r.ok) {
        container.innerHTML = '<div class="ps-success">✅ ' + cfg.successMsg + '</div>';
      } else {
        btn.disabled = false;
        btn.textContent = cfg.buttonText;
        alert('Submission failed. Please try again.');
      }
    }).catch(function() {
      btn.disabled = false;
      btn.textContent = cfg.buttonText;
      alert('Network error. Please check your connection.');
    });
  });
})();
<\/script>`;
}

export const WebFormBuilder: React.FC = () => {
  const { settings, updateSettings, currentUser } = useData();
  const webhookUrl = 'https://crm.perfectscholar.com/api/webhook';
  
  const forms: WebForm[] = settings.web_forms || [];

  // View state: 'list' | 'create' | 'embed'
  const [view, setView] = useState<'list' | 'create' | 'embed'>('list');
  const [selectedForm, setSelectedForm] = useState<WebForm | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Form builder state
  const [formName, setFormName] = useState('');
  const [leadSource, setLeadSource] = useState('Website Form');
  const [buttonText, setButtonText] = useState('Submit Enquiry');
  const [successMessage, setSuccessMessage] = useState('Thank you! Our team will contact you shortly.');
  const [primaryColor, setPrimaryColor] = useState('#4F46E5');
  const [fields, setFields] = useState<WebFormField[]>(DEFAULT_FIELDS.map(f => ({ ...f })));

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const resetBuilder = () => {
    setFormName('');
    setLeadSource('Website Form');
    setButtonText('Submit Enquiry');
    setSuccessMessage('Thank you! Our team will contact you shortly.');
    setPrimaryColor('#4F46E5');
    setFields(DEFAULT_FIELDS.map(f => ({ ...f })));
  };

  const handleCreateForm = () => {
    if (!formName.trim()) return;
    const newForm: WebForm = {
      id: `form-${Date.now()}`,
      name: formName.trim(),
      lead_source: leadSource,
      button_text: buttonText,
      success_message: successMessage,
      primary_color: primaryColor,
      fields: fields.filter(f => f.enabled),
      created_at: new Date().toISOString(),
    };
    const updated = [...forms, newForm];
    updateSettings({ web_forms: updated });
    resetBuilder();
    setSelectedForm(newForm);
    setView('embed');
  };

  const handleDeleteForm = (id: string) => {
    if (!confirm('Delete this form?')) return;
    updateSettings({ web_forms: forms.filter(f => f.id !== id) });
  };

  const toggleField = (key: string) => {
    setFields(prev => prev.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f));
  };

  const toggleRequired = (key: string) => {
    setFields(prev => prev.map(f => f.key === key ? { ...f, required: !f.required } : f));
  };

  const handleCopyCode = () => {
    if (!selectedForm) return;
    const code = generateEmbedCode(selectedForm, webhookUrl);
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  // ─── EMBED CODE VIEW ───────────────────────────────────────
  if (view === 'embed' && selectedForm) {
    const embedCode = generateEmbedCode(selectedForm, webhookUrl);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('list')} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-xl transition-all">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div>
            <h2 className="font-bold text-slate-800 dark:text-white text-base">{selectedForm.name}</h2>
            <p className="text-xs text-slate-400 font-medium">Embed Code — paste this into your website HTML</p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 rounded-2xl p-4 flex gap-3">
          <Sparkles className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-indigo-700 dark:text-indigo-300">
            <p className="font-bold mb-1">How to use this embed code</p>
            <ol className="list-decimal ml-4 space-y-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
              <li>Copy the code below</li>
              <li>Paste it anywhere in your website's HTML where you want the form to appear</li>
              <li>The form is self-contained — no plugins or libraries needed</li>
              <li>Leads submitted will appear in your CRM under <strong>"{selectedForm.lead_source}"</strong> source instantly</li>
            </ol>
          </div>
        </div>

        {/* Code Block */}
        <div className="relative bg-slate-950 dark:bg-black border border-slate-800 dark:border-zinc-900 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 dark:border-zinc-900">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Embed Code</span>
            </div>
            <button
              onClick={handleCopyCode}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                copiedCode
                  ? 'bg-emerald-500 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {copiedCode ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Code</>}
            </button>
          </div>
          <pre className="p-4 text-xs text-indigo-300 overflow-x-auto max-h-96 leading-relaxed font-mono whitespace-pre-wrap break-all">
            {embedCode}
          </pre>
        </div>

        {/* Preview of Fields */}
        <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-700 dark:text-white mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4 text-indigo-500" /> Form Fields Preview
          </h3>
          <div className="space-y-3 max-w-sm">
            {selectedForm.fields.map(f => (
              <div key={f.key}>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  {f.label}{f.required && <span className="text-rose-500 ml-0.5">*</span>}
                </label>
                {f.type === 'select' ? (
                  <select disabled className="w-full border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm bg-slate-50 dark:bg-zinc-900 text-slate-400 cursor-not-allowed">
                    <option>Select...</option>
                  </select>
                ) : (
                  <input
                    type={f.type}
                    placeholder={f.label}
                    disabled
                    className="w-full border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm bg-slate-50 dark:bg-zinc-900 text-slate-400 cursor-not-allowed"
                  />
                )}
              </div>
            ))}
            <button
              disabled
              className="w-full py-3 rounded-xl text-sm font-bold text-white mt-2"
              style={{ backgroundColor: selectedForm.primary_color }}
            >
              {selectedForm.button_text}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── CREATE FORM VIEW ──────────────────────────────────────
  if (view === 'create') {
    const enabledCount = fields.filter(f => f.enabled).length;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => { setView('list'); resetBuilder(); }} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-xl transition-all">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div>
            <h2 className="font-bold text-slate-800 dark:text-white text-base">Create New Lead Form</h2>
            <p className="text-xs text-slate-400 font-medium">Configure your form and get an embed code</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left: Config */}
          <div className="space-y-5">

            {/* Basic Info */}
            <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Form Details</h3>
              
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Form Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. MBBS Enquiry Form"
                  className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-zinc-900 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Lead Source Label</label>
                <input
                  type="text"
                  value={leadSource}
                  onChange={e => setLeadSource(e.target.value)}
                  placeholder="e.g. Website Form"
                  className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-zinc-900 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:text-white"
                />
                <p className="text-[10px] text-slate-400 mt-1">Leads from this form will show this as their source in the CRM</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Submit Button Text</label>
                <input
                  type="text"
                  value={buttonText}
                  onChange={e => setButtonText(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-zinc-900 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Success Message</label>
                <input
                  type="text"
                  value={successMessage}
                  onChange={e => setSuccessMessage(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-zinc-900 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:text-white"
                />
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Button & Accent Color</label>
                <div className="flex flex-wrap gap-2 items-center">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setPrimaryColor(c)}
                      className={`w-7 h-7 rounded-lg transition-all ${primaryColor === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="w-7 h-7 rounded-lg cursor-pointer border border-slate-200 dark:border-zinc-700"
                    title="Custom color"
                  />
                  <span className="text-xs font-mono text-slate-400">{primaryColor}</span>
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleCreateForm}
              disabled={!formName.trim() || enabledCount < 2}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all"
            >
              <Code2 className="w-4 h-4" />
              Generate Embed Code
            </button>
          </div>

          {/* Right: Field Selector */}
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Form Fields</h3>
              <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                {enabledCount} enabled
              </span>
            </div>

            <div className="space-y-2">
              {fields.map(field => (
                <div
                  key={field.key}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    field.enabled
                      ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200/60 dark:border-indigo-800/40'
                      : 'bg-slate-50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800/50 opacity-60'
                  }`}
                >
                  <GripVertical className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 flex-shrink-0" />
                  
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold ${field.enabled ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                      {field.label}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">{field.key}</p>
                  </div>

                  {/* Required toggle (only if enabled) */}
                  {field.enabled && field.key !== 'name' && field.key !== 'phone' && (
                    <button
                      onClick={() => toggleRequired(field.key)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all ${
                        field.required
                          ? 'bg-rose-50 text-rose-500 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800/40'
                          : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-zinc-800 dark:border-zinc-700'
                      }`}
                    >
                      {field.required ? 'Required' : 'Optional'}
                    </button>
                  )}

                  {/* Name & Phone are always required */}
                  {(field.key === 'name' || field.key === 'phone') && (
                    <span className="text-[10px] font-bold text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded-md border border-rose-200/50 dark:border-rose-900/30">
                      Required
                    </span>
                  )}

                  {/* Enable/disable toggle */}
                  <button
                    onClick={() => field.key !== 'name' && field.key !== 'phone' && toggleField(field.key)}
                    className={`flex-shrink-0 ${field.key === 'name' || field.key === 'phone' ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                    title={field.key === 'name' || field.key === 'phone' ? 'Always required' : 'Toggle field'}
                  >
                    {field.enabled
                      ? <ToggleRight className="w-5 h-5 text-indigo-500" />
                      : <ToggleLeft className="w-5 h-5 text-slate-400" />
                    }
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── LIST VIEW ─────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-500" /> Website Lead Forms
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Create embeddable forms and paste the code into your website to capture leads directly into the CRM.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setView('create')}
            className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-500/10 transition-all hover:scale-[1.01]"
          >
            <Plus className="w-4 h-4" /> New Form
          </button>
        )}
      </div>

      {/* Webhook Info Card */}
      <div className="bg-slate-900 dark:bg-black border border-slate-700 dark:border-zinc-900 rounded-2xl p-4 flex items-start gap-3">
        <Code2 className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-slate-300 mb-1">Your CRM Webhook Endpoint</p>
          <code className="text-xs font-mono text-indigo-300 break-all">{webhookUrl}</code>
          <p className="text-[10px] text-slate-500 mt-1">All forms submit leads to this endpoint. You can also use this URL directly in n8n, Zapier, or Make.</p>
        </div>
      </div>

      {/* Form Cards */}
      {forms.length === 0 ? (
        <div className="bg-white dark:bg-zinc-950 border border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl p-12 flex flex-col items-center justify-center text-center">
          <Globe className="w-10 h-10 text-slate-300 dark:text-zinc-700 mb-4" />
          <h3 className="font-bold text-slate-600 dark:text-slate-300 mb-1">No Forms Yet</h3>
          <p className="text-xs text-slate-400 mb-5 max-w-xs">Create your first lead capture form and get a code snippet to paste on your website.</p>
          {isAdmin && (
            <button
              onClick={() => setView('create')}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" /> Create First Form
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {forms.map(form => (
            <div
              key={form.id}
              className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-2xl p-5 hover:shadow-md dark:hover:shadow-black/30 transition-all group"
            >
              {/* Color accent bar */}
              <div className="h-1.5 rounded-full mb-4" style={{ backgroundColor: form.primary_color }} />

              <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1">{form.name}</h3>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">{form.lead_source}</p>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {form.fields.map(f => (
                  <span key={f.key} className="text-[10px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md">
                    {f.label}
                  </span>
                ))}
              </div>

              <div className="text-[10px] text-slate-400 mb-4">
                Created {new Date(form.created_at).toLocaleDateString()}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setSelectedForm(form); setView('embed'); }}
                  className="flex-1 py-2 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-indigo-200/50 dark:border-indigo-800/40"
                >
                  <Code2 className="w-3.5 h-3.5" /> Get Code
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteForm(form.id)}
                    className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-400 rounded-xl transition-all border border-transparent hover:border-rose-200/50 opacity-0 group-hover:opacity-100"
                    title="Delete form"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
