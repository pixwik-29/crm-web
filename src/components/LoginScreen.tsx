"use client";

import React, { useState, useEffect } from 'react';
import { useData } from '@/context/DataContext';
import { supabase } from '@/lib/supabase';
import { LogIn, UserCheck, ShieldAlert, Sparkles, Key, Mail, User, Info, ArrowLeft, Phone, Smartphone } from 'lucide-react';
import { Footer } from '@/components/Footer';

interface Credential {
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'manager' | 'counsellor';
  profileId: string;
  phone?: string;
}

const DEFAULT_CREDENTIALS: Credential[] = [
  { email: 'nash@pixwik.com', password: 'Pixwik@8899', name: 'Nash Newton (Admin)', role: 'admin', profileId: 'user-admin', phone: '+919876543212' },
  { email: 'manager@crm.com', password: 'manager123', name: 'Rajesh Kumar (Manager)', role: 'manager', profileId: 'user-manager', phone: '+919876543213' },
  { email: 'amit@crm.com', password: 'counsellor123', name: 'Amit Verma', role: 'counsellor', profileId: 'user-counsellor-1', phone: '+919876543210' },
  { email: 'priya@crm.com', password: 'counsellor123', name: 'Priya Sharma', role: 'counsellor', profileId: 'user-counsellor-2', phone: '+919876543211' }
];


