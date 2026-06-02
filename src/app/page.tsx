"use client";

import React, { useState, useEffect } from 'react';
import { DataProvider, useData } from '@/context/DataContext';
import { CRMStats } from '@/components/CRMStats';
import { CRMAnalytics } from '@/components/CRMAnalytics';
import { KanbanBoard } from '@/components/KanbanBoard';
import { LeadsTable } from '@/components/LeadsTable';
import { LeadDetailsModal } from '@/components/LeadDetailsModal';
import { AddLeadModal } from '@/components/AddLeadModal';
import { LoginScreen } from '@/components/LoginScreen';
import { CRMSettings } from '@/components/CRMSettings';
import { WebFormBuilder } from '@/components/WebFormBuilder';
import { 
  Sparkles, Sun, Moon, LogOut, RefreshCw, Layers, Table, BarChart3, 
  HelpCircle, User, ShieldCheck, Flame, Settings, Globe
} from 'lucide-react';

const DashboardContent: React.FC = () => {
  const { 
    currentUser, 
    logout, 
    leads, 
    tasks, 
    profiles, 
    activityLogs, 
    whatsappHistory, 
    switchUser,
    isLoading
  } = useData();

  // Navigation tab
  const [activeView, setActiveView] = useState<'board' | 'list' | 'analytics' | 'settings' | 'forms'>('board');
  
  // Theme state
  const [darkMode, setDarkMode] = useState(true);
  
  // Lead Modals state
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Global lead source filter
  const [activeSourceFilter, setActiveSourceFilter] = useState<string>('All');

  // Derive unique sources from leads dynamically
  const allSources = ['All', ...Array.from(new Set(leads.map(l => l.lead_source).filter(Boolean)))];

  // Source-filtered leads passed to all views
  const filteredLeads = activeSourceFilter === 'All'
    ? leads
    : leads.filter(l => l.lead_source === activeSourceFilter);

  const getSourcePillStyle = (source: string, isActive: boolean) => {
    if (!isActive) return 'bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-900';
    const map: Record<string, string> = {
      'All':              'bg-indigo-600 text-white border-transparent shadow shadow-indigo-500/20',
      'Facebook Ads':     'bg-blue-600 text-white border-transparent shadow shadow-blue-500/20',
      'Instagram Ads':    'bg-pink-600 text-white border-transparent shadow shadow-pink-500/20',
      'Google Ads':       'bg-amber-500 text-white border-transparent shadow shadow-amber-500/20',
      'WhatsApp Campaign':'bg-emerald-600 text-white border-transparent shadow shadow-emerald-500/20',
      'Website Form':     'bg-cyan-600 text-white border-transparent shadow shadow-cyan-500/20',
      'Referral':         'bg-purple-600 text-white border-transparent shadow shadow-purple-500/20',
      'Organic':          'bg-teal-600 text-white border-transparent shadow shadow-teal-500/20',
      'Manual Entry':     'bg-slate-600 text-white border-transparent shadow shadow-slate-500/20',
    };
    return map[source] || 'bg-indigo-600 text-white border-transparent shadow shadow-indigo-500/20';
  };

  // Apply dark mode class to html document or wrapper
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-wider uppercase text-slate-400">Loading Perfect Scholar CRM Engine...</p>
      </div>
    );
  }

  // Redirect to Login if no active user profile session
  if (!currentUser) {
    return <LoginScreen />;
  }

  // Render detail overlay lead (always keep sync)
  const currentSelectedLeadDetails = selectedLead 
    ? leads.find(l => l.id === selectedLead.id) || null
    : null;

  return (
    <div className={`min-h-screen flex flex-col bg-slate-50 dark:bg-black dark:text-white transition-colors duration-300 font-sans`}>
      
      {/* Top Header Navbar */}
      <header className="sticky top-0 z-40 bg-white/70 dark:bg-zinc-950/50 backdrop-blur-xl border-b border-slate-200/80 dark:border-zinc-900/80 px-6 py-4 flex flex-wrap gap-4 items-center justify-between shadow-sm">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <img 
            src={darkMode ? "/logo.png" : "/light.png"} 
            alt="Perfect Scholar Logo" 
            className="h-10 w-auto object-contain" 
          />
          <div>
            <h1 className="font-extrabold text-sm tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-indigo-950 dark:from-white dark:to-slate-350">
              Perfect Scholar Lead Management
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Workspace CRM</p>
          </div>
        </div>


        {/* User profile & settings */}
        <div className="flex items-center gap-3">
          
          {/* Light/Dark Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 border border-slate-200 dark:border-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-xl text-slate-500 dark:text-slate-400 transition-all"
            title="Switch theme"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Active Logged profile display */}
          <div className="flex items-center gap-2 border-l border-slate-200 dark:border-zinc-900 pl-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 text-white flex items-center justify-center text-xs font-bold uppercase">
              {currentUser.full_name.slice(0, 2)}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1">
                {currentUser.full_name}
                {currentUser.role === 'admin' && (
                  <span title="System Administrator">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                  </span>
                )}
              </div>
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{currentUser.role} Account</div>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-slate-400 hover:text-rose-500 transition-all border border-transparent hover:border-rose-100 dark:hover:border-rose-900/30"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>

        </div>

      </header>

      {/* Main Body */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        
        {/* Row 1: KPI Stats widgets */}
        <CRMStats leads={filteredLeads} tasks={tasks} />

        {/* Row 1.5: Lead Source Filter Pills */}
        <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-2 shadow-sm">
          <div className="flex items-center gap-1.5 mr-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
            <Globe className="w-3.5 h-3.5" /> Filter by Source
          </div>
          {allSources.map(source => {
            const count = source === 'All' ? leads.length : leads.filter(l => l.lead_source === source).length;
            const isActive = activeSourceFilter === source;
            return (
              <button
                key={source}
                id={`source-filter-${source.replace(/\s+/g, '-').toLowerCase()}`}
                onClick={() => setActiveSourceFilter(source)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 border ${
                  getSourcePillStyle(source, isActive)
                }`}
              >
                {source}
                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-md text-[10px] font-extrabold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
          {activeSourceFilter !== 'All' && (
            <button
              onClick={() => setActiveSourceFilter('All')}
              className="ml-auto text-[10px] font-semibold text-slate-400 hover:text-rose-500 transition-colors"
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Row 2: Tabs selector bar */}
        <div className="flex flex-wrap gap-2 justify-between items-center border-b border-slate-200 dark:border-zinc-900 pb-2">
          
          <div className="flex overflow-x-auto gap-2 pb-1.5 w-full md:w-auto -mx-6 px-6 md:mx-0 md:px-0">
            <button
              onClick={() => setActiveView('board')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all flex-shrink-0 whitespace-nowrap ${
                activeView === 'board'
                  ? 'bg-indigo-600 text-white shadow shadow-indigo-500/20'
                  : 'bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Pipeline Board
            </button>
            
            <button
              onClick={() => setActiveView('list')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all flex-shrink-0 whitespace-nowrap ${
                activeView === 'list'
                  ? 'bg-indigo-600 text-white shadow shadow-indigo-500/20'
                  : 'bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-900'
              }`}
            >
              <Table className="w-3.5 h-3.5" /> Leads Directory
            </button>

            <button
              onClick={() => setActiveView('analytics')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all flex-shrink-0 whitespace-nowrap ${
                activeView === 'analytics'
                  ? 'bg-indigo-600 text-white shadow shadow-indigo-500/20'
                  : 'bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Source & Performance Analytics
            </button>

            <button
              onClick={() => setActiveView('forms')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all flex-shrink-0 whitespace-nowrap ${
                activeView === 'forms'
                  ? 'bg-indigo-600 text-white shadow shadow-indigo-500/20'
                  : 'bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> Web Forms
            </button>

            <button
              onClick={() => setActiveView('settings')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all flex-shrink-0 whitespace-nowrap ${
                activeView === 'settings'
                  ? 'bg-indigo-600 text-white shadow shadow-indigo-500/20'
                  : 'bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-900'
              }`}
            >
              <Settings className="w-3.5 h-3.5" /> Integrations & Role Settings
            </button>
          </div>

          <div className="text-xs text-slate-400 dark:text-slate-500 font-semibold">
            {activeSourceFilter !== 'All' ? (
              <span>
                <span className="text-indigo-500 font-bold">{filteredLeads.length}</span> of {leads.length} leads
                {' '}• <span className="text-indigo-400">{activeSourceFilter}</span>
              </span>
            ) : (
              <span>{leads.length} Leads captured • {tasks.filter(t => !t.is_completed).length} Pending Tasks</span>
            )}
          </div>

        </div>

        {/* Row 3: Tab Content rendering */}
        <div className="transition-all duration-300">
          
          {activeView === 'board' && (
            <KanbanBoard 
              leads={filteredLeads} 
              profiles={profiles} 
              onSelectLead={setSelectedLead} 
            />
          )}

          {activeView === 'list' && (
            <LeadsTable
              leads={filteredLeads}
              profiles={profiles}
              onSelectLead={setSelectedLead}
              onOpenAddModal={() => setIsAddOpen(true)}
            />
          )}

          {activeView === 'analytics' && (
            <CRMAnalytics
              leads={filteredLeads}
              profiles={profiles}
              whatsappMessages={whatsappHistory}
            />
          )}

          {activeView === 'settings' && (
            <CRMSettings />
          )}

          {activeView === 'forms' && (
            <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm">
              <WebFormBuilder />
            </div>
          )}

        </div>

      </main>

      {/* Slide Drawer: Lead Details */}
      {currentSelectedLeadDetails && (
        <LeadDetailsModal
          lead={currentSelectedLeadDetails}
          onClose={() => setSelectedLead(null)}
          profiles={profiles}
        />
      )}

      {/* Modal: Add Manual Lead */}
      <AddLeadModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        profiles={profiles}
      />

    </div>
  );
};

export default function Home() {
  return (
    <DataProvider>
      <DashboardContent />
    </DataProvider>
  );
}
