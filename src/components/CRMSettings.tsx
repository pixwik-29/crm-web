"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/context/DataContext';

import { 
  Users, Webhook, MessageSquare, ShieldAlert, Check, Copy, 
  Settings, Key, Shuffle, RefreshCw, PlusCircle, Trash2, Wifi, WifiOff,
  Plus, FileText, Plane
} from 'lucide-react';

import { PipelineStage } from '@/types/crm';
import Link from 'next/link';

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
    createUserProfile,
    deleteUserProfile,
    whatsappTemplates,
    addWhatsAppTemplate,
    updateWhatsAppTemplate,
    deleteWhatsAppTemplate,
    uploadAttachment,
    tenantId,
    pipelines,
    pipelineAccess,
    addPipeline,
    updatePipeline,
    deletePipeline,
    updatePipelineAccess,
    visaRequiredDocs,
    saveVisaRequiredDoc,
    deleteVisaRequiredDoc
  } = useData();

  const searchParams = useSearchParams();

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

  // Pipeline management states
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [editPipelineName, setEditPipelineName] = useState('');
  const [editPipelineStages, setEditPipelineStages] = useState<PipelineStage[]>([]);
  const [newPipelineName, setNewPipelineName] = useState('');

  // Checklist settings states
  const [configCountry, setConfigCountry] = useState('Georgia');
  const [newRequiredDocName, setNewRequiredDocName] = useState('');

  const handleAddConfigDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequiredDocName.trim()) return;
    try {
      await saveVisaRequiredDoc(configCountry, newRequiredDocName.trim(), true);
      setNewRequiredDocName('');
    } catch (err: any) {
      alert(err.message || 'Failed to save config.');
    }
  };

  const handleDeleteConfigDoc = async (id: string) => {
    if (!window.confirm('Delete this checklist requirement?')) return;
    await deleteVisaRequiredDoc(id);
  };

  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      const defaultPipe = pipelines.find(p => p.is_default) || pipelines[0];
      setSelectedPipelineId(defaultPipe.id);
    }
  }, [pipelines, selectedPipelineId]);

  const currentPipeline = pipelines.find(p => p.id === selectedPipelineId);

  useEffect(() => {
    if (currentPipeline) {
      setEditPipelineName(currentPipeline.name);
      setEditPipelineStages([...currentPipeline.stages].sort((a, b) => a.order - b.order));
    }
  }, [selectedPipelineId, currentPipeline]);

  // WhatsApp Template States
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [tempBody, setTempBody] = useState('');
  const [tempAttachUrl, setTempAttachUrl] = useState('');
  const [tempAttachName, setTempAttachName] = useState('');
  const [templateStatus, setTemplateStatus] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  
  // File upload state and ref
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

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

  // Facebook Ads connection state
  const [fbStatus, setFbStatus] = useState<string | null>(null);
  const isFbConnected = Boolean(settings.meta_access_token && settings.meta_access_token.trim().length > 10);
  const fbAppId = process.env.NEXT_PUBLIC_FB_APP_ID;
  const [useLiveOauth, setUseLiveOauth] = useState(false);

  // Change Password states & handler
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPw, setIsUpdatingPw] = useState(false);
  const [pwStatus, setPwStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwStatus(null);

    if (newPassword.length < 6) {
      setPwStatus({ type: 'error', message: 'Password must be at least 6 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwStatus({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    setIsUpdatingPw(true);
    try {
      const { isSupabaseConfigured, supabase } = await import('@/lib/supabase');
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        
        if (currentUser?.id && typeof window !== 'undefined') {
          const key = tenantId !== 'default' ? `crm_credentials_tenant_${tenantId}` : 'crm_credentials';
          const stored = localStorage.getItem(key);
          const creds = stored ? JSON.parse(stored) : [];
          const index = creds.findIndex((c: any) => c.profileId === currentUser.id);
          if (index > -1) {
            creds[index].password = newPassword;
            localStorage.setItem(key, JSON.stringify(creds));
          }
        }
      } else {
        if (currentUser?.id && typeof window !== 'undefined') {
          const key = tenantId !== 'default' ? `crm_credentials_tenant_${tenantId}` : 'crm_credentials';
          const stored = localStorage.getItem(key);
          const creds = stored ? JSON.parse(stored) : [];
          const index = creds.findIndex((c: any) => c.profileId === currentUser.id);
          if (index > -1) {
            creds[index].password = newPassword;
            localStorage.setItem(key, JSON.stringify(creds));
          } else {
            throw new Error('User profile credential not found in sandbox environment.');
          }
        } else {
          throw new Error('User is unauthenticated.');
        }
      }

      setPwStatus({ type: 'success', message: 'Password successfully updated!' });
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwStatus(null), 5000);
    } catch (err: any) {
      setPwStatus({ type: 'error', message: err.message || 'Failed to update password.' });
    } finally {
      setIsUpdatingPw(false);
    }
  };

  const getFbPages = () => {
    if (!settings.fb_pages) return [];
    try {
      return typeof settings.fb_pages === 'string' 
        ? JSON.parse(settings.fb_pages) 
        : settings.fb_pages;
    } catch (e) {
      console.warn("Could not parse fb_pages", e);
      return [];
    }
  };
  const connectedPages = getFbPages();
  const connectedAt = settings.fb_connected_at ? new Date(settings.fb_connected_at).toLocaleString() : '';

  // Read URL params set by OAuth callback
  useEffect(() => {
    const fbResult = searchParams.get('fb');
    const fbError = searchParams.get('fb_error');
    const pageCount = searchParams.get('pages');
    if (fbResult === 'connected') {
      setFbStatus(`✅ Facebook connected! ${pageCount ? `${pageCount} page(s) linked.` : ''} Token saved to your workspace.`);
      setTimeout(() => setFbStatus(null), 8000);
    } else if (fbError) {
      setFbStatus(`⚠️ Facebook error: ${fbError}`);
      setTimeout(() => setFbStatus(null), 8000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Sync state values when settings updates from context
  useEffect(() => {
    setCompName(settings.company_name);
    setAdmYear(settings.admission_year_prefix);
    setAssignRule(settings.lead_assignment_rule);
    setBudgetThreshold(settings.routing_budget_threshold.toString());
    setVerifyToken(settings.meta_verify_token);
    setAccessToken(settings.meta_access_token);
    setPhoneId(settings.whatsapp_phone_id);
    setAccountId(settings.whatsapp_account_id);
    setWhApiToken(settings.whatsapp_api_token);
    setAutoResponse(settings.whatsapp_auto_response_template);
    setFormStrategy(settings.form_integration_strategy || 'fixed');
    setFixedCourse(settings.form_integration_fixed_course || 'MBBS');
    setDynamicField(settings.form_integration_dynamic_field || 'course');
    setStages(settings.pipeline_stages ? [...settings.pipeline_stages].sort((a,b) => a.order - b.order) : []);
  }, [settings]);

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


  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({
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

    setSaveStatus('Settings successfully saved & synced to cloud!');
    setTimeout(() => setSaveStatus(null), 3000);
  };


  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName.trim() || !tempBody.trim()) {
      setTemplateError('Template name and body are required.');
      return;
    }
    setTemplateError(null);
    setTemplateStatus(editingTemplateId ? 'Saving template updates...' : 'Creating new template...');

    try {
      if (editingTemplateId) {
        await updateWhatsAppTemplate(editingTemplateId, {
          name: tempName.trim(),
          body: tempBody.trim(),
          attachment_url: tempAttachUrl.trim() || undefined,
          attachment_name: tempAttachName.trim() || undefined
        });
        setTemplateStatus('Template updated successfully!');
      } else {
        await addWhatsAppTemplate({
          name: tempName.trim(),
          body: tempBody.trim(),
          attachment_url: tempAttachUrl.trim() || undefined,
          attachment_name: tempAttachName.trim() || undefined
        });
        setTemplateStatus('Template created successfully!');
      }
      // Reset form
      setEditingTemplateId(null);
      setTempName('');
      setTempBody('');
      setTempAttachUrl('');
      setTempAttachName('');
      setTimeout(() => setTemplateStatus(null), 3000);
    } catch (err: any) {
      setTemplateError(err.message || 'Failed to save template.');
    }
  };

  const handleEditTemplate = (tpl: any) => {
    setEditingTemplateId(tpl.id);
    setTempName(tpl.name);
    setTempBody(tpl.body);
    setTempAttachUrl(tpl.attachment_url || '');
    setTempAttachName(tpl.attachment_name || '');
    setTemplateError(null);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      await deleteWhatsAppTemplate(id);
      setTemplateStatus('Template deleted successfully!');
      setTimeout(() => setTemplateStatus(null), 3000);
    } catch (err: any) {
      setTemplateError(err.message || 'Failed to delete template.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setTemplateError(null);
    setTemplateStatus('Uploading file to Supabase Storage...');

    try {
      const result = await uploadAttachment(file);
      setTempAttachUrl(result.url);
      setTempAttachName(result.name);
      setTemplateStatus('File uploaded successfully! URL and name configured.');
      setTimeout(() => setTemplateStatus(null), 3000);
    } catch (err: any) {
      setTemplateError(err.message || 'Failed to upload attachment.');
      setTemplateStatus(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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

  const handleCreatePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPipelineName.trim()) return;
    try {
      const initialStages: PipelineStage[] = [
        { id: '1st followup', name: '1st followup', color: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400', order: 0 },
        { id: 'Discussion stage', name: 'Discussion stage', color: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400', order: 1 },
        { id: 'Connected to manager', name: 'Connected to manager', color: 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400', order: 2 },
        { id: 'Closed Won', name: 'Closed Won', color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400', order: 3 },
        { id: 'Closed Lost', name: 'Closed Lost', color: 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-450', order: 4 }
      ];
      const result = await addPipeline(newPipelineName.trim(), initialStages);
      setNewPipelineName('');
      if (result && result.id) {
        setSelectedPipelineId(result.id);
      }
      setSaveStatus('New pipeline created successfully!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to create pipeline');
    }
  };

  const handleRenamePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPipelineId || !editPipelineName.trim()) return;
    try {
      await updatePipeline(selectedPipelineId, editPipelineName.trim(), editPipelineStages);
      setSaveStatus('Pipeline name updated!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to rename pipeline');
    }
  };

  const handleDeletePipeline = async (id: string) => {
    const pipe = pipelines.find(p => p.id === id);
    if (!pipe) return;
    if (pipe.is_default) {
      alert("Cannot delete default pipeline.");
      return;
    }
    const leadCount = leads.filter(l => l.pipeline_id === id).length;
    if (leadCount > 0) {
      alert(`Cannot delete pipeline "${pipe.name}": there are ${leadCount} active leads currently assigned to it.`);
      return;
    }
    if (confirm(`Are you sure you want to delete pipeline "${pipe.name}"?`)) {
      try {
        await deletePipeline(id);
        const defaultPipe = pipelines.find(p => p.is_default);
        if (defaultPipe) {
          setSelectedPipelineId(defaultPipe.id);
        }
        setSaveStatus('Pipeline deleted successfully.');
        setTimeout(() => setSaveStatus(null), 3000);
      } catch (err: any) {
        alert(err.message || 'Failed to delete pipeline');
      }
    }
  };

  const handleAddPipelineStage = async () => {
    if (!newStageName.trim() || !selectedPipelineId) return;
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
      color: colors[editPipelineStages.length % colors.length],
      order: editPipelineStages.length
    };
    const updatedStages = [...editPipelineStages, newStage];
    setEditPipelineStages(updatedStages);
    setNewStageName('');
    try {
      await updatePipeline(selectedPipelineId, editPipelineName, updatedStages);
    } catch (err: any) {
      alert(err.message || 'Failed to add stage');
    }
  };

  const handleDeletePipelineStage = async (stageId: string) => {
    if (!selectedPipelineId) return;
    const count = leads.filter(l => l.pipeline_id === selectedPipelineId && l.status === stageId).length;
    if (count > 0) {
      alert(`Cannot delete stage "${stageId}": there are ${count} active leads currently in this stage.`);
      return;
    }
    const updatedStages = editPipelineStages
      .filter(s => s.id !== stageId)
      .map((s, index) => ({ ...s, order: index }));
    setEditPipelineStages(updatedStages);
    try {
      await updatePipeline(selectedPipelineId, editPipelineName, updatedStages);
    } catch (err: any) {
      alert(err.message || 'Failed to delete stage');
    }
  };

  const handleMovePipelineStage = async (index: number, direction: 'up' | 'down') => {
    if (!selectedPipelineId) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= editPipelineStages.length) return;
    
    const updated = [...editPipelineStages];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    
    const finalStages = updated.map((s, idx) => ({ ...s, order: idx }));
    setEditPipelineStages(finalStages);
    try {
      await updatePipeline(selectedPipelineId, editPipelineName, finalStages);
    } catch (err: any) {
      alert(err.message || 'Failed to reorder stage');
    }
  };

  const handleRenamePipelineStage = async (index: number, newName: string) => {
    if (!selectedPipelineId) return;
    const updated = [...editPipelineStages];
    updated[index] = { ...updated[index], name: newName };
    setEditPipelineStages(updated);
    try {
      await updatePipeline(selectedPipelineId, editPipelineName, updated);
    } catch (err: any) {
      console.error("Failed to auto-save renamed stage:", err);
    }
  };

  const getPipelineUserAccess = (profileId: string) => {
    return pipelineAccess.some(pa => pa.pipeline_id === selectedPipelineId && pa.profile_id === profileId);
  };

  const handleToggleUserAccess = async (profileId: string) => {
    if (!selectedPipelineId) return;
    const hasAccess = getPipelineUserAccess(profileId);
    const currentAccessList = pipelineAccess
      .filter(pa => pa.pipeline_id === selectedPipelineId)
      .map(pa => pa.profile_id);

    let newAccessList: string[];
    if (hasAccess) {
      newAccessList = currentAccessList.filter(id => id !== profileId);
    } else {
      newAccessList = [...currentAccessList, profileId];
    }
    try {
      await updatePipelineAccess(selectedPipelineId, newAccessList);
    } catch (err: any) {
      alert(err.message || 'Failed to update access control');
    }
  };

  const counsellorsAndManagers = profiles.filter(p => p.role === 'counsellor' || p.role === 'manager');

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



            {/* Meta Lead Webhooks Integration */}
            <div className="pt-4 border-t border-slate-100 dark:border-zinc-900 space-y-4">
              <div className="flex items-center gap-2">
                <Webhook className="w-4 h-4 text-blue-500" />
                <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300">Meta/Facebook Lead Ads Webhook Settings</h4>
              </div>

              {/* Facebook Ads Connect Card */}
              <div className={`rounded-2xl border p-4 space-y-4 ${
                isFbConnected
                  ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40'
                  : 'bg-slate-50 dark:bg-zinc-900/40 border-slate-200 dark:border-zinc-800'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Facebook logo */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isFbConnected ? 'bg-blue-600' : 'bg-slate-300 dark:bg-zinc-700'
                    }`}>
                      <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-white">Facebook Ads</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {isFbConnected
                          ? (
                            <>
                              <Wifi className="w-3 h-3 text-emerald-500" />
                              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                Connected {connectedAt ? `on ${connectedAt}` : '– token active'}
                              </span>
                            </>
                          )
                          : <><WifiOff className="w-3 h-3 text-slate-400" /><span className="text-[10px] font-semibold text-slate-400">Not connected</span></>}
                      </div>
                    </div>
                  </div>

                  {isFbConnected ? (
                    <button
                      type="button"
                      onClick={() => { 
                        setAccessToken(''); 
                        updateSettings({ 
                          meta_access_token: '',
                          fb_connected_at: undefined,
                          fb_pages: []
                        }); 
                      }}
                      className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 transition-all"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <a
                      href={`/api/fb-oauth?tenant_id=${tenantId}${useLiveOauth ? '&real=true' : ''}`}
                      className="px-3 py-1.5 rounded-xl text-[10px] font-bold text-white transition-all flex items-center gap-1.5 bg-[#1877F2] hover:bg-[#166fe5] cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      {useLiveOauth ? 'Connect Live Meta App' : 'Connect with Facebook'}
                    </a>
                  )}
                </div>

                {!isFbConnected && (
                  <div className="flex items-center justify-between bg-slate-100/60 dark:bg-zinc-900/60 p-3 border border-slate-200 dark:border-zinc-800/40 rounded-xl text-xs gap-3">
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 dark:text-slate-200">OAuth Connection Mode</p>
                      <p className="text-[10px] text-slate-400 leading-normal mt-0.5">Choose simulated sandbox connection or a live Meta App integration.</p>
                    </div>
                    <div className="flex bg-slate-200/60 dark:bg-zinc-800/60 p-0.5 rounded-lg border border-slate-200 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setUseLiveOauth(false)}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                          !useLiveOauth 
                            ? 'bg-[#1877F2] text-white shadow-sm' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Simulated
                      </button>
                      <button
                        type="button"
                        onClick={() => setUseLiveOauth(true)}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                          useLiveOauth 
                            ? 'bg-[#1877F2] text-white shadow-sm' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Live Meta App
                      </button>
                    </div>
                  </div>
                )}

                {!isFbConnected && useLiveOauth && (
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5 space-y-2 text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed animate-fade-in">
                    <p className="font-bold text-[11px] text-slate-800 dark:text-white flex items-center gap-1.5">
                      ⚠️ Live Meta App Configuration Requirements:
                    </p>
                    <p>
                      To prevent the <strong>"Facebook login is currently unavailable for this app"</strong> error, you must ensure the following are configured in your App in the <a href="https://developers.facebook.com/" target="_blank" rel="noreferrer" className="underline font-bold text-[#1877F2] hover:text-[#166fe5]">Meta Developer Console</a>:
                    </p>
                    <ul className="list-decimal pl-4 space-y-1.5 font-medium">
                      <li>Go to <strong>App Settings → Basic</strong> and verify your <strong>Privacy Policy URL</strong> and <strong>User Data Deletion Instructions URL</strong> are saved.</li>
                      <li>Go to <strong>Use Cases → Customize → Facebook Login → Settings</strong> and add the exact <strong>Valid OAuth Redirect URI</strong>: <code className="bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-1 py-0.5 rounded font-mono text-slate-800 dark:text-slate-200">{origin}/api/fb-oauth/callback</code></li>
                      <li>If your Meta App status is <strong>Development Mode</strong>, only developer/tester accounts added in the App Dashboard roles can successfully log in. To open it to all users, switch to <strong>Live Mode</strong> and ensure <code>public_profile</code> has **Advanced Access**.</li>
                    </ul>
                  </div>
                )}

                {isFbConnected && connectedPages.length > 0 && (
                  <div className="pt-3 border-t border-slate-200 dark:border-zinc-800/60 space-y-2">
                    <p className="text-[9px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                      Authorized Facebook Pages ({connectedPages.length})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {connectedPages.map((page: any) => (
                        <div 
                          key={page.id}
                          className="bg-white/80 dark:bg-black/60 border border-slate-200 dark:border-zinc-900 px-3 py-2 rounded-xl flex items-center justify-between text-[11px] text-slate-800 dark:text-slate-200"
                        >
                          <span className="font-bold truncate">{page.name}</span>
                          <span className="text-[8px] text-slate-400 font-mono ml-2">ID: {String(page.id).substring(0, 8)}...</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {fbStatus && (
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-[10px] font-semibold">
                    {fbStatus}
                  </div>
                )}

                {/* Manual Token entry (always shown so admins can paste token) */}
                {isAdmin && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Meta System User Access Token</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={accessToken}
                        onChange={(e) => setAccessToken(e.target.value)}
                        placeholder="Paste your long-lived Page / System User token here…"
                        className="flex-1 bg-white dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-blue-500 font-mono"
                      />
                      {accessToken && (
                        <button
                          type="button"
                          onClick={() => handleCopyText(accessToken, 'fbtoken')}
                          className="px-3 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-500 dark:text-slate-400 rounded-xl text-xs flex items-center gap-1.5"
                        >
                          {copiedId === 'fbtoken' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Generate a <strong>long-lived System User token</strong> from your{' '}
                      <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Business Manager → System Users</a>.
                      This token is securely stored per-company and used to fetch Facebook Ads leads automatically.
                    </p>
                  </div>
                )}
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

          {/* WhatsApp Message Templates & Attachments Manager */}
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-900 pb-4">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-slate-800 dark:text-white">WhatsApp Message Templates & Attachments</h3>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Configure message templates and dynamic attachments (PDF/Images) that consultants can select when messaging leads.
            </p>

            {templateError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-semibold">
                ⚠️ {templateError}
              </div>
            )}

            {templateStatus && (
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-[10px] font-semibold">
                ℹ️ {templateStatus}
              </div>
            )}

            {/* Existing Templates Grid */}
            <div className="space-y-4">
              {whatsappTemplates.map((tpl) => (
                <div 
                  key={tpl.id} 
                  className="bg-slate-50 dark:bg-black/40 border border-slate-150 dark:border-zinc-900/60 p-4 rounded-2xl space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">{tpl.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Created at: {new Date(tpl.created_at).toLocaleDateString()}</p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditTemplate(tpl)}
                          className="px-2.5 py-1 bg-indigo-50 dark:bg-zinc-900 hover:bg-indigo-100 dark:hover:bg-zinc-800 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-bold transition-all"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(tpl.id)}
                          className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 rounded-lg transition-all"
                          title="Delete Template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-350 bg-white dark:bg-zinc-950/80 border border-slate-100 dark:border-zinc-900/50 p-2.5 rounded-xl font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
                    {tpl.body}
                  </p>

                  {tpl.attachment_url && (
                    <div className="flex items-center gap-2 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-950/30 px-3 py-1.5 rounded-xl text-[10px] text-indigo-600 dark:text-indigo-400">
                      <span className="font-bold">📎 Attachment:</span>
                      <span className="truncate flex-1 font-semibold">{tpl.attachment_name || 'Unnamed attachment'}</span>
                      <a href={tpl.attachment_url} target="_blank" rel="noreferrer" className="underline hover:text-indigo-500 font-extrabold flex-shrink-0">View File</a>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Template Form (Admin only) */}
            {isAdmin && (
              <div className="border-t border-slate-100 dark:border-zinc-900 pt-6 space-y-4">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                  {editingTemplateId ? 'Edit WhatsApp Template' : 'Create New WhatsApp Template'}
                </h4>

                <form onSubmit={handleSaveTemplate} className="space-y-4">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Template Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Russia Brochure Template"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Message Body Text</label>
                      <div className="flex gap-1.5">
                        {['lead_name', 'neet_marks', 'budget', 'preferred_destination'].map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setTempBody(prev => prev + ` {{${p}}}`)}
                            className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-500 dark:text-slate-400 rounded text-[9px] font-bold"
                          >
                            +{p}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      required
                      rows={4}
                      placeholder="Enter message text... Use placeholders like {{lead_name}} to personalize."
                      value={tempBody}
                      onChange={(e) => setTempBody(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="pt-2 border-t border-dashed border-slate-100 dark:border-zinc-900">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Brochure / File Attachment (Optional)</label>
                    
                    <div className="flex flex-col gap-3">
                      {tempAttachUrl && (
                        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          <Check className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="font-bold">Attached:</span>
                          <span className="truncate flex-1 font-semibold">{tempAttachName || 'Attached Document'}</span>
                          <a href={tempAttachUrl} target="_blank" rel="noreferrer" className="underline hover:text-emerald-500 font-extrabold flex-shrink-0 mr-1.5">Preview Upload</a>
                          <button
                            type="button"
                            onClick={() => {
                              setTempAttachUrl('');
                              setTempAttachName('');
                            }}
                            className="text-rose-500 hover:text-rose-600 font-extrabold flex-shrink-0 text-[10px] bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 rounded-lg"
                          >
                            Remove
                          </button>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-4 items-stretch">
                        {/* Hidden File Input */}
                        <input 
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          accept="application/pdf,image/*"
                          className="hidden"
                        />
                        
                        {/* Upload Button Trigger */}
                        <button
                          type="button"
                          disabled={isUploading}
                          onClick={() => fileInputRef.current?.click()}
                          className={`flex-1 sm:flex-none px-5 py-3 border border-dashed rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                            isUploading 
                              ? 'bg-slate-50 border-slate-300 text-slate-400 cursor-not-allowed'
                              : 'bg-indigo-50/50 hover:bg-indigo-100 dark:bg-zinc-900 dark:hover:bg-zinc-850 border-indigo-200 dark:border-zinc-800 text-indigo-600 dark:text-indigo-400'
                          }`}
                        >
                          {isUploading ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <PlusCircle className="w-3.5 h-3.5" />
                              {tempAttachUrl ? 'Replace Attachment' : 'Upload Document'}
                            </>
                          )}
                        </button>

                        {/* Display URL and name inputs side-by-side */}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {templateError && templateError.toLowerCase().includes('upload') && (
                            <p className="text-[10px] text-rose-500 font-semibold absolute -mt-4">⚠️ {templateError}</p>
                          )}
                          <input
                            type="url"
                            placeholder="Or paste attachment URL..."
                            value={tempAttachUrl}
                            onChange={(e) => setTempAttachUrl(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                          />
                          <input
                            type="text"
                            placeholder="Attachment display name..."
                            value={tempAttachName}
                            onChange={(e) => setTempAttachName(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-[10px] uppercase transition-all shadow hover:scale-[1.01] active:scale-[0.99]"
                    >
                      {editingTemplateId ? 'Save Template Updates' : 'Create Template'}
                    </button>
                    {editingTemplateId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTemplateId(null);
                          setTempName('');
                          setTempBody('');
                          setTempAttachUrl('');
                          setTempAttachName('');
                        }}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-250 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-500 dark:text-slate-400 rounded-xl text-[10px] font-bold transition-all"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}
          </div>

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

          {/* Multiple Pipelines Manager */}
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-900 pb-4">
              <div className="flex items-center gap-2.5">
                <Shuffle className="w-5 h-5 text-indigo-500 animate-pulse" />
                <h3 className="font-bold text-slate-800 dark:text-white">CRM Pipelines & Access Control</h3>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Create separate pipelines (e.g. Sales, Visa, Travel) and decide which counsellors or managers have access to each.
            </p>

            {!isAdmin && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl p-3.5 flex gap-2 text-xs font-semibold items-center">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>Only administrators can configure pipelines and access controls.</span>
              </div>
            )}

            {isAdmin && (
              <div className="space-y-6 animate-fade-in">
                {/* Pipelines List Tabs */}
                <div className="flex flex-wrap gap-2 border-b border-slate-100 dark:border-zinc-900 pb-3">
                  {pipelines.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPipelineId(p.id)}
                      className={`px-3.5 py-2 rounded-2xl text-xs font-bold border transition-all ${
                        selectedPipelineId === p.id
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/10'
                          : 'bg-slate-50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 text-slate-600 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-zinc-800/80'
                      }`}
                    >
                      {p.name} {p.is_default && '(Default)'}
                    </button>
                  ))}
                </div>

                {currentPipeline && (
                  <div className="space-y-5 p-5 bg-slate-50/50 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-zinc-900/50">
                    
                    {/* Pipeline Info & Rename */}
                    <form onSubmit={handleRenamePipeline} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Pipeline Name</label>
                        <input
                          type="text"
                          value={editPipelineName}
                          onChange={(e) => setEditPipelineName(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 font-semibold"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow"
                      >
                        Rename
                      </button>
                      {!currentPipeline.is_default && (
                        <button
                          type="button"
                          onClick={() => handleDeletePipeline(currentPipeline.id)}
                          className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 dark:text-rose-400 rounded-xl transition-all"
                          title="Delete Pipeline"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </form>

                    {/* Stages Customizer */}
                    <div className="space-y-3">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stages</label>
                      <div className="space-y-2">
                        {editPipelineStages.map((stage, index) => {
                          const leadCount = leads.filter(l => l.pipeline_id === currentPipeline.id && l.status === stage.id).length;
                          return (
                            <div 
                              key={stage.id} 
                              className="flex items-center gap-3 bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-900/50 p-2.5 rounded-xl shadow-sm"
                            >
                              <span className="text-[10px] text-slate-400 font-extrabold w-5 text-center">
                                #{index + 1}
                              </span>
                              <input
                                type="text"
                                value={stage.name}
                                onChange={(e) => handleRenamePipelineStage(index, e.target.value)}
                                className="flex-1 bg-transparent border-0 rounded-none p-0 text-xs text-slate-800 dark:text-white outline-none focus:ring-0 font-semibold"
                              />
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {leadCount} leads
                              </span>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={() => handleMovePipelineStage(index, 'up')}
                                  className="p-1 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-500 disabled:opacity-30 transition-all font-bold text-xs"
                                  title="Move Up"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  disabled={index === editPipelineStages.length - 1}
                                  onClick={() => handleMovePipelineStage(index, 'down')}
                                  className="p-1 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-500 disabled:opacity-30 transition-all font-bold text-xs"
                                  title="Move Down"
                                >
                                  ▼
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePipelineStage(stage.id)}
                                  className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 rounded-lg transition-all"
                                  title="Delete Stage"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Add stage input */}
                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Add stage name..."
                          value={newStageName}
                          onChange={(e) => setNewStageName(e.target.value)}
                          className="flex-1 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddPipelineStage}
                          className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/45 dark:text-indigo-400 text-indigo-655 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                        >
                          <PlusCircle className="w-3.5 h-3.5" /> Add
                        </button>
                      </div>
                    </div>

                    {/* Access Matrix */}
                    <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-zinc-800">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Counsellor & Manager Access Controls</label>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">Select which team members have access permissions to view and edit leads in this pipeline.</p>
                      
                      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-2xl p-4 space-y-2 max-h-48 overflow-y-auto shadow-inner">
                        {counsellorsAndManagers.length > 0 ? (
                          counsellorsAndManagers.map(profile => {
                            const hasAccess = getPipelineUserAccess(profile.id);
                            return (
                              <label key={profile.id} className="flex items-center justify-between p-1.5 hover:bg-slate-50 dark:hover:bg-zinc-900/50 rounded-xl cursor-pointer">
                                <span className="text-xs text-slate-700 dark:text-slate-350 font-medium">
                                  {profile.full_name} <span className="text-[10px] text-slate-400 font-semibold">({profile.role})</span>
                                </span>
                                <input
                                  type="checkbox"
                                  checked={hasAccess}
                                  onChange={() => handleToggleUserAccess(profile.id)}
                                  className="w-4 h-4 text-indigo-650 border-slate-300 dark:border-zinc-800 rounded focus:ring-indigo-500 cursor-pointer"
                                />
                              </label>
                            );
                          })
                        ) : (
                          <div className="text-center py-4 text-slate-400 text-xs font-medium">No managers or counsellors registered yet.</div>
                        )}
                      </div>
                    </div>

                  </div>
                )}

                {/* Create Pipeline Form */}
                <form onSubmit={handleCreatePipeline} className="pt-4 border-t border-slate-200 dark:border-zinc-900">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Create Custom Pipeline</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Travel Pipeline, Visa Pipeline..."
                      value={newPipelineName}
                      onChange={(e) => setNewPipelineName(e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Create Pipeline
                    </button>
                  </div>
                </form>

              </div>
            )}
          </div>

          {/* Visa Checklist Configurator */}
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-900 pb-4">
              <div className="flex items-center gap-2.5">
                <Plane className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-slate-800 dark:text-white">Visa Checklist Requirements</h3>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Configure default required document slots for students heading to target countries. These documents are automatically verified against the partner portal submissions.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Form */}
              <div className="md:col-span-1 border border-slate-150 dark:border-zinc-900 rounded-2xl p-4 space-y-4">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Add Requirement</h4>
                <form onSubmit={handleAddConfigDoc} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Country Target</label>
                    <select
                      value={configCountry}
                      onChange={(e) => setConfigCountry(e.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs font-bold text-slate-700 dark:text-slate-350 outline-none"
                    >
                      <option value="Georgia">Georgia</option>
                      <option value="Russia">Russia</option>
                      <option value="Armenia">Armenia</option>
                      <option value="Uzbekistan">Uzbekistan</option>
                      <option value="Bangladesh">Bangladesh</option>
                      <option value="Nepal">Nepal</option>
                      <option value="Philippines">Philippines</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Requirement Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Police Clearance Certificate"
                      value={newRequiredDocName}
                      onChange={(e) => setNewRequiredDocName(e.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 disabled:opacity-60"
                    />
                  </div>

                  {isAdmin && (
                    <button
                      type="submit"
                      className="w-full bg-indigo-650 hover:bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Save
                    </button>
                  )}
                </form>
              </div>

              {/* Right List */}
              <div className="md:col-span-2 space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {['Georgia', 'Russia', 'Armenia', 'Uzbekistan', 'Bangladesh', 'Nepal', 'Philippines'].map(c => {
                  const countryDocs = visaRequiredDocs.filter(d => d.country.toLowerCase() === c.toLowerCase());
                  if (countryDocs.length === 0) return null;
                  return (
                    <div key={c} className="border border-slate-150 dark:border-zinc-900 rounded-2xl p-4 space-y-3">
                      <h4 className="text-xs font-extrabold text-indigo-550 dark:text-indigo-400 uppercase tracking-widest border-b border-slate-50 dark:border-zinc-900/50 pb-1.5">
                        {c} ({countryDocs.length} required)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {countryDocs.map(d => (
                          <div key={d.id} className="flex justify-between items-center bg-slate-50 dark:bg-black/40 border border-slate-200/50 dark:border-zinc-900/50 px-3 py-1.5 rounded-xl">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-350">{d.document_name}</span>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteConfigDoc(d.id)}
                                className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 rounded-lg transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: User list & role assignments center */}
        <div className="space-y-6">

          {/* ── Change Password Card ─────────────────────────── */}
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center border-b border-slate-100 dark:border-zinc-900 pb-3 gap-2.5">
              <Key className="w-5 h-5 text-indigo-500" />
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white text-xs">My Account & Password</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{currentUser?.full_name} ({currentUser?.role})</p>
              </div>
            </div>

            {pwStatus && (
              <div className={`p-2 rounded-xl text-[10px] font-semibold border ${pwStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'}`}>
                {pwStatus.message}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3.5">
              <div>
                <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-black border border-slate-250 dark:border-zinc-900 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-black border border-slate-250 dark:border-zinc-900 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={isUpdatingPw}
                className="w-full py-2 bg-indigo-650 hover:bg-indigo-600 disabled:bg-slate-300 dark:disabled:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-all shadow hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-1.5"
              >
                {isUpdatingPw ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Update Password</span>
                )}
              </button>
            </form>
          </div>

          {/* ── Facebook Ads Connect Card ─────────────────────────── */}
          <div className={`rounded-3xl p-6 shadow-sm border space-y-4 ${isFbConnected ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-900'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Facebook logo */}
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm text-white font-black text-base ${isFbConnected ? 'bg-emerald-500' : 'bg-[#1877F2]'}`}>
                  {isFbConnected ? <Check className="w-5 h-5" /> : <span>f</span>}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800 dark:text-white">Facebook Ads</h3>
                  <p className={`text-[10px] font-semibold uppercase tracking-widest mt-0.5 ${isFbConnected ? 'text-emerald-500' : 'text-slate-400'}`}>
                    {isFbConnected ? '● Connected' : '○ Not Connected'}
                  </p>
                </div>
              </div>
              {isFbConnected && (
                <span className="text-[9px] font-bold uppercase tracking-widest bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                  Active
                </span>
              )}
            </div>

            {fbStatus && (
              <div className={`rounded-xl p-3 text-xs font-semibold border ${fbStatus.startsWith('✅') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'}`}>
                {fbStatus}
              </div>
            )}

            {isFbConnected ? (
              <div className="space-y-3">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Your Facebook Ads account is connected. Leads from your Meta campaigns are being automatically ingested into the CRM pipeline.
                </p>
                <div className="flex items-center gap-2">
                  <Wifi className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Receiving leads from Meta Ads Manager</span>
                </div>
                {isAdmin && fbAppId && (
                  <a
                    href={`/api/fb-oauth?tenant_id=${tenantId}`}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-zinc-800"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Reconnect / Refresh Token
                  </a>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Connect your Facebook Business account to automatically import leads from your Meta Ads campaigns directly into this CRM workspace.
                </p>
                <ul className="space-y-1.5">
                  {['Auto-import leads from Meta Ads', 'Real-time lead sync via Webhook', 'WhatsApp follow-up on new leads'].map(feat => (
                    <li key={feat} className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                      <Check className="w-3 h-3 text-indigo-500 flex-shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
                {isAdmin && fbAppId ? (
                  <a
                    href={`/api/fb-oauth?tenant_id=${tenantId}`}
                    className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <span className="font-black text-sm leading-none">f</span>
                    Connect with Facebook
                  </a>
                ) : !fbAppId ? (
                  <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <WifiOff className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                      NEXT_PUBLIC_FB_APP_ID not configured. Contact your system administrator.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl">
                    <ShieldAlert className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <p className="text-[10px] text-slate-500 font-semibold">Only admins can connect Facebook Ads.</p>
                  </div>
                )}
              </div>
            )}
          </div>

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

                  <div className="flex items-center gap-2">
                    {isAdmin && profile.id !== currentUser?.id && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm(`Are you sure you want to permanently delete the profile for ${profile.full_name}?`)) {
                            try {
                              await deleteUserProfile(profile.id);
                            } catch (err: any) {
                              alert(err.message || "Failed to delete user profile.");
                            }
                          }
                        }}
                        className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 hover:text-rose-600 rounded-lg transition-all"
                        title="Delete User Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
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

          {/* Personal Account Deletion Link */}
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-500" />
              <h3 className="font-bold text-slate-800 dark:text-white">Account Deletion</h3>
            </div>
            <p className="text-xs text-slate-550 dark:text-zinc-400">
              Need to permanently close your account and delete your associated CRM records? You can request complete data erasure.
            </p>
            <div className="pt-2">
              <Link 
                href="/data-deletion"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-650 hover:underline"
              >
                Data Deletion Instructions & Request Form →
              </Link>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