export const LoginScreen: React.FC = () => {
  const { login, profiles, switchUser, isConfigured, tenantId } = useData();

  // Screen modes: 'login' | 'register' | 'forgot' | 'otp' | 'reset-pass'
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'otp' | 'reset-pass'>('login');

  // Login method selector
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');

  // Input states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'manager' | 'counsellor'>('counsellor');
  
  // SMS OTP states
  const [phone, setPhone] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [generatedPhoneOtp, setGeneratedPhoneOtp] = useState('');
  const [isPhoneOtpSent, setIsPhoneOtpSent] = useState(false);
  const [registerPhone, setRegisterPhone] = useState('');

  // OTP Reset states
  const [otpInput, setOtpInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');

  // UI state
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);


  // Load / Initialize Credentials in localStorage (Sandbox mode helper)
  const getCredentials = (): Credential[] => {
    if (typeof window === 'undefined') return DEFAULT_CREDENTIALS;
    const key = tenantId !== 'default' ? `crm_credentials_tenant_${tenantId}` : 'crm_credentials';
    const stored = localStorage.getItem(key);
    if (!stored) {
      if (tenantId !== 'default') {
        // For tenant workspaces, return empty — real auth goes through Supabase.
        // Sandbox credentials are seeded by the partner admin portal, not auto-generated.
        return [];
      }
      localStorage.setItem('crm_credentials', JSON.stringify(DEFAULT_CREDENTIALS));
      return DEFAULT_CREDENTIALS;
    }
    const parsed: Credential[] = JSON.parse(stored);
    const updated = parsed.map(c => {
      const match = DEFAULT_CREDENTIALS.find(d => d.email.toLowerCase() === c.email.toLowerCase());
      if (match && !c.phone) {
        return { ...c, phone: match.phone };
      }
      return c;
    });
    return updated;
  };


  const saveCredentials = (creds: Credential[]) => {
    const key = tenantId !== 'default' ? `crm_credentials_tenant_${tenantId}` : 'crm_credentials';
    localStorage.setItem(key, JSON.stringify(creds));
  };

  // Auto fill credentials helper for quick demo testing
  const handleFillCredentials = (emailVal: string, passVal: string) => {
    setEmail(emailVal);
    setPassword(passVal);
    setError('');
  };

  // 1. Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in both email and password.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      if (isConfigured) {
        // Real Supabase Connection Login
        const profile = await login(email, 'counsellor', '', password); // In Supabase, email/password handles credentials
        
        // Save these credentials locally so that future Phone OTP logins work on this device
        if (typeof window !== 'undefined' && profile) {
          const key = tenantId !== 'default' ? `crm_credentials_tenant_${tenantId}` : 'crm_credentials';
          const stored = localStorage.getItem(key);
          const creds = stored ? JSON.parse(stored) : [];
          const index = creds.findIndex((c: any) => c.email.toLowerCase() === email.toLowerCase());
          const newCred = {
            email: email,
            password: password,
            name: profile.full_name,
            role: profile.role,
            profileId: profile.id,
            phone: profile.phone
          };
          if (index > -1) {
            creds[index] = newCred;
          } else {
            creds.push(newCred);
          }
          localStorage.setItem(key, JSON.stringify(creds));
        }
      } else {
        // Local sandbox verification
        const creds = getCredentials();
        const found = creds.find(c => c.email.toLowerCase() === email.toLowerCase());
        
        if (!found) {
          setError('No user account matches this email. Register below to create one.');
          setIsSubmitting(false);
          return;
        }

        if (found.password !== password) {
          setError('Incorrect password. Please try again.');
          setIsSubmitting(false);
          return;
        }

        // Search profiles
        let targetProfile = profiles.find(p => p.id === found.profileId);
        if (!targetProfile) {
          // If profile is missing, initialize it
          targetProfile = await login(found.email, found.role, found.name, found.password);
        } else {
          switchUser(targetProfile);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // 1b. Handle Send Phone OTP Submit
  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) {
      setError('Please enter your mobile number.');
      return;
    }
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const creds = getCredentials();
      const cleanInputPhone = phone.replace(/\D/g, '');
      let foundCred: Credential | undefined;

      const localCred = creds.find(c => {
        if (!c.phone) return false;
        const cleanCredPhone = c.phone.replace(/\D/g, '');
        return cleanCredPhone.endsWith(cleanInputPhone) || cleanInputPhone.endsWith(cleanCredPhone);
      });

      if (localCred) {
        foundCred = localCred;
      } else if (isConfigured && supabase) {
        // Look up registered phone number in Supabase profiles bypassing RLS via server-side RPC
        const { data, error: rpcError } = await supabase.rpc('check_phone_registered', { phone_num: cleanInputPhone });
        if (rpcError) {
          console.error("RPC Phone Check Error:", rpcError);
        } else if (data && data.length > 0) {
          const matched = data[0];
          foundCred = {
            email: matched.email,
            password: 'counsellor123', // Default password fallback for new users
            name: matched.full_name,
            role: matched.role as any,
            profileId: matched.email,
            phone: matched.phone || phone
          };
        }
      }

      if (!foundCred) {
        setError('This phone number is not registered in the system.');
        setIsSubmitting(false);
        return;
      }

      // Generate a 6-digit OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedPhoneOtp(otpCode);

      setSuccess('Sending OTP via SMS...');

      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: foundCred.phone,
          otp: otpCode
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to deliver SMS. Check API configuration.');
      }

      setIsPhoneOtpSent(true);
      setSuccess(`An OTP verification code has been sent via SMS to ${foundCred.phone}.`);
    } catch (err: any) {
      setError(err.message || 'Failed to send SMS. Please verify network connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1c. Handle Verify Phone OTP Submit
  const handlePhoneOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneOtp) {
      setError('Please enter the OTP verification code.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    if (phoneOtp === generatedPhoneOtp) {
      try {
        const creds = getCredentials();
        const cleanInputPhone = phone.replace(/\D/g, '');
        let foundCred = creds.find(c => {
          if (!c.phone) return false;
          const cleanCredPhone = c.phone.replace(/\D/g, '');
          return cleanCredPhone.endsWith(cleanInputPhone) || cleanInputPhone.endsWith(cleanCredPhone);
        });

        // Dynamic database fallback check
        if (!foundCred && isConfigured && supabase) {
          const { data } = await supabase.rpc('check_phone_registered', { phone_num: cleanInputPhone });
          if (data && data.length > 0) {
            const matched = data[0];
            foundCred = {
              email: matched.email,
              password: 'counsellor123',
              name: matched.full_name,
              role: matched.role as any,
              profileId: matched.email,
              phone: matched.phone || phone
            };
          }
        }

        if (foundCred) {
          // Log user in
          let targetProfile = profiles.find(p => p.id === foundCred.profileId);
          if (!targetProfile) {
            targetProfile = await login(foundCred.email, foundCred.role, foundCred.name, foundCred.password);
          } else {
            switchUser(targetProfile);
          }
          setSuccess('Login successful!');
        } else {
          setError('Profile matching credentials not found.');
        }
      } catch (err: any) {
        setError(err.message || 'Login failed.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setError('Invalid OTP code. Please enter the correct code sent to your phone.');
      setIsSubmitting(false);
    }
  };

  // 2. Handle Registration Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !registerPhone) {
      setError('Please fill in all registration fields (Name, Email, Password, and Mobile Number).');
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      if (isConfigured) {
        setError('Self-registration is disabled in live Cloud mode. Contact database administrator.');
      } else {
        const creds = getCredentials();
        const alreadyExists = creds.some(c => c.email.toLowerCase() === email.toLowerCase());
        if (alreadyExists) {
          setError('An account with this email already exists.');
          setIsSubmitting(false);
          return;
        }

        // Register profile
        const newProfile = await login(email, role, name, password);
        
        // Save phone to profile as well in mock mode
        if (newProfile) {
          newProfile.phone = registerPhone.startsWith('+') ? registerPhone : `+91${registerPhone}`;
        }

        // Save credential
        const updatedCreds = [...creds, {
          email,
          password,
          name,
          role,
          profileId: newProfile.id,
          phone: registerPhone.startsWith('+') ? registerPhone : `+91${registerPhone}`
        }];
        saveCredentials(updatedCreds);
        
        setSuccess('Registration successful! Dispatching welcome email...');


        // Send real welcome email asynchronously
        try {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: email,
              subject: 'Welcome to Perfect Scholar Lead Management Workspace',
              html: `
                <div style="font-family: sans-serif; padding: 25px; color: #1e293b; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                  <h2 style="color: #4f46e5; font-size: 20px; font-weight: bold; margin-bottom: 20px;">Welcome to Perfect Scholar!</h2>
                  <p style="font-size: 14px; color: #334155; line-height: 1.6;">Hello <strong>${name}</strong>,</p>
                  <p style="font-size: 14px; color: #334155; line-height: 1.6;">Your consultant account has been registered successfully. Here are your workspace access details:</p>
                  <div style="background-color: #f8fafc; padding: 15px; border-radius: 12px; margin: 20px 0; border: 1px dashed #cbd5e1;">
                    <table style="width: 100%; font-size: 13px; color: #475569;">
                      <tr>
                        <td style="padding: 4px 0; font-weight: bold;">Workspace Role:</td>
                        <td style="padding: 4px 0; color: #0f172a;">${role.toUpperCase()}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; font-weight: bold;">Login Email:</td>
                        <td style="padding: 4px 0; color: #0f172a;">${email}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; font-weight: bold;">Password:</td>
                        <td style="padding: 4px 0; color: #0f172a;"><em>[The password you set during registration]</em></td>
                      </tr>
                    </table>
                  </div>
                  <p style="font-size: 14px; color: #334155; line-height: 1.6;">You can now log in to the Perfect Scholar CRM web dashboard or the native mobile app to manage your leads, schedule follow-ups, and track candidate records.</p>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
                  <p style="font-size: 11px; color: #64748b; text-align: center;">Perfect Scholar CRM • Confidential Transactional Mail</p>
                </div>
              `
            })
          });
        } catch (mailErr) {
          console.error("Welcome email failed to deliver:", mailErr);
        }

        setSuccess('Registration successful! Logging you in...');
        setTimeout(() => {
          switchUser(newProfile);
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to register account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Handle Forgot Password Submit
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    const creds = getCredentials();
    const found = creds.find(c => c.email.toLowerCase() === email.toLowerCase());

    if (!found) {
      setError('No registered account matches this email.');
      setIsSubmitting(false);
      return;
    }

    // Generate real 6-digit OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    localStorage.setItem('m_otp', generatedOtp);
    localStorage.setItem('m_otp_email', email);

    setResetEmail(email);
    setSuccess('Sending One-Time Password (OTP) to your email...');

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: 'Perfect Scholar CRM - Password Recovery OTP',
          html: `
            <div style="font-family: sans-serif; padding: 25px; color: #1e293b; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
              <h2 style="color: #4f46e5; font-size: 20px; font-weight: bold; margin-bottom: 20px;">Password Reset Request</h2>
              <p style="font-size: 14px; color: #334155; line-height: 1.6;">Hello,</p>
              <p style="font-size: 14px; color: #334155; line-height: 1.6;">We received a request to recover the password for your Perfect Scholar CRM account. Use the following 6-digit verification code to reset your password:</p>
              <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; font-size: 28px; font-weight: 800; letter-spacing: 6px; text-align: center; margin: 25px 0; color: #4f46e5; border: 1px solid #e2e8f0;">
                ${generatedOtp}
              </div>
              <p style="font-size: 13px; color: #64748b; line-height: 1.6;">This code is valid for 10 minutes. If you did not request this recovery, you can safely ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
              <p style="font-size: 11px; color: #64748b; text-align: center;">Perfect Scholar CRM • Confidential Transactional Mail</p>
            </div>
          `
        })
      });

      if (!res.ok) {
        throw new Error('Failed to deliver OTP. SMTP connection failed.');
      }

      setSuccess(`A real OTP code has been delivered to ${email}.`);
      setTimeout(() => {
        setSuccess('');
        setMode('otp');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch email. Please check internet connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Handle OTP Verify Submit
  const handleOtpVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const storedOtp = localStorage.getItem('m_otp');
    if (storedOtp && otpInput === storedOtp) {
      setError('');
      setMode('reset-pass');
    } else {
      setError('Invalid OTP code. Please enter the correct code sent to your email.');
    }
  };

  // 5. Handle Reset Password Submit
  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }

    const creds = getCredentials();
    const updated = creds.map(c => {
      if (c.email.toLowerCase() === resetEmail.toLowerCase()) {
        return { ...c, password: newPassword };
      }
      return c;
    });

    saveCredentials(updated);
    setSuccess('Password updated successfully! Redirecting...');
    
    setTimeout(() => {
      setSuccess('');
      setEmail(resetEmail);
      setPassword(newPassword);
      setMode('login');
    }, 2000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between bg-radial from-slate-900 via-slate-950 to-black p-4 text-white relative overflow-hidden">
      
      {/* Background Graphic Accents */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[120px]"></div>

      <div className="flex-1 flex items-center justify-center w-full">
        {/* Main card */}
        <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative z-10 my-8">
        
        {/* Brand Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <img 
            src="/logo.png" 
            alt="Perfect Scholar Logo" 
            className="h-16 w-auto object-contain mb-4" 
          />
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
            Perfect Scholar Lead Management
          </h1>
          <p className="text-xs text-slate-400 mt-2">
            Multi-User CRM & Lead Management System
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center font-medium">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center font-semibold animate-pulse">
            {success}
          </div>
        )}

        {tenantId && tenantId !== 'default' && (
          <div className="mb-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/35 text-blue-400 text-xs leading-relaxed flex items-start gap-2.5">
            <Info className="w-4.5 h-4.5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-bold text-[13px] text-white mb-1">
                Workspace: {tenantId.toUpperCase()}
              </p>
              <p className="text-slate-350 text-[11px] leading-relaxed">
                Sign in using the <span className="text-white font-semibold">email address and password</span> provided to you when this CRM subscription was created.
              </p>
            </div>
          </div>
        )}

        {/* 1. VIEW: CREDENTIALS LOGIN */}
        {mode === 'login' && (
          <div className="space-y-6">
            {/* Method Tabs */}
            <div className="flex border-b border-slate-800/80 mb-4">
              <button
                type="button"
                onClick={() => {
                  setLoginMethod('email');
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 pb-3 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-b-2 ${
                  loginMethod === 'email'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-400'
                }`}
              >
                <Mail className="w-3.5 h-3.5" /> Email & Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginMethod('phone');
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 pb-3 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-b-2 ${
                  loginMethod === 'phone'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-400'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" /> Mobile OTP
              </button>
            </div>

            {loginMethod === 'email' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      placeholder="admin@crm.com or amit@crm.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-3 text-xs outline-none text-white transition-all"
                    />
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setSuccess('');
                        setMode('forgot');
                      }}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-bold hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      placeholder="Enter account password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-3 text-xs outline-none text-white transition-all"
                    />
                    <Key className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                >
                  <LogIn className="w-4 h-4" /> Enter Workspace
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                {!isPhoneOtpSent ? (
                  <form onSubmit={handleSendPhoneOtp} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                        Mobile Number
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          required
                          placeholder="e.g. 9876543210"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-3 text-xs outline-none text-white transition-all"
                        />
                        <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                    >
                      <Smartphone className="w-4 h-4" /> Send OTP Code
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handlePhoneOtpVerify} className="space-y-4 animate-fade-in">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                        Enter OTP Code
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          maxLength={6}
                          placeholder="Enter 6-digit OTP"
                          value={phoneOtp}
                          onChange={(e) => setPhoneOtp(e.target.value)}
                          className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-3 text-xs outline-none text-white tracking-[6px] text-center font-extrabold transition-all"
                        />
                        <Key className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                    >
                      <UserCheck className="w-4 h-4" /> Verify OTP & Sign In
                    </button>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsPhoneOtpSent(false);
                          setPhoneOtp('');
                          setError('');
                          setSuccess('');
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-all font-medium underline underline-offset-4"
                      >
                        Change Phone Number
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Spacer */}
            <div className="pt-2"></div>

            {/* Mode Switcher Link */}
            <div className="text-center pt-2">
              <button
                onClick={() => {
                  setError('');
                  setSuccess('');
                  setMode('register');
                }}
                className="text-xs text-slate-400 hover:text-white transition-all underline decoration-dotted underline-offset-4"
              >
                Create Custom Consultant Account
              </button>
            </div>
          </div>
        )}

        {/* 2. VIEW: REGISTRATION */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div className="flex items-center gap-2 mb-2 text-indigo-400">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setSuccess('');
                  setMode('login');
                }}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold uppercase tracking-wider">Register Consultant Account</span>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none text-white transition-all"
                />
                <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="ramesh@crm.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none text-white transition-all"
                />
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Mobile Number
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={registerPhone}
                  onChange={(e) => setRegisterPhone(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none text-white transition-all"
                />
                <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              </div>
            </div>

            <div>

              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="Set account password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none text-white transition-all"
                />
                <Key className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Workspace Role
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`py-2 px-1 rounded-xl text-[10px] font-semibold border flex items-center justify-center gap-1 transition-all ${
                    role === 'admin'
                      ? 'bg-blue-600/10 border-blue-500 text-blue-400 shadow-inner'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <ShieldAlert className="w-3 h-3 flex-shrink-0" /> Admin
                </button>
                <button
                  type="button"
                  onClick={() => setRole('manager')}
                  className={`py-2 px-1 rounded-xl text-[10px] font-semibold border flex items-center justify-center gap-1 transition-all ${
                    role === 'manager'
                      ? 'bg-purple-600/10 border-purple-500 text-purple-400 shadow-inner'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Sparkles className="w-3 h-3 flex-shrink-0" /> Manager
                </button>
                <button
                  type="button"
                  onClick={() => setRole('counsellor')}
                  className={`py-2 px-1 rounded-xl text-[10px] font-semibold border flex items-center justify-center gap-1 transition-all ${
                    role === 'counsellor'
                      ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400 shadow-inner'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <UserCheck className="w-3 h-3 flex-shrink-0" /> Counsellor
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mt-2"
            >
              Register & Login
            </button>
          </form>
        )}

        {/* 3. VIEW: FORGOT PASSWORD */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-2 text-blue-400">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setSuccess('');
                  setMode('login');
                }}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold uppercase tracking-wider">Reset Password (OTP Delivery)</span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
              Enter your consultant email address. We will simulate sending a standard OTP authorization token to recover access.
            </p>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Account Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="Enter registered email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none text-white transition-all"
                />
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-[0.99] mt-2"
            >
              Verify Email & Deliver OTP
            </button>
          </form>
        )}

        {/* 4. VIEW: ENTER OTP */}
        {mode === 'otp' && (
          <form onSubmit={handleOtpVerify} className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-2 text-blue-400">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setSuccess('');
                  setMode('forgot');
                }}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold uppercase tracking-wider">Authorize Recovery Token</span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
              Enter the OTP authentication code. Copy code from the indicator below to verify connection.
            </p>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Simulated 6-Digit OTP Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="Enter 123456"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-2.5 text-center text-sm font-bold tracking-widest outline-none text-white transition-all"
              />
            </div>

            <div className="p-3 bg-indigo-950/20 border border-indigo-900/30 rounded-xl text-[10px] text-indigo-400 text-center font-bold uppercase tracking-wider">
              📢 Check your Zoho inbox or spam folder for the real 6-digit OTP code.
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-[0.99]"
            >
              Verify OTP Code
            </button>
          </form>
        )}

        {/* 5. VIEW: SET NEW PASSWORD */}
        {mode === 'reset-pass' && (
          <form onSubmit={handleResetPassword} className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-2 text-blue-400">
              <span className="text-xs font-bold uppercase tracking-wider">Set New Password</span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
              Credential authorization succeeded. Enter a new password for account <strong>{resetEmail}</strong>.
            </p>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none text-white transition-all"
                />
                <Key className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-[0.99]"
            >
              Save New Password
            </button>
          </form>
        )}

        {/* Sandbox note */}
        <div className="mt-8 border-t border-slate-800/80 pt-6 text-center text-[10px] text-slate-500 leading-relaxed">
          Demo database runs inside your browser session storage. Sessions are persistent.
        </div>
        </div>
      </div>
      <Footer isLoginScreen={true} />
    </div>
  );
};
