import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Trash2, Mail, Info, CheckCircle2 } from 'lucide-react';

export default function DataDeletionPage() {
  const lastUpdated = "June 4, 2026";
  const contactEmail = "crm@perfectscholar.com";
  
  // Pre-formatted email content
  const emailSubject = encodeURIComponent("Account/Data Deletion Request - Perfect Scholar CRM");
  const emailBody = encodeURIComponent(
    "Hello Perfect Scholar Support Team,\n\n" +
    "I am writing to request the permanent deletion of my account and/or my candidate records on the Perfect Scholar CRM system.\n\n" +
    "Please find my registration details below:\n" +
    "- Full Name: [Your Full Name]\n" +
    "- Registered Email Address: [Your Registered Email]\n" +
    "- Associated Mobile Number: [Your Phone Number]\n" +
    "- Account Role (Counsellor/Manager/Candidate): [Your Role]\n\n" +
    "I understand that this action is irreversible and will permanently purge all my login credentials, assigned tasks, push notification tokens, and client logs from the database.\n\n" +
    "Please process this request within the standard review timeline and notify me when data erasure is completed.\n\n" +
    "Best regards,\n" +
    "[Your Name]"
  );

  const mailtoUrl = `mailto:${contactEmail}?subject=${emailSubject}&body=${emailBody}`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-800 dark:text-zinc-100 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300 font-sans">
      
      {/* Background Graphic Accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-650/5 dark:bg-red-500/5 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-indigo-600/5 dark:bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10">
        
        {/* Navigation / Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 transition-colors uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Workspace
          </Link>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-[10px] font-extrabold uppercase tracking-widest">
            <Trash2 className="w-3.5 h-3.5" /> Data Compliance
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white/80 dark:bg-zinc-950/60 backdrop-blur-xl border border-slate-200/80 dark:border-zinc-900/80 rounded-3xl p-8 sm:p-12 shadow-xl dark:shadow-2xl">
          
          {/* Main Title Section */}
          <div className="border-b border-slate-100 dark:border-zinc-900 pb-8 mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-white dark:via-zinc-200 dark:to-white mb-2">
              Data & Account Deletion
            </h1>
            <p className="text-xs text-slate-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">
              Perfect Scholar Lead Management System • Last Updated: {lastUpdated}
            </p>
          </div>

          {/* Interactive Request Action Box */}
          <div className="p-6 rounded-2xl bg-gradient-to-tr from-slate-50 to-slate-100/50 dark:from-zinc-900/40 dark:to-zinc-900/20 border border-slate-200/50 dark:border-zinc-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10 shadow-sm">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Info className="w-4 h-4 text-indigo-500" /> Account Deletion Request
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed max-w-lg">
                Clicking the button will generate a pre-formatted template in your device's default mail app to submit a formal erasure request to the Perfect Scholar database compliance team.
              </p>
            </div>
            <a 
              href={mailtoUrl}
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md shadow-red-650/10 hover:scale-[1.01] transition-all flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" /> Request Account Deletion
            </a>
          </div>

          {/* Deletion Details Text */}
          <div className="space-y-8 text-sm leading-relaxed text-slate-655 dark:text-zinc-350">
            
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                1. Account Deletion Mandate
              </h2>
              <p>
                In compliance with the Apple App Store Review Guideline 5.1.1 and Google Play Store User Data policy, the Perfect Scholar CRM provides a transparent pathway for all registered platform members (counsellors, managers) and prospective candidates to delete their accounts and personal records.
              </p>
              <p>
                Perfect Scholar guarantees that once a deletion request is processed, all associated data is permanently scrubbed from our cloud tables and server storage blocks.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                2. What Data is Permanently Erased?
              </h2>
              <p>
                When your account or lead profile is deleted, the following database nodes are permanently removed:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                <div className="p-4 rounded-xl border border-slate-100 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/10 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">Credentials & Session</h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">Administrative email, password hash, and active JWT logins.</p>
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-slate-100 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/10 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">Lead & Contact Records</h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">Candidate profiles, academic choices, contact numbers, and notes.</p>
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-slate-100 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/10 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">Task Reminders</h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">All scheduled tasks, calendar events, and follow-up flags.</p>
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-slate-100 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/10 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">System Tokens</h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">Expo Push Notification tokens registered for device delivery.</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                3. Alternative Deletion Methods
              </h2>
              <p>
                If you prefer not to use the automated email link above, you can request data deletion through the following routes:
              </p>
              <ul className="list-decimal pl-5 space-y-2">
                <li>
                  <strong>Direct Administrator Action:</strong> If you are a counsellor or manager, you can request your system administrator to access the **Integrations & Role Settings** control board, navigate to user management, and click the deletion button on your profile name. This instantly deletes the profile and clears your login capability.
                </li>
                <li>
                  <strong>Manual Email Request:</strong> Send a manual email to <a href={`mailto:${contactEmail}`} className="text-indigo-650 dark:text-indigo-400 hover:underline font-bold">{contactEmail}</a> using your registered account email, stating clearly that you request the complete removal of your personal profiles.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                4. Data Retention Exception
              </h2>
              <p>
                Please note that certain financial transactions or post-closing visa processing logs may be retained temporarily in an offline backup if required under local tax, accounting, or higher-education regulatory audits. Such exceptions are strictly controlled, quarantined, and never used for active business operations.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                5. Processing Timelines
              </h2>
              <p>
                Once an email deletion request is received by the support inbox, verification check steps are completed, and final database purge commands are executed within <strong>7 business days</strong>. A confirmation email will be dispatched to your address once the operations have succeeded.
              </p>
            </section>

          </div>

        </div>

        {/* Legal Footer Note */}
        <div className="mt-8 text-center text-xs text-slate-400 dark:text-zinc-650">
          Perfect Scholar © {new Date().getFullYear()} • Confidential System Documentation
        </div>

      </div>
    </div>
  );
}
