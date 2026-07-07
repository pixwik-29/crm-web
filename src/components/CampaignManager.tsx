import React, { useState, useEffect } from 'react';
import { useData } from '@/context/DataContext';
import { 
  Send, Users, Filter, Calendar, CheckCircle2, AlertCircle, 
  Play, Clock, RefreshCw, BarChart2, Check, UserCheck, MessageSquare 
} from 'lucide-react';

export const CampaignManager: React.FC = () => {
  const { 
    leads, 
    whatsappTemplates, 
    tenantId, 
    settings 
  } = useData();

  // Filters state
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDestination, setFilterDestination] = useState('all');
  const [filterCourse, setFilterCourse] = useState('all');
  const [neetMin, setNeetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [targetTag, setTargetTag] = useState('');

  // Template state
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [variableMappings, setVariableMappings] = useState<string[]>([]);
  
  // Schedule state
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState('');

  // UI state
  const [matchedLeadsCount, setMatchedLeadsCount] = useState(0);
  const [isLaunching, setIsLaunching] = useState(false);
  const [campaignStatus, setCampaignStatus] = useState<string | null>(null);
  const [campaignError, setCampaignError] = useState<string | null>(null);

  // Load countries and courses list for filter dropdowns
  const uniqueDestinations = Array.from(new Set(leads.map(l => l.preferred_destination).filter(Boolean)));
  const uniqueCourses = Array.from(new Set(leads.map(l => l.course).filter(Boolean)));
  const allTags = Array.from(new Set(leads.flatMap(l => l.tags || [])));

  // Calculate matching leads in real-time on UI
  useEffect(() => {
    let filtered = leads;
    if (filterStatus !== 'all') {
      filtered = filtered.filter(l => l.status === filterStatus);
    }
    if (filterDestination !== 'all') {
      filtered = filtered.filter(l => l.preferred_destination === filterDestination);
    }
    if (filterCourse !== 'all') {
      filtered = filtered.filter(l => l.course === filterCourse);
    }
    if (neetMin) {
      filtered = filtered.filter(l => (l.neet_marks || 0) >= parseInt(neetMin));
    }
    if (budgetMax) {
      filtered = filtered.filter(l => (l.budget || 9999999) <= parseFloat(budgetMax));
    }
    if (targetTag) {
      filtered = filtered.filter(l => l.tags?.includes(targetTag));
    }
    setMatchedLeadsCount(filtered.length);
  }, [leads, filterStatus, filterDestination, filterCourse, neetMin, budgetMax, targetTag]);

  // Adjust personalization fields based on selected template's placeholders
  useEffect(() => {
    if (!selectedTemplateName) {
      setVariableMappings([]);
      return;
    }
    const template = whatsappTemplates.find(t => t.name === selectedTemplateName);
    if (!template) return;

    // Detect {{1}}, {{2}} placeholder counts in the template body
    const placeholderMatches = template.body.match(/\{\{\d+\}\}/g) || [];
    const counts = placeholderMatches.length;
    
    // Seed initial mappings (default variable 1 to 'name')
    const initial = Array(counts).fill('').map((_, idx) => idx === 0 ? 'name' : 'course');
    setVariableMappings(initial);
  }, [selectedTemplateName, whatsappTemplates]);

  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateName) {
      setCampaignError('Please select a template.');
      return;
    }
    if (isScheduled && !scheduleDateTime) {
      setCampaignError('Please specify scheduling date and time.');
      return;
    }

    setCampaignError(null);
    setCampaignStatus('Launching broadcast campaign...');
    setIsLaunching(true);

    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: {
            status: filterStatus,
            preferred_destination: filterDestination,
            course: filterCourse,
            neet_marks_min: neetMin || undefined,
            budget_max: budgetMax || undefined,
            tags: targetTag ? [targetTag] : undefined
          },
          templateName: selectedTemplateName,
          variables: variableMappings,
          scheduledTime: isScheduled ? new Date(scheduleDateTime).toISOString() : undefined,
          tenantId
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to trigger campaign');

      setCampaignStatus(`🚀 Campaign started successfully! Dispatched to ${data.targetsCount} target lead(s).`);
      
      // Reset form states
      setSelectedTemplateName('');
      setIsScheduled(false);
      setScheduleDateTime('');
    } catch (err: any) {
      setCampaignError(err.message);
      setCampaignStatus(null);
    } finally {
      setIsLaunching(false);
    }
  };

  const updateVariableMapping = (index: number, value: string) => {
    const updated = [...variableMappings];
    updated[index] = value;
    setVariableMappings(updated);
  };

  return (
    <div className="space-y-6">
      
      {/* Campaign Header banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-500 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-[-30%] right-[-5%] w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
            <Send className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">WhatsApp Broadcast Campaigns</h2>
            <p className="text-xs text-emerald-100 font-medium mt-1">Configure filters, map template parameters, and dispatch bulk alerts to leads</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Step 1: Configuration Form */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-6">
          <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2"><Filter className="w-4 h-4 text-emerald-500" /> Target Lead Filters</h3>
          
          <form onSubmit={handleLaunchCampaign} className="space-y-6">
            
            {/* Filter grid options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Lead Status</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500">
                  <option value="all">All Statuses</option>
                  <option value="Lead Created">Lead Created</option>
                  <option value="1st followup">1st followup</option>
                  <option value="cold">Cold</option>
                  <option value="warm">Warm</option>
                  <option value="hot">Hot</option>
                  <option value="admission done">Admission Done</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Preferred Destination</label>
                <select value={filterDestination} onChange={(e) => setFilterDestination(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500">
                  <option value="all">All Destinations</option>
                  {uniqueDestinations.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Target Course</label>
                <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500">
                  <option value="all">All Courses</option>
                  {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Tag Filter</label>
                <select value={targetTag} onChange={(e) => setTargetTag(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500">
                  <option value="">No Tag Filter</option>
                  {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Min NEET Marks</label>
                <input type="number" value={neetMin} onChange={(e) => setNeetMin(e.target.value)} placeholder="e.g. 150" className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500" />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Max Budget limit (INR)</label>
                <input type="number" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="e.g. 2500000" className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500" />
              </div>
            </div>

            {/* Template Selection */}
            <div className="border-t border-slate-100 dark:border-zinc-900 pt-6 space-y-4">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2"><MessageSquare className="w-4 h-4 text-emerald-500" /> Message Template Selection</h3>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Approved Meta Template</label>
                <select value={selectedTemplateName} onChange={(e) => setSelectedTemplateName(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500 font-bold">
                  <option value="">Select template...</option>
                  {whatsappTemplates.map(t => (
                    <option key={t.id} value={t.name}>{t.name} (Approved)</option>
                  ))}
                </select>
              </div>

              {selectedTemplateName && (
                <div className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-2xl p-4 space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Template Template Body Preview</span>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-mono whitespace-pre-wrap">
                    {whatsappTemplates.find(t => t.name === selectedTemplateName)?.body}
                  </p>
                </div>
              )}
            </div>

            {/* Variable personalizations mapping */}
            {variableMappings.length > 0 && (
              <div className="border-t border-slate-100 dark:border-zinc-900 pt-6 space-y-4 animate-fade-in">
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2"><UserCheck className="w-4 h-4 text-emerald-500" /> Variable Personalization Mapping</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {variableMappings.map((mapping, idx) => (
                    <div key={idx}>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-bold">Variable {'{'}{idx + 1}{'}'}</label>
                      <select value={mapping} onChange={(e) => updateVariableMapping(idx, e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500">
                        <option value="name">Candidate Full Name (lead.name)</option>
                        <option value="course">Selected Course (lead.course)</option>
                        <option value="preferred_destination">Preferred Country (lead.preferred_destination)</option>
                        <option value="budget">Candidate Budget (lead.budget)</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scheduling and Submission */}
            <div className="border-t border-slate-100 dark:border-zinc-900 pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-white">Schedule for Later Delivery</span>
                </div>
                <button type="button" onClick={() => setIsScheduled(!isScheduled)} className={`w-10 h-6 rounded-full transition-all relative outline-none cursor-pointer ${isScheduled ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-zinc-800'}`}>
                  <span className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${isScheduled ? 'left-5' : 'left-1'}`}></span>
                </button>
              </div>

              {isScheduled && (
                <div className="animate-slide-down">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Target Dispatch Date & Time</label>
                  <input type="datetime-local" value={scheduleDateTime} onChange={(e) => setScheduleDateTime(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500" />
                </div>
              )}
            </div>

            {campaignStatus && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center gap-2.5 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{campaignStatus}</span>
              </div>
            )}

            {campaignError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center gap-2.5 text-xs font-bold">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{campaignError}</span>
              </div>
            )}

            <button type="submit" disabled={isLaunching || matchedLeadsCount === 0 || !selectedTemplateName} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white font-bold rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/15 flex items-center justify-center gap-2">
              <Play className="w-4 h-4 fill-white" />
              {isScheduled ? 'Schedule Campaign' : 'Launch Immediate Campaign'}
            </button>

          </form>
        </div>

        {/* Step 2: Campaign Summary Panel */}
        <div className="space-y-6">
          
          {/* Matched leads stats */}
          <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm text-center space-y-4">
            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Total Matching Targets</h4>
            <div className="flex items-baseline justify-center gap-1.5">
              <span className="text-5xl font-black text-slate-800 dark:text-white tracking-tight">{matchedLeadsCount}</span>
              <span className="text-xs font-bold text-slate-400">lead(s)</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal px-2">Matches current active filter selections dynamically evaluated from your leads table</p>
          </div>

          {/* Configuration Requirements check */}
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-4">
            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Broadcast Guidelines</h4>
            <div className="space-y-3.5">
              <div className="flex gap-2 text-xs">
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-slate-600 dark:text-zinc-400 leading-normal">Ensure target leads have correct country code phone numbers (e.g. starting with +91)</span>
              </div>
              <div className="flex gap-2 text-xs">
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-slate-600 dark:text-zinc-400 leading-normal">Always match variable placeholders accurately to prevent template formatting rejections</span>
              </div>
              <div className="flex gap-2 text-xs">
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-slate-600 dark:text-zinc-400 leading-normal">Limit broadcast frequencies to protect your quality rating and avoid customer spam reports</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
