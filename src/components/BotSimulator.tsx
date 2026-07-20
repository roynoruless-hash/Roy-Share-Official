import React, { useState, useEffect } from 'react';
import { Bot, User, Withdraw, Transaction, Notification } from '../types';
import { 
  Send, Smartphone, User as UserIcon, CheckCircle2, Copy, Share2, 
  ExternalLink, Sparkles, AlertCircle, HelpCircle, ArrowLeft,
  ChevronRight, Compass, Bell, Settings, Award, History, Info, Clock, Check, Wallet
} from 'lucide-react';

interface BotSimulatorProps {
  activeBot: Bot | null;
  onRefreshBots: () => Promise<void>;
}

export default function BotSimulator({ activeBot, onRefreshBots }: BotSimulatorProps) {
  // Simulator profile
  const [telegramId, setTelegramId] = useState('519348572');
  const [username, setUsername] = useState('ritik_dev');
  const [fullName, setFullName] = useState('Ritik Rai');
  const [mobileNumber, setMobileNumber] = useState('9876543210');
  const [referredByInput, setReferredByInput] = useState('');
  const [deviceFingerprint, setDeviceFingerprint] = useState('simulated_fingerprint_' + Math.floor(1000 + Math.random() * 9000));

  // Simulation flow states
  const [joinedChannelIds, setJoinedChannelIds] = useState<Record<string, boolean>>({});
  const [joinedGroupIds, setJoinedGroupIds] = useState<Record<string, boolean>>({});
  const [botMessages, setBotMessages] = useState<{ sender: 'bot' | 'user'; text: string; timestamp: string; opt?: any }[]>([]);
  const [botStep, setBotStep] = useState<'welcome' | 'join_verify' | 'register_form' | 'otp_verification' | 'mini_app_unlocked'>('welcome');
  
  // Registration and OTP verification
  const [otpSent, setOtpSent] = useState('');
  const [userOtpInput, setUserOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpAttemptsLeft, setOtpAttemptsLeft] = useState(3);
  const [regError, setRegError] = useState('');

  // Mini App active screen
  const [miniAppTab, setMiniAppTab] = useState<'home' | 'wallet' | 'refer' | 'withdraw' | 'support' | 'notifications' | 'settings'>('home');

  // Mini App user data state
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdraws, setWithdraws] = useState<Withdraw[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Withdraw request state
  const [wdAmount, setWdAmount] = useState('');
  const [wdMethod, setWdMethod] = useState<'UPI' | 'Redeem Code'>('UPI');
  const [wdDetails, setWdDetails] = useState('');
  const [wdMessage, setWdMessage] = useState('');

  // Copy success animation
  const [copiedLink, setCopiedLink] = useState(false);

  // Load simulated user on start
  useEffect(() => {
    if (activeBot) {
      checkExistingUser();
      fetchNotifications();
    } else {
      resetSimulatorState();
    }
  }, [activeBot, telegramId]);

  const resetSimulatorState = () => {
    setUser(null);
    setBotStep('welcome');
    setBotMessages([]);
    setTransactions([]);
    setWithdraws([]);
    setJoinedChannelIds({});
    setJoinedGroupIds({});
  };

  const checkExistingUser = async () => {
    if (!activeBot) return;
    try {
      const res = await fetch(`/api/bots/${activeBot.id}/users/${telegramId}`);
      const data = await res.json();
      if (data.success && data.exists) {
        setUser(data.user);
        setBotStep('mini_app_unlocked');
        fetchUserHistory(data.user.telegramId);
      } else {
        setUser(null);
        setBotStep('welcome');
        initializeBotConversation();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUserHistory = async (tgId: string) => {
    if (!activeBot) return;
    try {
      const resTx = await fetch(`/api/bots/${activeBot.id}/transactions/${tgId}`);
      const dataTx = await resTx.json();
      if (dataTx.success) setTransactions(dataTx.transactions);

      const resWd = await fetch(`/api/bots/${activeBot.id}/withdraws/${tgId}`);
      const dataWd = await resWd.json();
      if (dataWd.success) setWithdraws(dataWd.withdraws);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNotifications = async () => {
    if (!activeBot) return;
    try {
      const res = await fetch(`/api/bots/${activeBot.id}/notifications`);
      const data = await res.json();
      if (data.success) setNotifications(data.notifications);
    } catch (e) {
      console.error(e);
    }
  };

  const initializeBotConversation = () => {
    if (!activeBot) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setBotMessages([
      {
        sender: 'bot',
        text: activeBot.settings.welcomeMessage,
        timestamp: time
      }
    ]);
  };

  const addMessage = (sender: 'bot' | 'user', text: string, opt?: any) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setBotMessages(prev => [...prev, { sender, text, timestamp: time, opt }]);
  };

  // Telegram Chat actions
  const handleStartBot = () => {
    if (botStep !== 'welcome') return;
    addMessage('user', '/start');
    
    setTimeout(() => {
      setBotStep('join_verify');
      addMessage('bot', '⚠️ Mandatary Channel and Group Verification!\n\nTo prevent abuse, you must join our verification channels and community group. Click the buttons below and then click verify.');
    }, 600);
  };

  const handleVerifyJoins = () => {
    if (!activeBot) return;

    // Verify all enabled mandatory channels
    const mandatoryChans = activeBot.channels.filter(c => c.enabled !== false && c.mandatory);
    const unjoinedChan = mandatoryChans.find(c => !joinedChannelIds[c.id]);
    if (unjoinedChan) {
      return alert(`Please click to join the mandatory Channel: "${unjoinedChan.name}" first.`);
    }

    // Verify all enabled mandatory groups
    const mandatoryGrps = activeBot.groups.filter(g => g.enabled !== false && g.mandatory);
    const unjoinedGrp = mandatoryGrps.find(g => !joinedGroupIds[g.id]);
    if (unjoinedGrp) {
      return alert(`Please click to join the mandatory Group: "${unjoinedGrp.name}" first.`);
    }

    addMessage('user', '🔍 Verify Membership Status');

    setTimeout(() => {
      setBotStep('register_form');
      addMessage('bot', '✅ Handle membership verified successfully!\n\nPlease complete your registration form to claim your referral profile link.');
    }, 600);
  };

  // Handle Register Submitting
  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBot) return;
    setRegError('');

    if (!fullName || !mobileNumber) {
      return setRegError('Full Name and Mobile Number are required.');
    }

    try {
      const res = await fetch(`/api/bots/${activeBot.id}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId,
          username,
          fullName,
          mobileNumber,
          referredBy: referredByInput,
          deviceFingerprint
        })
      });
      const data = await res.json();
      if (data.success) {
        addMessage('user', `Register: ${fullName} (${mobileNumber})`);
        
        // Request OTP instantly
        handleRequestOTP();
      } else {
        setRegError(data.message || 'Registration failed');
      }
    } catch (err) {
      setRegError('Server connection failure.');
    }
  };

  const handleRequestOTP = async () => {
    if (!activeBot) return;
    try {
      const res = await fetch(`/api/bots/${activeBot.id}/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, mobileNumber })
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(data.otp);
        setBotStep('otp_verification');
        setOtpAttemptsLeft(3);
        setUserOtpInput('');
        setOtpError('');
        
        // Push bot bubble message containing the simulated OTP
        addMessage('bot', `📩 OTP Verification Code sent to mobile number: +91 ${mobileNumber}.\n\nEnter the 6-digit security code.`, { showOtp: data.otp });
      } else {
        setRegError(data.message || 'Failed to dispatch OTP.');
      }
    } catch (err) {
      setRegError('Server connection failure.');
    }
  };

  // Verify OTP
  const handleVerifyOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBot || !userOtpInput) return;
    setOtpError('');

    try {
      const res = await fetch(`/api/bots/${activeBot.id}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, otp: userOtpInput })
      });
      const data = await res.json();
      if (data.success) {
        addMessage('user', `Verify Code: ${userOtpInput}`);
        addMessage('bot', '🎉 OTP Verified Successfully!\n\nYour registration is completed. Click the button below to launch the Mini App.');
        
        setUser(data.user);
        setBotStep('mini_app_unlocked');
        fetchUserHistory(data.user.telegramId);
        onRefreshBots(); // refreshes admin stats
      } else {
        setOtpError(data.message || 'Invalid verification OTP.');
        setOtpAttemptsLeft(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      setOtpError('Server validation failure.');
    }
  };

  // Claim Milestone Reward
  const handleClaimMilestone = async (milestoneId: string, referralsRequired: number) => {
    if (!activeBot || !user) return;
    try {
      const res = await fetch(`/api/bots/${activeBot.id}/users/${user.telegramId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestoneId })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Milestone claimed successfully! ₹${data.user.claimedRewards - user.claimedRewards} added to wallet balance!`);
        setUser(data.user);
        fetchUserHistory(data.user.telegramId);
        onRefreshBots(); // Refreshes admin panel
      } else {
        alert(data.message || 'Failed to claim milestone');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Withdrawal request
  const handlePostWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBot || !user || !wdAmount || !wdDetails) return;
    setWdMessage('');

    try {
      const res = await fetch(`/api/bots/${activeBot.id}/users/${user.telegramId}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(wdAmount),
          method: wdMethod,
          details: wdDetails
        })
      });
      const data = await res.json();
      if (data.success) {
        setWdMessage('Withdrawal request logged successfully! Waiting for administrator approval.');
        setWdAmount('');
        setWdDetails('');
        setUser(data.user);
        fetchUserHistory(data.user.telegramId);
        onRefreshBots(); // Refresh stats on admin side
      } else {
        setWdMessage(`Error: ${data.message}`);
      }
    } catch (err) {
      setWdMessage('Network error occurred.');
    }
  };

  // DEBUG / TESTING FUNCTIONS: Generate Mock Referrals
  const handleGenerateMockReferral = async (status: 'verified' | 'pending') => {
    if (!activeBot || !user) return;
    try {
      // Create a random mock invitee
      const mockTg = String(Math.floor(100000000 + Math.random() * 900000000));
      const mockName = `Invitee #${mockTg.substring(0, 4)}`;
      const mockMobile = String(Math.floor(6000000000 + Math.random() * 3999999999));

      // 1. Register Mock User
      const resReg = await fetch(`/api/bots/${activeBot.id}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: mockTg,
          username: `invitee_${mockTg.substring(0, 4)}`,
          fullName: mockName,
          mobileNumber: mockMobile,
          referredBy: user.telegramId,
          deviceFingerprint: 'fingerprint_' + mockTg
        })
      });
      const dataReg = await resReg.json();

      if (dataReg.success && status === 'verified') {
        // 2. Mock OTP request
        const resOtp = await fetch(`/api/bots/${activeBot.id}/otp/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegramId: mockTg, mobileNumber: mockMobile })
        });
        const dataOtp = await resOtp.json();

        // 3. Mock OTP verify to set Status to verified
        await fetch(`/api/bots/${activeBot.id}/otp/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegramId: mockTg, otp: dataOtp.otp })
        });
      }

      // Re-fetch current simulator user profile to see updated referral count
      await checkExistingUser();
      await onRefreshBots();
      alert(`Mock ${status} referral generated successfully!`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyLink = () => {
    if (!user || !activeBot) return;
    const refLink = `${window.location.origin}/?bot=${activeBot.username}&start=${user.telegramId}`;
    navigator.clipboard.writeText(refLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 font-sans text-slate-100 relative">
      {/* Simulator Frame Header */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Smartphone className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-wider font-display">Telegram Client Emulator</span>
        </div>
        
        {/* Toggle simulation profile settings */}
        <div className="flex items-center gap-2">
          {user && (
            <button 
              onClick={() => {
                if (window.confirm('Reset this simulation account?')) {
                  resetSimulatorState();
                }
              }}
              className="text-[9px] bg-slate-800 hover:bg-slate-700 hover:text-white px-2 py-0.5 rounded text-slate-400 font-mono"
            >
              Reset Account
            </button>
          )}
          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Active
          </span>
        </div>
      </div>

      {!activeBot ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="p-4 bg-indigo-600/10 rounded-full text-indigo-400 mb-4 animate-bounce">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="text-base font-bold font-display">Awaiting Active Bot Selection</h2>
          <p className="text-xs text-slate-400 mt-2 max-w-xs">
            To start simulating the Telegram user flow, please register a Telegram Bot in the Admin panel on the left and select it.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* SIMULATOR SCREEN CONTENT */}
          {botStep !== 'mini_app_unlocked' ? (
            /* TELEGRAM CHATBOT SIMULATION VIEW */
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
              {/* Bot Info Header */}
              <div className="p-3 bg-slate-900 flex items-center gap-3 border-b border-slate-850 shadow-md shrink-0">
                <img 
                  src={activeBot.photoUrl} 
                  alt={activeBot.name} 
                  className="w-10 h-10 rounded-full object-cover border border-indigo-500/20" 
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h3 className="text-xs font-bold text-white">{activeBot.name}</h3>
                  <p className="text-[10px] text-slate-400 font-mono">@{activeBot.username}</p>
                </div>
              </div>

              {/* Chat Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 flex flex-col">
                {botMessages.map((msg, index) => (
                  <div 
                    key={index} 
                    className={`max-w-[85%] flex flex-col ${msg.sender === 'user' ? 'self-end items-end' : 'self-start items-start'}`}
                  >
                    <div className={`p-3 text-xs leading-relaxed ${msg.sender === 'user' ? 'telegram-bubble-out bg-indigo-600' : 'telegram-bubble-in bg-slate-850'}`}>
                      {msg.text.split('\n').map((line, i) => (
                        <p key={i} className="min-h-[14px]">{line}</p>
                      ))}

                      {/* Display simulation OTP directly to help tester */}
                      {msg.opt?.showOtp && (
                        <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-center font-bold tracking-widest text-sm font-mono">
                          SIMULATOR CODE: {msg.opt.showOtp}
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-500 mt-1">{msg.timestamp}</span>
                  </div>
                ))}
              </div>

              {/* Bot Chat Footer Toggles */}
              <div className="p-3 bg-slate-900 border-t border-slate-850 shrink-0 space-y-2">
                {botStep === 'welcome' && (
                  <button 
                    onClick={handleStartBot}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20"
                  >
                    <Send className="w-3.5 h-3.5" />
                    START Telegram Bot
                  </button>
                )}

                {botStep === 'join_verify' && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-400 text-center uppercase tracking-wider font-semibold">Join Mandatory Handles</p>
                    <div className="grid grid-cols-1 gap-2 max-h-[140px] overflow-y-auto pr-1">
                      {activeBot.channels.filter(c => c.enabled !== false).map(c => {
                        const isJoined = !!joinedChannelIds[c.id];
                        return (
                          <button 
                            key={c.id}
                            onClick={() => {
                              setJoinedChannelIds(prev => ({ ...prev, [c.id]: true }));
                              window.open(c.url, '_blank');
                            }}
                            className={`py-2 px-3 text-[11px] rounded-lg font-semibold flex items-center justify-between gap-1.5 transition ${
                              isJoined 
                                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/35' 
                                : 'bg-slate-800 hover:bg-slate-750 text-white border border-slate-700'
                            }`}
                          >
                            <span className="truncate">Channel: {c.name} {c.mandatory && <span className="text-[9px] text-rose-400 font-bold ml-1">(Req)</span>}</span>
                            {isJoined ? <Check className="w-3.5 h-3.5 shrink-0" /> : <ExternalLink className="w-3.5 h-3.5 shrink-0" />}
                          </button>
                        );
                      })}
                      {activeBot.groups.filter(g => g.enabled !== false).map(g => {
                        const isJoined = !!joinedGroupIds[g.id];
                        return (
                          <button 
                            key={g.id}
                            onClick={() => {
                              setJoinedGroupIds(prev => ({ ...prev, [g.id]: true }));
                              window.open(g.url, '_blank');
                            }}
                            className={`py-2 px-3 text-[11px] rounded-lg font-semibold flex items-center justify-between gap-1.5 transition ${
                              isJoined 
                                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/35' 
                                : 'bg-sky-950/40 hover:bg-sky-950/65 text-sky-400 border border-sky-850'
                            }`}
                          >
                            <span className="truncate">Group: {g.name} {g.mandatory && <span className="text-[9px] text-rose-400 font-bold ml-1">(Req)</span>}</span>
                            {isJoined ? <Check className="w-3.5 h-3.5 shrink-0" /> : <ExternalLink className="w-3.5 h-3.5 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button 
                      onClick={handleVerifyJoins}
                      className="w-full bg-indigo-600 hover:bg-indigo-550 text-white font-bold py-2.5 rounded-xl transition text-xs shadow-md shadow-indigo-600/10"
                    >
                      Verify Membership Join
                    </button>
                  </div>
                )}

                {botStep === 'register_form' && (
                  <form onSubmit={handleRegisterUser} className="space-y-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <div className="flex justify-between items-center pb-1 border-b border-slate-850">
                      <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wide">Register Account Profile</h4>
                      <span className="text-[9px] text-slate-500 font-mono">SIMULATED ID: {telegramId}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[9px] text-slate-450 mb-0.5">Full Name</label>
                        <input 
                          type="text" 
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-450 mb-0.5">Mobile Number</label>
                        <input 
                          type="text" 
                          value={mobileNumber}
                          onChange={(e) => setMobileNumber(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] text-slate-450 mb-0.5">Referrer ID (Optional / Leave blank for direct)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 519348572" 
                        value={referredByInput}
                        onChange={(e) => setReferredByInput(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-[11px] font-mono"
                      />
                    </div>

                    {regError && (
                      <p className="text-[10px] text-rose-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{regError}</span>
                      </p>
                    )}

                    <button 
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg transition text-xs"
                    >
                      Save & Request OTP Verification
                    </button>
                  </form>
                )}

                {botStep === 'otp_verification' && (
                  <form onSubmit={handleVerifyOTPSubmit} className="space-y-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <div className="flex justify-between items-center pb-1 border-b border-slate-850">
                      <h4 className="text-[11px] font-bold text-yellow-500 uppercase tracking-wide">Enter OTP Security Code</h4>
                      <span className="text-[9px] text-slate-500">Attempts left: {otpAttemptsLeft}</span>
                    </div>

                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Enter 6-digit OTP code"
                        value={userOtpInput}
                        onChange={(e) => setUserOtpInput(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded p-2 text-xs text-center font-bold font-mono tracking-widest text-yellow-500"
                        maxLength={6}
                      />
                      <button 
                        type="button"
                        onClick={handleRequestOTP}
                        className="bg-slate-850 hover:bg-slate-800 text-[10px] text-slate-400 hover:text-white px-2.5 rounded border border-slate-850"
                      >
                        Resend OTP
                      </button>
                    </div>

                    {otpError && (
                      <p className="text-[10px] text-rose-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{otpError}</span>
                      </p>
                    )}

                    <button 
                      type="submit"
                      disabled={!userOtpInput || otpAttemptsLeft === 0}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg transition text-xs disabled:opacity-50"
                    >
                      Submit Verification Code
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : (
            /* TELEGRAM MINI APP VIEW (DASHBOARD LAYER) */
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
              {/* Mini App Mock Header */}
              <div className="p-3 bg-slate-950 border-b border-slate-850 flex items-center justify-between shadow-md shrink-0">
                <div className="flex items-center gap-2">
                  <img 
                    src={activeBot.photoUrl} 
                    alt={activeBot.name} 
                    className="w-8 h-8 rounded-full border border-indigo-600/30 object-cover" 
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h3 className="text-xs font-extrabold text-white font-display tracking-tight">{activeBot.name}</h3>
                    <span className="text-[9px] text-indigo-400 font-bold px-1.5 py-0.2 bg-indigo-950/40 rounded-full font-mono">MINI APP</span>
                  </div>
                </div>

                {/* Close/Exit Mini App */}
                <button 
                  onClick={() => {
                    setBotStep('welcome');
                    initializeBotConversation();
                  }}
                  className="p-1 text-slate-500 hover:text-slate-350 hover:bg-slate-850 rounded"
                  title="Close Mini App"
                >
                  <LogOutIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Developer Test Dashboard Panel (Only visible inside simulator for seamless testing) */}
              <div className="bg-slate-950 px-3 py-1.5 border-b border-slate-850 flex items-center justify-between text-[10px] text-indigo-300 font-mono select-none">
                <span>🧪 Testing Controls:</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleGenerateMockReferral('verified')}
                    className="bg-indigo-900/30 hover:bg-indigo-900/50 text-[9px] px-1.5 py-0.5 rounded border border-indigo-800 text-indigo-300"
                  >
                    +1 Verified Invite
                  </button>
                  <button 
                    onClick={() => handleGenerateMockReferral('pending')}
                    className="bg-slate-800 hover:bg-slate-700 text-[9px] px-1.5 py-0.5 rounded border border-slate-750 text-slate-300"
                  >
                    +1 Pending Invite
                  </button>
                </div>
              </div>

              {/* Mini App Content Layer */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {miniAppTab === 'home' && user && (
                  <div className="space-y-4">
                    {/* User Profile Card */}
                    <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850 flex items-center justify-between gap-3 shadow-lg relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl" />
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-xl shadow-md">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white font-display">{user.fullName}</h4>
                          <p className="text-[10px] text-slate-450 font-mono">@{user.username} | ID: {user.telegramId}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase tracking-wide font-medium">Verified Wallet</span>
                        <span className="text-lg font-black text-yellow-500 font-display">₹{user.walletBalance.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Stats Balance panel cards */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="p-3 bg-slate-950/40 border border-slate-850/80 rounded-xl">
                        <span className="text-[10px] text-slate-450 uppercase block font-semibold tracking-wider">Total Earned</span>
                        <span className="text-base font-extrabold text-indigo-400 mt-1 block">₹{user.totalEarned.toFixed(2)}</span>
                      </div>
                      <div className="p-3 bg-slate-950/40 border border-slate-850/80 rounded-xl">
                        <span className="text-[10px] text-slate-450 uppercase block font-semibold tracking-wider">Withdrawn Cash</span>
                        <span className="text-base font-extrabold text-emerald-400 mt-1 block">₹{user.totalWithdrawn.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Milestone System Section */}
                    <div className="p-4 bg-slate-950/40 border border-slate-850/80 rounded-2xl space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-850/60 pb-2">
                        <h4 className="text-xs font-bold text-white font-display flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-indigo-400" />
                          Referral milestone System
                        </h4>
                        <span className="text-[10px] bg-slate-850 px-2 py-0.5 rounded-full font-bold font-mono text-indigo-300">
                          {user.referralCount} Verified Invites
                        </span>
                      </div>

                      {/* Display progress cards for upcoming milestones */}
                      {activeBot.milestones.filter(m => m.enabled).map(m => {
                        const isUnlocked = user.referralCount >= m.referralsRequired;
                        const progress = Math.min(100, (user.referralCount / m.referralsRequired) * 100);
                        
                        return (
                          <div key={m.id} className="p-3 bg-slate-900 border border-slate-850 rounded-xl space-y-2.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-300">{m.referralsRequired} Referrals Target</span>
                              <span className="font-bold text-yellow-500 font-mono">₹{m.rewardAmount} CASH</span>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-850">
                              <div 
                                className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full rounded-full transition-all duration-500" 
                                style={{ width: `${progress}%` }}
                              />
                            </div>

                            {/* Info text + Claim button */}
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-450 font-mono">{user.referralCount} / {m.referralsRequired} Complete</span>
                              {isUnlocked ? (
                                <button 
                                  onClick={() => handleClaimMilestone(m.id, m.referralsRequired)}
                                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1 rounded text-[10px] transition"
                                >
                                  Claim Reward
                                </button>
                              ) : (
                                <span className="text-slate-500 italic">Locked</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Navigation Mini App quick grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setMiniAppTab('wallet')}
                        className="p-3 bg-slate-950/40 hover:bg-slate-950/50 rounded-xl border border-slate-850 text-left transition text-xs"
                      >
                        <Wallet className="w-4 h-4 text-yellow-500 mb-1.5" />
                        <span className="font-bold block text-white">Wallet Hub</span>
                        <span className="text-[10px] text-slate-500">History & transactions</span>
                      </button>

                      <button 
                        onClick={() => setMiniAppTab('refer')}
                        className="p-3 bg-slate-950/40 hover:bg-slate-950/50 rounded-xl border border-slate-850 text-left transition text-xs"
                      >
                        <Share2 className="w-4 h-4 text-indigo-400 mb-1.5" />
                        <span className="font-bold block text-white">Refer & Earn</span>
                        <span className="text-[10px] text-slate-500">Milestones list</span>
                      </button>

                      <button 
                        onClick={() => setMiniAppTab('withdraw')}
                        className="p-3 bg-slate-950/40 hover:bg-slate-950/50 rounded-xl border border-slate-850 text-left transition text-xs"
                      >
                        <Clock className="w-4 h-4 text-emerald-400 mb-1.5" />
                        <span className="font-bold block text-white">Withdraw</span>
                        <span className="text-[10px] text-slate-500">Cash-out balance</span>
                      </button>

                      <button 
                        onClick={() => setMiniAppTab('notifications')}
                        className="p-3 bg-slate-950/40 hover:bg-slate-950/50 rounded-xl border border-slate-850 text-left transition text-xs"
                      >
                        <Bell className="w-4 h-4 text-amber-500 mb-1.5" />
                        <span className="font-bold block text-white">Updates</span>
                        <span className="text-[10px] text-slate-500">Announcements</span>
                      </button>
                    </div>

                    {/* Support & settings row */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button 
                        onClick={() => setMiniAppTab('support')}
                        className="p-2.5 bg-slate-950/20 border border-slate-850/60 rounded-xl hover:bg-slate-950/30 flex items-center justify-center gap-1.5 transition text-[11px]"
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                        FAQs & Support
                      </button>
                      <button 
                        onClick={() => setMiniAppTab('settings')}
                        className="p-2.5 bg-slate-950/20 border border-slate-850/60 rounded-xl hover:bg-slate-950/30 flex items-center justify-center gap-1.5 transition text-[11px]"
                      >
                        <Settings className="w-3.5 h-3.5 text-slate-400" />
                        Account Settings
                      </button>
                    </div>
                  </div>
                )}

                {miniAppTab === 'wallet' && user && (
                  <div className="space-y-4">
                    <button 
                      onClick={() => setMiniAppTab('home')}
                      className="text-xs text-indigo-400 hover:text-white flex items-center gap-1 font-semibold"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
                    </button>

                    <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850 text-center space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">Available balance</span>
                      <h2 className="text-2xl font-black font-display text-yellow-500">₹{user.walletBalance.toFixed(2)}</h2>
                      <div className="pt-2 flex justify-center gap-3 text-[10px] text-slate-400 font-mono">
                        <span>Earned: ₹{user.totalEarned}</span>
                        <span>•</span>
                        <span>Pending: ₹{user.pendingWithdraw}</span>
                      </div>
                    </div>

                    {/* Transactions Ledger log */}
                    <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-indigo-400" />
                        Transactions History
                      </h4>

                      {transactions.length === 0 ? (
                        <p className="text-xs text-slate-500 italic text-center p-3">No transactions recorded yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {transactions.map(tx => (
                            <div key={tx.id} className="p-2.5 bg-slate-900 border border-slate-850/60 rounded-xl flex items-center justify-between text-xs">
                              <div>
                                <p className="font-semibold text-white">{tx.description}</p>
                                <p className="text-[9px] text-slate-500 font-mono">{tx.timestamp.split('T')[0]} {tx.timestamp.split('T')[1].substring(0, 5)}</p>
                              </div>
                              <span className={`font-mono font-bold ${tx.type === 'credit' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {tx.type === 'credit' ? '+' : '-'}₹{tx.amount}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {miniAppTab === 'refer' && user && (
                  <div className="space-y-4">
                    <button 
                      onClick={() => setMiniAppTab('home')}
                      className="text-xs text-indigo-400 hover:text-white flex items-center gap-1 font-semibold"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
                    </button>

                    {/* Referral link Card */}
                    <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850 text-center space-y-3 relative overflow-hidden">
                      <h3 className="text-xs font-bold text-white font-display uppercase tracking-wide">Invite Friends & Earn Rewards</h3>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Referrals only credit when your friends join verification handles and complete Mobile OTP. Claim milestones for cash rewards!
                      </p>

                      <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-850 flex items-center justify-between text-xs font-mono select-all">
                        <span className="text-[10px] text-indigo-300 truncate mr-2">
                          {window.location.origin}/?bot={activeBot.username}&start={user.telegramId}
                        </span>
                        <button 
                          onClick={handleCopyLink}
                          className="p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-white shrink-0 transition"
                          title="Copy Link"
                        >
                          {copiedLink ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Referral Progress metrics */}
                    <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-3">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Milestone Performance targets</h4>
                      
                      <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="bg-slate-900 p-2 rounded">
                          <span className="text-[10px] text-slate-450 block">Total Referrals</span>
                          <span className="font-extrabold text-white text-sm">{user.referralCount} Users</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded">
                          <span className="text-[10px] text-slate-455 block">Milestone Earnings</span>
                          <span className="font-extrabold text-yellow-500 text-sm">₹{user.claimedRewards}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {miniAppTab === 'withdraw' && user && (
                  <div className="space-y-4">
                    <button 
                      onClick={() => setMiniAppTab('home')}
                      className="text-xs text-indigo-400 hover:text-white flex items-center gap-1 font-semibold"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
                    </button>

                    <form onSubmit={handlePostWithdraw} className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-850 pb-1.5">Submit Withdraw request</h3>
                      
                      <div className="bg-slate-900 p-2 rounded-lg text-center text-xs text-slate-400 font-mono">
                        Minimum Withdrawal Limit: <span className="font-bold text-yellow-500">₹{activeBot.settings.minWithdraw}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <button 
                          type="button" 
                          onClick={() => setWdMethod('UPI')}
                          className={`py-2 rounded-lg font-semibold transition ${wdMethod === 'UPI' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'}`}
                        >
                          UPI Address
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setWdMethod('Redeem Code')}
                          className={`py-2 rounded-lg font-semibold transition ${wdMethod === 'Redeem Code' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'}`}
                        >
                          Redeem Code
                        </button>
                      </div>

                      <div className="text-xs">
                        <label className="block text-[10px] text-slate-450 mb-0.5">Amount (₹)</label>
                        <input 
                          type="number" 
                          value={wdAmount}
                          onChange={(e) => setWdAmount(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-850 rounded p-2 text-xs font-bold text-yellow-500 text-right"
                          placeholder={`Min ₹${activeBot.settings.minWithdraw}`}
                        />
                      </div>

                      <div className="text-xs">
                        <label className="block text-[10px] text-slate-450 mb-0.5">
                          {wdMethod === 'UPI' ? 'UPI Address / Virtual Payment ID' : 'Mobile Number / Email'}
                        </label>
                        <input 
                          type="text" 
                          value={wdDetails}
                          onChange={(e) => setWdDetails(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-850 rounded p-2 text-xs text-white"
                          placeholder={wdMethod === 'UPI' ? 'e.g. ritik@upi' : 'e.g. email@domain.com'}
                        />
                      </div>

                      {wdMessage && (
                        <p className={`text-[11px] p-2 rounded ${wdMessage.startsWith('Error') ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                          {wdMessage}
                        </p>
                      )}

                      <button 
                        type="submit"
                        disabled={!wdAmount || !wdDetails || Number(wdAmount) < activeBot.settings.minWithdraw || user.walletBalance < Number(wdAmount)}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg transition text-xs disabled:opacity-40"
                      >
                        Submit Withdrawal request
                      </button>
                    </form>

                    {/* Withdrawal logs history */}
                    <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Withdrawals logs History</h4>
                      
                      {withdraws.length === 0 ? (
                        <p className="text-xs text-slate-500 italic text-center p-3">No withdrawal requests filed.</p>
                      ) : (
                        <div className="space-y-2">
                          {withdraws.map(w => (
                            <div key={w.id} className="p-2.5 bg-slate-900 border border-slate-850 rounded-xl text-xs space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-300">{w.method}</span>
                                <span className="font-extrabold text-yellow-500">₹{w.amount}</span>
                              </div>
                              <p className="text-[9px] text-slate-500 font-mono">Recipient: {w.details}</p>
                              
                              <div className="flex justify-between items-center text-[10px] pt-1">
                                <span className={`font-semibold uppercase ${w.status === 'approved' ? 'text-emerald-400' : w.status === 'rejected' ? 'text-rose-400' : 'text-amber-400'}`}>
                                  {w.status}
                                </span>
                                <span className="text-[9px] text-slate-500 font-mono">{w.timestamp.split('T')[0]}</span>
                              </div>

                              {w.status === 'rejected' && (
                                <p className="text-[10px] text-rose-400 italic font-medium bg-rose-500/5 p-1 rounded border border-rose-500/10">Rejection Reason: {w.reason}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {miniAppTab === 'notifications' && (
                  <div className="space-y-4">
                    <button 
                      onClick={() => setMiniAppTab('home')}
                      className="text-xs text-indigo-400 hover:text-white flex items-center gap-1 font-semibold"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
                    </button>

                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Announcement Updates ({notifications.length})</h3>
                      
                      {notifications.length === 0 ? (
                        <p className="text-xs text-slate-500 italic text-center p-4">No notifications yet.</p>
                      ) : (
                        <div className="space-y-2.5">
                          {notifications.map(n => (
                            <div key={n.id} className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-1 text-xs">
                              <h4 className="font-bold text-indigo-300">{n.title}</h4>
                              <p className="text-[11px] text-slate-400 leading-relaxed">{n.message}</p>
                              <span className="text-[8px] text-slate-500 font-mono block text-right pt-1">{n.timestamp.split('T')[0]}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {miniAppTab === 'support' && (
                  <div className="space-y-4">
                    <button 
                      onClick={() => setMiniAppTab('home')}
                      className="text-xs text-indigo-400 hover:text-white flex items-center gap-1 font-semibold"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
                    </button>

                    <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-850 pb-1.5">Frequently Asked Questions</h3>
                      
                      <div className="space-y-2 text-xs">
                        <div className="p-2.5 bg-slate-900 rounded-lg">
                          <p className="font-bold text-white">How do I verify referrals?</p>
                          <p className="text-[10px] text-slate-450 mt-1">Invited users must click /start on the bot, join all verification channels/groups, and verify mobile number via OTP.</p>
                        </div>
                        <div className="p-2.5 bg-slate-900 rounded-lg">
                          <p className="font-bold text-white">When can I withdraw cash?</p>
                          <p className="text-[10px] text-slate-450 mt-1">Once your wallet balance crosses the minimum configured withdraw limit set by active administration.</p>
                        </div>
                        <div className="p-2.5 bg-slate-900 rounded-lg">
                          <p className="font-bold text-white">Can I log in on multiple accounts?</p>
                          <p className="text-[10px] text-slate-450 mt-1">No, our fraud system logs unique device fingerprints. Multiple registrations on same device triggers blockage warning.</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-indigo-950/25 border border-indigo-900/30 rounded-xl text-center text-xs">
                      <p className="text-slate-400">Need direct support?</p>
                      <a href="https://t.me/royshare_support" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-indigo-400 hover:underline font-bold mt-1.5">
                        <ExternalLink className="w-3.5 h-3.5" /> Contact Bot Support Handle
                      </a>
                    </div>
                  </div>
                )}

                {miniAppTab === 'settings' && user && (
                  <div className="space-y-4">
                    <button 
                      onClick={() => setMiniAppTab('home')}
                      className="text-xs text-indigo-400 hover:text-white flex items-center gap-1 font-semibold"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
                    </button>

                    <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850 space-y-3 text-xs">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Simulator Profiles</h3>
                      
                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Mock Username</label>
                          <input 
                            type="text" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Mock Telegram ID</label>
                          <input 
                            type="text" 
                            value={telegramId}
                            onChange={(e) => setTelegramId(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        resetSimulatorState();
                        alert('Simulation Profile Terminated.');
                      }}
                      className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 rounded-xl transition text-xs"
                    >
                      Log Out / Hard Reset Account
                    </button>
                  </div>
                )}
              </div>

              {/* Bottom bar Mini App Navigation footer */}
              <div className="p-2 bg-slate-950 border-t border-slate-850 flex justify-around text-[10px] text-slate-450 shrink-0">
                <button 
                  onClick={() => { setMiniAppTab('home'); }}
                  className={`flex flex-col items-center gap-0.5 transition ${miniAppTab === 'home' ? 'text-indigo-400 font-bold' : 'hover:text-white'}`}
                >
                  <Compass className="w-4 h-4" />
                  <span>Home</span>
                </button>
                <button 
                  onClick={() => { setMiniAppTab('wallet'); }}
                  className={`flex flex-col items-center gap-0.5 transition ${miniAppTab === 'wallet' ? 'text-indigo-400 font-bold' : 'hover:text-white'}`}
                >
                  <Wallet className="w-4 h-4" />
                  <span>Wallet</span>
                </button>
                <button 
                  onClick={() => { setMiniAppTab('refer'); }}
                  className={`flex flex-col items-center gap-0.5 transition ${miniAppTab === 'refer' ? 'text-indigo-400 font-bold' : 'hover:text-white'}`}
                >
                  <Share2 className="w-4 h-4" />
                  <span>Refer</span>
                </button>
                <button 
                  onClick={() => { setMiniAppTab('withdraw'); }}
                  className={`flex flex-col items-center gap-0.5 transition ${miniAppTab === 'withdraw' ? 'text-indigo-400 font-bold' : 'hover:text-white'}`}
                >
                  <Clock className="w-4 h-4" />
                  <span>Withdraw</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Simple fallback helper component since standard LogOut is occasionally missing in packages
function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
    </svg>
  );
}
