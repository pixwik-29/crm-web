import React, { useState, useEffect } from 'react';
import { useData } from '@/context/DataContext';
import { supabase } from '@/lib/supabase';
import { 
  Send, Users, Filter, Calendar, CheckCircle2, AlertCircle, 
  Play, Clock, RefreshCw, BarChart2, Check, UserCheck, MessageSquare,
  Plus, Trash2, Edit3, X, ChevronRight 
} from 'lucide-react';

export const CampaignManager: React.FC = () => {
  const { 
    leads, 
    whatsappTemplates, 
    tenantId, 
    settings 
  } = useData();

  // Tab State
  const [activeTab, setActiveTab] = useState<'broadcast' | 'groups'>('broadcast');

  // Groups list state
  const [groups, setGroups] = useState<any[]>([]);

  // Selected Group for Broadcast
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);

  // Group Create/Edit Modal State
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  // Group Form fields
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupStatuses, setGroupStatuses] = useState<string[]>([]);
  const [groupDestinations, setGroupDestinations] = useState<string[]>([]);
  const [groupCourses, setGroupCourses] = useState<string[]>([]);
  const [groupTags, setGroupTags] = useState<string[]>([]);
  const [groupNeetMin, setGroupNeetMin] = useState('');
  const [groupBudgetMax, setGroupBudgetMax] = useState('');

  // Manual Broadcast Filters state
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

  // UI status states
  const [matchedLeadsCount, setMatchedLeadsCount] = useState(0);
  const [isLaunching, setIsLaunching] = useState(false);
  const [campaignStatus, setCampaignStatus] = useState<string | null>(null);
  const [campaignError, setCampaignError] = useState<string | null>(null);

  // Unique options for dropdowns/badges
  const uniqueDestinations = Array.from(new Set(leads.map(l => l.preferred_destination).filter(Boolean))) as string[];
  const uniqueCourses = Array.from(new Set(leads.map(l => l.course).filter(Boolean))) as string[];
  const allTags = Array.from(new Set(leads.flatMap(l => l.tags || []))) as string[];
  const statusOptions = ['Lead Created', '1st followup', 'cold', 'warm', 'hot', 'admission done'];

  // Fetch groups
  const fetchGroups = async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/lead-groups?tenantId=${tenantId}`);
      const data = await res.json();
      if (data.success) {
        setGroups(data.groups);
      }
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [tenantId]);

  // Calculate dynamic matching count for a specific filters object
  const calculateGroupCount = (filters: any) => {
    if (!filters) return 0;
    let filtered = leads;
    
    if (filters.statuses && Array.isArray(filters.statuses) && filters.statuses.length > 0 && !filters.statuses.includes('all')) {
      filtered = filtered.filter(l => filters.statuses.includes(l.status));
    }
    if (filters.destinations && Array.isArray(filters.destinations) && filters.destinations.length > 0 && !filters.destinations.includes('all')) {
      filtered = filtered.filter(l => filters.destinations.includes(l.preferred_destination));
    }
    if (filters.courses && Array.isArray(filters.courses) && filters.courses.length > 0 && !filters.courses.includes('all')) {
      filtered = filtered.filter(l => filters.courses.includes(l.course));
    }
    if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
      filtered = filtered.filter(l => filters.tags.some((t: string) => l.tags?.includes(t)));
    }
    if (filters.neet_marks_min) {
      filtered = filtered.filter(l => (l.neet_marks || 0) >= parseInt(filters.neet_marks_min));
    }
    if (filters.budget_max) {
      filtered = filtered.filter(l => (l.budget || 9999999) <= parseFloat(filters.budget_max));
    }
    return filtered.length;
  };

  // Calculate matching leads in real-time on UI (Manual Broadcast mode)
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

    const placeholderMatches = template.body.match(/\{\{\d+\}\}/g) || [];
    const counts = placeholderMatches.length;
    
    const initial = Array(counts).fill('').map((_, idx) => idx === 0 ? 'name' : 'course');
    setVariableMappings(initial);
  }, [selectedTemplateName, whatsappTemplates]);

  // Launch broadcast
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
      const payload: any = {
        templateName: selectedTemplateName,
        variables: variableMappings,
        scheduledTime: isScheduled ? new Date(scheduleDateTime).toISOString() : undefined,
        tenantId
      };

      if (targetGroupId) {
        payload.groupId = targetGroupId;
      } else {
        payload.filters = {
          status: filterStatus,
          preferred_destination: filterDestination,
          course: filterCourse,
          neet_marks_min: neetMin || undefined,
          budget_max: budgetMax || undefined,
          tags: targetTag ? [targetTag] : undefined
        };
      }

      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to trigger campaign');

      setCampaignStatus(`🚀 Campaign started successfully! Dispatched to ${data.targetsCount} target lead(s).`);
      
      // Reset form states
      setSelectedTemplateName('');
      setIsScheduled(false);
      setScheduleDateTime('');
      setTargetGroupId(null);
    } catch (err: any) {
      setCampaignError(err.message);
      setCampaignStatus(null);
    } finally {
      setIsLaunching(false);
    }
  };

  // Group Create/Edit Handler
  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName) return;

    try {
      const payload = {
        id: editingGroupId || undefined,
        tenantId,
        name: groupName,
        description: groupDesc,
        filters: {
          statuses: groupStatuses,
          destinations: groupDestinations,
          courses: groupCourses,
          tags: groupTags,
          neet_marks_min: groupNeetMin || undefined,
          budget_max: groupBudgetMax || undefined
        }
      };

      const method = editingGroupId ? 'PUT' : 'POST';
      const res = await fetch('/api/lead-groups', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setIsGroupModalOpen(false);
        setEditingGroupId(null);
        setGroupName('');
        setGroupDesc('');
        setGroupStatuses([]);
        setGroupDestinations([]);
        setGroupCourses([]);
        setGroupTags([]);
        setGroupNeetMin('');
        setGroupBudgetMax('');
        fetchGroups();
      }
    } catch (err) {
      console.error('Failed to save group:', err);
    }
  };

  // Edit Group triggers
  const handleEditGroup = (group: any) => {
    setEditingGroupId(group.id);
    setGroupName(group.name);
    setGroupDesc(group.description || '');
    setGroupStatuses(group.filters?.statuses || []);
    setGroupDestinations(group.filters?.destinations || []);
    setGroupCourses(group.filters?.courses || []);
    setGroupTags(group.filters?.tags || []);
    setGroupNeetMin(group.filters?.neet_marks_min || '');
    setGroupBudgetMax(group.filters?.budget_max || '');
    setIsGroupModalOpen(true);
  };

  // Delete group
  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Are you sure you want to delete this group?')) return;
    try {
      const res = await fetch(`/api/lead-groups?id=${id}&tenantId=${tenantId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchGroups();
        if (targetGroupId === id) setTargetGroupId(null);
      }
    } catch (err) {
      console.error('Failed to delete group:', err);
    }
  };

  const updateVariableMapping = (index: number, value: string) => {
    const updated = [...variableMappings];
    updated[index] = value;
    setVariableMappings(updated);
  };

  const targetGroupCount = targetGroupId 
    ? calculateGroupCount(groups.find(g => g.id === targetGroupId)?.filters) 
    : matchedLeadsCount;

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
            <p className="text-xs text-emerald-100 font-medium mt-1">Configure filters, manage dynamic lead groups, and dispatch bulk templates to contacts</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-100 dark:border-zinc-900 pb-px">
        <button 
          onClick={() => setActiveTab('broadcast')}
          className={`pb-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'broadcast'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          🚀 Launch Broadcast
        </button>
        <button 
          onClick={() => setActiveTab('groups')}
          className={`pb-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'groups'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          👥 Saved Messaging Groups
        </button>
      </div>

      {activeTab === 'broadcast' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left panel: Broadcast Form */}
          <div className="lg:col-span-2 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in">
            
            {/* If targeting a saved group */}
            {targetGroupId ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-500" /> Segment Target Mode
                  </h3>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-4 rounded-2xl flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">Targeting Group</span>
                    <h4 className="text-sm font-extrabold text-slate-800 dark:text-white">
                      {groups.find(g => g.id === targetGroupId)?.name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {groups.find(g => g.id === targetGroupId)?.description || 'No description provided'}
                    </p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setTargetGroupId(null)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Use Manual Filters
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                  <Filter className="w-4 h-4 text-emerald-500" /> Target Lead Filters
                </h3>
                
                {/* Filter grid options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Lead Status</label>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500 font-bold">
                      <option value="all">All Statuses</option>
                      {statusOptions.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Preferred Destination</label>
                    <select value={filterDestination} onChange={(e) => setFilterDestination(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500 font-bold">
                      <option value="all">All Destinations</option>
                      {uniqueDestinations.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Target Course</label>
                    <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500 font-bold">
                      <option value="all">All Courses</option>
                      {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Tag Filter</label>
                    <select value={targetTag} onChange={(e) => setTargetTag(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500 font-bold">
                      <option value="">No Tag Filter</option>
                      {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Min NEET Marks</label>
                    <input type="number" value={neetMin} onChange={(e) => setNeetMin(e.target.value)} placeholder="e.g. 150" className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500 font-bold" />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Max Budget limit (INR)</label>
                    <input type="number" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="e.g. 2500000" className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500 font-bold" />
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleLaunchCampaign} className="space-y-6">
              
              {/* Template Selection */}
              <div className="border-t border-slate-100 dark:border-zinc-900 pt-6 space-y-4">
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-500" /> Template Select
                </h3>
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Meta Template</label>
                  <select value={selectedTemplateName} onChange={(e) => setSelectedTemplateName(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500 font-bold">
                    <option value="">Select template...</option>
                    {whatsappTemplates.map(t => (
                      <option key={t.id} value={t.name}>{t.name} (Approved)</option>
                    ))}
                  </select>
                </div>

                {selectedTemplateName && (
                  <div className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-2xl p-4 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Template Preview</span>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-mono whitespace-pre-wrap">
                      {whatsappTemplates.find(t => t.name === selectedTemplateName)?.body}
                    </p>
                  </div>
                )}
              </div>

              {/* Variable personalizations mapping */}
              {variableMappings.length > 0 && (
                <div className="border-t border-slate-100 dark:border-zinc-900 pt-6 space-y-4 animate-fade-in">
                  <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-500" /> Personalize Fields
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {variableMappings.map((mapping, idx) => (
                      <div key={idx}>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-bold">Variable {'{'}{idx + 1}{'}'}</label>
                        <select value={mapping} onChange={(e) => updateVariableMapping(idx, e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500 font-bold">
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

              {/* Scheduling */}
              <div className="border-t border-slate-100 dark:border-zinc-900 pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-bold text-slate-800 dark:text-white">Schedule Broadcast</span>
                  </div>
                  <button type="button" onClick={() => setIsScheduled(!isScheduled)} className={`w-10 h-6 rounded-full transition-all relative outline-none cursor-pointer ${isScheduled ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-zinc-800'}`}>
                    <span className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${isScheduled ? 'left-5' : 'left-1'}`}></span>
                  </button>
                </div>

                {isScheduled && (
                  <div className="animate-slide-down">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Dispatch Date & Time</label>
                    <input type="datetime-local" value={scheduleDateTime} onChange={(e) => setScheduleDateTime(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500 font-bold" />
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

              <button type="submit" disabled={isLaunching || targetGroupCount === 0 || !selectedTemplateName} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white font-bold rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/15 flex items-center justify-center gap-2 cursor-pointer">
                <Play className="w-4 h-4 fill-white" />
                {isScheduled ? 'Schedule Campaign' : 'Launch Broadcast'}
              </button>

            </form>
          </div>

          {/* Right panel: Summary */}
          <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm text-center space-y-4">
              <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Total Targets</h4>
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="text-5xl font-black text-slate-800 dark:text-white tracking-tight">{targetGroupCount}</span>
                <span className="text-xs font-bold text-slate-400 font-bold">lead(s)</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal px-2">Matches current active filter selections dynamically evaluated from your database</p>
            </div>

            <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-4">
              <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Campaign Instructions</h4>
              <div className="space-y-3.5">
                <div className="flex gap-2 text-xs">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-600 dark:text-zinc-400 leading-normal font-medium">Verify numbers start with country code (e.g. +91)</span>
                </div>
                <div className="flex gap-2 text-xs">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-600 dark:text-zinc-400 leading-normal font-medium">Map placeholders carefully to prevent template failures</span>
                </div>
                <div className="flex gap-2 text-xs">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-600 dark:text-zinc-400 leading-normal font-medium">Spam rules apply: dispatch in structured groups</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {activeTab === 'groups' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800 dark:text-white">Active Segment Groups</h3>
              <p className="text-xs text-slate-400 mt-1 font-medium">Define lead categories dynamically using multi-select filter parameters</p>
            </div>
            <button 
              onClick={() => {
                setEditingGroupId(null);
                setGroupName('');
                setGroupDesc('');
                setGroupStatuses([]);
                setGroupDestinations([]);
                setGroupCourses([]);
                setGroupTags([]);
                setGroupNeetMin('');
                setGroupBudgetMax('');
                setIsGroupModalOpen(true);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold tracking-wider uppercase transition-all shadow-md shadow-emerald-600/10 flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create Group
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map(group => {
              const leadCount = calculateGroupCount(group.filters);
              return (
                <div key={group.id} className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all group">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">{group.name}</h4>
                        <p className="text-xs text-slate-400 font-medium">{group.description || 'No description'}</p>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-black">
                        {leadCount} leads
                      </div>
                    </div>

                    {/* Filter Summary */}
                    <div className="border-t border-slate-100 dark:border-zinc-900 pt-3 space-y-2">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Filters Config</span>
                      <div className="flex flex-wrap gap-1">
                        {group.filters?.statuses?.length > 0 && (
                          <span className="bg-slate-50 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 px-2 py-0.5 rounded text-[10px] font-bold">
                            Stage: {group.filters.statuses.join(', ')}
                          </span>
                        )}
                        {group.filters?.destinations?.length > 0 && (
                          <span className="bg-slate-50 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 px-2 py-0.5 rounded text-[10px] font-bold">
                            Country: {group.filters.destinations.join(', ')}
                          </span>
                        )}
                        {group.filters?.courses?.length > 0 && (
                          <span className="bg-slate-50 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 px-2 py-0.5 rounded text-[10px] font-bold">
                            Course: {group.filters.courses.join(', ')}
                          </span>
                        )}
                        {group.filters?.tags?.length > 0 && (
                          <span className="bg-slate-50 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 px-2 py-0.5 rounded text-[10px] font-bold">
                            Tags: {group.filters.tags.join(', ')}
                          </span>
                        )}
                        {group.filters?.neet_marks_min && (
                          <span className="bg-slate-50 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 px-2 py-0.5 rounded text-[10px] font-bold">
                            NEET: &gt;={group.filters.neet_marks_min}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-6 border-t border-slate-100 dark:border-zinc-900 pt-4">
                    <button 
                      onClick={() => {
                        setTargetGroupId(group.id);
                        setActiveTab('broadcast');
                      }}
                      disabled={leadCount === 0}
                      className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold tracking-wide transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Use for Broadcast
                    </button>
                    <button 
                      onClick={() => handleEditGroup(group)}
                      className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded-xl transition-all cursor-pointer"
                      title="Edit Group"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteGroup(group.id)}
                      className="p-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl transition-all cursor-pointer"
                      title="Delete Group"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {groups.length === 0 && (
              <div className="col-span-full bg-slate-50 dark:bg-zinc-950 border border-dashed border-slate-200 dark:border-zinc-900 rounded-3xl p-12 text-center space-y-4">
                <Users className="w-12 h-12 text-slate-300 mx-auto" />
                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">No Messaging Groups Configured</h4>
                  <p className="text-xs text-slate-400 font-medium">Create dynamic segments to make sending template campaigns fast and easy</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Group Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col animate-scale-up">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-zinc-900 sticky top-0 bg-white dark:bg-zinc-950 z-10">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-500" /> {editingGroupId ? 'Modify Saved Segment' : 'Create Messaging Group'}
              </h3>
              <button 
                onClick={() => setIsGroupModalOpen(false)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 rounded-full transition-all text-slate-600 dark:text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="p-6 space-y-6 flex-1">
              
              {/* Basic Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Group Segment Name</label>
                  <input 
                    type="text" 
                    value={groupName} 
                    onChange={(e) => setGroupName(e.target.value)} 
                    placeholder="e.g. Hot MBBS Leads" 
                    required 
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500 font-bold" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Short Description</label>
                  <input 
                    type="text" 
                    value={groupDesc} 
                    onChange={(e) => setGroupDesc(e.target.value)} 
                    placeholder="e.g. Leads matching warm/hot status" 
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500 font-bold" 
                  />
                </div>
              </div>

              {/* RLS/Multi-select Badge Pickers */}
              <div className="space-y-4 border-t border-slate-100 dark:border-zinc-900 pt-4">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Multi-Select Filtering Specifications</span>
                
                {/* 1. Lead Stage Selector */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Target Lead Stages</label>
                  <div className="flex flex-wrap gap-1.5">
                    {statusOptions.map(st => {
                      const isSelected = groupStatuses.includes(st);
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setGroupStatuses(groupStatuses.filter(s => s !== st));
                            } else {
                              setGroupStatuses([...groupStatuses, st]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                            isSelected 
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                              : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-slate-300'
                          }`}
                        >
                          {st}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Destination Selector */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Countries / Destinations</label>
                  {uniqueDestinations.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {uniqueDestinations.map(dest => {
                        const isSelected = groupDestinations.includes(dest);
                        return (
                          <button
                            key={dest}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setGroupDestinations(groupDestinations.filter(d => d !== dest));
                              } else {
                                setGroupDestinations([...groupDestinations, dest]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                              isSelected 
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                                : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-slate-300'
                            }`}
                          >
                            {dest}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 font-medium italic">No destinations registered in leads records.</p>
                  )}
                </div>

                {/* 3. Course Selector */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Courses</label>
                  {uniqueCourses.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {uniqueCourses.map(course => {
                        const isSelected = groupCourses.includes(course);
                        return (
                          <button
                            key={course}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setGroupCourses(groupCourses.filter(c => c !== course));
                              } else {
                                setGroupCourses([...groupCourses, course]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                              isSelected 
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                                : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-slate-300'
                            }`}
                          >
                            {course}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 font-medium italic">No courses registered in leads records.</p>
                  )}
                </div>

                {/* 4. Tag Selector */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Tags</label>
                  {allTags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {allTags.map(tag => {
                        const isSelected = groupTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setGroupTags(groupTags.filter(t => t !== tag));
                              } else {
                                setGroupTags([...groupTags, tag]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                              isSelected 
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                                : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-slate-300'
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 font-medium italic">No tags registered in leads records.</p>
                  )}
                </div>
              </div>

              {/* NEET & Budget bounds */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 dark:border-zinc-900 pt-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Min NEET Marks Threshold</label>
                  <input 
                    type="number" 
                    value={groupNeetMin} 
                    onChange={(e) => setGroupNeetMin(e.target.value)} 
                    placeholder="e.g. 150" 
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500 font-bold" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Max Budget limit (INR)</label>
                  <input 
                    type="number" 
                    value={groupBudgetMax} 
                    onChange={(e) => setGroupBudgetMax(e.target.value)} 
                    placeholder="e.g. 2500000" 
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500 font-bold" 
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="border-t border-slate-100 dark:border-zinc-900 pt-6 flex gap-3 justify-end sticky bottom-0 bg-white dark:bg-zinc-950 z-10 pb-2">
                <button 
                  type="button" 
                  onClick={() => setIsGroupModalOpen(false)}
                  className="px-5 py-3 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-emerald-600/10 cursor-pointer"
                >
                  Save Group
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
