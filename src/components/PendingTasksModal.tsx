"use client";

import React, { useState } from 'react';
import { Task, Lead } from '@/types/crm';
import { useData } from '@/context/DataContext';
import { X, Check, Clock, User, AlertCircle, Search, CheckCircle } from 'lucide-react';

interface PendingTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLead: (lead: Lead, tab?: 'notes' | 'tasks' | 'whatsapp' | 'timeline' | 'checklist') => void;
}

export const PendingTasksModal: React.FC<PendingTasksModalProps> = ({
  isOpen,
  onClose,
  onSelectLead,
}) => {
  const { tasks, leads, toggleTask } = useData();
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  // Filter for pending tasks
  const pendingTasks = tasks.filter(task => !task.is_completed);

  // Filter by search term
  const filteredTasks = pendingTasks.filter(task => {
    const lead = leads.find(l => l.id === task.lead_id);
    const searchLower = searchTerm.toLowerCase();
    const matchesTitle = task.title.toLowerCase().includes(searchLower);
    const matchesLeadName = lead ? lead.name.toLowerCase().includes(searchLower) : false;
    return matchesTitle || matchesLeadName;
  });

  const getDueDateStatus = (dueDateStr?: string) => {
    if (!dueDateStr) return null;
    const dueDate = new Date(dueDateStr);
    const now = new Date();
    if (dueDate < now) {
      return { label: 'Overdue', className: 'bg-rose-500/10 text-rose-500 border border-rose-500/20' };
    }
    return { label: 'Pending', className: 'bg-amber-500/10 text-amber-500 border border-amber-500/20' };
  };

  const handleTaskClick = (task: Task) => {
    const lead = leads.find(l => l.id === task.lead_id);
    if (lead) {
      onSelectLead(lead, 'tasks');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl w-full max-w-lg p-6 shadow-2xl animate-fade-in relative flex flex-col max-h-[85vh]">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" />
            Pending CRM Tasks
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Showing {filteredTasks.length} unresolved action items requiring follow-up.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by task title or student name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>

        {/* Task List container */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-zinc-800">
          {filteredTasks.length > 0 ? (
            filteredTasks.map(task => {
              const lead = leads.find(l => l.id === task.lead_id);
              const statusInfo = getDueDateStatus(task.due_date);
              
              return (
                <div 
                  key={task.id} 
                  className="bg-slate-50/50 dark:bg-zinc-900/35 border border-slate-150 dark:border-zinc-900/70 hover:border-slate-300 dark:hover:border-zinc-800 p-4 rounded-2xl transition-all flex items-start gap-3 group relative"
                >
                  {/* Task toggle button */}
                  <button 
                    onClick={() => toggleTask(task.id)}
                    className="w-5 h-5 rounded-lg border border-slate-300 dark:border-zinc-800 hover:border-emerald-500 dark:hover:border-emerald-500 flex items-center justify-center transition-all bg-white dark:bg-black mt-0.5 flex-shrink-0 group-hover:scale-105"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-500 opacity-0 hover:opacity-100 transition-opacity" />
                  </button>

                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    <button 
                      onClick={() => handleTaskClick(task)}
                      className="text-sm font-semibold text-slate-800 dark:text-slate-200 text-left hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors w-full focus:outline-none"
                    >
                      {task.title}
                    </button>

                    {/* Meta info */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5 text-xs">
                      {lead && (
                        <button
                          onClick={() => handleTaskClick(task)}
                          className="text-indigo-650 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <User className="w-3.5 h-3.5" />
                          Lead: {lead.name}
                        </button>
                      )}

                      {task.due_date && (
                        <span className="text-slate-450 dark:text-slate-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Due: {new Date(task.due_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      )}

                      {statusInfo && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 flex flex-col items-center justify-center gap-3">
              <div className="p-3.5 bg-emerald-500/10 rounded-2xl text-emerald-500">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-white">All Caught Up!</p>
                <p className="text-xs text-slate-450 mt-1 max-w-[240px] mx-auto">
                  {searchTerm ? "No tasks matching your search query." : "No pending follow-ups scheduled."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
