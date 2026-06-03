"use client";

import React, { useState, useRef } from 'react';
import { useData } from '@/context/DataContext';
import { 
  FileText, Check, AlertCircle, Clock, Upload, Plane, ShieldCheck, 
  Trash2, Plus, MessageSquare, Globe, Building2, UserCheck, Calendar, MapPin
} from 'lucide-react';
import { VisaApplication } from '@/types/crm';

export const VisaProcessing: React.FC = () => {
  const { 
    currentUser,
    leads,
    profiles,
    visaApplications,
    visaRequiredDocs,
    visaUploadedDocs,
    updateVisaApplication,
    saveVisaRequiredDoc,
    deleteVisaRequiredDoc,
    uploadVisaDoc,
    deleteVisaDoc,
    verifyVisaDoc,
    sendVisaDocToStudent
  } = useData();

  // Active tabs and filters
  const [selectedCountry, setSelectedCountry] = useState<string>('All');
  const [selectedCollege, setSelectedCollege] = useState<string>('All');
  const [selectedSource, setSelectedSource] = useState<string>('All'); // 'All', 'Internal', 'External'
  const [activeTab, setActiveTab] = useState<'applications' | 'settings'>('applications');

  // Detail Modal State
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'checklist' | 'issuances' | 'travel'>('checklist');

  // Document Checklist Config Form States
  const [configCountry, setConfigCountry] = useState<string>('Georgia');
  const [newRequiredDocName, setNewRequiredDocName] = useState<string>('');

  // File Upload states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingDocName, setUploadingDocName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Derive unique lists for filters
  const countries = ['All', ...Array.from(new Set(visaApplications.map(va => va.target_country).filter(Boolean)))];
  const colleges = ['All', ...Array.from(new Set(visaApplications.map(va => va.target_college).filter(Boolean)))];
  const externalConsultants = Array.from(
    new Set(
      visaApplications
        .map(va => {
          const lead = leads.find(l => l.id === va.lead_id);
          return lead?.external_consultant;
        })
        .filter(Boolean)
    )
  );

  // Filter visa applications
  const filteredApps = visaApplications.filter(va => {
    const lead = leads.find(l => l.id === va.lead_id);
    if (!lead) return false;

    // Filter by Country
    const matchCountry = selectedCountry === 'All' || va.target_country === selectedCountry;
    // Filter by College
    const matchCollege = selectedCollege === 'All' || va.target_college === selectedCollege;
    // Filter by Source (Internal vs External)
    let matchSource = true;
    if (selectedSource === 'Internal') {
      matchSource = !lead.external_consultant;
    } else if (selectedSource === 'External') {
      matchSource = !!lead.external_consultant;
    } else if (selectedSource !== 'All') {
      matchSource = lead.external_consultant === selectedSource;
    }

    return matchCountry && matchCollege && matchSource;
  });

  const activeApp = visaApplications.find(va => va.id === activeAppId);
  const activeLead = activeApp ? leads.find(l => l.id === activeApp.lead_id) : null;
  const activeAppDocs = activeApp ? visaUploadedDocs.filter(d => d.visa_application_id === activeApp.id) : [];

  // Required docs checklist calculations
  const getRequiredDocsForCountry = (country: string) => {
    return visaRequiredDocs.filter(rd => rd.country.toLowerCase() === country.toLowerCase() && rd.is_required);
  };

  const getChecklistProgress = (va: VisaApplication) => {
    const reqs = getRequiredDocsForCountry(va.target_country || '');
    if (reqs.length === 0) return { uploaded: 0, total: 0, percent: 100 };
    const uploadedDocs = visaUploadedDocs.filter(
      d => d.visa_application_id === va.id && !d.is_issuance && d.status === 'verified'
    );
    const verifiedCount = reqs.filter(r => uploadedDocs.some(u => u.document_name.toLowerCase() === r.document_name.toLowerCase())).length;
    return {
      uploaded: verifiedCount,
      total: reqs.length,
      percent: Math.round((verifiedCount / reqs.length) * 100)
    };
  };

  // Handlers
  const handleStatusChange = async (appId: string, newStatus: string) => {
    await updateVisaApplication(appId, { status: newStatus });
  };

  const handleUpdateNotes = async (appId: string, notes: string) => {
    await updateVisaApplication(appId, { visa_notes: notes });
  };

  const handleUpdateTravel = async (appId: string, updates: Partial<VisaApplication>) => {
    await updateVisaApplication(appId, updates);
  };

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

  const triggerUpload = (docName: string) => {
    setUploadingDocName(docName);
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeAppId || !uploadingDocName) return;

    setIsUploading(true);
    try {
      const isIssuance = ['Admission Letter', 'Invitation Letter', 'Visa Copy', 'Flight Ticket'].includes(uploadingDocName);
      await uploadVisaDoc(activeAppId, uploadingDocName, file, isIssuance);
      setUploadingDocName(null);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload document.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteUploadedDoc = async (id: string) => {
    if (!window.confirm('Remove this file upload?')) return;
    await deleteVisaDoc(id);
  };

  const handleVerifyDoc = async (id: string, status: 'verified' | 'rejected') => {
    await verifyVisaDoc(id, status);
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-900 pb-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
            <Plane className="w-5 h-5 text-indigo-500 animate-pulse" /> Post-Closing & Visa desk
          </h2>
          <p className="text-xs text-slate-500 mt-1">Manage Closed Won candidates, travel checklists, official document releases, and pre-departure updates.</p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-slate-100 dark:bg-zinc-900/60 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
          <button 
            onClick={() => setActiveTab('applications')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'applications' 
                ? 'bg-white dark:bg-zinc-950 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Applications ({visaApplications.length})
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'settings' 
                ? 'bg-white dark:bg-zinc-950 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Country Settings
          </button>
        </div>
      </div>

      {activeTab === 'applications' ? (
        <>
          {/* Filters Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 p-4 rounded-3xl shadow-sm">
            
            {/* Filter by Target Country */}
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Target Country</label>
              <select 
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
              >
                {countries.map(c => <option key={c} value={c}>{c === 'All' ? '🌍 All Countries' : c}</option>)}
              </select>
            </div>

            {/* Filter by College */}
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Target University</label>
              <select 
                value={selectedCollege}
                onChange={(e) => setSelectedCollege(e.target.value)}
                className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
              >
                {colleges.map(c => <option key={c} value={c}>{c === 'All' ? '🎓 All Colleges' : c}</option>)}
              </select>
            </div>

            {/* Filter by Source */}
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Referral Source</label>
              <select 
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="All">💼 All Lead Sources</option>
                <option value="Internal">🏢 Direct Inbound Leads (Internal)</option>
                <option value="External">🤝 External API Partner / Consultant</option>
                {externalConsultants.map(ec => (
                  <option key={ec} value={ec}>🔗 Consultant: {ec}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredApps.length > 0 ? (
              filteredApps.map(va => {
                const lead = leads.find(l => l.id === va.lead_id);
                if (!lead) return null;
                const progress = getChecklistProgress(va);
                return (
                  <div 
                    key={va.id}
                    onClick={() => {
                      setActiveAppId(va.id);
                      setActiveDetailTab('checklist');
                    }}
                    className="group bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900/60 p-5 rounded-3xl hover:border-indigo-500/50 dark:hover:border-indigo-500/40 hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between h-48 relative overflow-hidden"
                  >
                    
                    {/* Top Detail row */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100/30 dark:border-indigo-900/20">
                          {va.status}
                        </span>
                        {lead.external_consultant && (
                          <span className="text-[9px] font-bold uppercase text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-md px-1.5 py-0.5">
                            🤝 {lead.external_consultant}
                          </span>
                        )}
                      </div>

                      <h3 className="font-extrabold text-sm text-slate-800 dark:text-white group-hover:text-indigo-500 transition-colors">
                        {lead.name}
                      </h3>
                      
                      <div className="flex items-center gap-1.5 text-xs text-slate-450 dark:text-slate-400">
                        <Globe className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="font-semibold">{va.target_country || 'Georgia'}</span>
                        <span className="text-slate-300 dark:text-slate-800">•</span>
                        <Building2 className="w-3.5 h-3.5 text-indigo-400 truncate max-w-[120px]" />
                        <span className="truncate max-w-[110px] font-semibold">{va.target_college || 'Tbilisi Medical'}</span>
                      </div>
                    </div>

                    {/* Bottom Progress row */}
                    <div className="border-t border-slate-100 dark:border-zinc-900/80 pt-3 flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Document checklist</p>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                          {progress.uploaded}/{progress.total} Verified
                        </p>
                      </div>
                      
                      {/* Percent badge */}
                      <div className={`text-[10px] font-extrabold px-2 py-1 rounded-xl ${
                        progress.percent === 100 
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/25'
                          : 'bg-slate-100 dark:bg-zinc-900 text-slate-500 dark:text-slate-400'
                      }`}>
                        {progress.percent}% Done
                      </div>
                    </div>

                  </div>
                );
              })
            ) : (
              <div className="col-span-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-12 text-center text-slate-400">
                <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">No applicants found</h4>
                <p className="text-xs text-slate-400 mt-1">Select other filters or update lead pipeline status to "Closed Won".</p>
              </div>
            )}
          </div>
        </>
      ) : (
        /* settings checklist configurator */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Form to add doc requirement */}
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="border-b border-slate-100 dark:border-zinc-900 pb-4">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-white uppercase tracking-wider">Configure Checklist by Country</h3>
              <p className="text-[10px] text-slate-400 mt-1">Create default required document slots for students heading to target countries.</p>
            </div>

            <form onSubmit={handleAddConfigDoc} className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Country Target</label>
                <select
                  value={configCountry}
                  onChange={(e) => setConfigCountry(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs font-bold text-slate-750 outline-none"
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
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Document Requirement Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Police Clearance Certificate"
                  value={newRequiredDocName}
                  onChange={(e) => setNewRequiredDocName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-650 hover:bg-indigo-600 text-white font-bold py-3 rounded-xl text-xs transition-all shadow hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Save Requirement
              </button>
            </form>
          </div>

          {/* Right Columns: List checklist requirements */}
          <div className="lg:col-span-2 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-6">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-white uppercase tracking-wider">Configured Requirements</h3>
            
            <div className="space-y-4">
              {['Georgia', 'Russia', 'Armenia', 'Uzbekistan', 'Bangladesh', 'Nepal', 'Philippines'].map(c => {
                const countryDocs = visaRequiredDocs.filter(d => d.country.toLowerCase() === c.toLowerCase());
                if (countryDocs.length === 0) return null;
                return (
                  <div key={c} className="border border-slate-100 dark:border-zinc-900 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-extrabold text-indigo-500 uppercase tracking-widest border-b border-slate-50 dark:border-zinc-900/50 pb-1.5">{c} ({countryDocs.length} slots)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {countryDocs.map(d => (
                        <div key={d.id} className="flex justify-between items-center bg-slate-50 dark:bg-black/40 border border-slate-200/50 dark:border-zinc-900/50 px-3 py-1.5 rounded-xl">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-350">{d.document_name}</span>
                          {isAdmin && (
                            <button
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
      )}

      {/* Hidden File Input for checklist uploads */}
      <input 
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept="application/pdf,image/*"
      />

      {/* Drawer Overlay for Application Details */}
      {activeAppId && activeApp && activeLead && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-fade-in">
          
          {/* Sidebar Drawer panel */}
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-950 h-full flex flex-col justify-between shadow-2xl relative border-l border-slate-200 dark:border-zinc-900">
            
            {/* Header info */}
            <div className="p-6 border-b border-slate-100 dark:border-zinc-900 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100/30 dark:border-indigo-900/20">
                    Visa Application Desk
                  </span>
                  {activeLead.external_consultant && (
                    <span className="text-[9px] font-bold uppercase text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-md px-1.5 py-0.5">
                      🤝 {activeLead.external_consultant}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-extrabold text-slate-800 dark:text-white">{activeLead.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{activeLead.phone} • {activeLead.email || 'No email'}</p>
              </div>

              <button 
                onClick={() => setActiveAppId(null)}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-bold transition-all border border-slate-200/50 dark:border-zinc-900"
              >
                ✕ Close Drawer
              </button>
            </div>

            {/* Scrollable details contents */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Step 1: Target College / Country & Status Selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-dashed border-slate-100 dark:border-zinc-900 pb-6">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Visa Process Status</label>
                  <select 
                    value={activeApp.status}
                    onChange={(e) => handleStatusChange(activeApp.id, e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs font-bold text-slate-850 outline-none"
                  >
                    <option value="Document Collection">Document Collection</option>
                    <option value="Apostille/Verification">Apostille/Verification</option>
                    <option value="Embassy Submission">Embassy Submission</option>
                    <option value="Visa Issued">Visa Issued</option>
                    <option value="Flyer/Pre-departure">Flyer/Pre-departure</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Target Country</label>
                  <input
                    type="text"
                    value={activeApp.target_country || ''}
                    onChange={(e) => updateVisaApplication(activeApp.id, { target_country: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Target College</label>
                  <input
                    type="text"
                    value={activeApp.target_college || ''}
                    onChange={(e) => updateVisaApplication(activeApp.id, { target_college: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>
              </div>

              {/* Sub tabs in drawer */}
              <div className="flex border-b border-slate-100 dark:border-zinc-900/60 pb-1.5 gap-4">
                {[
                  { id: 'checklist', label: 'Student checklist', icon: FileText },
                  { id: 'issuances', label: 'Counsellor releases (Issuances)', icon: ShieldCheck },
                  { id: 'travel', label: 'Travel planning', icon: Plane }
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveDetailTab(tab.id as any)}
                      className={`pb-2 text-xs font-bold flex items-center gap-1.5 transition-all border-b-2 -mb-[8px] ${
                        activeDetailTab === tab.id
                          ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                          : 'border-transparent text-slate-400 hover:text-slate-650'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Sub tab Contents */}
              {activeDetailTab === 'checklist' && (
                <div className="space-y-4">
                  
                  {uploadError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {isUploading && (
                    <div className="p-3 bg-indigo-500/10 border border-indigo-500/25 text-indigo-500 text-xs rounded-xl flex items-center gap-2 animate-pulse">
                      <Clock className="w-4 h-4 animate-spin" />
                      <span>Uploading document and updating records...</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    {getRequiredDocsForCountry(activeApp.target_country || '').map(req => {
                      const upload = activeAppDocs.find(d => d.document_name.toLowerCase() === req.document_name.toLowerCase() && !d.is_issuance);
                      
                      return (
                        <div 
                          key={req.id} 
                          className="flex flex-col sm:flex-row items-start sm:items-center justify-between border border-slate-100 dark:border-zinc-900/60 p-4 rounded-2xl gap-3"
                        >
                          <div>
                            <p className="text-xs font-extrabold text-slate-800 dark:text-white">{req.document_name}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Required check slot</p>
                          </div>

                          <div className="flex items-center gap-2.5 self-end sm:self-auto">
                            {upload ? (
                              <>
                                {/* Status indicators */}
                                {upload.status === 'pending' && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">Pending Verification</span>
                                )}
                                {upload.status === 'verified' && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 flex items-center gap-1"><Check className="w-3 h-3" /> Verified</span>
                                )}
                                {upload.status === 'rejected' && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/25">Rejected</span>
                                )}

                                <a href={upload.file_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 underline font-semibold">View File</a>
                                
                                {isAdmin && upload.status === 'pending' && (
                                  <div className="flex gap-1 border-l border-slate-200 dark:border-zinc-900 pl-2">
                                    <button 
                                      onClick={() => handleVerifyDoc(upload.id, 'verified')}
                                      className="px-2 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[10px] font-bold"
                                    >
                                      Verify
                                    </button>
                                    <button 
                                      onClick={() => handleVerifyDoc(upload.id, 'rejected')}
                                      className="px-2 py-0.5 bg-rose-500 hover:bg-rose-600 text-white rounded text-[10px] font-bold"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                )}

                                <button 
                                  onClick={() => handleDeleteUploadedDoc(upload.id)}
                                  className="p-1 text-slate-400 hover:text-rose-500 rounded transition-all"
                                  title="Delete Document"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button 
                                onClick={() => triggerUpload(req.document_name)}
                                className="px-3 py-1.5 border border-dashed border-indigo-200 dark:border-zinc-800 text-indigo-650 hover:bg-indigo-50/40 rounded-xl text-[10px] font-extrabold flex items-center gap-1.5 transition-all"
                              >
                                <Upload className="w-3.5 h-3.5" /> Upload Document
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeDetailTab === 'issuances' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500">
                    Upload official documents for the candidate. Tapping "Send WhatsApp" triggers a direct template containing the download link.
                  </p>

                  <div className="space-y-3">
                    {['Admission Letter', 'Invitation Letter', 'Visa Copy', 'Flight Ticket'].map(docName => {
                      const upload = activeAppDocs.find(d => d.document_name === docName && d.is_issuance);
                      
                      return (
                        <div 
                          key={docName} 
                          className="flex flex-col sm:flex-row items-start sm:items-center justify-between border border-slate-100 dark:border-zinc-900/60 p-4 rounded-2xl gap-3"
                        >
                          <div>
                            <p className="text-xs font-extrabold text-slate-800 dark:text-white">{docName}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Consultant issuance file</p>
                          </div>

                          <div className="flex items-center gap-2.5 self-end sm:self-auto">
                            {upload ? (
                              <>
                                <a href={upload.file_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 underline font-semibold">View File</a>
                                
                                <button
                                  onClick={() => sendVisaDocToStudent(upload.id)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all"
                                  title="Send to student via WhatsApp"
                                >
                                  <MessageSquare className="w-3 h-3" /> Send WhatsApp
                                </button>

                                <button 
                                  onClick={() => handleDeleteUploadedDoc(upload.id)}
                                  className="p-1 text-slate-400 hover:text-rose-500 rounded transition-all"
                                  title="Delete Document"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button 
                                onClick={() => triggerUpload(docName)}
                                className="px-3 py-1.5 border border-dashed border-indigo-200 dark:border-zinc-800 text-indigo-650 hover:bg-indigo-50/40 rounded-xl text-[10px] font-extrabold flex items-center gap-1.5 transition-all"
                              >
                                <Upload className="w-3.5 h-3.5" /> Upload File
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeDetailTab === 'travel' && (
                <div className="space-y-6">
                  
                  {/* Flight scheduling inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Departure Date & Time</label>
                      <div className="relative">
                        <input
                          type="datetime-local"
                          value={activeApp.travel_departure_date ? new Date(activeApp.travel_departure_date).toISOString().slice(0, 16) : ''}
                          onChange={(e) => handleUpdateTravel(activeApp.id, { travel_departure_date: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                          className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 pl-10 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                        />
                        <Calendar className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Departure Airport</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="e.g. IGI Airport, Delhi (DEL)"
                          value={activeApp.travel_departure_airport || ''}
                          onChange={(e) => handleUpdateTravel(activeApp.id, { travel_departure_airport: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 pl-10 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                        />
                        <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  </div>

                  {/* Travel checklist checks */}
                  <div className="space-y-3 pt-4 border-t border-dashed border-slate-100 dark:border-zinc-900">
                    <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Travel prep checklist</h4>
                    
                    {[
                      { key: 'travel_currency_exchanged', label: 'Foreign Currency Exchanged (USD / Local)', desc: 'Foreign exchange card or cash issued.' },
                      { key: 'travel_insurance_done', label: 'Medical & Travel Insurance Policy Done', desc: 'Valid insurance document uploaded.' },
                      { key: 'travel_luggage_guidelines', label: 'Luggage weight guidelines verified', desc: 'Checked weight complies with airline limits.' },
                      { key: 'travel_pickup_confirmed', label: 'Arrival Airport Pickup Confirmed', desc: 'University team or partner pickup is scheduled.' }
                    ].map(item => (
                      <label 
                        key={item.key} 
                        className="flex items-start gap-3 border border-slate-50 dark:border-zinc-900 p-3.5 rounded-2xl hover:bg-slate-50/50 dark:hover:bg-black/30 transition-all cursor-pointer"
                      >
                        <input 
                          type="checkbox"
                          checked={!!(activeApp as any)[item.key]}
                          onChange={(e) => handleUpdateTravel(activeApp.id, { [item.key]: e.target.checked })}
                          className="mt-1 w-4 h-4 accent-indigo-650"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-350">{item.label}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{item.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                </div>
              )}

              {/* Case Notes/Logs */}
              <div className="pt-6 border-t border-slate-100 dark:border-zinc-900 space-y-3">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Application logs / visa notes</label>
                <textarea
                  rows={3}
                  placeholder="Record visa slot dates, interview questions, passport details, or delay reasons..."
                  value={activeApp.visa_notes || ''}
                  onChange={(e) => handleUpdateNotes(activeApp.id, e.target.value)}
                  className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-2xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

            </div>

            {/* Bottom drawer banner */}
            <div className="p-4 bg-slate-50 dark:bg-zinc-950 border-t border-slate-150 dark:border-zinc-900 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span>Updated: {new Date(activeApp.updated_at).toLocaleString()}</span>
              <span>Case ID: {activeApp.id.substring(0, 8)}</span>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
