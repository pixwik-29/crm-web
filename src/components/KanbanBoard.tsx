"use client";
 
import React, { useState } from 'react';
import { Lead, Profile, PipelineStage, Pipeline } from '@/types/crm';
import { useData } from '@/context/DataContext';
import { Phone, MessageSquare, Tag, Award, User, Flame, Layers } from 'lucide-react';
 
interface KanbanBoardProps {
  leads: Lead[];
  profiles: Profile[];
  onSelectLead: (lead: Lead) => void;
}
 
export const KanbanBoard: React.FC<KanbanBoardProps> = ({ leads, profiles, onSelectLead }) => {
  const { updateLead, currentUser, settings, pipelines, pipelineAccess, activePipeline, setActivePipeline } = useData();
  const stages = [...(activePipeline?.stages || [])].sort((a, b) => a.order - b.order);
  const [draggedOverStage, setDraggedOverStage] = useState<string | null>(null);
 
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
  };
 
  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (draggedOverStage !== stageId) {
      setDraggedOverStage(stageId);
    }
  };
 
  const handleDragLeave = () => {
    setDraggedOverStage(null);
  };
 
  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    setDraggedOverStage(null);
    const leadId = e.dataTransfer.getData('text/plain');
    if (!leadId) return;
 
    try {
      await updateLead(leadId, { status: targetStage });
    } catch (err) {
      console.error("Error updating lead status via drag-drop:", err);
    }
  };
 
  // Get pipelines this user has access to
  const userPipelines = pipelines.filter(p => 
    currentUser?.role === 'admin' || 
    pipelineAccess.some(pa => pa.pipeline_id === p.id && pa.profile_id === currentUser?.id)
  );

  // Filter out leads if active user is counsellor and not admin
  const filteredLeads = leads.filter(l => {
    // Pipeline match: lead pipeline matches active pipeline, or is null and active pipeline is default
    const pipelineMatch = l.pipeline_id === activePipeline?.id || 
                          (l.pipeline_id === null && activePipeline?.is_default);
    
    if (!pipelineMatch) return false;

    if (currentUser?.role === 'admin' || currentUser?.role === 'manager') return true;
    return l.assigned_counsellor_id === currentUser?.id;
  });
 
  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'Facebook Ads': return 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200/50 dark:border-blue-800/40';
      case 'Instagram Ads': return 'bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400 border-pink-200/50 dark:border-pink-800/40';
      case 'Google Ads': return 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200/50 dark:border-amber-800/40';
      case 'WhatsApp Campaign': return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/40';
      case 'Website Form': return 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400 border-cyan-200/50 dark:border-cyan-800/40';
      default: return 'bg-slate-50 text-slate-600 dark:bg-slate-950/40 dark:text-slate-400 border-slate-200/50 dark:border-slate-800/40';
    }
  };
 
  return (
    <div className="space-y-4">
      {/* Pipeline Switcher Banner */}
      <div className="w-full flex flex-wrap gap-4 items-center justify-between bg-white dark:bg-zinc-950 p-4 border border-slate-200 dark:border-zinc-900 rounded-3xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Layers className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-white">Active Lead Pipeline</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-extrabold mt-0.5">Switching lead stages dashboard</p>
          </div>
        </div>
        
        <div>
          {userPipelines.length > 1 ? (
            <select
              value={activePipeline?.id || ''}
              onChange={(e) => {
                const selected = userPipelines.find(p => p.id === e.target.value);
                if (selected) setActivePipeline(selected);
              }}
              className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 cursor-pointer min-w-[220px]"
            >
              {userPipelines.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.is_default ? '(Default)' : ''}
                </option>
              ))}
            </select>
          ) : (
            <span className="inline-flex items-center bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 dark:text-indigo-400 px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm">
              Current: {activePipeline?.name || 'No Pipeline'}
            </span>
          )}
        </div>
      </div>

      {/* Columns Grid */}
      <div className="flex gap-4 overflow-x-auto pb-6 select-none -mx-4 px-4 scrollbar-thin dark:scrollbar-thumb-slate-800 scrollbar-thumb-slate-200">
        {stages.map(stage => {
          const stageLeads = filteredLeads.filter(l => l.status === stage.id);
          const totalBudget = stageLeads.reduce((acc, l) => acc + (l.budget || 0), 0);
 
          return (
            <div
              key={stage.id}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.id)}
              className={`board-column flex-shrink-0 w-80 bg-slate-50/50 dark:bg-zinc-950/20 border rounded-3xl p-4 transition-all duration-200 ${
                draggedOverStage === stage.id 
                  ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/10 scale-[1.01]' 
                  : 'border-slate-200 dark:border-zinc-900'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${stage.color || 'bg-slate-100 border-slate-200 text-slate-700'}`}>
                    {stage.name}
                  </span>
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                    {stageLeads.length}
                  </span>
                </div>
                {totalBudget > 0 && (
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/50 px-2 py-0.5 rounded-md">
                    ₹{(totalBudget / 100000).toFixed(0)}L
                  </span>
                )}
              </div>
 
              {/* Leads List */}
              <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-1 pb-1 scrollbar-thin">
                {stageLeads.length > 0 ? (
                  stageLeads.map(lead => {
                    const counselor = profiles.find(p => p.id === lead.assigned_counsellor_id);
                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onClick={() => onSelectLead(lead)}
                        className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900/80 hover:border-slate-300 dark:hover:border-zinc-800/80 rounded-2xl p-4 shadow-sm hover:shadow transition-all cursor-grab active:cursor-grabbing group hover:-translate-y-0.5 duration-200"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-semibold text-sm text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {lead.name}
                          </h4>
                          {lead.score >= 80 && (
                            <span className="flex-shrink-0" title="High Conversion Score">
                              <Flame className="w-4 h-4 text-orange-500 fill-orange-500 animate-bounce" />
                            </span>
                          )}
                        </div>
                        
                        {lead.course && (
                          <div className="mb-2 flex flex-wrap gap-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50/80 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-100/50 dark:border-indigo-900/30">
                              🎓 {lead.course}
                            </span>
                          </div>
                        )}
 
                        {/* Lead Details Grid */}
                        <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                          {lead.neet_marks && (
                            <div>
                              <span className="text-slate-400 dark:text-slate-500">NEET:</span>{' '}
                              <span className="font-bold text-slate-700 dark:text-slate-300">{lead.neet_marks}</span>
                            </div>
                          )}
                          {lead.budget && (
                            <div>
                              <span className="text-slate-400 dark:text-slate-500">Budget:</span>{' '}
                              <span className="font-semibold text-slate-700 dark:text-slate-300">₹{(lead.budget / 100000).toFixed(0)}L</span>
                            </div>
                          )}
                          {lead.preferred_destination && (
                            <div className="col-span-2 truncate">
                              <span className="text-slate-400 dark:text-slate-500">Target:</span>{' '}
                              <span className="font-medium text-slate-700 dark:text-slate-300">{lead.preferred_destination}</span>
                            </div>
                          )}
                        </div>
 
                        {/* Badges / Footer */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-2">
                          {/* Source badge */}
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${getSourceBadgeColor(lead.lead_source)}`}>
                            {lead.lead_source}
                          </span>
 
                          {/* Counselor Avatar / Indicator */}
                          <div className="flex items-center gap-1.5">
                            {counselor ? (
                              <div 
                                className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[9px] font-extrabold uppercase"
                                title={`Assigned to: ${counselor.full_name}`}
                              >
                                {counselor.full_name.slice(0, 2)}
                              </div>
                            ) : (
                              <div 
                                className="w-5 h-5 rounded-full border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400"
                                title="Unassigned lead"
                              >
                                <User className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-28 border border-dashed border-slate-200 dark:border-slate-800/80 rounded-2xl flex items-center justify-center text-slate-400 text-xs">
                    Empty Stage
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
