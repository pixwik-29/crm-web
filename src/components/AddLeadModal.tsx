"use client";

import React, { useState } from 'react';
import { useData } from '@/context/DataContext';
import { Profile } from '@/types/crm';
import { X, Plus, AlertCircle } from 'lucide-react';

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: Profile[];
}

const SOURCES = [
  'Facebook Ads', 'Instagram Ads', 'Google Ads', 'WhatsApp Campaign', 
  'Website Form', 'Referral', 'Organic', 'Manual Entry', 'YouTube', 'TikTok', 'Other'
];

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

export const AddLeadModal: React.FC<AddLeadModalProps> = ({ isOpen, onClose, profiles }) => {
  const { addLead, currentUser, pipelines, pipelineAccess, activePipeline } = useData();

  // Get pipelines this user has access to
  const userPipelines = pipelines.filter(p => 
    currentUser?.role === 'admin' || 
    pipelineAccess.some(pa => pa.pipeline_id === p.id && pa.profile_id === currentUser?.id)
  );

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [fatherNumber, setFatherNumber] = useState('');
  const [motherNumber, setMotherNumber] = useState('');
  const [email, setEmail] = useState('');
  const [parentContact, setParentContact] = useState('');
  const [neetMarks, setNeetMarks] = useState('');
  const [budget, setBudget] = useState('');
  const [prefDestination, setPrefDestination] = useState('');
  const [course, setCourse] = useState('MBBS');
  const [source, setSource] = useState('Manual Entry');
  const [campaign, setCampaign] = useState('');
  const [counsellorId, setCounsellorId] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [externalConsultant, setExternalConsultant] = useState('');
  
  const [pipelineId, setPipelineId] = useState('');
  const [status, setStatus] = useState('');

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync initial pipeline and status when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const initialPipeId = activePipeline?.id || userPipelines[0]?.id || '';
      setPipelineId(initialPipeId);
      const pObj = pipelines.find(p => p.id === initialPipeId);
      if (pObj && pObj.stages.length > 0) {
        setStatus(pObj.stages[0].id);
      } else {
        setStatus('');
      }
    }
  }, [isOpen, activePipeline, pipelines, pipelineAccess]);

  const handlePipelineChange = (newPipelineId: string) => {
    setPipelineId(newPipelineId);
    const pObj = pipelines.find(p => p.id === newPipelineId);
    if (pObj && pObj.stages.length > 0) {
      setStatus(pObj.stages[0].id);
    } else {
      setStatus('');
    }
  };

  const selectedPipelineObj = pipelines.find(p => p.id === pipelineId);
  const stages = selectedPipelineObj?.stages || [];

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      setError('Name and Phone number are required fields.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      const formattedTags = tagsInput 
        ? tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0)
        : [];
      
      // Automatic lead scoring based on NEET marks (simple logic for now)
      const parsedNeet = neetMarks ? parseInt(neetMarks) : 0;
      let score = 30; // base score
      if (parsedNeet > 450) score = 90;
      else if (parsedNeet > 300) score = 65;
      else if (parsedNeet > 150) score = 50;

      await addLead({
        name,
        phone,
        whatsapp_number: whatsappNumber || undefined,
        father_number: fatherNumber || undefined,
        mother_number: motherNumber || undefined,
        email: email || undefined,
        parent_contact: parentContact || undefined,
        neet_marks: neetMarks ? parsedNeet : undefined,
        budget: budget ? parseFloat(budget) * 100000 : undefined, // Convert Lakhs to absolute ₹ value
        preferred_destination: prefDestination || undefined,
        course,
        lead_source: source,
        campaign_name: campaign || undefined,
        status: status || '1st followup',
        pipeline_id: pipelineId || null,
        assigned_counsellor_id: counsellorId || (currentUser?.role === 'counsellor' ? currentUser.id : null),
        tags: formattedTags,
        score,
        external_consultant: externalConsultant || undefined
      });

      // Clear fields and close
      setName('');
      setPhone('');
      setWhatsappNumber('');
      setFatherNumber('');
      setMotherNumber('');
      setEmail('');
      setParentContact('');
      setNeetMarks('');
      setBudget('');
      setPrefDestination('');
      setCourse('MBBS');
      setSource('Manual Entry');
      setCampaign('');
      setCounsellorId('');
      setTagsInput('');
      setExternalConsultant('');
      
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to capture manual lead.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl w-full max-w-2xl p-6 shadow-2xl animate-fade-in relative">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Capture Manual Lead</h2>
          <p className="text-xs text-slate-500 mt-1">Capture details manually to start CRM workflow pipeline sync.</p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/50 rounded-xl p-3.5 flex gap-2 text-rose-600 dark:text-rose-400 text-xs font-semibold mb-5 items-center">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Section 1: Candidate Basic Info */}
          <div className="sm:col-span-2 border-b border-slate-100 dark:border-zinc-900 pb-2 mb-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Candidate Contact Details</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Student Name *</label>
            <input
              type="text"
              required
              placeholder="Full name of student"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Student Phone *</label>
            <input
              type="text"
              required
              placeholder="e.g. +919876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">WhatsApp Number</label>
            <input
              type="text"
              placeholder="e.g. +919876543210"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Father's Number</label>
            <input
              type="text"
              placeholder="e.g. +919876543211"
              value={fatherNumber}
              onChange={(e) => setFatherNumber(e.target.value)}
              className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Mother's Number</label>
            <input
              type="text"
              placeholder="e.g. +919876543212"
              value={motherNumber}
              onChange={(e) => setMotherNumber(e.target.value)}
              className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Student Email</label>
            <input
              type="email"
              placeholder="student@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Parent Phone/Contact</label>
            <input
              type="text"
              placeholder="e.g. +919876543211"
              value={parentContact}
              onChange={(e) => setParentContact(e.target.value)}
              className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Section 2: Qualifications & Preference */}
          <div className="sm:col-span-2 border-b border-slate-100 dark:border-zinc-900 pb-2 mb-2 mt-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Qualifications & Course Preference</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">NEET Score (Out of 720)</label>
            <input
              type="number"
              placeholder="e.g. 480"
              value={neetMarks}
              onChange={(e) => setNeetMarks(e.target.value)}
              className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Budget (Lakhs INR)</label>
            <input
              type="number"
              placeholder="e.g. 50"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Applied Course</label>
            <select
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-300 outline-none focus:border-indigo-500 transition-all"
            >
              {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Preferred Country/State</label>
            <input
              type="text"
              placeholder="e.g. Georgia, Russia, Karnataka"
              value={prefDestination}
              onChange={(e) => setPrefDestination(e.target.value)}
              className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tags (Comma Separated)</label>
            <input
              type="text"
              placeholder="Georgia Preferred, High Budget"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Section 3: Campaign & Routing */}
          <div className="sm:col-span-2 border-b border-slate-100 dark:border-zinc-900 pb-2 mb-2 mt-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Routing & Tracking Info</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Lead Source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-300 outline-none"
            >
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Pipeline</label>
            <select
              value={pipelineId}
              onChange={(e) => handlePipelineChange(e.target.value)}
              className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-300 outline-none"
            >
              {userPipelines.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Initial Status / Stage</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-300 outline-none"
            >
              {stages.map(st => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Campaign Name</label>
            <input
              type="text"
              placeholder="e.g. MBBS Abroad Campaign June"
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">External Consultant Source</label>
            <input
              type="text"
              placeholder="e.g. ABC Agency, John Doe"
              value={externalConsultant}
              onChange={(e) => setExternalConsultant(e.target.value)}
              className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned Counsellor</label>
              <select
                value={counsellorId}
                onChange={(e) => setCounsellorId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-300 outline-none"
              >
                <option value="">Unassigned (Counsellor gets notified on auto-assignment)</option>
                {profiles.map(c => (
                  <option key={c.id} value={c.id}>{c.full_name} ({c.role})</option>
                ))}
              </select>
            </div>
          )}

          {/* Footer Actions */}
          <div className="sm:col-span-2 border-t border-slate-100 dark:border-zinc-900 pt-4 mt-4 flex justify-end gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 dark:border-zinc-900 rounded-2xl text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold rounded-2xl text-xs shadow-md transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Save Candidate Lead
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
