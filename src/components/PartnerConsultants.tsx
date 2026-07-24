import React, { useState, useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { 
  Search, Users, MessageSquare, Send, CheckCircle2, AlertCircle, 
  Phone, Mail, Award, ShieldAlert, Check, Play, Filter, X, ChevronDown, ChevronUp, ChevronRight
} from 'lucide-react';

export const PartnerConsultants: React.FC = () => {
  const { 
    partnerUsers, 
    partners, 
    whatsappTemplates, 
    tenantId,
    isConfigured
  } = useData();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgencyId, setSelectedAgencyId] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');

  // Multi-select State
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Accordion expansion state for parent consultant agency rows
  const [expandedAgencyIds, setExpandedAgencyIds] = useState<string[]>([]);

  const toggleAgencyExpand = (partnerId: string) => {
    setExpandedAgencyIds(prev => 
      prev.includes(partnerId) ? prev.filter(id => id !== partnerId) : [...prev, partnerId]
    );
  };

  // Bulk Broadcast Modal State
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [variableMappings, setVariableMappings] = useState<string[]>([]);
  const [customTextMessage, setCustomTextMessage] = useState('');
  const [isCustomMessage, setIsCustomMessage] = useState(false);

  // Status logs
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Map agency ID to agency details for fast lookups
  const agencyMap = useMemo(() => {
    return new Map(partners.map(p => [p.id, p]));
  }, [partners]);

  // Roles formatting helper
  const formatRole = (role: string) => {
    switch (role) {
      case 'super_admin': return 'Super Admin';
      case 'partner_manager': return 'Partner Manager';
      case 'consultant_agency': return 'Agency Principal';
      case 'consultant_staff': return 'Consultant Staff';
      case 'regional_partner': return 'Regional Partner';
      default: return role.replace(/_/g, ' ');
    }
  };

  // Separate staff users and primary consultant users
  const staffUsers = useMemo(() => {
    return partnerUsers.filter(u => u.role === 'consultant_staff');
  }, [partnerUsers]);

  const staffByPartnerId = useMemo(() => {
    const map = new Map<string, typeof partnerUsers>();
    staffUsers.forEach(staff => {
      const existing = map.get(staff.partner_id) || [];
      existing.push(staff);
      map.set(staff.partner_id, existing);
    });
    return map;
  }, [staffUsers]);

  const primaryConsultants = useMemo(() => {
    return partnerUsers.filter(u => u.role !== 'consultant_staff');
  }, [partnerUsers]);

  // Filtered primary consultants list (also matching if search query matches any nested staff)
  const filteredPrimaryConsultants = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return primaryConsultants.filter(user => {
      const agency = agencyMap.get(user.partner_id);
      const agencyName = agency?.business_name || '';
      const partnerStaff = staffByPartnerId.get(user.partner_id) || [];
      
      const matchesStaffSearch = query ? partnerStaff.some(s => 
        s.full_name.toLowerCase().includes(query) || 
        (s.email && s.email.toLowerCase().includes(query)) ||
        (s.phone && s.phone.includes(query))
      ) : false;

      const matchesSearch = 
        !query ||
        user.full_name.toLowerCase().includes(query) ||
        (user.email && user.email.toLowerCase().includes(query)) ||
        agencyName.toLowerCase().includes(query) ||
        matchesStaffSearch;

      const matchesAgency = selectedAgencyId === 'all' || user.partner_id === selectedAgencyId;
      const matchesRole = selectedRole === 'all' || user.role === selectedRole;

      return matchesSearch && matchesAgency && matchesRole;
    });
  }, [primaryConsultants, agencyMap, staffByPartnerId, searchQuery, selectedAgencyId, selectedRole]);

  // All selectable users (primary consultants + matching staff under expanded/filtered primary consultants)
  const allSelectableUsers = useMemo(() => {
    const users: typeof partnerUsers = [...filteredPrimaryConsultants];
    filteredPrimaryConsultants.forEach(p => {
      const staff = staffByPartnerId.get(p.partner_id) || [];
      users.push(...staff);
    });
    return users;
  }, [filteredPrimaryConsultants, staffByPartnerId]);

  // Selected consultants details for the broadcast modal
  const selectedConsultantsInfo = useMemo(() => {
    return partnerUsers.filter(u => selectedUserIds.includes(u.id));
  }, [partnerUsers, selectedUserIds]);

  // Checkbox handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedUserIds(allSelectableUsers.map(u => u.id));
    } else {
      setSelectedUserIds([]);
    }
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  // Template select side-effect
  const handleTemplateChange = (templateName: string) => {
    setSelectedTemplateName(templateName);
    if (!templateName) {
      setVariableMappings([]);
      return;
    }
    const template = whatsappTemplates.find(t => t.name === templateName);
    if (template) {
      const matches = template.body.match(/\{\{[\w\d_]+\}\}/g) || [];
      setVariableMappings(Array(matches.length).fill(''));
    }
  };

  // Trigger broadcast dispatch
  const handleSendBroadcast = async () => {
    if (selectedConsultantsInfo.length === 0) return;
    if (!isCustomMessage && !selectedTemplateName) {
      setErrorMsg('Please select a template.');
      return;
    }
    if (isCustomMessage && !customTextMessage.trim()) {
      setErrorMsg('Please write a message.');
      return;
    }

    setIsSending(true);
    setErrorMsg(null);
    setStatusMsg('Sending bulk WhatsApp messages to consultants...');

    let successCount = 0;
    let failedCount = 0;

    for (const user of selectedConsultantsInfo) {
      const agency = agencyMap.get(user.partner_id);
      const targetPhone = agency?.whatsapp_number || agency?.phone;

      if (!targetPhone) {
        failedCount++;
        continue;
      }

      try {
        const payload: any = {
          to: targetPhone,
          tenantId,
        };

        if (isCustomMessage) {
          payload.type = 'text';
          // Replace name variable dynamically if present in custom text e.g. {name}
          payload.text = customTextMessage.replace(/{name}/g, user.full_name);
        } else {
          payload.type = 'template';
          payload.templateName = selectedTemplateName;
          // Build variable values: replace placeholder index with actual values or fallback to name
          payload.variables = variableMappings.map((val, idx) => {
            if (val === 'name') return user.full_name;
            if (val === 'email') return user.email || '';
            if (val === 'agency') return agency?.business_name || '';
            return val || user.full_name;
          });
        }

        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          successCount++;
        } else {
          failedCount++;
        }
      } catch (err) {
        failedCount++;
      }
    }

    setIsSending(false);
    if (failedCount === 0) {
      setStatusMsg(`🎉 Successfully dispatched WhatsApp messages to all ${successCount} consultants!`);
      setSelectedUserIds([]);
      setTimeout(() => {
        setIsBroadcastModalOpen(false);
        setStatusMsg(null);
      }, 3000);
    } else {
      setStatusMsg(null);
      setErrorMsg(`Completed with issues: ${successCount} sent, ${failedCount} failed (missing phone numbers or API error).`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header card banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-[-30%] right-[-5%] w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">Partner Consultants &amp; Staff</h2>
            <p className="text-xs text-indigo-100 font-medium mt-1">
              Directory of active consultants registered across your referral network agencies. Track roles and dispatch messages.
            </p>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-6">
        
        {/* Filters and Actions Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left search/filters */}
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, agency..." 
                className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select 
                value={selectedAgencyId} 
                onChange={(e) => setSelectedAgencyId(e.target.value)}
                className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-700 dark:text-slate-350 outline-none focus:border-indigo-500 font-bold"
              >
                <option value="all">All Agencies</option>
                {partners.map(p => (
                  <option key={p.id} value={p.id}>{p.business_name}</option>
                ))}
              </select>

              <select 
                value={selectedRole} 
                onChange={(e) => setSelectedRole(e.target.value)}
                className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-700 dark:text-slate-350 outline-none focus:border-indigo-500 font-bold"
              >
                <option value="all">All Roles</option>
                <option value="consultant_agency">Agency Principal</option>
                <option value="consultant_staff">Consultant Staff</option>
                <option value="partner_manager">Partner Manager</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          </div>

          {/* Right bulk actions */}
          {selectedUserIds.length > 0 && (
            <div className="flex items-center gap-3 animate-fade-in">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-2 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                {selectedUserIds.length} Selected
              </span>
              <button 
                onClick={() => {
                  setErrorMsg(null);
                  setStatusMsg(null);
                  setIsBroadcastModalOpen(true);
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 cursor-pointer border-none shadow-md shadow-emerald-600/10"
              >
                <Send className="w-3.5 h-3.5" /> Send Bulk Broadcast
              </button>
            </div>
          )}

        </div>

        {/* Directory Table */}
        <div className="border border-slate-200 dark:border-zinc-900 rounded-2xl overflow-hidden bg-white dark:bg-zinc-950">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-black/30 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 border-b border-slate-200 dark:border-zinc-900">
                  <th className="p-4 w-12 text-center">
                    <input 
                      type="checkbox"
                      checked={allSelectableUsers.length > 0 && selectedUserIds.length === allSelectableUsers.length}
                      onChange={handleSelectAll}
                      className="cursor-pointer"
                    />
                  </th>
                  <th className="p-4">Consultant / Agency</th>
                  <th className="p-4">Partner Agency</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Agency Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-900 text-xs">
                {filteredPrimaryConsultants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                      No consultants found in directory. Ensure they are invited or registered on the partner portal.
                    </td>
                  </tr>
                ) : (
                  filteredPrimaryConsultants.map(user => {
                    const agency = agencyMap.get(user.partner_id);
                    const isSelected = selectedUserIds.includes(user.id);
                    const contactPhone = agency?.whatsapp_number || agency?.phone || '--';
                    const partnerStaff = staffByPartnerId.get(user.partner_id) || [];
                    const isExpanded = expandedAgencyIds.includes(user.partner_id) || (searchQuery.trim() !== '' && partnerStaff.some(s => s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase()))));

                    return (
                      <React.Fragment key={user.id}>
                        <tr 
                          className={`hover:bg-slate-50/30 dark:hover:bg-zinc-900/20 transition-all ${
                            isSelected ? 'bg-indigo-50/10 dark:bg-indigo-950/5' : ''
                          }`}
                        >
                          <td className="p-4 text-center">
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectUser(user.id)}
                              className="cursor-pointer"
                            />
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-extrabold flex items-center justify-center text-xs border border-indigo-100/50 dark:border-indigo-900/50 uppercase flex-shrink-0">
                                {user.full_name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-extrabold text-slate-800 dark:text-white leading-normal">{user.full_name}</p>
                                {user.email && (
                                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5 flex items-center gap-1">
                                    <Mail className="w-3 h-3 text-slate-350" /> {user.email}
                                  </p>
                                )}
                                {partnerStaff.length > 0 && (
                                  <button 
                                    onClick={() => toggleAgencyExpand(user.partner_id)}
                                    className="mt-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-md font-bold text-[10px] inline-flex items-center gap-1 border border-indigo-100 dark:border-indigo-900/40 cursor-pointer transition-all"
                                  >
                                    <Users className="w-3 h-3" />
                                    <span>{partnerStaff.length} Staff Member{partnerStaff.length === 1 ? '' : 's'}</span>
                                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            {agency ? (
                              <div>
                                <span className="font-bold text-slate-700 dark:text-zinc-300 block">{agency.business_name}</span>
                                <span className={`inline-block text-[9px] font-extrabold px-1.5 py-0.5 rounded-full mt-1 border ${
                                  agency.status === 'active' 
                                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30'
                                    : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30'
                                }`}>
                                  {agency.status || 'Pending'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">No Agency Mapped</span>
                            )}
                          </td>
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-black/30 text-slate-600 dark:text-zinc-400 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-zinc-800/40 font-bold text-[10px]">
                              <Award className="w-3.5 h-3.5 text-indigo-400" />
                              {formatRole(user.role)}
                            </span>
                          </td>
                          <td className="p-4">
                            {contactPhone !== '--' ? (
                              <div className="space-y-1">
                                <span className="font-semibold text-slate-700 dark:text-zinc-355 block flex items-center gap-1">
                                  <Phone className="w-3.5 h-3.5 text-emerald-500" /> {contactPhone}
                                </span>
                                {agency?.whatsapp_number && (
                                  <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 px-1.5 py-0.5 rounded-md inline-block">
                                    WhatsApp Active
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">No phone configured</span>
                            )}
                          </td>
                        </tr>

                        {isExpanded && partnerStaff.length > 0 && (
                          <tr key={`staff-nest-${user.id}`}>
                            <td colSpan={5} className="bg-slate-50/50 dark:bg-zinc-950/60 p-3 border-b border-slate-200/60 dark:border-zinc-900">
                              <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2.5 shadow-sm">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-zinc-800/60">
                                  <span className="text-[11px] font-extrabold text-slate-700 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-indigo-500" /> Staff & Team Members under {agency?.business_name || user.full_name}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400">
                                    {partnerStaff.length} Onboarded Account{partnerStaff.length === 1 ? '' : 's'}
                                  </span>
                                </div>
                                <div className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                                  {partnerStaff.map(staff => {
                                    const isStaffSelected = selectedUserIds.includes(staff.id);
                                    return (
                                      <div key={staff.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                                        <div className="flex items-center gap-2.5">
                                          <input 
                                            type="checkbox"
                                            checked={isStaffSelected}
                                            onChange={() => handleSelectUser(staff.id)}
                                            className="cursor-pointer"
                                          />
                                          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-bold flex items-center justify-center text-[10px] uppercase">
                                            {staff.full_name.charAt(0)}
                                          </div>
                                          <div>
                                            <span className="font-bold text-slate-800 dark:text-white block">{staff.full_name}</span>
                                            {staff.email && (
                                              <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono block">{staff.email}</span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-[9px] font-extrabold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-2 py-0.5 rounded border border-slate-200/50 dark:border-zinc-700/50">
                                            Consultant Staff
                                          </span>
                                          <span className="text-[9px] font-extrabold bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded border border-rose-100/50 dark:border-rose-900/30">
                                            Commissions (Hidden)
                                          </span>
                                          {staff.phone && (
                                            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                              <Phone className="w-3 h-3 text-slate-400" /> {staff.phone}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Bulk Broadcast Modal */}
      {isBroadcastModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-3xl w-full max-w-lg p-6 shadow-2xl animate-scale-up space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-900 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-white">Broadcast to Consultants</h3>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Send bulk template or custom message to {selectedConsultantsInfo.length} contact(s)</p>
                </div>
              </div>
              <button 
                onClick={() => setIsBroadcastModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-all cursor-pointer border-none bg-transparent text-slate-400 hover:text-slate-800 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Type selector toggle */}
            <div className="flex rounded-xl bg-slate-100 dark:bg-zinc-900 p-1 text-[11px] font-bold">
              <button 
                type="button"
                onClick={() => {
                  setIsCustomMessage(false);
                  setErrorMsg(null);
                }} 
                className={`flex-1 py-2.5 rounded-lg text-center transition-all cursor-pointer border-none ${!isCustomMessage ? 'bg-white dark:bg-black shadow-sm text-slate-800 dark:text-white' : 'text-slate-400 bg-transparent'}`}
              >
                WhatsApp Meta Template
              </button>
              <button 
                type="button"
                onClick={() => {
                  setIsCustomMessage(true);
                  setErrorMsg(null);
                }} 
                className={`flex-1 py-2.5 rounded-lg text-center transition-all cursor-pointer border-none ${isCustomMessage ? 'bg-white dark:bg-black shadow-sm text-slate-800 dark:text-white' : 'text-slate-400 bg-transparent'}`}
              >
                Custom Text Message
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {!isCustomMessage ? (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Select Approved Template</label>
                    <select 
                      value={selectedTemplateName} 
                      onChange={(e) => handleTemplateChange(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 font-bold"
                    >
                      <option value="">Select template...</option>
                      {whatsappTemplates.map(t => (
                        <option key={t.id} value={t.name}>{t.name} (Approved)</option>
                      ))}
                    </select>
                  </div>

                  {selectedTemplateName && (
                    <div className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-2xl p-4 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Template Preview</span>
                      <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-mono whitespace-pre-wrap">
                        {whatsappTemplates.find(t => t.name === selectedTemplateName)?.body}
                      </p>
                    </div>
                  )}

                  {variableMappings.length > 0 && (
                    <div className="space-y-3">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Map Template Variables</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {variableMappings.map((val, idx) => (
                          <div key={idx} className="space-y-1.5">
                            <label className="block text-[10px] text-slate-400 font-bold">Variable {'{'}{idx + 1}{'}'}</label>
                            <select 
                              value={val} 
                              onChange={(e) => {
                                const next = [...variableMappings];
                                next[idx] = e.target.value;
                                setVariableMappings(next);
                              }}
                              className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 font-semibold"
                            >
                              <option value="">Select field mapping...</option>
                              <option value="name">Consultant Name (user.full_name)</option>
                              <option value="email">Consultant Email (user.email)</option>
                              <option value="agency">Agency Name (agency.business_name)</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Compose WhatsApp Message</label>
                  <textarea 
                    value={customTextMessage}
                    onChange={(e) => setCustomTextMessage(e.target.value)}
                    placeholder="Type your message here. Tip: Use {name} to personalize it."
                    rows={4}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-indigo-500 font-medium resize-none leading-relaxed"
                  />
                </div>
              )}
            </div>

            {/* Status updates */}
            {statusMsg && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center gap-2.5 text-xs font-bold animate-fade-in">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{statusMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center gap-2.5 text-xs font-bold animate-fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Footer */}
            <div className="flex gap-3 justify-end border-t border-slate-100 dark:border-zinc-900 pt-4">
              <button 
                type="button" 
                disabled={isSending}
                onClick={() => setIsBroadcastModalOpen(false)}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-2xl text-xs font-bold transition-all cursor-pointer border-none disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                type="button" 
                disabled={isSending || (isCustomMessage ? !customTextMessage.trim() : !selectedTemplateName)}
                onClick={handleSendBroadcast}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-indigo-600/10 cursor-pointer border-none flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block"></span>
                    Sending...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" /> Launch Broadcast
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
