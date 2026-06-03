"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Lead, Profile, Note, Task, ActivityLog, WhatsAppMessage } from '@/types/crm';
import { useData } from '@/context/DataContext';
import { X, Send, Phone, MessageCircle, Mail, Plus, Check, Clock, User, FileText, Activity, AlertCircle, Edit, Calendar } from 'lucide-react';

interface LeadDetailsModalProps {
  lead: Lead | null;
  onClose: () => void;
  profiles: Profile[];
}

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

export const LeadDetailsModal: React.FC<LeadDetailsModalProps> = ({ lead, onClose, profiles }) => {
  const { 
    updateLead, 
    notes, 
    addNote, 
    tasks, 
    addTask, 
    toggleTask, 
    activityLogs, 
    whatsappHistory, 
    whatsappTemplates, 
    sendWhatsAppTemplate, 
    sendCustomWhatsApp,
    currentUser,
    settings
  } = useData();

  const [activeTab, setActiveTab] = useState<'notes' | 'tasks' | 'whatsapp' | 'timeline'>('notes');
  
  // Note Form
  const [newNote, setNewNote] = useState('');
  
  // Task Form
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  
  // WhatsApp Custom Message Form
  const [customMsg, setCustomMsg] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  
  // Lead Edit Forms
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNeet, setEditNeet] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [editDest, setEditDest] = useState('');
  const [editCourse, setEditCourse] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editParent, setEditParent] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editFather, setEditFather] = useState('');
  const [editMother, setEditMother] = useState('');
  const [editCounsellor, setEditCounsellor] = useState('');

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Initialize edit fields when lead changes
  useEffect(() => {
    if (lead) {
      setEditName(lead.name);
      setEditPhone(lead.phone);
      setEditNeet(lead.neet_marks ? String(lead.neet_marks) : '');
      setEditBudget(lead.budget ? String(lead.budget) : '');
      setEditDest(lead.preferred_destination || '');
      setEditCourse(lead.course || '');
      setEditStatus(lead.status);
      setEditParent(lead.parent_contact || '');
      setEditWhatsapp(lead.whatsapp_number || '');
      setEditFather(lead.father_number || '');
      setEditMother(lead.mother_number || '');
      setEditCounsellor(lead.assigned_counsellor_id || '');
      setIsEditing(false);
    }
  }, [lead]);

  // Auto-scroll chat history to bottom
  useEffect(() => {
    if (activeTab === 'whatsapp' && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab, whatsappHistory]);

  if (!lead) return null;

  // Filter content related to this specific lead
  const leadNotes = notes.filter(n => n.lead_id === lead.id);
  const leadTasks = tasks.filter(t => t.lead_id === lead.id);
  const leadLogs = activityLogs.filter(log => log.lead_id === lead.id);
  const leadChats = whatsappHistory.filter(c => c.lead_id === lead.id).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const counselor = profiles.find(p => p.id === lead.assigned_counsellor_id);

  // Form handlers
  const handleSaveEdit = async () => {
    try {
      await updateLead(lead.id, {
        name: editName,
        phone: editPhone,
        neet_marks: editNeet ? parseInt(editNeet) : undefined,
        budget: editBudget ? parseFloat(editBudget) : undefined,
        preferred_destination: editDest,
        course: editCourse,
        status: editStatus,
        parent_contact: editParent,
        whatsapp_number: editWhatsapp || undefined,
        father_number: editFather || undefined,
        mother_number: editMother || undefined,
        assigned_counsellor_id: editCounsellor || null
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update lead details:", err);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    await addNote(lead.id, newNote);
    setNewNote('');
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    await addTask(lead.id, newTaskTitle, newTaskDueDate);
    setNewTaskTitle('');
    setNewTaskDueDate('');
  };

  const handleSendWhatsAppTemplate = async () => {
    if (!selectedTemplateId) return;
    await sendWhatsAppTemplate(lead.id, selectedTemplateId);
    setSelectedTemplateId('');
  };

  const handleSendCustomWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMsg.trim()) return;
    await sendCustomWhatsApp(lead.id, customMsg);
    setCustomMsg('');
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white dark:bg-zinc-950 border-l border-slate-200 dark:border-zinc-900 shadow-2xl z-50 flex flex-col transition-all duration-300 animate-slide-in">
      
      {/* Modal Header */}
      <div className="p-6 border-b border-slate-200 dark:border-zinc-900 flex justify-between items-center bg-slate-50 dark:bg-black/40">
        <div>
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Lead Profile</span>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2 mt-1">
            {lead.name}
            <span className="text-xs bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 font-medium px-2 py-0.5 rounded-full">
              ID: {lead.id.slice(-6)}
            </span>
          </h2>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Details Area */}
      <div className="p-6 border-b border-slate-200 dark:border-zinc-900 overflow-y-auto max-h-[30vh]">
        {isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Name</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-zinc-900 rounded-xl p-2 text-xs text-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone</label>
              <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-zinc-900 rounded-xl p-2 text-xs text-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Parent Contact</label>
              <input type="text" value={editParent} onChange={(e) => setEditParent(e.target.value)} className="w-full bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-zinc-900 rounded-xl p-2 text-xs text-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">WhatsApp Number</label>
              <input type="text" value={editWhatsapp} onChange={(e) => setEditWhatsapp(e.target.value)} className="w-full bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-zinc-900 rounded-xl p-2 text-xs text-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Father's Number</label>
              <input type="text" value={editFather} onChange={(e) => setEditFather(e.target.value)} className="w-full bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-zinc-900 rounded-xl p-2 text-xs text-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mother's Number</label>
              <input type="text" value={editMother} onChange={(e) => setEditMother(e.target.value)} className="w-full bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-zinc-900 rounded-xl p-2 text-xs text-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">NEET Marks</label>
              <input type="number" value={editNeet} onChange={(e) => setEditNeet(e.target.value)} className="w-full bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-zinc-900 rounded-xl p-2 text-xs text-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Budget (INR)</label>
              <input type="number" value={editBudget} onChange={(e) => setEditBudget(e.target.value)} className="w-full bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-zinc-900 rounded-xl p-2 text-xs text-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Preferred destination</label>
              <input type="text" value={editDest} onChange={(e) => setEditDest(e.target.value)} className="w-full bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-zinc-900 rounded-xl p-2 text-xs text-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Applied Course</label>
              <select value={editCourse} onChange={(e) => setEditCourse(e.target.value)} className="w-full bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-zinc-900 rounded-xl p-2 text-xs text-slate-800 dark:text-slate-350 outline-none">
                {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pipeline Status</label>
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="w-full bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-zinc-900 rounded-xl p-2 text-xs text-slate-800 dark:text-white">
                {(settings.pipeline_stages || []).map(stage => (
                  <option key={stage.id} value={stage.id}>{stage.name}</option>
                ))}
              </select>
            </div>
            {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned Counsellor</label>
                <select value={editCounsellor} onChange={(e) => setEditCounsellor(e.target.value)} className="w-full bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-zinc-900 rounded-xl p-2 text-xs text-slate-800 dark:text-white">
                  <option value="">Unassigned</option>
                  {profiles.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.role})</option>
                  ))}
                </select>
              </div>
            )}
            <div className="md:col-span-2 flex justify-end gap-2 mt-2">
              <button onClick={() => setIsEditing(false)} className="px-4 py-2 border border-slate-200 dark:border-zinc-900 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800">Cancel</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold">Save Details</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-sm">
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Phone Number</p>
              <p className="font-semibold text-slate-700 dark:text-slate-350 mt-1 flex items-center gap-1.5">
                {lead.phone}
                <a href={`tel:${lead.phone}`} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-blue-500" title="Trigger Call Action"><Phone className="w-3.5 h-3.5" /></a>
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Email Address</p>
              <p className="font-semibold text-slate-700 dark:text-slate-350 mt-1 truncate flex items-center gap-1.5">
                {lead.email || '--'}
                {lead.email && <a href={`mailto:${lead.email}`} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-purple-500" title="Send Email"><Mail className="w-3.5 h-3.5" /></a>}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Parent Contact</p>
              <p className="font-semibold text-slate-700 dark:text-slate-350 mt-1">{lead.parent_contact || '--'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">WhatsApp Number</p>
              <p className="font-semibold text-slate-700 dark:text-slate-350 mt-1 flex items-center gap-1.5">
                {lead.whatsapp_number || '--'}
                {lead.whatsapp_number && <a href={`https://wa.me/${lead.whatsapp_number.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-emerald-500" title="Open WhatsApp"><MessageCircle className="w-3.5 h-3.5" /></a>}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Father's Number</p>
              <p className="font-semibold text-slate-700 dark:text-slate-350 mt-1 flex items-center gap-1.5">
                {lead.father_number || '--'}
                {lead.father_number && <a href={`tel:${lead.father_number}`} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-blue-500" title="Call Father"><Phone className="w-3.5 h-3.5" /></a>}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Mother's Number</p>
              <p className="font-semibold text-slate-700 dark:text-slate-350 mt-1 flex items-center gap-1.5">
                {lead.mother_number || '--'}
                {lead.mother_number && <a href={`tel:${lead.mother_number}`} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-blue-500" title="Call Mother"><Phone className="w-3.5 h-3.5" /></a>}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">NEET score</p>
              <p className="font-semibold text-slate-700 dark:text-slate-350 mt-1">{lead.neet_marks ? `${lead.neet_marks} Marks` : '--'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Course Budget</p>
              <p className="font-semibold text-slate-700 dark:text-slate-350 mt-1">{lead.budget ? `₹${(lead.budget / 100000).toFixed(1)} Lakh` : '--'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Target Country/State</p>
              <p className="font-semibold text-slate-700 dark:text-slate-350 mt-1">{lead.preferred_destination || '--'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Applied Course</p>
              <p className="font-semibold text-slate-700 dark:text-slate-350 mt-1">{lead.course || '--'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Lead Source</p>
              <p className="mt-1"><span className="text-[10px] font-bold px-2 py-0.5 border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-950/30 text-slate-500 dark:text-slate-400">{lead.lead_source}</span></p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Counsellor Assigned</p>
              <p className="font-semibold text-slate-700 dark:text-slate-350 mt-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {counselor ? counselor.full_name : <span className="text-slate-400 italic">Unassigned</span>}
              </p>
            </div>
            <div className="flex items-end">
              <button 
                onClick={() => setIsEditing(true)} 
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 flex items-center gap-1 hover:underline"
              >
                <Edit className="w-3.5 h-3.5" /> Edit Profile Details
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto scrollbar-none border-b border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-semibold">
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex-1 flex-shrink-0 whitespace-nowrap px-4 py-3.5 flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === 'notes'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4 text-slate-450 dark:text-slate-400" /> Internal Notes ({leadNotes.length})
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex-1 flex-shrink-0 whitespace-nowrap px-4 py-3.5 flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === 'tasks'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4 text-slate-450 dark:text-slate-400" /> Tasks ({leadTasks.filter(t => !t.is_completed).length})
        </button>
        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`flex-1 flex-shrink-0 whitespace-nowrap px-4 py-3.5 flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === 'whatsapp'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <MessageCircle className="w-4 h-4 text-slate-450 dark:text-slate-400" /> Send WhatsApp
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex-1 flex-shrink-0 whitespace-nowrap px-4 py-3.5 flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === 'timeline'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4 text-slate-450 dark:text-slate-400" /> Activity Log
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-black/20">
        
        {/* TAB: NOTES */}
        {activeTab === 'notes' && (
          <div className="space-y-6">
            
            {/* Note input */}
            <form onSubmit={handleAddNote} className="flex gap-2">
              <input
                type="text"
                placeholder="Type team member note (e.g. parent is worried about budget)"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="flex-1 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-2xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all dark:text-white"
              />
              <button 
                type="submit"
                className="px-5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl text-xs transition-all shadow-md shadow-indigo-500/10 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Note
              </button>
            </form>

            {/* Note list */}
            <div className="space-y-4">
              {leadNotes.length > 0 ? (
                leadNotes.map(note => {
                  const author = profiles.find(p => p.id === note.author_id);
                  return (
                    <div key={note.id} className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-900/80 rounded-2xl p-4 shadow-sm">
                      <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {author?.full_name || 'System'}
                        </span>
                        <span>{new Date(note.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                        {note.content}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">No internal notes captured yet</div>
              )}
            </div>
          </div>
        )}

        {/* TAB: TASKS */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            
            {/* Task input */}
            <form onSubmit={handleAddTask} className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 p-4 rounded-2xl space-y-3">
              <input
                type="text"
                placeholder="Schedule follow-up task (e.g. call back to discuss tuition fees)"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="w-full bg-slate-50 dark:bg-black/50 border border-slate-100 dark:border-zinc-900 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all dark:text-white"
              />
              <div className="flex gap-2 items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>Due Date:</span>
                  <input
                    type="datetime-local"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="bg-transparent border border-slate-200 dark:border-zinc-900 rounded-lg p-1 text-slate-600 dark:text-slate-400 focus:outline-none"
                  />
                </div>
                
                <button 
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs shadow-md transition-all flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Schedule Task
                </button>
              </div>
            </form>

            {/* Task list */}
            <div className="space-y-3">
              {leadTasks.length > 0 ? (
                leadTasks.map(task => (
                  <div 
                    key={task.id} 
                    className={`border rounded-2xl p-4 flex justify-between items-center transition-all ${
                      task.is_completed
                        ? 'bg-slate-50/80 dark:bg-black/40 border-slate-200/50 dark:border-zinc-900 opacity-60'
                        : 'bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-900/80 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button 
                        onClick={() => toggleTask(task.id)}
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                          task.is_completed
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-slate-300 dark:border-slate-700 hover:border-indigo-500 bg-transparent'
                        }`}
                      >
                        {task.is_completed && <Check className="w-3.5 h-3.5" />}
                      </button>
                      <div>
                        <p className={`text-sm font-semibold ${task.is_completed ? 'line-through text-slate-400 dark:text-slate-600' : 'text-slate-800 dark:text-slate-250'}`}>
                          {task.title}
                        </p>
                        {task.due_date && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-1 font-medium">
                            <Clock className="w-3 h-3" />
                            Due: {new Date(task.due_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">No pending follow-ups scheduled</div>
              )}
            </div>
          </div>
        )}

        {/* TAB: WHATSAPP */}
        {activeTab === 'whatsapp' && (
          <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden bg-slate-950/40 p-6 space-y-4">
            
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Select a template to send directly to the lead via the WhatsApp Desktop app or Web.
            </div>

            {/* Template Selector */}
            <div className="flex gap-2 items-center">
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm rounded-xl p-3 outline-none text-slate-700 dark:text-slate-300"
              >
                <option value="">-- Choose WhatsApp Template --</option>
                {whatsappTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button
                onClick={handleSendWhatsAppTemplate}
                disabled={!selectedTemplateId}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4" /> Send Template
              </button>
            </div>
          </div>
        )}

        {/* TAB: TIMELINE */}
        {activeTab === 'timeline' && (
          <div className="relative pl-6 border-l-2 border-slate-200 dark:border-zinc-900 space-y-6">
            {leadLogs.length > 0 ? (
              leadLogs.map(log => {
                const actor = profiles.find(p => p.id === log.actor_id);
                return (
                  <div key={log.id} className="relative">
                    {/* timeline marker */}
                    <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-indigo-500 border-4 border-slate-100 dark:border-black"></div>
                    
                    <div className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-900/80 rounded-2xl p-4 shadow-sm">
                      <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {log.action_type.toUpperCase().replace('_', ' ')}
                        </span>
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                        {log.description}
                      </p>
                      <div className="text-[10px] text-slate-400 mt-2 font-medium">
                        By: {actor?.full_name || 'System Auto'}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs -ml-6">No operations logged yet</div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
