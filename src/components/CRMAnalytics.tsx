"use client";

import React, { useState, useEffect } from 'react';
import { Lead, Profile, WhatsAppMessage } from '@/types/crm';
import { useData } from '@/context/DataContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { PieChart as PieIcon, BarChart2, TrendingUp, HelpCircle } from 'lucide-react';

interface CRMAnalyticsProps {
  leads: Lead[];
  profiles: Profile[];
  whatsappMessages: WhatsAppMessage[];
}

export const CRMAnalytics: React.FC<CRMAnalyticsProps> = ({ leads, profiles, whatsappMessages }) => {
  const { settings } = useData();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-96 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl animate-pulse flex items-center justify-center text-slate-400">
        Loading analytics charts...
      </div>
    );
  }

  // 1. Lead Source Distribution
  // Find which stages are qualified/active:
  // Dynamically: any stage that is not the first stage and not Closed Won / Closed Lost
  const stages = settings?.pipeline_stages || [];
  const firstStageId = stages.length > 0 ? stages.sort((a, b) => a.order - b.order)[0].id : '1st followup';
  const qualifiedStageIds = stages.length > 0 
    ? stages.filter(s => s.id !== firstStageId && s.id !== 'Closed Won' && s.id !== 'Closed Lost').map(s => s.id)
    : ['Discussion stage', 'Connected to manager', 'Documents collected'];

  const sourcesMap: { [key: string]: { count: number; qualified: number; closed: number } } = {};
  leads.forEach(l => {
    const src = l.lead_source || 'Manual Entry';
    if (!sourcesMap[src]) {
      sourcesMap[src] = { count: 0, qualified: 0, closed: 0 };
    }
    sourcesMap[src].count += 1;
    if (qualifiedStageIds.includes(l.status)) {
      sourcesMap[src].qualified += 1;
    }
    if (l.status === 'Closed Won') {
      sourcesMap[src].closed += 1;
    }
  });

  const sourceData = Object.entries(sourcesMap).map(([name, val]) => ({
    name,
    Leads: val.count,
    Qualified: val.qualified,
    Admissions: val.closed,
    conversionRate: val.count > 0 ? Math.round((val.closed / val.count) * 100) : 0
  })).sort((a, b) => b.Leads - a.Leads);

  // 2. Campaign Wise Analytics
  const campaignsMap: { [key: string]: { count: number; closed: number } } = {};
  leads.forEach(l => {
    if (l.campaign_name) {
      const camp = l.campaign_name;
      if (!campaignsMap[camp]) campaignsMap[camp] = { count: 0, closed: 0 };
      campaignsMap[camp].count += 1;
      if (l.status === 'Closed Won') campaignsMap[camp].closed += 1;
    }
  });

  const campaignData = Object.entries(campaignsMap)
    .map(([name, val]) => ({
      name: name.length > 25 ? name.substring(0, 22) + '...' : name,
      Leads: val.count,
      Conversions: val.closed,
      rate: val.count > 0 ? Math.round((val.closed / val.count) * 100) : 0
    }))
    .sort((a, b) => b.Leads - a.Leads)
    .slice(0, 5); // top 5 campaigns

  // 3. Counsellor Performance
  const counsellors = profiles.filter(p => p.role === 'counsellor');
  const counsellorData = counsellors.map(c => {
    const assignedLeads = leads.filter(l => l.assigned_counsellor_id === c.id);
    const total = assignedLeads.length;
    const closed = assignedLeads.filter(l => l.status === 'Closed Won').length;
    const qualified = assignedLeads.filter(l => 
      qualifiedStageIds.includes(l.status)
    ).length;

    return {
      name: c.full_name.split(' ')[0], // First name
      Leads: total,
      Qualified: qualified,
      Closed: closed,
      rate: total > 0 ? Math.round((closed / total) * 100) : 0
    };
  });

  // 4. WhatsApp Message History Analytics
  const outgoingCount = whatsappMessages.filter(m => m.direction === 'outgoing').length;
  const incomingCount = whatsappMessages.filter(m => m.direction === 'incoming').length;
  const statusRead = whatsappMessages.filter(m => m.status === 'read').length;
  const statusDelivered = whatsappMessages.filter(m => m.status === 'delivered').length;
  const statusSent = whatsappMessages.filter(m => m.status === 'sent').length;

  const whatsappStatusData = [
    { name: 'Read', value: statusRead },
    { name: 'Delivered', value: statusDelivered },
    { name: 'Sent', value: statusSent }
  ].filter(d => d.value > 0);

  // Pie chart colors
  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

  return (
    <div className="space-y-8">
      
      {/* Upper Analytics Row (Sources and Counsellor Performance) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Lead Sources Performance */}
        <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <PieIcon className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-slate-800 dark:text-white">Leads and Admissions by Source</h3>
          </div>
          <div className="h-80">
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                      borderRadius: '16px', 
                      border: 'none',
                      color: 'white',
                      fontSize: '12px'
                    }} 
                  />
                  <Legend verticalAlign="top" height={36} fontSize={11} />
                  <Bar dataKey="Leads" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Qualified" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Admissions" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">No leads data available</div>
            )}
          </div>
        </div>

        {/* Counsellor Conversion Performance */}
        <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <h3 className="font-semibold text-slate-800 dark:text-white">Counsellor Conversion Tracking</h3>
          </div>
          <div className="h-80">
            {counsellorData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={counsellorData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} unit="%" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                      borderRadius: '16px', 
                      border: 'none',
                      color: 'white',
                      fontSize: '12px'
                    }}
                  />
                  <Legend verticalAlign="top" height={36} fontSize={11} />
                  <Bar dataKey="rate" name="Conversion Rate (%)" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  <Bar dataKey="Leads" name="Total Assigned Leads" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">No counsellor performance data available</div>
            )}
          </div>
        </div>

      </div>

      {/* Lower Analytics Row (Campaign and WhatsApp Performance) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Best Performing Campaigns */}
        <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <BarChart2 className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-slate-800 dark:text-white">Top 5 Campaigns by Conversions</h3>
          </div>
          <div className="h-80">
            {campaignData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={campaignData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                  <XAxis type="number" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis type="category" dataKey="name" stroke="#94A3B8" fontSize={10} width={120} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                      borderRadius: '16px', 
                      border: 'none',
                      color: 'white',
                      fontSize: '12px'
                    }}
                  />
                  <Legend verticalAlign="top" height={36} fontSize={11} />
                  <Bar dataKey="Leads" fill="#6366F1" radius={[0, 4, 4, 0]} barSize={12} />
                  <Bar dataKey="Conversions" fill="#10B981" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">No campaigns metrics available</div>
            )}
          </div>
        </div>

        {/* WhatsApp & Engagement Stats */}
        <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <HelpCircle className="w-5 h-5 text-purple-500" />
            <h3 className="font-semibold text-slate-800 dark:text-white">WhatsApp & Engagement Analytics</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-80">
            
            {/* Quick Metrics */}
            <div className="flex flex-col justify-center gap-4 bg-slate-50 dark:bg-black p-6 rounded-2xl border border-slate-100 dark:border-zinc-900">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Total Chats Initiated</p>
                <h4 className="text-3xl font-extrabold text-slate-800 dark:text-white mt-1">{whatsappMessages.length}</h4>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-4">
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase">Incoming</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-white">{incomingCount}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase">Outgoing</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-white">{outgoingCount}</p>
                </div>
              </div>
            </div>

            {/* Read/Delivered status */}
            <div className="h-full flex items-center justify-center">
              {whatsappStatusData.length > 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <div className="w-full h-4/5">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={whatsappStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {whatsappStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Custom legend */}
                  <div className="flex gap-4 text-xs font-medium text-slate-500">
                    {whatsappStatusData.map((item, idx) => (
                      <span key={idx} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                        {item.name}: {item.value}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 text-xs">No WhatsApp interactions logged</div>
              )}
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
