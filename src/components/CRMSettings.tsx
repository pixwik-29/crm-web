"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/context/DataContext';

import { 
  Users, Webhook, MessageSquare, ShieldAlert, Check, Copy, 
  Settings, Key, Shuffle, RefreshCw, PlusCircle, Trash2, Wifi, WifiOff,
  Plus, FileText, Plane
} from 'lucide-react';

import { PipelineStage, PartnerRoutingRule } from '@/types/crm';
import Link from 'next/link';

const KNOWN_COUNTRIES = ['Georgia', 'Russia', 'Armenia', 'Uzbekistan', 'Bangladesh', 'Nepal', 'Philippines', 'Kazakhstan', 'Kyrgyzstan', 'China'];
const KNOWN_COURSES = ['MBBS', 'MBBS Abroad', 'BDS', 'MD', 'Nursing', 'Pharmacy', 'Computer Science Engineering', 'MBA', 'Other'];

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
    resetUserProfilePassword,
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

  // ── Partner Lead Auto-Routing States ───────────────────────────────────────
  const defaultRule = (): PartnerRoutingRule => ({
    enabled: false,
    pipeline_id: '',
    stage_id: '',
    filter_countries: [],
    filter_courses: []
  });

  const [routingInterested, setRoutingInterested] = useState<PartnerRoutingRule>(
    settings.partner_routing_interested || defaultRule()
  );
  const [routingConfirmed, setRoutingConfirmed] = useState<PartnerRoutingRule>(
    settings.partner_routing_confirmed || defaultRule()
  );
  const [routingSaveStatus, setRoutingSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    setRoutingInterested(settings.partner_routing_interested || defaultRule());
    setRoutingConfirmed(settings.partner_routing_confirmed || defaultRule());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.partner_routing_interested, settings.partner_routing_confirmed]);

  const handleSaveRoutingRules = async () => {
    await updateSettings({
      partner_routing_interested: routingInterested,
      partner_routing_confirmed: routingConfirmed
    });
    setRoutingSaveStatus('Routing rules saved!');
    setTimeout(() => setRoutingSaveStatus(null), 3000);
  };

  const getStagesForPipeline = (pipelineId: string) =>
    pipelines.find(p => p.id === pipelineId)?.stages || [];

  const toggleFilterItem = (
    rule: PartnerRoutingRule,
    setRule: React.Dispatch<React.SetStateAction<PartnerRoutingRule>>,
    field: 'filter_countries' | 'filter_courses',
    value: string
  ) => {
    setRule(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value]
    }));
  };
  // ── End Partner Routing States ─────────────────────────────────────────────

  // ── Settings Tab Navigation ─────────────────────────────────────────────────
  const [settingsTab, setSettingsTab] = useState<'general' | 'integrations' | 'pipelines' | 'visa' | 'team' | 'account'>('general');
  // ── End Settings Tab ─────────────────────────────────────────────────────────

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

  // Reset Password for other users
  const [isResetPassModalOpen, setIsResetPassModalOpen] = useState(false);
  const [profileToReset, setProfileToReset] = useState<any>(null);
  const [newPasswordForReset, setNewPasswordForReset] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState('');
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Delete user profile states
  const [isDeleteUserModalOpen, setIsDeleteUserModalOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<any>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState('');

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

  const handleRoleChange = async (profileId: string, role: 'admin' | 'manager' | 'counsellor') => {
    try {
      await updateProfileRole(profileId, role);
    } catch (err: any) {
      console.error('Failed to change user role:', err);
    }
  };

  // Reset Password for other user
  const handleResetPasswordClick = (profile: any) => {
    setProfileToReset(profile);
    setNewPasswordForReset('');
    setResetPasswordError('');
    setResetPasswordSuccess('');
    setIsResetPassModalOpen(true);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPasswordForReset || newPasswordForReset.length < 6) {
      setResetPasswordError('Password must be at least 6 characters long.');
      return;
    }
    setResetPasswordError('');
    setResetPasswordSuccess('');
    setIsResettingPassword(true);

    try {
      await resetUserProfilePassword(profileToReset.id, newPasswordForReset);
      setResetPasswordSuccess('Password reset successfully!');
      setTimeout(() => {
        setIsResetPassModalOpen(false);
        setProfileToReset(null);
      }, 2000);
    } catch (err: any) {
      setResetPasswordError(err.message || 'Failed to reset password.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Delete User profile
  const handleDeleteUserClick = (profile: any) => {
    setProfileToDelete(profile);
    setDeleteUserError('');
    setIsDeleteUserModalOpen(true);
  };

  const handleDeleteUserConfirm = async () => {
    if (!profileToDelete) return;
    setDeleteUserError('');
    setIsDeletingUser(true);

    try {
      await deleteUserProfile(profileToDelete.id);
      setIsDeleteUserModalOpen(false);
      setProfileToDelete(null);
    } catch (err: any) {
      setDeleteUserError(err.message || 'Failed to delete user.');
    } finally {
      setIsDeletingUser(false);
    }
  };


  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({
      company_name: compName,
      admission_year_prefix: admYear,
      lead_assignment_rule: assignRule,
      routing_budget_threshold: parseFloat(budgetThreshold) || 40,
      form_integration_strategy: formStrategy,
      form_integration_fixed_course: fixedCourse,
      form_integration_dynamic_field: dynamicField,
      pipeline_stages: stages
    });
    setSaveStatus('General settings saved!');
    setTimeout(() => setSaveStatus(null), 3000);
  };


  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveMetaSettings = async () => {
    await updateSettings({
      meta_verify_token: verifyToken,
      meta_access_token: accessToken,
    });
    setSaveStatus('Meta integration settings saved!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleSaveWhatsAppSettings = async () => {
    await updateSettings({
      whatsapp_phone_id: phoneId,
      whatsapp_account_id: accountId,
      whatsapp_api_token: whApiToken,
      whatsapp_auto_response_template: autoResponse,
    });
    setSaveStatus('WhatsApp settings saved!');
    setTimeout(() => setSaveStatus(null), 3000);
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
    <div className="space-y-6 animate-fade-in">

      {/* ── Tab Navigation ─────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-2xl p-1.5 flex gap-1 shadow-sm overflow-x-auto">
        {([
          { id: 'general'      as const, Icon: Settings,      label: 'General'      },
          { id: 'integrations' as const, Icon: Webhook,        label: 'Integrations' },
          { id: 'pipelines'    as const, Icon: Shuffle,        label: 'Pipelines'    },
          { id: 'visa'         as const, Icon: Plane,          label: 'Visa & Docs'  },
          { id: 'team'         as const, Icon: Users,          label: 'Team'         },
          { id: 'account'      as const, Icon: Key,            label: 'Account'      },
        ]).map(({ id, Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSettingsTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex-shrink-0 ${
              settingsTab === id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-900'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Shared save notification ───────────────────────────────────── */}
      {saveStatus && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 rounded-2xl p-4 flex items-center gap-2.5 text-xs font-bold shadow-md shadow-emerald-500/5">
          <Check className="w-4 h-4" />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* ══════════════════ GENERAL ══════════════════════════════════════ */}
      {settingsTab === 'general' && (
        <form onSubmit={handleSaveSettings} className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-900 pb-4">
            <div className="flex items-center gap-2.5">
              <Settings className="w-5 h-5 text-indigo-500" />
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white">General & Lead Routing Engine</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Core company configuration and lead assignment rules</p>
              </div>
            </div>
            {isAdmin && (
              <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow hover:scale-[1.02] active:scale-[0.98]">
                Save Settings
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Company / Agency Name</label>
              <input type="text" value={compName} onChange={(e) => setCompName(e.target.value)} disabled={!isAdmin} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 disabled:opacity-60" />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Admission Prefix Year</label>
              <input type="text" value={admYear} onChange={(e) => setAdmYear(e.target.value)} disabled={!isAdmin} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 disabled:opacity-60" />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Lead Assignment Routing Rule</label>
              <select value={assignRule} onChange={(e) => setAssignRule(e.target.value as any)} disabled={!isAdmin} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-350 outline-none disabled:opacity-60">
                <option value="round-robin">Round-Robin Assignment (Auto-Assign to Counsellors)</option>
                <option value="manual">Manual Assignments (Admin assigns lead queues)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">VIP Budget Auto-Routing Threshold (Lakhs)</label>
              <input type="number" value={budgetThreshold} onChange={(e) => setBudgetThreshold(e.target.value)} disabled={!isAdmin} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 disabled:opacity-60" />
            </div>
          </div>

          {/* Form Ingestion & Course Mapping */}
          <div className="pt-4 border-t border-slate-100 dark:border-zinc-900 space-y-4">
            <div className="flex items-center gap-2">
              <Webhook className="w-4 h-4 text-indigo-500 animate-pulse" />
              <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300">Form Ingestion & Course Mapping Configuration</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Ingestion Mapping Strategy</label>
                <select value={formStrategy} onChange={(e) => setFormStrategy(e.target.value as any)} disabled={!isAdmin} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-350 outline-none disabled:opacity-60">
                  <option value="fixed">Fixed Course Ingestion (Auto-assigns all form leads to a specific course)</option>
                  <option value="dynamic">Dynamic Form Mapping (Maps field dynamically from payload)</option>
                </select>
              </div>
              {formStrategy === 'fixed' ? (
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Target Fixed Course</label>
                  <select value={fixedCourse} onChange={(e) => setFixedCourse(e.target.value)} disabled={!isAdmin} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-350 outline-none disabled:opacity-60">
                    {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Payload Field Key to Map (e.g. course)</label>
                  <input type="text" value={dynamicField} onChange={(e) => setDynamicField(e.target.value)} disabled={!isAdmin} placeholder="e.g. course, preferred_course" className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 disabled:opacity-60" />
                </div>
              )}
            </div>
          </div>
        </form>
      )}

      {/* ══════════════════ INTEGRATIONS ═════════════════════════════════ */}
      {settingsTab === 'integrations' && (
        <div className="space-y-6">

          {/* Meta / Facebook Lead Ads ─────────────────────────────────── */}
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-900 pb-4">
              <div className="flex items-center gap-2.5">
                <Webhook className="w-5 h-5 text-blue-500" />
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white">Meta / Facebook Lead Ads</h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Connect Facebook Ads, manage webhook & access token</p>
                </div>
              </div>
              {isAdmin && (
                <button type="button" onClick={handleSaveMetaSettings} className="px-4 py-2 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded-xl text-xs font-bold transition-all shadow hover:scale-[1.02] active:scale-[0.98]">
                  Save Meta Settings
                </button>
              )}
            </div>

            {/* FB Connect card */}
            <div className={`rounded-2xl border p-4 space-y-4 ${isFbConnected ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40' : 'bg-slate-50 dark:bg-zinc-900/40 border-slate-200 dark:border-zinc-800'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isFbConnected ? 'bg-blue-600' : 'bg-slate-300 dark:bg-zinc-700'}`}>
                    <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-white">Facebook Ads</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {isFbConnected ? (
                        <><Wifi className="w-3 h-3 text-emerald-500" /><span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Connected {connectedAt ? `on ${connectedAt}` : '– token active'}</span></>
                      ) : <><WifiOff className="w-3 h-3 text-slate-400" /><span className="text-[10px] font-semibold text-slate-400">Not connected</span></>}
                    </div>
                  </div>
                </div>
                {isFbConnected ? (
                  <button type="button" onClick={() => { setAccessToken(''); updateSettings({ meta_access_token: '', fb_connected_at: undefined, fb_pages: [] }); }} className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 transition-all">
                    Disconnect
                  </button>
                ) : (
                  <a href={`/api/fb-oauth?tenant_id=${tenantId}${useLiveOauth ? '&real=true' : ''}`} className="px-3 py-1.5 rounded-xl text-[10px] font-bold text-white transition-all flex items-center gap-1.5 bg-[#1877F2] hover:bg-[#166fe5] cursor-pointer hover:scale-[1.02] active:scale-[0.98]">
                    <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
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
                    <button type="button" onClick={() => setUseLiveOauth(false)} className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${!useLiveOauth ? 'bg-[#1877F2] text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-200'}`}>Simulated</button>
                    <button type="button" onClick={() => setUseLiveOauth(true)} className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${useLiveOauth ? 'bg-[#1877F2] text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-200'}`}>Live Meta App</button>
                  </div>
                </div>
              )}

              {!isFbConnected && useLiveOauth && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5 space-y-2 text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed animate-fade-in">
                  <p className="font-bold text-[11px] text-slate-800 dark:text-white flex items-center gap-1.5">⚠️ Live Meta App Configuration Requirements:</p>
                  <p>To prevent the <strong>&quot;Facebook login is currently unavailable for this app&quot;</strong> error, you must ensure the following are configured in your App in the <a href="https://developers.facebook.com/" target="_blank" rel="noreferrer" className="underline font-bold text-[#1877F2] hover:text-[#166fe5]">Meta Developer Console</a>:</p>
                  <ul className="list-decimal pl-4 space-y-1.5 font-medium">
                    <li>Go to <strong>App Settings → Basic</strong> and verify your <strong>Privacy Policy URL</strong> and <strong>User Data Deletion Instructions URL</strong> are saved.</li>
                    <li>Go to <strong>Use Cases → Customize → Facebook Login → Settings</strong> and add the exact <strong>Valid OAuth Redirect URI</strong>: <code className="bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-1 py-0.5 rounded font-mono text-slate-800 dark:text-slate-200">{origin}/api/fb-oauth/callback</code></li>
                    <li>If your Meta App status is <strong>Development Mode</strong>, only developer/tester accounts can log in. Switch to <strong>Live Mode</strong> and ensure <code>public_profile</code> has Advanced Access.</li>
                  </ul>
                </div>
              )}

              {isFbConnected && connectedPages.length > 0 && (
                <div className="pt-3 border-t border-slate-200 dark:border-zinc-800/60 space-y-2">
                  <p className="text-[9px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Authorized Facebook Pages ({connectedPages.length})</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {connectedPages.map((page: any) => (
                      <div key={page.id} className="bg-white/80 dark:bg-black/60 border border-slate-200 dark:border-zinc-900 px-3 py-2 rounded-xl flex items-center justify-between text-[11px] text-slate-800 dark:text-slate-200">
                        <span className="font-bold truncate">{page.name}</span>
                        <span className="text-[8px] text-slate-400 font-mono ml-2">ID: {String(page.id).substring(0, 8)}...</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {fbStatus && <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-[10px] font-semibold">{fbStatus}</div>}

              {isAdmin && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Meta System User Access Token</label>
                  <div className="flex gap-2">
                    <input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="Paste your long-lived Page / System User token here…" className="flex-1 bg-white dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-blue-500 font-mono" />
                    {accessToken && (
                      <button type="button" onClick={() => handleCopyText(accessToken, 'fbtoken')} className="px-3 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-500 dark:text-slate-400 rounded-xl text-xs flex items-center gap-1.5">
                        {copiedId === 'fbtoken' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">Generate a <strong>long-lived System User token</strong> from your{' '}<a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Business Manager → System Users</a>.</p>
                </div>
              )}
            </div>

            {/* Webhook URL + Verify Token */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Lead Ingest Payload URL</label>
                <div className="flex gap-2">
                  <input type="text" readOnly value={`${origin}/api/webhook`} className="flex-1 bg-slate-150/40 dark:bg-black/40 border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-400 outline-none cursor-not-allowed" />
                  <button type="button" onClick={() => handleCopyText(`${origin}/api/webhook`, 'url')} className="px-4 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                    {copiedId === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} Copy
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Verify Token (Meta Dashboard verify)</label>
                <input type="text" value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} disabled={!isAdmin} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 disabled:opacity-60" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">System App Verify ID</label>
                <input type="text" readOnly value="edu_verify_sub_channel" className="w-full bg-slate-150/40 dark:bg-black/40 border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-400 outline-none cursor-not-allowed" />
              </div>
            </div>
          </div>

          {/* WhatsApp Business API ────────────────────────────────────── */}
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-900 pb-4">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-5 h-5 text-emerald-500" />
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white">WhatsApp Business API</h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Credentials for sending messages to leads</p>
                </div>
              </div>
              {isAdmin && (
                <button type="button" onClick={handleSaveWhatsAppSettings} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow hover:scale-[1.02] active:scale-[0.98]">
                  Save WhatsApp
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">WhatsApp Phone ID</label>
                <input type="text" value={phoneId} onChange={(e) => setPhoneId(e.target.value)} disabled={!isAdmin} placeholder="e.g. 123456789012345" className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500 disabled:opacity-60" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">WhatsApp Business Account ID</label>
                <input type="text" value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={!isAdmin} placeholder="e.g. 987654321098765" className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500 disabled:opacity-60" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">WhatsApp API Access Token</label>
                <input type="password" value={whApiToken} onChange={(e) => setWhApiToken(e.target.value)} disabled={!isAdmin} placeholder="Paste your WhatsApp Cloud API token..." className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500 disabled:opacity-60 font-mono" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Auto-Response Template</label>
                <textarea value={autoResponse} onChange={(e) => setAutoResponse(e.target.value)} disabled={!isAdmin} rows={3} placeholder="Message sent automatically when a new WhatsApp lead is received..." className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500 disabled:opacity-60 resize-none" />
              </div>
            </div>
          </div>

          {/* WhatsApp Message Templates & Attachments ─────────────────── */}
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-900 pb-4">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-slate-800 dark:text-white">WhatsApp Message Templates & Attachments</h3>
              </div>
            </div>
            <p className="text-xs text-slate-500">Configure message templates and dynamic attachments (PDF/Images) that consultants can select when messaging leads.</p>
            {templateError && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-semibold">⚠️ {templateError}</div>}
            {templateStatus && <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-[10px] font-semibold">ℹ️ {templateStatus}</div>}
            <div className="space-y-4">
              {whatsappTemplates.map((tpl) => (
                <div key={tpl.id} className="bg-slate-50 dark:bg-black/40 border border-slate-150 dark:border-zinc-900/60 p-4 rounded-2xl space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">{tpl.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Created at: {new Date(tpl.created_at).toLocaleDateString()}</p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => handleEditTemplate(tpl)} className="px-2.5 py-1 bg-indigo-50 dark:bg-zinc-900 hover:bg-indigo-100 dark:hover:bg-zinc-800 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-bold transition-all">Edit</button>
                        <button type="button" onClick={() => handleDeleteTemplate(tpl.id)} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 rounded-lg transition-all" title="Delete Template"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-350 bg-white dark:bg-zinc-950/80 border border-slate-100 dark:border-zinc-900/50 p-2.5 rounded-xl font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">{tpl.body}</p>
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
            {isAdmin && (
              <div className="border-t border-slate-100 dark:border-zinc-900 pt-6 space-y-4">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">{editingTemplateId ? 'Edit WhatsApp Template' : 'Create New WhatsApp Template'}</h4>
                <form onSubmit={handleSaveTemplate} className="space-y-4">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Template Name</label>
                    <input type="text" required placeholder="e.g. Russia Brochure Template" value={tempName} onChange={(e) => setTempName(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Message Body Text</label>
                      <div className="flex gap-1.5">
                        {['lead_name', 'neet_marks', 'budget', 'preferred_destination'].map(p => (
                          <button key={p} type="button" onClick={() => setTempBody(prev => prev + ` {{${p}}}`)} className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-500 dark:text-slate-400 rounded text-[9px] font-bold">+{p}</button>
                        ))}
                      </div>
                    </div>
                    <textarea required rows={4} placeholder="Enter message text... Use placeholders like {{lead_name}} to personalize." value={tempBody} onChange={(e) => setTempBody(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500" />
                  </div>
                  <div className="pt-2 border-t border-dashed border-slate-100 dark:border-zinc-900">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Brochure / File Attachment (Optional)</label>
                    <div className="flex flex-col gap-3">
                      {tempAttachUrl && (
                        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          <Check className="w-3.5 h-3.5 flex-shrink-0" /><span className="font-bold">Attached:</span>
                          <span className="truncate flex-1 font-semibold">{tempAttachName || 'Attached Document'}</span>
                          <a href={tempAttachUrl} target="_blank" rel="noreferrer" className="underline hover:text-emerald-500 font-extrabold flex-shrink-0 mr-1.5">Preview Upload</a>
                          <button type="button" onClick={() => { setTempAttachUrl(''); setTempAttachName(''); }} className="text-rose-500 hover:text-rose-600 font-extrabold flex-shrink-0 text-[10px] bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 rounded-lg">Remove</button>
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row gap-4 items-stretch">
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="application/pdf,image/*" className="hidden" />
                        <button type="button" disabled={isUploading} onClick={() => fileInputRef.current?.click()} className={`flex-1 sm:flex-none px-5 py-3 border border-dashed rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${isUploading ? 'bg-slate-50 border-slate-300 text-slate-400 cursor-not-allowed' : 'bg-indigo-50/50 hover:bg-indigo-100 dark:bg-zinc-900 border-indigo-200 dark:border-zinc-800 text-indigo-600 dark:text-indigo-400'}`}>
                          {isUploading ? (<><RefreshCw className="w-3.5 h-3.5 animate-spin" />Uploading...</>) : (<><PlusCircle className="w-3.5 h-3.5" />{tempAttachUrl ? 'Replace Attachment' : 'Upload Document'}</>)}
                        </button>
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input type="url" placeholder="Or paste attachment URL..." value={tempAttachUrl} onChange={(e) => setTempAttachUrl(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500" />
                          <input type="text" placeholder="Attachment display name..." value={tempAttachName} onChange={(e) => setTempAttachName(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-[10px] uppercase transition-all shadow hover:scale-[1.01] active:scale-[0.99]">{editingTemplateId ? 'Save Template Updates' : 'Create Template'}</button>
                    {editingTemplateId && (
                      <button type="button" onClick={() => { setEditingTemplateId(null); setTempName(''); setTempBody(''); setTempAttachUrl(''); setTempAttachName(''); }} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-250 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-500 dark:text-slate-400 rounded-xl text-[10px] font-bold transition-all">Cancel</button>
                    )}
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Web Custom Form Snippet ──────────────────────────────────── */}
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-indigo-500" />
              <h3 className="font-bold text-slate-800 dark:text-white">Custom Landing Page Form Integration</h3>
            </div>
            <p className="text-xs text-slate-500">Copy this JavaScript snippet and embed it into your custom college landing pages or Google Sheet triggers to capture leads directly in the CRM.</p>
            <div className="relative">
              <pre className="bg-slate-900 dark:bg-black border border-slate-250 dark:border-zinc-900 rounded-2xl p-4 text-[10px] text-indigo-300 overflow-x-auto font-mono max-h-64">{sampleFormScript}</pre>
              <button type="button" onClick={() => handleCopyText(sampleFormScript, 'script')} className="absolute top-3 right-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold flex items-center gap-1.5">
                {copiedId === 'script' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} Copy Code
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ══════════════════ PIPELINES ════════════════════════════════════ */}
      {settingsTab === 'pipelines' && (
        <div className="space-y-6">

          {/* Pipeline Manager ─────────────────────────────────────────── */}
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-900 pb-4">
              <div className="flex items-center gap-2.5">
                <Shuffle className="w-5 h-5 text-indigo-500 animate-pulse" />
                <h3 className="font-bold text-slate-800 dark:text-white">CRM Pipelines & Access Control</h3>
              </div>
            </div>
            <p className="text-xs text-slate-500">Create separate pipelines (e.g. Sales, Visa, Travel) and decide which counsellors or managers have access to each.</p>

            {!isAdmin && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl p-3.5 flex gap-2 text-xs font-semibold items-center">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>Only administrators can configure pipelines and access controls.</span>
              </div>
            )}

            {isAdmin && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-wrap gap-2 border-b border-slate-100 dark:border-zinc-900 pb-3">
                  {pipelines.map(p => (
                    <button key={p.id} type="button" onClick={() => setSelectedPipelineId(p.id)} className={`px-3.5 py-2 rounded-2xl text-xs font-bold border transition-all ${selectedPipelineId === p.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/10' : 'bg-slate-50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 text-slate-600 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-zinc-800/80'}`}>
                      {p.name} {p.is_default && '(Default)'}
                    </button>
                  ))}
                </div>

                {currentPipeline && (
                  <div className="space-y-5 p-5 bg-slate-50/50 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-zinc-900/50">
                    <form onSubmit={handleRenamePipeline} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Pipeline Name</label>
                        <input type="text" value={editPipelineName} onChange={(e) => setEditPipelineName(e.target.value)} className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 font-semibold" />
                      </div>
                      <button type="submit" className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow">Rename</button>
                      {!currentPipeline.is_default && (
                        <button type="button" onClick={() => handleDeletePipeline(currentPipeline.id)} className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 dark:text-rose-400 rounded-xl transition-all" title="Delete Pipeline"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </form>

                    <div className="space-y-3">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stages</label>
                      <div className="space-y-2">
                        {editPipelineStages.map((stage, index) => {
                          const leadCount = leads.filter(l => l.pipeline_id === currentPipeline.id && l.status === stage.id).length;
                          return (
                            <div key={stage.id} className="flex items-center gap-3 bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-900/50 p-2.5 rounded-xl shadow-sm">
                              <span className="text-[10px] text-slate-400 font-extrabold w-5 text-center">#{index + 1}</span>
                              <input type="text" value={stage.name} onChange={(e) => handleRenamePipelineStage(index, e.target.value)} className="flex-1 bg-transparent border-0 rounded-none p-0 text-xs text-slate-800 dark:text-white outline-none focus:ring-0 font-semibold" />
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-slate-400 whitespace-nowrap">{leadCount} leads</span>
                              <div className="flex items-center gap-1">
                                <button type="button" disabled={index === 0} onClick={() => handleMovePipelineStage(index, 'up')} className="p-1 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-500 disabled:opacity-30 transition-all font-bold text-xs" title="Move Up">▲</button>
                                <button type="button" disabled={index === editPipelineStages.length - 1} onClick={() => handleMovePipelineStage(index, 'down')} className="p-1 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-500 disabled:opacity-30 transition-all font-bold text-xs" title="Move Down">▼</button>
                                <button type="button" onClick={() => handleDeletePipelineStage(stage.id)} className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 rounded-lg transition-all" title="Delete Stage"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <input type="text" placeholder="Add stage name..." value={newStageName} onChange={(e) => setNewStageName(e.target.value)} className="flex-1 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-none" />
                        <button type="button" onClick={handleAddPipelineStage} className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/45 dark:text-indigo-400 text-indigo-655 rounded-xl text-xs font-bold transition-all flex items-center gap-1"><PlusCircle className="w-3.5 h-3.5" /> Add</button>
                      </div>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-zinc-800">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Counsellor & Manager Access Controls</label>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">Select which team members have access permissions to view and edit leads in this pipeline.</p>
                      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-2xl p-4 space-y-2 max-h-48 overflow-y-auto shadow-inner">
                        {counsellorsAndManagers.length > 0 ? (
                          counsellorsAndManagers.map(profile => {
                            const hasAccess = getPipelineUserAccess(profile.id);
                            return (
                              <label key={profile.id} className="flex items-center justify-between p-1.5 hover:bg-slate-50 dark:hover:bg-zinc-900/50 rounded-xl cursor-pointer">
                                <span className="text-xs text-slate-700 dark:text-slate-350 font-medium">{profile.full_name} <span className="text-[10px] text-slate-400 font-semibold">({profile.role})</span></span>
                                <input type="checkbox" checked={hasAccess} onChange={() => handleToggleUserAccess(profile.id)} className="w-4 h-4 text-indigo-650 border-slate-300 dark:border-zinc-800 rounded focus:ring-indigo-500 cursor-pointer" />
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

                <form onSubmit={handleCreatePipeline} className="pt-4 border-t border-slate-200 dark:border-zinc-900">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Create Custom Pipeline</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="e.g. Travel Pipeline, Visa Pipeline..." value={newPipelineName} onChange={(e) => setNewPipelineName(e.target.value)} className="flex-1 bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500" />
                    <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5"><PlusCircle className="w-3.5 h-3.5" /> Create Pipeline</button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Partner Lead Auto-Routing ────────────────────────────────── */}
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-900 pb-4">
              <div className="flex items-center gap-2.5">
                <Shuffle className="w-5 h-5 text-indigo-500" />
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white">Partner Lead Auto-Routing</h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Define which pipeline &amp; stage partner students land in when synced to CRM</p>
                </div>
              </div>
              {isAdmin && (
                <button type="button" onClick={handleSaveRoutingRules} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" /> Save Rules
                </button>
              )}
            </div>
            {routingSaveStatus && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl p-3 text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4" /> {routingSaveStatus}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: '🎯 Interested / Prospect Students', desc: 'Students marked as "Interested" in Partner Portal', rule: routingInterested, setRule: setRoutingInterested },
                { label: '✅ Confirmed Admissions', desc: 'Students with confirmed admission / paid students', rule: routingConfirmed, setRule: setRoutingConfirmed }
              ].map(({ label, desc, rule, setRule }) => (
                <div key={label} className={`rounded-2xl border p-4 space-y-4 transition-all ${rule.enabled ? 'border-indigo-400/40 dark:border-indigo-600/40 bg-indigo-50/50 dark:bg-indigo-950/20' : 'border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-white">{label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>
                    </div>
                    {isAdmin && (
                      <button type="button" onClick={() => setRule(prev => ({ ...prev, enabled: !prev.enabled }))} className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-all ${rule.enabled ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-zinc-700'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${rule.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    )}
                  </div>
                  {rule.enabled && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Target Pipeline</label>
                        <select value={rule.pipeline_id} onChange={e => setRule(prev => ({ ...prev, pipeline_id: e.target.value, stage_id: '' }))} disabled={!isAdmin} className="w-full bg-white dark:bg-black border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:border-indigo-500 disabled:opacity-60">
                          <option value="">— Select Pipeline —</option>
                          {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}{p.is_default ? ' (Default)' : ''}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Landing Stage</label>
                        <select value={rule.stage_id} onChange={e => setRule(prev => ({ ...prev, stage_id: e.target.value }))} disabled={!isAdmin || !rule.pipeline_id} className="w-full bg-white dark:bg-black border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:border-indigo-500 disabled:opacity-60">
                          <option value="">— Select Stage —</option>
                          {getStagesForPipeline(rule.pipeline_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        {!rule.pipeline_id && <p className="text-[9px] text-slate-400 mt-1">Select a pipeline first</p>}
                      </div>
                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Country Filter <span className="font-normal normal-case">(empty = all countries)</span></label>
                        <div className="flex flex-wrap gap-1.5">
                          {KNOWN_COUNTRIES.map(c => (
                            <button key={c} type="button" disabled={!isAdmin} onClick={() => toggleFilterItem(rule, setRule, 'filter_countries', c)} className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all ${rule.filter_countries.includes(c) ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400'}`}>{c}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Course Filter <span className="font-normal normal-case">(empty = all courses)</span></label>
                        <div className="flex flex-wrap gap-1.5">
                          {KNOWN_COURSES.map(c => (
                            <button key={c} type="button" disabled={!isAdmin} onClick={() => toggleFilterItem(rule, setRule, 'filter_courses', c)} className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all ${rule.filter_courses.includes(c) ? 'bg-violet-500 border-violet-500 text-white' : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300 hover:border-violet-400'}`}>{c}</button>
                          ))}
                        </div>
                      </div>
                      {rule.pipeline_id && rule.stage_id && (
                        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                          ✓ Routes to: <strong>{pipelines.find(p => p.id === rule.pipeline_id)?.name}</strong> → <strong>{rule.stage_id}</strong>
                          {rule.filter_countries.length > 0 && <span className="ml-1 text-slate-400">| Countries: {rule.filter_countries.join(', ')}</span>}
                          {rule.filter_courses.length > 0 && <span className="ml-1 text-slate-400">| Courses: {rule.filter_courses.join(', ')}</span>}
                        </div>
                      )}
                    </div>
                  )}
                  {!rule.enabled && <p className="text-[10px] text-slate-400 italic">Disabled — falls back to default pipeline routing</p>}
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ══════════════════ VISA & DOCS ══════════════════════════════════ */}
      {settingsTab === 'visa' && (
        <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-900 pb-4">
            <div className="flex items-center gap-2.5">
              <Plane className="w-5 h-5 text-indigo-500" />
              <h3 className="font-bold text-slate-800 dark:text-white">Visa Checklist Requirements</h3>
            </div>
          </div>
          <p className="text-xs text-slate-500">Configure default required document slots for students heading to target countries. These documents are automatically verified against the partner portal submissions.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 border border-slate-150 dark:border-zinc-900 rounded-2xl p-4 space-y-4">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Add Requirement</h4>
              <form onSubmit={handleAddConfigDoc} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Country Target</label>
                  <select value={configCountry} onChange={(e) => setConfigCountry(e.target.value)} disabled={!isAdmin} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs font-bold text-slate-700 dark:text-slate-350 outline-none">
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
                  <input type="text" required placeholder="e.g. Police Clearance Certificate" value={newRequiredDocName} onChange={(e) => setNewRequiredDocName(e.target.value)} disabled={!isAdmin} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 disabled:opacity-60" />
                </div>
                {isAdmin && (
                  <button type="submit" className="w-full bg-indigo-650 hover:bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow flex items-center justify-center gap-1.5">
                    <Plus className="w-4 h-4" /> Save
                  </button>
                )}
              </form>
            </div>
            <div className="md:col-span-2 space-y-4 max-h-[400px] overflow-y-auto pr-1">
              {['Georgia', 'Russia', 'Armenia', 'Uzbekistan', 'Bangladesh', 'Nepal', 'Philippines'].map(c => {
                const countryDocs = visaRequiredDocs.filter(d => d.country.toLowerCase() === c.toLowerCase());
                if (countryDocs.length === 0) return null;
                return (
                  <div key={c} className="border border-slate-150 dark:border-zinc-900 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-extrabold text-indigo-550 dark:text-indigo-400 uppercase tracking-widest border-b border-slate-50 dark:border-zinc-900/50 pb-1.5">{c} ({countryDocs.length} required)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {countryDocs.map(d => (
                        <div key={d.id} className="flex justify-between items-center bg-slate-50 dark:bg-black/40 border border-slate-200/50 dark:border-zinc-900/50 px-3 py-1.5 rounded-xl">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-350">{d.document_name}</span>
                          {isAdmin && (
                            <button type="button" onClick={() => handleDeleteConfigDoc(d.id)} className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 rounded-lg transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
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
      )}

      {/* ══════════════════ TEAM ═════════════════════════════════════════ */}
      {settingsTab === 'team' && (
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
                    {profile.full_name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-white">{profile.full_name}</p>
                    <p className="text-[10px] text-slate-400">{profile.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={profile.role}
                    onChange={(e) => handleRoleChange(profile.id, e.target.value as any)}
                    disabled={!isAdmin || profile.id === currentUser?.id}
                    className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="counsellor">Counsellor</option>
                  </select>

                  {isAdmin && profile.id !== currentUser?.id && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleResetPasswordClick(profile)}
                        className="p-2 bg-slate-50 dark:bg-zinc-900 hover:bg-indigo-500/10 hover:text-indigo-500 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-zinc-800 rounded-xl transition-all shadow-sm cursor-pointer"
                        title="Reset Password"
                      >
                        <Key className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUserClick(profile)}
                        className="p-2 bg-slate-50 dark:bg-zinc-900 hover:bg-rose-500/10 hover:text-rose-500 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-zinc-800 rounded-xl transition-all shadow-sm cursor-pointer"
                        title="Delete User"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {isAdmin && (
            <div className="border-t border-slate-100 dark:border-zinc-900 pt-6 space-y-4">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Create New Team Member</h4>
              {userCreateError && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-semibold">⚠️ {userCreateError}</div>}
              {userCreateStatus && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">✓ {userCreateStatus}</div>}
              <form onSubmit={handleAddUserSubmit} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Full Name</label>
                    <input type="text" required value={newUserFullName} onChange={(e) => setNewUserFullName(e.target.value)} placeholder="e.g. Rahul Sharma" className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Email Address</label>
                    <input type="email" required value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="counsellor@agency.com" className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Phone Number</label>
                    <input type="tel" required value={newUserPhone} onChange={(e) => setNewUserPhone(e.target.value)} placeholder="+91 98765 43210" className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Role</label>
                    <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as any)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500">
                      <option value="counsellor">Counsellor</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Temporary Password</label>
                    <input type="password" required value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Set a temporary password..." className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500" />
                  </div>
                </div>
                <button type="submit" disabled={isCreatingUser} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg text-[10px] uppercase transition-all disabled:opacity-50 mt-2">
                  {isCreatingUser ? 'Creating Account...' : 'Create Account & Send Credentials Email'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ ACCOUNT ══════════════════════════════════════ */}
      {settingsTab === 'account' && (
        <div className="space-y-6">

          {/* Change Password ──────────────────────────────────────────── */}
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
                <input type="password" required placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-250 dark:border-zinc-900 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Confirm New Password</label>
                <input type="password" required placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-250 dark:border-zinc-900 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-none focus:border-blue-500" />
              </div>
              <button type="submit" disabled={isUpdatingPw} className="w-full py-2 bg-indigo-650 hover:bg-indigo-600 disabled:bg-slate-300 dark:disabled:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-all shadow hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-1.5">
                {isUpdatingPw ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Update Password</span>}
              </button>
            </form>
          </div>

          {/* Active Integrations Status ───────────────────────────────── */}
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

          {/* Account Deletion ─────────────────────────────────────────── */}
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-500" />
              <h3 className="font-bold text-slate-800 dark:text-white">Account Deletion</h3>
            </div>
            <p className="text-xs text-slate-550 dark:text-zinc-400">Need to permanently close your account and delete your associated CRM records? You can request complete data erasure.</p>
            <div className="pt-2">
              <Link href="/data-deletion" className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-650 hover:underline">
                Data Deletion Instructions & Request Form →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isResetPassModalOpen && profileToReset && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-lg space-y-4 relative overflow-y-auto max-h-[90vh]">
            <button 
              onClick={() => {
                setIsResetPassModalOpen(false);
                setProfileToReset(null);
              }} 
              className="absolute top-4 right-4 p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-455 cursor-pointer border-none bg-transparent"
            >
              <Plus className="w-4 h-4 rotate-45" />
            </button>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase flex items-center gap-1.5">
              <Key className="w-5 h-5 text-indigo-500 animate-pulse" /> Reset User Password
            </h3>
            <p className="text-xs text-slate-500">
              Set a new secure password for <strong className="text-slate-700 dark:text-white">{profileToReset.full_name}</strong> ({profileToReset.email}).
            </p>

            {resetPasswordError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-semibold">
                ⚠️ {resetPasswordError}
              </div>
            )}
            {resetPasswordSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                ✓ {resetPasswordSuccess}
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">New Password *</label>
                <input 
                  type="password"
                  required
                  value={newPasswordForReset}
                  onChange={(e) => setNewPasswordForReset(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white outline-none font-medium"
                />
              </div>

              <button 
                type="submit" 
                disabled={isResettingPassword}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-[10px] uppercase transition-all shadow disabled:opacity-50"
              >
                {isResettingPassword ? 'Resetting password...' : 'Confirm Reset Password'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {isDeleteUserModalOpen && profileToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-lg space-y-4 relative">
            <h3 className="text-sm font-bold text-rose-600 uppercase flex items-center gap-1.5">
              <ShieldAlert className="w-5 h-5 text-rose-500" /> Delete User Account
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Are you sure you want to permanently delete the account for <strong className="text-slate-700 dark:text-white">{profileToDelete.full_name}</strong> ({profileToDelete.email})?
            </p>
            <p className="text-[11px] text-rose-500 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20 font-medium">
              ⚠️ This action is irreversible. Deleting the user will remove their credentials, profile details, and revoke all active permissions.
            </p>

            {deleteUserError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-semibold">
                ⚠️ {deleteUserError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button 
                type="button" 
                onClick={() => {
                  setIsDeleteUserModalOpen(false);
                  setProfileToDelete(null);
                }} 
                className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-650 dark:text-slate-300 font-bold py-2.5 rounded-xl text-[10px] uppercase transition-all"
              >
                Cancel
              </button>
              <button 
                type="button" 
                disabled={isDeletingUser}
                onClick={handleDeleteUserConfirm}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl text-[10px] uppercase transition-all shadow disabled:opacity-50"
              >
                {isDeletingUser ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

