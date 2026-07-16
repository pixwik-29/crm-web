import React, { useState, useEffect, useRef } from 'react';
import { useData } from '@/context/DataContext';
import { supabase } from '@/lib/supabase';
import { 
  MessageSquare, User, Send, Paperclip, Check, CheckCheck, 
  Clock, AlertCircle, Info, Phone, Tag, Calendar, UserCheck, ShieldAlert,
  ChevronRight, ArrowLeft, Search, PlusCircle, Paperclip as AttachmentIcon 
} from 'lucide-react';

interface Thread {
  leadId: string;
  leadName: string;
  phone: string;
  assignedTo: string | null;
  lastMessageText: string;
  lastMessageTime: string;
  unread: boolean;
}

export const SharedInbox: React.FC = () => {
  const { 
    leads, 
    whatsappHistory, 
    whatsappTemplates, 
    profiles, 
    currentUser, 
    tenantId, 
    isConfigured,
    settings
  } = useData();

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [inboxFilter, setInboxFilter] = useState<'all' | 'me' | 'unassigned'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Messaging input states
  const [inputText, setInputText] = useState('');
  const [activeInputTab, setActiveInputTab] = useState<'chat' | 'note'>('chat');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Status logs
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Local optimistic state: messages added immediately after sending (before DB re-fetch)
  const [localHistory, setLocalHistory] = useState<any[]>([]);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeThreadId, whatsappHistory, localHistory]);

  // Dedicated realtime subscription for incoming messages in this component
  // Handles both INSERT (new messages) and UPDATE (status changes: sent→delivered→read)
  useEffect(() => {
    if (!supabase || !tenantId) return;

    const channel = supabase
      .channel(`inbox-realtime-${tenantId}-v2`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_history',
        filter: `tenant_id=eq.${tenantId}`
      }, (payload) => {
        const newMsg = payload.new as any;
        setLocalHistory(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev; // deduplicate
          return [...prev, newMsg];
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'whatsapp_history',
        filter: `tenant_id=eq.${tenantId}`
      }, (payload) => {
        const updatedMsg = payload.new as any;
        // Update status in local state so delivery ticks update live
        setLocalHistory(prev =>
          prev.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m)
        );
      })
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [tenantId]);


  // Merge all messages: DataContext (DB) + localHistory (optimistic/realtime)
  // This unified pool is used for BOTH thread list previews AND chat panel
  const allMessages = React.useMemo(() => {
    const dbIds = new Set(whatsappHistory.map(m => m.id));
    const merged = [...whatsappHistory, ...localHistory.filter(m => !dbIds.has(m.id))];
    return merged;
  }, [whatsappHistory, localHistory]);

  // Aggregate active lead threads from merged message pool
  const threads: Thread[] = React.useMemo(() => {
    const threadMap = new Map<string, Thread>();

    leads.forEach(lead => {
      const targetPhone = lead.whatsapp_number || lead.phone || '';
      if (!targetPhone) return;

      // Find all messages for this lead from the unified merged pool
      const leadHistory = allMessages
        .filter(h => h.lead_id === lead.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const lastMsg = leadHistory[0];

      threadMap.set(lead.id, {
        leadId: lead.id,
        leadName: lead.name,
        phone: targetPhone,
        assignedTo: lead.assigned_counsellor_id || null,
        lastMessageText: lastMsg ? lastMsg.message_text : 'No conversations started yet',
        lastMessageTime: lastMsg ? lastMsg.created_at : lead.created_at,
        unread: lastMsg ? (lastMsg.direction === 'incoming' && lastMsg.status !== 'read') : false
      });
    });

    return Array.from(threadMap.values()).sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
  }, [leads, allMessages]);

  // Filter threads
  const filteredThreads = threads.filter(t => {
    // A. Filter type
    if (inboxFilter === 'me' && t.assignedTo !== currentUser?.id) return false;
    if (inboxFilter === 'unassigned' && t.assignedTo !== null) return false;

    // B. Search keyword
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return t.leadName.toLowerCase().includes(query) || t.phone.includes(query);
    }

    return true;
  });

  const activeLead = leads.find(l => l.id === activeThreadId);

  // Use the unified allMessages pool filtered to the active thread for the chat panel
  const activeChats = React.useMemo(() => {
    if (!activeThreadId) return [];
    return allMessages
      .filter(m => m.lead_id === activeThreadId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [activeThreadId, allMessages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThreadId || !activeLead) return;

    const messageContent = selectedTemplateId 
      ? whatsappTemplates.find(t => t.id === selectedTemplateId)?.body || ''
      : inputText;

    if (!messageContent.trim() && !selectedFile) return;

    setIsSending(true);
    setSendError(null);

    try {
      // 1. Dispatch internal team notes
      if (activeInputTab === 'note') {
        if (isConfigured && supabase) {
          await supabase.from('notes').insert({
            lead_id: activeThreadId,
            body: messageContent,
            created_by: currentUser?.id || null,
            tenant_id: tenantId
          });
          await supabase.from('activity_logs').insert({
            lead_id: activeThreadId,
            actor_id: currentUser?.id || null,
            action_type: 'note_added',
            description: `Added private thread note: "${messageContent.substring(0, 60)}"`,
            tenant_id: tenantId
          });
        }
        setInputText('');
        setActiveInputTab('chat');
        setIsSending(false);
        return;
      }

      // 2. Determine the target phone number
      const targetPhone = activeLead.whatsapp_number || activeLead.phone || '';
      if (!targetPhone) throw new Error('Lead has no WhatsApp/phone number.');

      // 3. Call the real Meta Cloud API via campaigns endpoint
      const payload: any = {
        tenantId,
        to: targetPhone,
        type: selectedTemplateId ? 'template' : (selectedFile ? 'document' : 'text'),
        message: messageContent,
      };

      if (selectedTemplateId) {
        const tpl = whatsappTemplates.find(t => t.id === selectedTemplateId);
        payload.templateName = tpl?.name;
      }

      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to send message');

      // 4. Write to whatsapp_history DB
      const newMsgId = `wa-out-${Date.now()}`;
      if (isConfigured && supabase) {
        const { data: inserted } = await supabase.from('whatsapp_history').insert({
          id: newMsgId,
          lead_id: activeThreadId,
          direction: 'outgoing',
          message_text: messageContent || '[Attachment]',
          status: 'sent',
          tenant_id: tenantId
        }).select().maybeSingle();

        await supabase.from('activity_logs').insert({
          lead_id: activeThreadId,
          actor_id: currentUser?.id || null,
          action_type: 'whatsapp_sent',
          description: `Sent WhatsApp: "${messageContent.substring(0, 50)}"`,
          tenant_id: tenantId
        });
      }

      // 5. Update local optimistic state immediately so message appears without refresh
      setLocalHistory(prev => {
        const optimistic = {
          id: newMsgId,
          lead_id: activeThreadId,
          direction: 'outgoing' as const,
          message_text: messageContent || '[Attachment]',
          status: 'sent',
          created_at: new Date().toISOString(),
          tenant_id: tenantId
        };
        if (prev.some(m => m.id === newMsgId)) return prev;
        return [...prev, optimistic];
      });

      // Reset inputs
      setInputText('');
      setSelectedTemplateId('');
      setSelectedFile(null);
    } catch (err: any) {
      setSendError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleAgentAssignment = async (agentId: string) => {
    if (!activeThreadId || !isConfigured || !supabase) return;
    try {
      await supabase
        .from('leads')
        .update({ assigned_counsellor_id: agentId || null })
        .eq('id', activeThreadId);

      await supabase.from('activity_logs').insert({
        lead_id: activeThreadId,
        actor_id: currentUser?.id || null,
        action_type: 'assigned',
        description: agentId 
          ? `Lead assigned to agent: ${profiles.find(p => p.id === agentId)?.full_name || 'Staff'}` 
          : 'Lead unassigned',
        tenant_id: tenantId
      });
    } catch (err: any) {
      console.error('[SharedInbox] Agent assignment failed:', err.message);
    }
  };

  const triggerAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="h-[calc(100vh-140px)] border border-slate-200 dark:border-zinc-900 rounded-3xl overflow-hidden bg-white dark:bg-zinc-950 shadow-sm flex">
      
      {/* 1. Left Sidebar: Thread List */}
      <div className="w-80 border-r border-slate-200 dark:border-zinc-900 flex flex-col bg-slate-50/50 dark:bg-black/20">
        
        {/* Search header */}
        <div className="p-4 border-b border-slate-200 dark:border-zinc-900 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold tracking-wider uppercase text-slate-800 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-500" /> WhatsApp Inbox
            </h2>
            <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
              Live
            </span>
          </div>
          
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search conversations..." className="w-full bg-white dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500" />
          </div>

          <div className="flex rounded-lg bg-slate-100 dark:bg-zinc-900 p-0.5 text-[10px] font-bold">
            <button onClick={() => setInboxFilter('all')} className={`flex-1 py-1.5 rounded-md text-center transition-all ${inboxFilter === 'all' ? 'bg-white dark:bg-black shadow-sm text-slate-800 dark:text-white' : 'text-slate-400'}`}>All</button>
            <button onClick={() => setInboxFilter('me')} className={`flex-1 py-1.5 rounded-md text-center transition-all ${inboxFilter === 'me' ? 'bg-white dark:bg-black shadow-sm text-slate-800 dark:text-white' : 'text-slate-400'}`}>Assigned</button>
            <button onClick={() => setInboxFilter('unassigned')} className={`flex-1 py-1.5 rounded-md text-center transition-all ${inboxFilter === 'unassigned' ? 'bg-white dark:bg-black shadow-sm text-slate-800 dark:text-white' : 'text-slate-400'}`}>Unassigned</button>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-900">
          {filteredThreads.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No conversations found</div>
          ) : (
            filteredThreads.map(thread => (
              <button key={thread.leadId} onClick={() => setActiveThreadId(thread.leadId)} className={`w-full p-4 flex gap-3 text-left transition-all ${activeThreadId === thread.leadId ? 'bg-emerald-50/40 dark:bg-emerald-500/5 border-l-4 border-emerald-600' : 'hover:bg-slate-50 dark:hover:bg-zinc-900'}`}>
                <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center text-emerald-700 font-bold text-xs uppercase flex-shrink-0">
                  {thread.leadName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-800 dark:text-white truncate">{thread.leadName}</span>
                    <span className="text-[9px] text-slate-400">{new Date(thread.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">{thread.lastMessageText}</p>
                  
                  {thread.unread && (
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-600"></span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 2. Middle Panel: Live Message Feed */}
      <div className="flex-1 flex flex-col bg-slate-50/20 dark:bg-zinc-950">
        {activeThreadId ? (
          <>
            {/* Active thread header */}
            <div className="p-4 border-b border-slate-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-white text-xs font-bold uppercase">
                  {activeLead?.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-800 dark:text-white">{activeLead?.name}</h3>
                  <span className="text-[10px] text-slate-400 font-medium">{activeLead?.phone || activeLead?.whatsapp_number}</span>
                </div>
              </div>
            </div>

            {/* Chat message bubbles list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeChats.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-xs text-slate-400 gap-2">
                  <Info className="w-5 h-5 text-slate-300" />
                  <span>No chat history recorded yet.<br/>Type below to begin chatting.</span>
                </div>
              ) : (
                activeChats.map(message => {
                  const isOutgoing = message.direction === 'outgoing';
                  return (
                    <div key={message.id} className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl p-3 shadow-sm text-xs leading-relaxed space-y-1 ${isOutgoing ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-white dark:bg-zinc-900 text-slate-800 dark:text-white rounded-tl-none border border-slate-100 dark:border-zinc-800'}`}>
                        <p>{message.message_text}</p>
                        
                        <div className="flex justify-end items-center gap-1 text-[9px] opacity-75">
                          <span>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isOutgoing && (
                            message.status === 'read' ? <CheckCheck className="w-3.5 h-3.5 text-sky-200" /> :
                            message.status === 'delivered' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-100" /> :
                            message.status === 'failed' ? <AlertCircle className="w-3.5 h-3.5 text-rose-300" /> :
                            <Check className="w-3.5 h-3.5 text-white/50" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef}></div>
            </div>

            {/* Messaging Input Area */}
            <div className="p-4 bg-white dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-900 space-y-3">
              <div className="flex rounded-xl bg-slate-100 dark:bg-zinc-900 p-0.5 text-[10px] font-bold w-48">
                <button type="button" onClick={() => setActiveInputTab('chat')} className={`flex-1 py-1.5 rounded-lg text-center transition-all ${activeInputTab === 'chat' ? 'bg-white dark:bg-black shadow-sm text-slate-800 dark:text-white' : 'text-slate-400'}`}>WhatsApp Chat</button>
                <button type="button" onClick={() => setActiveInputTab('note')} className={`flex-1 py-1.5 rounded-lg text-center transition-all ${activeInputTab === 'note' ? 'bg-white dark:bg-black shadow-sm text-slate-800 dark:text-white' : 'text-slate-400'}`}>Internal Note</button>
              </div>

              {activeInputTab === 'chat' && (
                <div className="flex gap-2">
                  <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500 max-w-xs">
                    <option value="">Quick template replies...</option>
                    {whatsappTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <form onSubmit={handleSend} className="flex gap-2 items-center">
                <input type="file" ref={fileInputRef} onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="hidden" />
                
                {activeInputTab === 'chat' && (
                  <button type="button" onClick={triggerAttachmentClick} className={`p-3 text-slate-400 hover:text-slate-600 rounded-xl bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 transition-all ${selectedFile ? 'text-emerald-500' : ''}`} title="Attach media file">
                    <Paperclip className="w-4 h-4" />
                  </button>
                )}

                <div className="flex-1 relative">
                  <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} disabled={!!selectedTemplateId} placeholder={activeInputTab === 'chat' ? (selectedTemplateId ? 'Template message loaded...' : 'Type message here (WhatsApp)...') : 'Type private agent note here...'} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl py-3 pl-4 pr-12 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500 disabled:opacity-50" />
                  
                  {selectedFile && (
                    <div className="absolute right-3 top-2.5 bg-emerald-600 text-white rounded-md text-[9px] font-bold px-2 py-1 flex items-center gap-1 animate-fade-in">
                      <span>{selectedFile.name.substring(0, 10)}...</span>
                      <button type="button" onClick={() => setSelectedFile(null)} className="hover:text-red-200">×</button>
                    </div>
                  )}
                </div>

                <button type="submit" disabled={isSending} className={`p-3 text-white rounded-xl shadow-lg transition-all ${activeInputTab === 'note' ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/10' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/10'}`}>
                  <Send className="w-4 h-4 fill-white" />
                </button>
              </form>

              {sendError && (
                <div className="text-[10px] text-rose-600 font-medium flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Failed dispatch: {sendError}</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-xs text-slate-400 gap-2">
            <MessageSquare className="w-10 h-10 text-slate-300" />
            <span>Select a conversation from the sidebar to view thread</span>
          </div>
        )}
      </div>

      {/* 3. Right Sidebar: CRM Lead Details */}
      {activeLead && (
        <div className="w-72 border-l border-slate-200 dark:border-zinc-900 flex flex-col bg-white dark:bg-zinc-950 p-6 space-y-6 overflow-y-auto">
          <div>
            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-4">Lead Context Details</h4>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-100 dark:bg-zinc-900 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs uppercase">
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-extrabold text-slate-800 dark:text-white truncate">{activeLead.name}</h4>
                  <span className="text-[10px] text-slate-400 truncate">{activeLead.email || 'No Email'}</span>
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-100 dark:border-zinc-900 pt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Current Status</span>
                  <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-extrabold px-2 py-0.5 rounded-md text-[9px]">{activeLead.status}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Preferred Course</span>
                  <span className="font-bold text-slate-700 dark:text-zinc-300">{activeLead.course || '--'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Destination</span>
                  <span className="font-bold text-slate-700 dark:text-zinc-300">{activeLead.preferred_destination || '--'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">NEET Marks</span>
                  <span className="font-bold text-slate-700 dark:text-zinc-300">{activeLead.neet_marks || '--'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-zinc-900 pt-6">
            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5 text-emerald-500" /> Assigned Agent</h4>
            <select value={activeLead.assigned_counsellor_id || ''} onChange={(e) => handleAgentAssignment(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-900 rounded-xl p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500 font-bold">
              <option value="">Unassigned</option>
              {profiles.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.full_name || 'Agent'}</option>
              ))}
            </select>
          </div>

          <div className="border-t border-slate-100 dark:border-zinc-900 pt-6">
            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Recent Activity</h4>
            <div className="space-y-3">
              <div className="flex gap-2 text-[10px] leading-normal text-slate-500 dark:text-zinc-400">
                <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full mt-1.5 flex-shrink-0"></div>
                <div>
                  <p className="font-semibold">WhatsApp chat initialized</p>
                  <span className="text-[9px] text-slate-400">Recently</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
