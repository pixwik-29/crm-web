"use client";

import React, { useState, useEffect } from 'react';
import { useData } from '@/context/DataContext';
import { 
  Users, Webhook, MessageSquare, ShieldAlert, Check, Copy, 
  Settings, Key, Shuffle, RefreshCw, PlusCircle, Trash2
} from 'lucide-react';
import { PipelineStage } from '@/types/crm';

const COURSES = [
  'MBBS',
  'MBBS Abroad',
  'Computer Science Engineering',
  'Mechanical Engineering',
  'Electrical Engineering',
  'Nursing',
  'MBA',
  'Other'
];

export const CRMSettings: React.FC = () => {
  const { 
    currentUser, 
    profiles, 
    leads,
    settings, 
    updateSettings, 
    updateProfileRole,
    createUserProfile
  } = useData();

  // Settings form states
  const [compName, setCompName] = useState(settings.company_name);
  const [admYear, setAdmYear] = useState(settings.admission_year_prefix);
  const [assignRule, setAssignRule] = useState<'round-robin' | 'manual'>(settings.lead_assignment_rule);
  const [budgetThreshold, setBudgetThreshold] = useState(settings.routing_budget_threshold.toString());
  const [verifyToken, setVerifyToken] = useState(settings.meta_verify_token);
  const [accessToken, setAccessToken] = useState(settings.meta_access_token);
  const [phoneId, setPhoneId] = useState(settings.whatsapp_phone_id);
  const [accountId, setAccountId] = useState(settings.whatsapp_account_id);
  const [whApiToken, setWhApiToken] = useState(settings.whatsapp_api_token);
  const [autoResponse, setAutoResponse] = useState(settings.whatsapp_auto_response_template);
  const [formStrategy, setFormStrategy] = useState<'fixed' | 'dynamic'>(settings.form_integration_strategy || 'fixed');
  const [fixedCourse, setFixedCourse] = useState(settings.form_integration_fixed_course || 'MBBS');
  const [dynamicField, setDynamicField] = useState(settings.form_integration_dynamic_field || 'course');
  const [stages, setStages] = useState<PipelineStage[]>(
    settings.pipeline_stages ? [...settings.pipeline_stages].sort((a,b) => a.order - b.order) : []
  );
  const [newStageName, setNewStageName] = useState('');

  // Status/Alerts
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // User Management Form states
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'manager' | 'counsellor'>('counsellor');
  const [userCreateStatus, setUserCreateStatus] = useState<string | null>(null);
  const [userCreateError, setUserCreateError] = useState<string | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Dynamic origin calculation for webhook URLs
  const [origin, setOrigin] = useState('http://localhost:3000');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserFullName || !newUserEmail || !newUserPassword || !newUserPhone) {
      setUserCreateError('Please fill in all user creation fields.');
      return;
    }
    setUserCreateError(null);
    setUserCreateStatus('Creating user profile and sending welcome details...');
    setIsCreatingUser(true);

    try {
      await createUserProfile(
        newUserEmail,
        newUserRole,
        newUserFullName,
        newUserPhone,
        newUserPassword
      );
      setUserCreateStatus('User successfully created! Login credentials sent.');
      // Reset fields
      setNewUserFullName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserPhone('');
      setNewUserRole('counsellor');
      setTimeout(() => setUserCreateStatus(null), 3000);
    } catch (err: any) {
      setUserCreateError(err.message || 'Failed to create user profile.');
    } finally {
      setIsCreatingUser(false);
    }
  };


  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      company_name: compName,
      admission_year_prefix: admYear,
      lead_assignment_rule: assignRule,
      routing_budget_threshold: parseFloat(budgetThreshold) || 40,
      meta_verify_token: verifyToken,
      meta_access_token: accessToken,
      whatsapp_phone_id: phoneId,
      whatsapp_account_id: accountId,
      whatsapp_api_token: whApiToken,
      whatsapp_auto_response_template: autoResponse,
      form_integration_strategy: formStrategy,
      form_integration_fixed_course: fixedCourse,
      form_integration_dynamic_field: dynamicField,
      pipeline_stages: stages
    });

    setSaveStatus('Settings successfully saved & synced!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddStage = () => {
    if (!newStageName.trim()) return;
    const colors = [
      'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
      'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400',
      'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
      'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400',
      'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
    ];
    const newStage: PipelineStage = {
      id: newStageName.trim(),
      name: newStageName.trim(),
      color: colors[stages.length % colors.length],
      order: stages.length
    };
    setStages([...stages, newStage]);
    setNewStageName('');
  };

  const handleDeleteStage = (stageId: string) => {
    const count = leads.filter(l => l.status === stageId).length;
    if (count > 0) {
      alert(`Cannot delete stage "${stageId}": there are ${count} active leads currently in this stage. Please reassign them to another stage first.`);
      return;
    }
    const updated = stages
      .filter(s => s.id !== stageId)
      .map((s, index) => ({ ...s, order: index }));
    setStages(updated);
  };

  const handleMoveStage = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;
    
    const updated = [...stages];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    
    const finalStages = updated.map((s, idx) => ({ ...s, order: idx }));
    setStages(finalStages);
  };

  const handleRenameStage = (index: number, newName: string) => {
    const updated = [...stages];
    updated[index] = { ...updated[index], name: newName };
    setStages(updated);
  };

  const getSampleFormScript = () => {
    const coursePayload = formStrategy === 'fixed'
      ? `course: '${fixedCourse}', // Fixed course selection configured in CRM Settings`
      : `course: leadData.${dynamicField || 'course'}, // Dynamic mapping from input field: ${dynamicField || 'course'}`;

    return `<!-- EduPath Lead Ingestion Form Script -->
<script>
async function submitEduPathLead(leadData) {
  try {
    const response = await fetch('${origin}/api/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: leadData.name,
        phone: leadData.phone,
        email: leadData.email,
        neet_marks: leadData.neetMarks,
        budget: leadData.budget,
        preferred_destination: leadData.prefDestination,
        ${coursePayload}
        lead_source: 'Website Form',
        campaign_name: 'Direct Organic Inbound'
      })
    });
    return await response.json();
  } catch (err) {
    console.error('Lead ingestion failed:', err);
  }
}
</script>`;
  };

  const sampleFormScript = getSampleFormScript();

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Save Settings Notification Alert */}
      {saveStatus && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 rounded-2xl p-4 flex items-center gap-2.5 text-xs font-bold shadow-md shadow-emerald-500/5">
          <Check className="w-4 h-4" />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: General & Routing Rules (Forms form settings) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* General & Lead Routing configuration form */}
          <form onSubmit={handleSaveSettings} className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-6">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-900 pb-4">
              <div className="flex items-center gap-2.5">
                <Settings className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-slate-800 dark:text-white">General & Lead Routing Engine</h3>
              </div>
              {isAdmin && (
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow hover:scale-[1.02] active:scale-[0.98]"
                >
                  Save Settings
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Company / Agency Name</label>
                <input
                  type="text"
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Admission Prefix Year</label>
                <input
                  type="text"
                  value={admYear}
                  onChange={(e) => setAdmYear(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Lead Assignment Routing Rule</label>
                <select
                  value={assignRule}
                  onChange={(e) => setAssignRule(e.target.value as any)}
                  disabled={!isAdmin}
                  className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-350 outline-none disabled:opacity-60"
                >
                  <option value="round-robin">Round-Robin Assignment (Auto-Assign to Counsellors)</option>
                  <option value="manual">Manual Assignments (Admin assigns lead queues)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">VIP Budget Auto-Routing Threshold (Lakhs)</label>
                <input
                  type="number"
                  value={budgetThreshold}
                  onChange={(e) => setBudgetThreshold(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 disabled:opacity-60"
                />
              </div>

            </div>

            {/* Ingestion & Course integration mapping section */}
            <div className="pt-4 border-t border-slate-100 dark:border-zinc-900 space-y-4">
              <div className="flex items-center gap-2">
                <Webhook className="w-4 h-4 text-indigo-500 animate-pulse" />
                <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300">Form Ingestion & Course Mapping Configuration</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Ingestion Mapping Strategy</label>
                  <select
                    value={formStrategy}
                    onChange={(e) => setFormStrategy(e.target.value as any)}
                    disabled={!isAdmin}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-350 outline-none disabled:opacity-60"
                  >
                    <option value="fixed">Fixed Course Ingestion (Auto-assigns all form leads to a specific course)</option>
                    <option value="dynamic">Dynamic Form Mapping (Maps field dynamically from payload)</option>
                  </select>
                </div>

                {formStrategy === 'fixed' ? (
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Target Fixed Course</label>
                    <select
                      value={fixedCourse}
                      onChange={(e) => setFixedCourse(e.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-350 outline-none disabled:opacity-60"
                    >
                      {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Payload Field Key to Map (e.g. course)</label>
                    <input
                      type="text"
                      value={dynamicField}
                      onChange={(e) => setDynamicField(e.target.value)}
                      disabled={!isAdmin}
                      placeholder="e.g. course, preferred_course"
                      className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 disabled:opacity-60"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* WhatsApp Integration Parameters */}
            <div className="pt-4 border-t border-slate-100 dark:border-zinc-900 space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-500" />
                <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300">WhatsApp Business API Settings</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Phone Number ID</label>
                  <input
                    type="text"
                    value={phoneId}
                    onChange={(e) => setPhoneId(e.target.value)}
                    disabled={!isAdmin}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">WhatsApp Business Account ID</label>
                  <input
                    type="text"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    disabled={!isAdmin}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 disabled:opacity-60"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Meta System User Access Token</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={whApiToken}
                      onChange={(e) => setWhApiToken(e.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 pr-10 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 disabled:opacity-60"
                    />
                    <Key className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Automatic Response Template ID</label>
                  <select
                    value={autoResponse}
                    onChange={(e) => setAutoResponse(e.target.value)}
                    disabled={!isAdmin}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-350 outline-none disabled:opacity-60"
                  >
                    <option value="welcome">Welcome Message Template</option>
                    <option value="neet-followup">NEET Marks Follow-up Template</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Meta Lead Webhooks Integration */}
            <div className="pt-4 border-t border-slate-100 dark:border-zinc-900 space-y-4">
              <div className="flex items-center gap-2">
                <Webhook className="w-4 h-4 text-blue-500" />
                <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300">Meta/Facebook Lead Ads Webhook Settings</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Lead Ingest Payload URL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${origin}/api/webhook`}
                      className="flex-1 bg-slate-150/40 dark:bg-black/40 border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-400 outline-none cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyText(`${origin}/api/webhook`, 'url')}
                      className="px-4 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                    >
                      {copiedId === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Verify Token (Meta Dashboard verify)</label>
                  <input
                    type="text"
                    value={verifyToken}
                    onChange={(e) => setVerifyToken(e.target.value)}
                    disabled={!isAdmin}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">System App Verify ID</label>
                  <input
                    type="text"
                    readOnly
                    value="edu_verify_sub_channel"
                    className="w-full bg-slate-150/40 dark:bg-black/40 border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-400 outline-none cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

          </form>

          {/* Web Custom Ingestion Form Snippet Generator */}
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-indigo-500" />
              <h3 className="font-bold text-slate-800 dark:text-white">Custom landing page form integration</h3>
            </div>
            <p className="text-xs text-slate-500">Copy this JavaScript snippet and embed it into your custom college landing pages or Google Sheet triggers to capture leads directly in the CRM.</p>
            
            <div className="relative">
              <pre className="bg-slate-900 dark:bg-black border border-slate-250 dark:border-zinc-900 rounded-2xl p-4 text-[10px] text-indigo-300 overflow-x-auto font-mono max-h-64">
                {sampleFormScript}
              </pre>
              <button
                type="button"
                onClick={() => handleCopyText(sampleFormScript, 'script')}
                className="absolute top-3 right-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold flex items-center gap-1.5"
              >
                {copiedId === 'script' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                Copy Code
              </button>
            </div>
          </div>

          {/* Pipeline Levels Manager */}
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-900 pb-4">
              <div className="flex items-center gap-2.5">
                <Shuffle className="w-5 h-5 text-indigo-500 animate-pulse" />
                <h3 className="font-bold text-slate-800 dark:text-white">Pipeline Stages & Level Customization</h3>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Customize lead stages, rename status tags, and rearrange column sequence on the Kanban Pipeline Board.
            </p>

            {!isAdmin && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl p-3.5 flex gap-2 text-xs font-semibold items-center">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>Only administrators can configure pipeline stages.</span>
              </div>
            )}

            <div className="space-y-3">
              {stages.map((stage, index) => {
                const leadCount = leads.filter(l => l.status === stage.id).length;
                return (
                  <div 
                    key={stage.id} 
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-zinc-900 p-3 rounded-2xl transition-all"
                  >
                    {/* Position Label & Colors */}
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-xs text-slate-400 font-extrabold w-6 text-center">
                        #{index + 1}
                      </span>
                      <input
                        type="text"
                        value={stage.name}
                        disabled={!isAdmin}
                        onChange={(e) => handleRenameStage(index, e.target.value)}
                        className="flex-1 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 disabled:opacity-60 font-semibold"
                      />
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${stage.color || 'bg-slate-100 text-slate-700'}`}>
                        {leadCount} leads
                      </span>
                    </div>

                    {/* Sorting & Deletion Controls */}
                    {isAdmin && (
                      <div className="flex items-center justify-end gap-2.5">
                        <div className="flex rounded-lg border border-slate-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveStage(index, 'up')}
                            className="p-2 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-500 disabled:opacity-30 border-r border-slate-250 dark:border-zinc-800 transition-all font-bold text-xs"
                            title="Move Stage Up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={index === stages.length - 1}
                            onClick={() => handleMoveStage(index, 'down')}
                            className="p-2 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-500 disabled:opacity-30 transition-all font-bold text-xs"
                            title="Move Stage Down"
                          >
                            ▼
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteStage(stage.id)}
                          className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 rounded-xl transition-all"
                          title="Delete Stage"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Create New Stage Form */}
            {isAdmin && (
              <div className="pt-4 border-t border-slate-100 dark:border-zinc-900 flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Visa In-Process"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddStage}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Add Stage
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: User list & role assignments */}
        <div className="space-y-6">
          
          {/* User role panel */}
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="border-b border-slate-100 dark:border-zinc-900 pb-4">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-slate-800 dark:text-white">Counsellors & User Roles</h3>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1.5">Access control assignment center</p>
            </div>

            {!isAdmin && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl p-3.5 flex gap-2 text-xs font-semibold items-center">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>Only administrators can update counsellor roles.</span>
              </div>
            )}

            <div className="divide-y divide-slate-100 dark:divide-zinc-900 space-y-4">
              {profiles.map((profile) => (
                <div key={profile.id} className="flex items-center justify-between pt-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 text-white flex items-center justify-center text-xs font-bold uppercase shadow-sm">
                      {profile.full_name.slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-white">{profile.full_name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{profile.phone || 'No phone set'}</div>
                    </div>
                  </div>

                  <div>
                    {isAdmin ? (
                      <select
                        value={profile.role}
                        onChange={(e) => updateProfileRole(profile.id, e.target.value as any)}
                        className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-lg py-1 px-2.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 outline-none"
                      >
                        <option value="admin">ADMIN</option>
                        <option value="counsellor">COUNSELLOR</option>
                      </select>
                    ) : (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-1 bg-slate-100 dark:bg-zinc-900 text-slate-500 dark:text-slate-400 rounded-md">
                        {profile.role}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* User creation form (Admin only) */}
            {isAdmin && (
              <div className="border-t border-slate-100 dark:border-zinc-900 pt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-indigo-500" />
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Create New Workspace User</h4>
                </div>

                {userCreateError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-semibold">
                    ⚠️ {userCreateError}
                  </div>
                )}

                {userCreateStatus && (
                  <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-[10px] font-semibold animate-pulse">
                    ℹ️ {userCreateStatus}
                  </div>
                )}

                <form onSubmit={handleAddUserSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Amit Verma"
                        value={newUserFullName}
                        onChange={(e) => setNewUserFullName(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-800 dark:text-white outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="amit@crm.com"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-800 dark:text-white outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Temporary Password
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="e.g. counsellor123"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-800 dark:text-white outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Mobile Number
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 9876543210"
                        value={newUserPhone}
                        onChange={(e) => setNewUserPhone(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-800 dark:text-white outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Assigned Role
                    </label>
                    <div className="flex gap-2">
                      {['counsellor', 'manager', 'admin'].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setNewUserRole(r as any)}
                          className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition-all ${
                            newUserRole === r
                              ? 'bg-indigo-600/10 border-indigo-500 text-indigo-500 shadow-inner'
                              : 'border-slate-200 dark:border-zinc-900 bg-slate-50 dark:bg-black text-slate-400 hover:border-slate-400'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isCreatingUser}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg text-[10px] uppercase transition-all disabled:opacity-50 mt-2"
                  >
                    {isCreatingUser ? 'Creating Account...' : 'Create Account & Send Credentials Email'}
                  </button>
                </form>
              </div>
            )}
          </div>


          {/* Quick System Connection diagnostics */}
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Shuffle className="w-5 h-5 text-indigo-500" />
              <h3 className="font-bold text-slate-800 dark:text-white">Active Integrations</h3>
            </div>

            <div className="space-y-3">
              {[
                { name: 'Meta Lead Ads API Webhook', status: 'Healthy Connection', color: 'bg-emerald-500' },
                { name: 'WhatsApp Business API Feed', status: 'Offline Sandbox (Simulated)', color: 'bg-orange-500' },
                { name: 'Supabase Realtime Sync', status: 'Active Gateway', color: 'bg-emerald-500' },
                { name: 'n8n Workflow Webhooks', status: 'Awaiting Webhook Payload', color: 'bg-indigo-500' },
              ].map((conn, idx) => (
                <div key={idx} className="flex justify-between items-center bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-zinc-900/60 p-3 rounded-2xl">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{conn.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${conn.color}`}></span>
                    <span className="text-[10px] font-bold text-slate-400">{conn.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
