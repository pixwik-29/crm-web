"use client";

import React, { useState } from 'react';
import { Lead, Profile } from '@/types/crm';
import { useData } from '@/context/DataContext';
import { Search, Filter, Trash2, ArrowUpDown, ChevronDown, Check, Plus, FileSpreadsheet, Eye, UserPlus } from 'lucide-react';

interface LeadsTableProps {
  leads: Lead[];
  profiles: Profile[];
  onSelectLead: (lead: Lead) => void;
  onOpenAddModal: () => void;
}

export const LeadsTable: React.FC<LeadsTableProps> = ({ leads, profiles, onSelectLead, onOpenAddModal }) => {
  const { updateLead, deleteLead, deleteLeads, currentUser, settings } = useData();
  
  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSource, setSelectedSource] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedCounsellor, setSelectedCounsellor] = useState('All');
  const [selectedCourse, setSelectedCourse] = useState('All');
  const [minNeet, setMinNeet] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  
  // Sorting state
  const [sortField, setSortField] = useState<keyof Lead>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter out leads if counsellor (only see assigned leads)
  const accessibleLeads = leads.filter(l => {
    if (currentUser?.role === 'admin' || currentUser?.role === 'manager') return true;
    return l.assigned_counsellor_id === currentUser?.id;
  });

  // Extract unique sources/statuses/courses for filters
  const sources = ['All', ...Array.from(new Set(accessibleLeads.map(l => l.lead_source)))];
  const statuses = ['All', ...Array.from(new Set(accessibleLeads.map(l => l.status)))];
  const courses = ['All', ...Array.from(new Set(accessibleLeads.map(l => l.course).filter(Boolean) as string[]))];
  const counsellors = profiles;

  // Handle sort toggle
  const handleSort = (field: keyof Lead) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Perform search, filter, and sorting
  const processedLeads = accessibleLeads
    .filter(lead => {
      const matchSearch = 
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone.includes(searchTerm) ||
        (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (lead.preferred_destination && lead.preferred_destination.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchSource = selectedSource === 'All' || lead.lead_source === selectedSource;
      const matchStatus = selectedStatus === 'All' || lead.status === selectedStatus;
      
      const matchCounsellor = 
        selectedCounsellor === 'All' || 
        (selectedCounsellor === 'unassigned' && !lead.assigned_counsellor_id) ||
        lead.assigned_counsellor_id === selectedCounsellor;
        
      const matchNeet = !minNeet || (lead.neet_marks && lead.neet_marks >= parseInt(minNeet));
      const matchBudget = !maxBudget || (lead.budget && lead.budget <= parseFloat(maxBudget) * 100000);
      const matchCourse = selectedCourse === 'All' || lead.course === selectedCourse;

      return matchSearch && matchSource && matchStatus && matchCounsellor && matchNeet && matchBudget && matchCourse;
    })
    .sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle null/undefined values
      if (aVal === undefined || aVal === null) return sortOrder === 'asc' ? 1 : -1;
      if (bVal === undefined || bVal === null) return sortOrder === 'asc' ? -1 : 1;

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal as string) 
          : (bVal as string).localeCompare(aVal);
      } else {
        return sortOrder === 'asc'
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      }
    });

  // Assign lead to counsellor directly from table
  const handleAssignCounsellor = async (leadId: string, counsellorId: string | null) => {
    try {
      await updateLead(leadId, { assigned_counsellor_id: counsellorId });
    } catch (err) {
      console.error("Failed to assign counsellor:", err);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Name', 'Phone', 'Email', 'Parent Contact', 'NEET Marks', 'Budget', 'Destination', 'Course', 'Source', 'Campaign', 'Status', 'Date Captured'];
    const rows = processedLeads.map(l => [
      l.name,
      l.phone,
      l.email || '',
      l.parent_contact || '',
      l.neet_marks || '',
      l.budget || '',
      l.preferred_destination || '',
      l.course || '',
      l.lead_source,
      l.campaign_name || '',
      l.status,
      new Date(l.created_at).toLocaleDateString()
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.map(val => `"${val}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `leads_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bulk Delete action
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.length} selected leads?`)) {
      try {
        await deleteLeads(selectedIds);
        setSelectedIds([]);
      } catch (err) {
        console.error("Failed to bulk delete leads:", err);
      }
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    // Try to find the stage style from settings pipeline stages
    const matchedStage = (settings.pipeline_stages || []).find(s => s.id === status);
    if (matchedStage && matchedStage.color) {
      // In LeadsTable, dynamic stage colors are already fully formatted classes
      return matchedStage.color;
    }
    
    switch (status) {
      case '1st followup':
      case 'New Lead': 
        return 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 border-blue-200/50';
      case 'Discussion stage':
      case 'WhatsApp Initiated': 
        return 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400 border-indigo-200/50';
      case 'Connected to manager':
      case 'Qualified': 
        return 'bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400 border-purple-200/50';
      case 'Documents collected':
        return 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200/50';
      case 'Closed Won': 
        return 'bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400 border-green-200/50';
      case 'Closed Lost': 
        return 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border-rose-200/50';
      default: 
        return 'bg-slate-50 text-slate-600 dark:bg-zinc-950 dark:text-slate-400 border-slate-200/50';
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900/80 rounded-3xl p-6 shadow-sm overflow-hidden">
      
      {/* Controls Header */}
      <div className="flex flex-col xl:flex-row gap-4 justify-between items-stretch xl:items-center mb-6">
        
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search leads by name, phone, email, country..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-zinc-900 rounded-2xl pl-11 pr-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all dark:text-white"
          />
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {selectedIds.length > 0 && (currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
            <button
              onClick={handleBulkDelete}
              className="px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-bold flex items-center gap-2 shadow-md shadow-rose-500/10 transition-all hover:scale-[1.01] active:scale-[0.98] animate-fade-in"
            >
              <Trash2 className="w-4 h-4" /> Delete Selected ({selectedIds.length})
            </button>
          )}

          <button 
            onClick={handleExportCSV}
            className="px-4 py-3 border border-slate-200 dark:border-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-900/50 text-slate-600 dark:text-slate-300 rounded-2xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> CSV Export
          </button>
          
          <button
            onClick={onOpenAddModal}
            className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-500/10 transition-all hover:scale-[1.01] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" /> Add Manual Lead
          </button>
        </div>

      </div>

      {/* Advanced Filters Bar */}
      <div className="bg-slate-50/50 dark:bg-black/30 border border-slate-100 dark:border-zinc-900/50 rounded-2xl p-4 mb-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        
        {/* Source Filter */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Lead Source</label>
          <select 
            value={selectedSource} 
            onChange={(e) => setSelectedSource(e.target.value)}
            className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 text-xs rounded-xl p-2 outline-none dark:text-slate-300"
          >
            {sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Status Stage</label>
          <select 
            value={selectedStatus} 
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 text-xs rounded-xl p-2 outline-none dark:text-slate-300"
          >
            {statuses.map(st => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>

        {/* Assignee Filter (Only Admin can see/filter other counselors) */}
        {currentUser?.role === 'admin' || currentUser?.role === 'manager' ? (
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Counsellor</label>
            <select 
              value={selectedCounsellor} 
              onChange={(e) => setSelectedCounsellor(e.target.value)}
              className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 text-xs rounded-xl p-2 outline-none dark:text-slate-300"
            >
              <option value="All">All Counsellors</option>
              <option value="unassigned">Unassigned</option>
              {counsellors.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
        ) : (
          <div className="opacity-50">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Counsellor</label>
            <input 
              type="text" 
              readOnly 
              value={currentUser?.full_name} 
              className="w-full bg-slate-100 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-900 text-xs rounded-xl p-2 outline-none text-slate-500" 
            />
          </div>
        )}

        {/* Min NEET marks */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Min NEET Score</label>
          <input
            type="number"
            placeholder="e.g. 350"
            value={minNeet}
            onChange={(e) => setMinNeet(e.target.value)}
            className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 text-xs rounded-xl p-2 outline-none dark:text-slate-300"
          />
        </div>

        {/* Max Budget (Lakhs) */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Max Budget (Lakhs)</label>
          <input
            type="number"
            placeholder="e.g. 60"
            value={maxBudget}
            onChange={(e) => setMaxBudget(e.target.value)}
            className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 text-xs rounded-xl p-2 outline-none dark:text-slate-300"
          />
        </div>

        {/* Course Filter */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Course</label>
          <select 
            value={selectedCourse} 
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 text-xs rounded-xl p-2 outline-none dark:text-slate-300"
          >
            {courses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Reset filters */}
        <div className="flex items-end">
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedSource('All');
              setSelectedStatus('All');
              setSelectedCounsellor('All');
              setSelectedCourse('All');
              setMinNeet('');
              setMaxBudget('');
            }}
            className="w-full py-2 border border-dashed border-slate-200 hover:border-slate-300 dark:border-zinc-900 dark:hover:border-zinc-800 text-slate-500 text-xs rounded-xl transition-all font-medium"
          >
            Clear Filters
          </button>
        </div>

      </div>

      {/* Table grid */}
      <div className="overflow-x-auto -mx-6">
        <table className="w-full border-collapse text-left text-sm text-slate-500 dark:text-slate-400">
          <thead>
            <tr className="border-b border-slate-200 dark:border-zinc-900 font-semibold text-xs text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-zinc-950/20">
              {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                <th className="px-6 py-4 w-10">
                  <input
                    type="checkbox"
                    checked={processedLeads.length > 0 && selectedIds.length === processedLeads.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(processedLeads.map(l => l.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                    className="w-4 h-4 text-indigo-600 border-slate-300 dark:border-zinc-800 rounded focus:ring-indigo-500"
                  />
                </th>
              )}
              <th onClick={() => handleSort('name')} className="px-6 py-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200">
                <span className="flex items-center gap-1.5">Name <ArrowUpDown className="w-3.5 h-3.5" /></span>
              </th>
              <th onClick={() => handleSort('neet_marks')} className="px-6 py-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200">
                <span className="flex items-center gap-1.5">NEET <ArrowUpDown className="w-3.5 h-3.5" /></span>
              </th>
              <th onClick={() => handleSort('budget')} className="px-6 py-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200">
                <span className="flex items-center gap-1.5">Budget <ArrowUpDown className="w-3.5 h-3.5" /></span>
              </th>
              <th className="px-6 py-4">Preferred State/Country</th>
              <th onClick={() => handleSort('course')} className="px-6 py-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200">
                <span className="flex items-center gap-1.5">Course <ArrowUpDown className="w-3.5 h-3.5" /></span>
              </th>
              <th className="px-6 py-4 whitespace-nowrap">Lead Source</th>
              <th className="px-6 py-4 whitespace-nowrap">Status</th>
              {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && <th className="px-6 py-4">Counsellor</th>}
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-900/60">
            {processedLeads.length > 0 ? (
              processedLeads.map(lead => {
                const assignee = profiles.find(p => p.id === lead.assigned_counsellor_id);
                const isSelected = selectedIds.includes(lead.id);
                return (
                  <tr 
                    key={lead.id} 
                    className={`hover:bg-slate-50/50 dark:hover:bg-slate-950/10 transition-colors group ${isSelected ? 'bg-slate-50/70 dark:bg-zinc-900/30' : ''}`}
                  >
                    {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                      <td className="px-6 py-4 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(prev => [...prev, lead.id]);
                            } else {
                              setSelectedIds(prev => prev.filter(id => id !== lead.id));
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 border-slate-300 dark:border-zinc-800 rounded focus:ring-indigo-500"
                        />
                      </td>
                    )}
                    {/* Name & Contact */}
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{lead.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{lead.phone}</div>
                    </td>

                    {/* NEET Marks & score */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-700 dark:text-slate-300">{lead.neet_marks || '--'}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="w-8 bg-slate-100 dark:bg-zinc-800 rounded-full h-1">
                          <div 
                            className="bg-indigo-500 h-1 rounded-full" 
                            style={{ width: `${lead.score}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold">{lead.score}</span>
                      </div>
                    </td>

                    {/* Budget */}
                    <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">
                      {lead.budget ? `₹${(lead.budget / 100000).toFixed(1)} Lakh` : '--'}
                    </td>

                    {/* Preferred dest */}
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        {lead.preferred_destination || '--'}
                      </span>
                    </td>

                    {/* Course */}
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50/80 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-100/50 dark:border-indigo-900/30">
                        {lead.course || '--'}
                      </span>
                    </td>
 
                    {/* Lead source badge */}
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-slate-50 dark:bg-zinc-900 dark:text-slate-300 dark:border-zinc-800 border-slate-200 whitespace-nowrap">
                        {lead.lead_source}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border whitespace-nowrap ${getStatusBadgeStyle(lead.status)}`}>
                        {lead.status}
                      </span>
                    </td>

                    {/* Counsellor selection (only admin) */}
                    {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                      <td className="px-6 py-4">
                        <select
                          value={lead.assigned_counsellor_id || ''}
                          onChange={(e) => handleAssignCounsellor(lead.id, e.target.value || null)}
                          className="bg-transparent text-xs text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 rounded-lg p-1 max-w-[140px] focus:outline-none"
                        >
                          <option value="">Unassigned</option>
                          {counsellors.map(c => (
                            <option key={c.id} value={c.id}>{c.full_name.split(' ')[0]}</option>
                          ))}
                        </select>
                      </td>
                    )}

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onSelectLead(lead)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-indigo-500 rounded-lg transition-all"
                          title="View lead file"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete lead: ${lead.name}?`)) {
                                deleteLead(lead.id);
                              }
                            }}
                            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete Lead"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={(currentUser?.role === 'admin' || currentUser?.role === 'manager') ? 10 : 8} className="px-6 py-8 text-center text-slate-400 text-xs">
                  No matching leads found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
