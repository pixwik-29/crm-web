"use client";

import React from 'react';
import { Lead, Task } from '@/types/crm';
import { useData } from '@/context/DataContext';
import { Users, UserCheck, Award, Clock } from 'lucide-react';

interface CRMStatsProps {
  leads: Lead[];
  tasks: Task[];
}

export const CRMStats: React.FC<CRMStatsProps> = ({ leads, tasks }) => {
  const { settings } = useData();
  const totalLeads = leads.length;
  
  // Find which stages are qualified/active:
  // Dynamically: any stage that is not the first stage and not Closed Won / Closed Lost
  const stages = settings?.pipeline_stages || [];
  const firstStageId = stages.length > 0 ? stages.sort((a, b) => a.order - b.order)[0].id : '1st followup';
  const qualifiedStageIds = stages.length > 0 
    ? stages.filter(s => s.id !== firstStageId && s.id !== 'Closed Won' && s.id !== 'Closed Lost').map(s => s.id)
    : ['Discussion stage', 'Connected to manager', 'Documents collected'];

  const qualifiedLeads = leads.filter(l => 
    qualifiedStageIds.includes(l.status)
  ).length;

  const admissionsClosed = leads.filter(l => l.status === 'Closed Won').length;

  const pendingFollowups = tasks.filter(t => !t.is_completed).length;

  const stats = [
    {
      title: 'Total Leads',
      value: totalLeads,
      icon: Users,
      color: 'from-blue-500 to-indigo-500 shadow-blue-500/10',
      textColor: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      percentage: totalLeads > 0 ? '+12% from last week' : 'No data yet'
    },
    {
      title: 'Qualified Leads',
      value: qualifiedLeads,
      icon: UserCheck,
      color: 'from-amber-500 to-orange-500 shadow-amber-500/10',
      textColor: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      percentage: totalLeads > 0 ? `${Math.round((qualifiedLeads / totalLeads) * 100)}% Qualification Rate` : '0%'
    },
    {
      title: 'Admissions Closed',
      value: admissionsClosed,
      icon: Award,
      color: 'from-emerald-500 to-teal-500 shadow-emerald-500/10',
      textColor: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      percentage: totalLeads > 0 ? `${Math.round((admissionsClosed / totalLeads) * 100)}% Conversion Rate` : '0%'
    },
    {
      title: 'Pending Tasks',
      value: pendingFollowups,
      icon: Clock,
      color: 'from-rose-500 to-pink-500 shadow-rose-500/10',
      textColor: 'text-rose-500',
      bgColor: 'bg-rose-500/10',
      percentage: 'Requires attention today'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <div 
            key={idx} 
            className="relative overflow-hidden bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 transition-all duration-300 hover:shadow-xl dark:hover:shadow-slate-950/20 hover:scale-[1.01] hover:-translate-y-0.5 group"
          >
            {/* Hover visual accent */}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-[0.03] rounded-bl-full transition-opacity duration-300`}></div>
            
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{stat.title}</p>
                <h3 className="text-3xl font-extrabold text-slate-800 dark:text-white mt-3 tracking-tight">{stat.value}</h3>
              </div>
              <div className={`p-3.5 rounded-2xl ${stat.bgColor} ${stat.textColor} transition-all duration-300 group-hover:scale-110 shadow-sm`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-4 text-xs font-medium text-slate-400 dark:text-slate-500">
              <span className={`px-2 py-0.5 rounded-md ${stat.bgColor} ${stat.textColor}`}>
                Live
              </span>
              <span>{stat.percentage}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
