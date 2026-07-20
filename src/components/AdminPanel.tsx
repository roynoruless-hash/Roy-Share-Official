import React, { useState, useEffect } from 'react';
import { 
  Bot, User, Withdraw, Transaction, Notification, AdminLog 
} from '../types';
import { 
  LayoutDashboard, Bot as BotIcon, Key, Sliders, Users, 
  Wallet, Settings, MessageSquare, AlertTriangle, Play, Square,
  CheckCircle, XCircle, Trash2, Shield, Plus, Edit, 
  TrendingUp, Activity, Bell, FileText, ArrowUpRight, ArrowDownLeft,
  ChevronRight, RefreshCw, Smartphone, Search, Check, Lock, Unlock, LogOut,
  Database, ShieldAlert, Clock as ClockIcon
} from 'lucide-react';

interface AdminPanelProps {
  bots: Bot[];
  activeBot: Bot | null;
  onSelectBot: (bot: Bot | null) => void;
  onRefreshBots: () => Promise<void>;
  onBotCreated: (bot: Bot) => void;
}

export default function AdminPanel({
  bots,
  activeBot,
  onSelectBot,
  onRefreshBots,
  onBotCreated
}: AdminPanelProps) {
  // Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'bots' | 'more'>('dashboard');
  const [activeSubTab, setActiveSubTab] = useState<'channels' | 'users' | 'milestones' | 'wallet' | 'withdrawals' | 'broadcast' | 'analytics' | 'settings' | 'security' | 'backup' | 'diagnostics' | null>(null);

  // Stats / Analytics state
  const [stats, setStats] = useState({
    totalUsers: 0,
    todayUsers: 0,
    verifiedUsers: 0,
    totalWallet: 0,
    pendingWithdraw: 0,
    totalWithdrawn: 0,
    referralCount: 0,
    withdrawCount: 0,
  });

  // Form states
  const [botToken, setBotToken] = useState('');
  const [isCreatingBot, setIsCreatingBot] = useState(false);
  const [botError, setBotError] = useState('');
  
  // Settings Form State
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [minWithdraw, setMinWithdraw] = useState(100);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [referralEnabled, setReferralEnabled] = useState(true);
  const [walletEnabled, setWalletEnabled] = useState(true);

  // Channels / Groups State
  const [channels, setChannels] = useState<Bot['channels']>([]);
  const [newChanName, setNewChanName] = useState('');
  const [newChanUrl, setNewChanUrl] = useState('');
  const [newChanMandatory, setNewChanMandatory] = useState(true);
  const [newChanEnabled, setNewChanEnabled] = useState(true);

  // Edit Channels state
  const [editingChanId, setEditingChanId] = useState<string | null>(null);
  const [editingChanName, setEditingChanName] = useState('');
  const [editingChanUrl, setEditingChanUrl] = useState('');
  const [editingChanMandatory, setEditingChanMandatory] = useState(true);
  const [editingChanEnabled, setEditingChanEnabled] = useState(true);

  const [groups, setGroups] = useState<Bot['groups']>([]);
  const [newGrpName, setNewGrpName] = useState('');
  const [newGrpUrl, setNewGrpUrl] = useState('');
  const [newGrpMandatory, setNewGrpMandatory] = useState(true);
  const [newGrpEnabled, setNewGrpEnabled] = useState(true);

  // Edit Groups state
  const [editingGrpId, setEditingGrpId] = useState<string | null>(null);
  const [editingGrpName, setEditingGrpName] = useState('');
  const [editingGrpUrl, setEditingGrpUrl] = useState('');
  const [editingGrpMandatory, setEditingGrpMandatory] = useState(true);
  const [editingGrpEnabled, setEditingGrpEnabled] = useState(true);

  // User Manager State
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [walletAdjustAmount, setWalletAdjustAmount] = useState('');
  const [walletAdjustAction, setWalletAdjustAction] = useState<'credit' | 'debit'>('credit');
  const [walletAdjustDesc, setWalletAdjustDesc] = useState('');
  const [userTxHistory, setUserTxHistory] = useState<Transaction[]>([]);
  const [userWdHistory, setUserWdHistory] = useState<Withdraw[]>([]);

  // Milestones State
  const [milestones, setMilestones] = useState<{ id: string; referralsRequired: number; rewardAmount: number; enabled: boolean }[]>([]);
  const [newMilestoneReferrals, setNewMilestoneReferrals] = useState('');
  const [newMilestoneReward, setNewMilestoneReward] = useState('');

  // Withdrawals State
  const [withdrawals, setWithdrawals] = useState<Withdraw[]>([]);
  const [wdRejectReason, setWdRejectReason] = useState('');
  const [wdActiveModal, setWdActiveModal] = useState<Withdraw | null>(null);

  // Broadcast campaign state
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastSuccess, setBroadcastSuccess] = useState('');

  // Audit Logs State
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [globalTransactions, setGlobalTransactions] = useState<Transaction[]>([]);

  // Loader
  const [isLoading, setIsLoading] = useState(false);

  // Backup / Security / Wallet state additions
  const [backupText, setBackupText] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Diagnostics & Auto Repair states
  const [diagResults, setDiagResults] = useState<any>(null);
  const [diagLogs, setDiagLogs] = useState<string[]>([]);
  const [isDiagRunning, setIsDiagRunning] = useState(false);
  const [overallPass, setOverallPass] = useState(false);
  const [isRepairing, setIsRepairing] = useState<string | null>(null);

  const runDiagnostics = async (botId: string, testName: string = 'all') => {
    if (!botId) return;
    setIsDiagRunning(true);
    try {
      const res = await fetch(`/api/bots/${botId}/diagnostics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: testName })
      });
      const data = await res.json();
      if (data.success) {
        if (testName === 'all') {
          setDiagResults(data.results);
          setDiagLogs(data.logs);
          setOverallPass(data.results.overallStatus === 'PASS');
        } else {
          setDiagResults((prev: any) => {
            const nextResults = {
              ...prev,
              ...data.results
            };
            const mandatorySuccess = 
              nextResults.telegramApi?.status === 'SUCCESS' && 
              nextResults.render?.status === 'SUCCESS';
            nextResults.overallStatus = mandatorySuccess ? 'PASS' : 'FAIL';
            setOverallPass(mandatorySuccess);
            return nextResults;
          });
          setDiagLogs(prev => [...prev, ...data.logs]);
        }
        showToast(testName === 'all' ? 'Diagnostics scan completed!' : `Diagnostic test ${testName} completed!`, 'success');
      } else {
        showToast(data.message || 'Diagnostics failed.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Could not reach backend diagnostics service.', 'error');
    } finally {
      setIsDiagRunning(false);
    }
  };

  const runAutoRepair = async (botId: string, actionName: string) => {
    if (!botId) return;
    setIsRepairing(actionName);
    try {
      const res = await fetch(`/api/bots/${botId}/repair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionName })
      });
      const data = await res.json();
      if (data.success) {
        setDiagLogs(prev => [...prev, ...data.logs]);
        showToast(`Auto repair action: "${actionName}" succeeded!`, 'success');
        await runDiagnostics(botId, 'all');
      } else {
        if (data.logs) setDiagLogs(prev => [...prev, ...data.logs]);
        showToast(data.error || 'Auto repair failed.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Repair service unreachable.', 'error');
    } finally {
      setIsRepairing(null);
    }
  };

  useEffect(() => {
    if (activeBot) {
      runDiagnostics(activeBot.id, 'all');
    } else {
      setDiagResults(null);
      setDiagLogs([]);
      setOverallPass(false);
    }
  }, [activeBot]);

  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Processing state for toggle/delete buttons
  const [isProcessingBotId, setIsProcessingBotId] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  // Clear toast after timer
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fetch bot specific details when activeBot changes
  useEffect(() => {
    if (activeBot) {
      setWelcomeMessage(activeBot.settings.welcomeMessage);
      setMaintenanceMode(activeBot.settings.maintenanceMode);
      setMinWithdraw(activeBot.settings.minWithdraw);
      setRegistrationEnabled(activeBot.settings.registrationEnabled);
      setReferralEnabled(activeBot.settings.referralEnabled);
      setWalletEnabled(activeBot.settings.walletEnabled);
      setChannels(activeBot.channels || []);
      setGroups(activeBot.groups || []);
      setMilestones(activeBot.milestones || []);
      fetchBotData();
    } else {
      setStats({
        totalUsers: 0,
        todayUsers: 0,
        verifiedUsers: 0,
        totalWallet: 0,
        pendingWithdraw: 0,
        totalWithdrawn: 0,
        referralCount: 0,
        withdrawCount: 0,
      });
      setUsers([]);
      setWithdrawals([]);
      setLogs([]);
      setGlobalTransactions([]);
    }
  }, [activeBot]);

  const fetchBotData = async () => {
    if (!activeBot) return;
    setIsLoading(true);
    try {
      // Fetch Analytics
      const resStats = await fetch(`/api/bots/${activeBot.id}/analytics`);
      const dataStats = await resStats.json();
      if (dataStats.success) setStats(dataStats.analytics);

      // Fetch Users
      const resUsers = await fetch(`/api/bots/${activeBot.id}/admin/users`);
      const dataUsers = await resUsers.json();
      if (dataUsers.success) setUsers(dataUsers.users);

      // Fetch Withdrawals
      const resWds = await fetch(`/api/bots/${activeBot.id}/admin/withdraws`);
      const dataWds = await resWds.json();
      if (dataWds.success) setWithdrawals(dataWds.withdraws);

      // Fetch Audit Logs
      const resLogs = await fetch(`/api/bots/${activeBot.id}/admin/logs`);
      const dataLogs = await resLogs.json();
      if (dataLogs.success) setLogs(dataLogs.logs);

      // Fetch Global Transactions
      const resTxs = await fetch(`/api/bots/${activeBot.id}/admin/transactions`);
      const dataTxs = await resTxs.json();
      if (dataTxs.success) setGlobalTransactions(dataTxs.transactions);

    } catch (e) {
      console.error('Error fetching bot data', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Backup and Restore Handlers
  const handleTriggerBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await fetch('/api/admin/backup');
      const data = await res.json();
      if (data.success) {
        const blob = new Blob([data.backup], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `roy-share-db-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Database backup file downloaded successfully!', 'success');
      } else {
        showToast('Failed to generate backup.', 'error');
      }
    } catch (err) {
      showToast('Failed to connect to server backup API.', 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreBackup = async (text: string) => {
    if (!text) {
      showToast('Please paste a backup JSON payload.', 'error');
      return;
    }
    setIsRestoring(true);
    try {
      const res = await fetch('/api/admin/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup: text })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Database restored successfully! Reloading...', 'success');
        setBackupText('');
        await onRefreshBots();
      } else {
        showToast(data.message || 'Error restoring database.', 'error');
      }
    } catch (err) {
      showToast('Failed to connect to backup restore API.', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  // Create Bot
  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botToken) return;
    setIsCreatingBot(true);
    setBotError('');
    try {
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: botToken })
      });
      const data = await res.json();
      if (data.success) {
        onBotCreated(data.bot);
        setBotToken('');
        // select as active bot
        onSelectBot(data.bot);
        setActiveTab('dashboard');
      } else {
        setBotError(data.message || 'Error creating bot');
      }
    } catch (err) {
      setBotError('Failed to connect to backend server.');
    } finally {
      setIsCreatingBot(false);
    }
  };

  // Toggle Bot Status
  const handleToggleBot = async (botId: string) => {
    if (isProcessingBotId) return;
    setIsProcessingBotId(botId);
    try {
      const res = await fetch(`/api/bots/${botId}/toggle`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`Bot @${data.bot.username} status toggled to: ${data.bot.status.toUpperCase()}`, 'success');
        await onRefreshBots();
        if (activeBot && activeBot.id === botId) {
          onSelectBot(data.bot);
        }
      } else {
        showToast(data.message || 'Failed to toggle bot status.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error. Failed to toggle bot status.', 'error');
    } finally {
      setIsProcessingBotId(null);
    }
  };

  // Delete Bot
  const handleDeleteBot = async (botId: string) => {
    if (isProcessingBotId) return;
    if (!window.confirm('Are you sure you want to delete this bot?')) return;

    setIsProcessingBotId(botId);
    try {
      const res = await fetch(`/api/bots/${botId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Bot and all isolated collection data deleted successfully.', 'success');
        
        // Auto-switch to another available bot if the active bot was deleted
        const remainingBots = bots.filter(b => b.id !== botId);
        if (activeBot && activeBot.id === botId) {
          if (remainingBots.length > 0) {
            onSelectBot(remainingBots[0]);
          } else {
            onSelectBot(null);
          }
        }
        
        await onRefreshBots();
      } else {
        showToast(data.message || 'Failed to delete bot.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error. Failed to delete bot.', 'error');
    } finally {
      setIsProcessingBotId(null);
    }
  };

  // Save General Settings
  const handleSaveSettings = async () => {
    if (!activeBot) return;
    try {
      const res = await fetch(`/api/bots/${activeBot.id}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            welcomeMessage,
            maintenanceMode,
            minWithdraw: Number(minWithdraw),
            registrationEnabled,
            referralEnabled,
            walletEnabled
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('General settings saved successfully!');
        onSelectBot(data.bot);
        await onRefreshBots();
        fetchBotData();
      }
    } catch (err) {
      alert('Failed to save settings.');
    }
  };

  // Channels Setup
  const handleAddChannel = async () => {
    if (!activeBot || !newChanName || !newChanUrl) return;
    const priority = channels.length > 0 ? Math.max(...channels.map(c => c.priority || 0)) + 1 : 1;
    const newChan = {
      id: 'chan_' + Date.now(),
      name: newChanName,
      url: newChanUrl,
      mandatory: newChanMandatory,
      enabled: newChanEnabled,
      priority
    };
    const updated = [...channels, newChan].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    try {
      const res = await fetch(`/api/bots/${activeBot.id}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels: updated })
      });
      const data = await res.json();
      if (data.success) {
        setChannels(data.channels);
        setNewChanName('');
        setNewChanUrl('');
        setNewChanMandatory(true);
        setNewChanEnabled(true);
        fetchBotData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateChannel = async (id: string, name: string, url: string, mandatory: boolean, enabled: boolean) => {
    if (!activeBot) return;
    const updated = channels.map(c => c.id === id ? { ...c, name, url, mandatory, enabled } : c);
    try {
      const res = await fetch(`/api/bots/${activeBot.id}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels: updated })
      });
      const data = await res.json();
      if (data.success) {
        setChannels(data.channels);
        setEditingChanId(null);
        fetchBotData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteChannel = async (id: string) => {
    if (!activeBot) return;
    const remaining = channels.filter(c => c.id !== id);
    const updated = remaining.map((c, index) => ({ ...c, priority: index + 1 }));
    try {
      const res = await fetch(`/api/bots/${activeBot.id}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels: updated })
      });
      const data = await res.json();
      if (data.success) {
        setChannels(data.channels);
        fetchBotData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveChannel = async (id: string, direction: 'up' | 'down') => {
    if (!activeBot) return;
    const sorted = [...channels].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    const index = sorted.findIndex(c => c.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sorted.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = sorted[index];
    sorted[index] = sorted[targetIndex];
    sorted[targetIndex] = temp;

    const updated = sorted.map((c, idx) => ({ ...c, priority: idx + 1 }));
    try {
      const res = await fetch(`/api/bots/${activeBot.id}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels: updated })
      });
      const data = await res.json();
      if (data.success) {
        setChannels(data.channels);
        fetchBotData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Groups Setup
  const handleAddGroup = async () => {
    if (!activeBot || !newGrpName || !newGrpUrl) return;
    const priority = groups.length > 0 ? Math.max(...groups.map(g => g.priority || 0)) + 1 : 1;
    const newGrp = {
      id: 'grp_' + Date.now(),
      name: newGrpName,
      url: newGrpUrl,
      mandatory: newGrpMandatory,
      enabled: newGrpEnabled,
      priority
    };
    const updated = [...groups, newGrp].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    try {
      const res = await fetch(`/api/bots/${activeBot.id}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: updated })
      });
      const data = await res.json();
      if (data.success) {
        setGroups(data.groups);
        setNewGrpName('');
        setNewGrpUrl('');
        setNewGrpMandatory(true);
        setNewGrpEnabled(true);
        fetchBotData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateGroup = async (id: string, name: string, url: string, mandatory: boolean, enabled: boolean) => {
    if (!activeBot) return;
    const updated = groups.map(g => g.id === id ? { ...g, name, url, mandatory, enabled } : g);
    try {
      const res = await fetch(`/api/bots/${activeBot.id}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: updated })
      });
      const data = await res.json();
      if (data.success) {
        setGroups(data.groups);
        setEditingGrpId(null);
        fetchBotData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!activeBot) return;
    const remaining = groups.filter(g => g.id !== id);
    const updated = remaining.map((g, index) => ({ ...g, priority: index + 1 }));
    try {
      const res = await fetch(`/api/bots/${activeBot.id}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: updated })
      });
      const data = await res.json();
      if (data.success) {
        setGroups(data.groups);
        fetchBotData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveGroup = async (id: string, direction: 'up' | 'down') => {
    if (!activeBot) return;
    const sorted = [...groups].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    const index = sorted.findIndex(g => g.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sorted.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = sorted[index];
    sorted[index] = sorted[targetIndex];
    sorted[targetIndex] = temp;

    const updated = sorted.map((g, idx) => ({ ...g, priority: idx + 1 }));
    try {
      const res = await fetch(`/api/bots/${activeBot.id}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: updated })
      });
      const data = await res.json();
      if (data.success) {
        setGroups(data.groups);
        fetchBotData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Milestones
  const handleAddMilestone = async () => {
    if (!activeBot || !newMilestoneReferrals || !newMilestoneReward) return;
    const updated = [...milestones, {
      id: 'ms_' + Date.now(),
      referralsRequired: Number(newMilestoneReferrals),
      rewardAmount: Number(newMilestoneReward),
      enabled: true
    }].sort((a, b) => a.referralsRequired - b.referralsRequired);

    try {
      const res = await fetch(`/api/bots/${activeBot.id}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestones: updated })
      });
      const data = await res.json();
      if (data.success) {
        setMilestones(data.milestones);
        setNewMilestoneReferrals('');
        setNewMilestoneReward('');
        fetchBotData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMilestone = async (id: string) => {
    if (!activeBot) return;
    const updated = milestones.filter(m => m.id !== id);
    try {
      const res = await fetch(`/api/bots/${activeBot.id}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestones: updated })
      });
      const data = await res.json();
      if (data.success) {
        setMilestones(data.milestones);
        fetchBotData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // User Actions (Details, Wallet Adjustment)
  const handleSelectUser = async (user: User) => {
    if (!activeBot) return;
    setSelectedUser(user);
    setWalletAdjustAmount('');
    setWalletAdjustDesc('');

    try {
      // fetch transaction history
      const resTx = await fetch(`/api/bots/${activeBot.id}/transactions/${user.telegramId}`);
      const dataTx = await resTx.json();
      if (dataTx.success) setUserTxHistory(dataTx.transactions);

      // fetch withdraw history
      const resWd = await fetch(`/api/bots/${activeBot.id}/withdraws/${user.telegramId}`);
      const dataWd = await resWd.json();
      if (dataWd.success) setUserWdHistory(dataWd.withdraws);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdjustWallet = async () => {
    if (!activeBot || !selectedUser || !walletAdjustAmount) return;
    const amount = Number(walletAdjustAmount);
    if (isNaN(amount) || amount <= 0) return alert('Invalid amount');

    try {
      const res = await fetch(`/api/bots/${activeBot.id}/admin/users/${selectedUser.telegramId}/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: walletAdjustAction,
          amount,
          description: walletAdjustDesc || 'Administrator Manual Correction'
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Wallet balance updated successfully!');
        setSelectedUser(data.user);
        // refresh data
        fetchBotData();
        // refresh selected user histories
        handleSelectUser(data.user);
      } else {
        alert(data.message || 'Action failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleBlockUser = async (telegramId: string, currentBlocked: boolean) => {
    if (!activeBot) return;
    try {
      const res = await fetch(`/api/bots/${activeBot.id}/admin/users/${telegramId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ block: !currentBlocked })
      });
      const data = await res.json();
      if (data.success) {
        if (selectedUser && selectedUser.telegramId === telegramId) {
          setSelectedUser(data.user);
        }
        fetchBotData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (telegramId: string) => {
    if (!activeBot) return;
    if (!window.confirm('Are you sure you want to delete this user profile? This removes their wallet balance and referral stats.')) return;
    try {
      const res = await fetch(`/api/bots/${activeBot.id}/admin/users/${telegramId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteUser: true })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedUser(null);
        fetchBotData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Withdraw approvals
  const handleProcessWithdraw = async (id: string, action: 'approve' | 'reject') => {
    if (!activeBot) return;
    if (action === 'reject' && !wdRejectReason) {
      return alert('Please enter a rejection reason.');
    }
    try {
      const res = await fetch(`/api/bots/${activeBot.id}/admin/withdraws/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: wdRejectReason })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Withdrawal request successfully ${action}ed!`);
        setWdActiveModal(null);
        setWdRejectReason('');
        fetchBotData();
      } else {
        alert(data.message || 'Action failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Broadcast
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBot || !broadcastTitle || !broadcastMessage) return;
    setIsLoading(true);
    setBroadcastSuccess('');
    try {
      const res = await fetch(`/api/bots/${activeBot.id}/admin/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: broadcastTitle, message: broadcastMessage })
      });
      const data = await res.json();
      if (data.success) {
        setBroadcastSuccess('Broadcast campaign initiated successfully to all registered bot users!');
        setBroadcastTitle('');
        setBroadcastMessage('');
        fetchBotData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const q = userSearch.toLowerCase();
    return u.fullName.toLowerCase().includes(q) || u.mobileNumber.includes(q) || u.telegramId.includes(q);
  });

  return (
    <div className="flex flex-col h-full text-white bg-slate-900 border-r border-slate-800">
      {/* Admin Panel Header */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-display tracking-tight text-white flex items-center gap-2">
              Roy Share <span className="text-xs px-2 py-0.5 bg-slate-800 text-indigo-400 rounded-full font-mono">ADMIN v2.0</span>
            </h1>
            <p className="text-xs text-slate-400">Telegram Multi-Bot Controller</p>
          </div>
        </div>
        
        {/* Refresh button */}
        {activeBot && (
          <button 
            onClick={fetchBotData}
            disabled={isLoading}
            className="p-1.5 hover:bg-slate-800 rounded-lg transition text-slate-400 hover:text-white"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Selected Bot Status Bar */}
      <div className="p-3 bg-slate-900/50 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Active Bot:</span>
          {activeBot ? (
            <div className="flex items-center gap-2 bg-slate-850 px-2 py-1 rounded border border-slate-800">
              <img 
                src={activeBot.photoUrl} 
                alt={activeBot.name} 
                className="w-4 h-4 rounded-full object-cover" 
                referrerPolicy="no-referrer"
              />
              <span className="font-semibold text-indigo-400">@{activeBot.username}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${overallPass ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span className={`px-1.5 py-0.2 rounded font-mono text-[9px] font-bold ${overallPass ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400 animate-pulse'}`}>
                {overallPass ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
          ) : (
            <span className="text-rose-400 font-semibold italic">No Active Bot selected</span>
          )}
        </div>

        {/* Bot selector dropdown */}
        <select 
          className="bg-slate-950 border border-slate-850 rounded px-2 py-1 text-slate-350 focus:outline-none focus:border-indigo-600 max-w-xs"
          value={activeBot?.id || ''}
          onChange={(e) => {
            const bot = bots.find(b => b.id === e.target.value);
            onSelectBot(bot || null);
          }}
        >
          <option value="">-- Choose Target Bot --</option>
          {bots.map(b => (
            <option key={b.id} value={b.id}>
              {b.name} (@{b.username}) {b.status === 'disabled' ? '[Disabled]' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Redesigned 3-Tab Premium Mobile-Friendly Segmented Controller (No Horizontal Scroll) */}
      <div className="grid grid-cols-3 bg-slate-950 border-b border-slate-800 shrink-0 text-xs">
        <button 
          onClick={() => {
            setActiveTab('dashboard');
            setActiveSubTab(null);
          }} 
          className={`flex flex-col items-center justify-center gap-1 py-2.5 border-b-2 font-bold transition ${activeTab === 'dashboard' ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard</span>
        </button>
        <button 
          onClick={() => {
            setActiveTab('bots');
            setActiveSubTab(null);
          }} 
          className={`flex flex-col items-center justify-center gap-1 py-2.5 border-b-2 font-bold transition ${activeTab === 'bots' ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          <BotIcon className="w-4 h-4" />
          <span>Bots</span>
        </button>
        <button 
          onClick={() => {
            setActiveTab('more');
          }} 
          className={`flex flex-col items-center justify-center gap-1 py-2.5 border-b-2 font-bold relative transition ${activeTab === 'more' ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          <Sliders className="w-4 h-4" />
          <span>More</span>
          {withdrawals.filter(w => w.status === 'pending').length > 0 && (
            <span className="absolute top-1.5 right-4 px-1.5 py-0.5 bg-amber-500 text-slate-950 rounded-full text-[9px] font-extrabold animate-pulse">
              {withdrawals.filter(w => w.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            {!activeBot ? (
              <div className="p-6 text-center bg-slate-950/40 rounded-xl border border-slate-800/80">
                <Sliders className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-semibold">No Bot Configuration Loaded</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  To view statistics, analytics, and manage settings, please first create a bot or select an existing bot from the selector dropdown.
                </p>
                <button 
                  onClick={() => setActiveTab('bots')}
                  className="mt-4 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-4 py-2 rounded-lg transition"
                >
                  <Plus className="w-4 h-4" /> Go to Bot Manager
                </button>
              </div>
            ) : (
              <>
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-450 tracking-wider uppercase block">Total Users</span>
                      <span className="text-xl font-bold font-display mt-1 block">{stats.totalUsers}</span>
                    </div>
                    <div className="p-2 bg-indigo-600/10 rounded-lg text-indigo-400">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-450 tracking-wider uppercase block">Today's Joins</span>
                      <span className="text-xl font-bold font-display mt-1 block text-emerald-400">+{stats.todayUsers}</span>
                    </div>
                    <div className="p-2 bg-emerald-600/10 rounded-lg text-emerald-400">
                      <Activity className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-450 tracking-wider uppercase block">Verified (OTP)</span>
                      <span className="text-xl font-bold font-display mt-1 block text-indigo-400">{stats.verifiedUsers}</span>
                    </div>
                    <div className="p-2 bg-indigo-600/10 rounded-lg text-indigo-400">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-450 tracking-wider uppercase block">Active Referrals</span>
                      <span className="text-xl font-bold font-display mt-1 block text-sky-400">{stats.referralCount}</span>
                    </div>
                    <div className="p-2 bg-sky-600/10 rounded-lg text-sky-400">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-450 tracking-wider uppercase block">User Wallets Total</span>
                      <span className="text-base font-bold mt-1 block text-yellow-500">₹{stats.totalWallet.toFixed(2)}</span>
                    </div>
                    <div className="p-1.5 bg-yellow-500/10 rounded-lg text-yellow-500">
                      <Wallet className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-450 tracking-wider uppercase block">Pending Withdrawals</span>
                      <span className="text-base font-bold mt-1 block text-amber-500">₹{stats.pendingWithdraw.toFixed(2)}</span>
                    </div>
                    <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400">
                      <ClockIcon className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-450 tracking-wider uppercase block">Total Withdrawn</span>
                      <span className="text-base font-bold mt-1 block text-emerald-500">₹{stats.totalWithdrawn.toFixed(2)}</span>
                    </div>
                    <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Handcrafted Visual SVG Stats Chart */}
                <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">User Performance & Activity Track</h4>
                    <span className="text-[10px] bg-indigo-600/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono">Real-time stats</span>
                  </div>
                  
                  {/* Decorative chart visualization */}
                  <div className="h-28 flex items-end justify-between pt-4 gap-2 border-b border-slate-800">
                    <div className="w-full flex flex-col items-center">
                      <div className="w-full bg-slate-800 rounded-t h-4 hover:bg-indigo-600 transition duration-300" title="Week 1" />
                      <span className="text-[9px] text-slate-500 mt-1 font-mono">W1</span>
                    </div>
                    <div className="w-full flex flex-col items-center">
                      <div className="w-full bg-slate-800 rounded-t h-10 hover:bg-indigo-600 transition duration-300" title="Week 2" />
                      <span className="text-[9px] text-slate-500 mt-1 font-mono">W2</span>
                    </div>
                    <div className="w-full flex flex-col items-center">
                      <div className="w-full bg-slate-800 rounded-t h-8 hover:bg-indigo-600 transition duration-300" title="Week 3" />
                      <span className="text-[9px] text-slate-500 mt-1 font-mono">W3</span>
                    </div>
                    <div className="w-full flex flex-col items-center">
                      <div className="w-full bg-slate-800 rounded-t h-16 hover:bg-indigo-600 transition duration-300" title="Week 4" />
                      <span className="text-[9px] text-slate-500 mt-1 font-mono">W4</span>
                    </div>
                    <div className="w-full flex flex-col items-center">
                      <div className="w-full bg-indigo-500 rounded-t h-24 hover:bg-indigo-400 transition duration-300" title="Current Week" />
                      <span className="text-[9px] text-indigo-400 mt-1 font-bold font-mono">Active</span>
                    </div>
                  </div>
                </div>

                {/* General Settings Fast Toggles */}
                <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-4">
                  <h3 className="text-sm font-semibold font-display text-white border-b border-slate-850 pb-2">Bot Settings Configuration</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-850">
                        <div>
                          <p className="font-semibold">Maintenance Mode</p>
                          <p className="text-[10px] text-slate-450">Stops users from accessing App</p>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={maintenanceMode}
                          onChange={(e) => setMaintenanceMode(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 rounded bg-slate-950 border-slate-800 focus:ring-indigo-600"
                        />
                      </div>

                      <div className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-850">
                        <div>
                          <p className="font-semibold">Registration Enabled</p>
                          <p className="text-[10px] text-slate-450">Allows new users to sign up</p>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={registrationEnabled}
                          onChange={(e) => setRegistrationEnabled(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 rounded bg-slate-950 border-slate-800 focus:ring-indigo-600"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-850">
                        <div>
                          <p className="font-semibold">Referral System</p>
                          <p className="text-[10px] text-slate-450">Active milestone referral counting</p>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={referralEnabled}
                          onChange={(e) => setReferralEnabled(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 rounded bg-slate-950 border-slate-800 focus:ring-indigo-600"
                        />
                      </div>

                      <div className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-850">
                        <div>
                          <p className="font-semibold">Min Withdrawal (₹)</p>
                          <p className="text-[10px] text-slate-450">Minimum coin value required</p>
                        </div>
                        <input 
                          type="number" 
                          value={minWithdraw}
                          onChange={(e) => setMinWithdraw(Number(e.target.value))}
                          className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 w-20 text-right focus:outline-none focus:border-indigo-600 font-semibold"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Welcome Message / Start Text</label>
                    <textarea 
                      value={welcomeMessage}
                      onChange={(e) => setWelcomeMessage(e.target.value)}
                      rows={2}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  <button 
                    onClick={handleSaveSettings}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 rounded-lg transition"
                  >
                    Save Bot Settings Profile
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'bots' && (
          <div className="space-y-4">
            {/* Create Bot */}
            <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-indigo-400" />
                Register New Bot
              </h3>
              
              <form onSubmit={handleCreateBot} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Telegram Bot Token</label>
                  <input 
                    type="text" 
                    placeholder="Enter Telegram Token e.g., 512345678:AAH_..."
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-indigo-200 font-mono focus:outline-none focus:border-indigo-600"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    System verifies token with standard <span className="font-mono text-slate-400">getMe</span>. If offline or simulated, it creates a fully working Mock Bot.
                  </p>
                </div>

                {botError && (
                  <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded text-rose-400 text-xs flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{botError}</span>
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isCreatingBot || !botToken}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 rounded-lg transition disabled:opacity-50"
                >
                  {isCreatingBot ? 'Connecting getMe Bot...' : 'Verify & Add Active Bot'}
                </button>
              </form>
            </div>

            {/* List Bots */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Available Bots ({bots.length})</h3>
              
              {bots.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-4 text-center border border-dashed border-slate-800 rounded">
                  No registered Telegram Bots yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {bots.map(b => (
                    <div 
                      key={b.id} 
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${activeBot?.id === b.id ? 'bg-indigo-950/20 border-indigo-600/40' : 'bg-slate-950/30 border-slate-850'}`}
                    >
                      <div className="flex items-center gap-3">
                        <img 
                          src={b.photoUrl} 
                          alt={b.name} 
                          className="w-9 h-9 rounded-full object-cover border border-slate-800"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                            {b.name}
                            <span className={`w-1.5 h-1.5 rounded-full ${b.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          </h4>
                          <p className="text-[11px] text-slate-400 font-mono">@{b.username}</p>
                          <span className="text-[9px] px-1.5 py-0.2 bg-slate-800 text-indigo-400 rounded font-mono">ID: {b.id}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => onSelectBot(b)}
                          disabled={isProcessingBotId !== null}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold transition ${activeBot?.id === b.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'} disabled:opacity-50`}
                        >
                          Select Bot
                        </button>
                        <button 
                          onClick={() => handleToggleBot(b.id)}
                          disabled={isProcessingBotId !== null}
                          className={`p-1.5 rounded text-[10px] transition ${
                            isProcessingBotId === b.id 
                              ? 'bg-slate-850 text-slate-500' 
                              : b.status === 'active' 
                              ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' 
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-750'
                          } disabled:opacity-50`}
                          title={b.status === 'active' ? 'Disable Bot' : 'Enable/Unlock Bot'}
                        >
                          {isProcessingBotId === b.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : b.status === 'active' ? (
                            <Unlock className="w-3.5 h-3.5" />
                          ) : (
                            <Lock className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button 
                          onClick={() => handleDeleteBot(b.id)}
                          disabled={isProcessingBotId !== null}
                          className="p-1.5 rounded text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition disabled:opacity-50"
                          title="Delete Bot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
            {activeTab === 'more' && activeBot && (
          <div className="space-y-4">
            {/* If no subtab selected, show the More Menu Options */}
            {!activeSubTab ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Extended Control Center</h2>
                  <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 font-bold">Bot ID: {activeBot.id}</span>
                </div>

                {/* Grid of the 10 modular sub-tabs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'channels', label: 'Channels & Groups', desc: 'Manage mandatory verification handles', icon: Key, color: 'text-indigo-400 bg-indigo-500/10' },
                    { id: 'users', label: 'Users Manager', desc: 'Search, block, and adjust profiles', icon: Users, color: 'text-sky-400 bg-sky-500/10' },
                    { id: 'milestones', label: 'Referral Milestones', desc: 'Configure referral rewards & goals', icon: TrendingUp, color: 'text-emerald-400 bg-emerald-500/10' },
                    { id: 'wallet', label: 'Wallet Ledger', desc: 'Manual wallet additions & adjustments', icon: Wallet, color: 'text-yellow-400 bg-yellow-500/10' },
                    { id: 'withdrawals', label: 'Withdrawals', desc: 'Review and process payout requests', icon: ArrowUpRight, color: 'text-amber-400 bg-amber-500/10', badge: withdrawals.filter(w => w.status === 'pending').length },
                    { id: 'broadcast', label: 'Broadcast', desc: 'Send push messages to all members', icon: MessageSquare, color: 'text-pink-400 bg-pink-500/10' },
                    { id: 'analytics', label: 'Analytics', desc: 'User demographics & join statistics', icon: Activity, color: 'text-purple-400 bg-purple-500/10' },
                    { id: 'settings', label: 'Bot Settings', desc: 'Toggles for maintenance, registration', icon: Settings, color: 'text-slate-400 bg-slate-500/10' },
                    { id: 'security', label: 'Security & Antifraud', desc: 'Track duplicate fingerprint accounts', icon: Shield, color: 'text-rose-400 bg-rose-500/10' },
                    { id: 'backup', label: 'Backup & Recovery', desc: 'Export or import system database JSON', icon: Database, color: 'text-teal-400 bg-teal-500/10' },
                    { id: 'diagnostics', label: 'Diagnostics Center', desc: 'Real production bot and server diagnostics', icon: Activity, color: 'text-rose-400 bg-rose-500/10' },
                  ].map(item => (
                    <button
                      key={item.id}
                      onClick={() => setActiveSubTab(item.id as any)}
                      className="flex items-center justify-between p-3.5 bg-slate-950/45 border border-slate-850 rounded-xl hover:border-indigo-500/40 active:bg-slate-950/80 transition text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${item.color} shrink-0 transition group-hover:scale-105`}>
                          <item.icon className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-100 block">{item.label}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5 leading-normal">{item.desc}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.badge ? (
                          <span className="px-1.5 py-0.5 bg-amber-500 text-slate-950 rounded text-[9px] font-extrabold animate-pulse">
                            {item.badge}
                          </span>
                        ) : null}
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Back Bar Header with Breadcrumb */}
                <div className="flex items-center justify-between bg-slate-950/40 border border-slate-850 p-2.5 rounded-xl">
                  <button 
                    onClick={() => setActiveSubTab(null)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg hover:border-indigo-500/30 text-indigo-400 hover:text-indigo-350 font-bold text-xs transition"
                  >
                    ← Back to More
                  </button>
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wide font-mono">
                    {activeSubTab === 'channels' ? 'Channels & Groups' :
                     activeSubTab === 'users' ? 'Users Manager' :
                     activeSubTab === 'milestones' ? 'Referral Milestones' :
                     activeSubTab === 'wallet' ? 'Wallet Ledger' :
                     activeSubTab === 'withdrawals' ? 'Withdrawals' :
                     activeSubTab === 'broadcast' ? 'Broadcast' :
                     activeSubTab === 'analytics' ? 'Analytics' :
                     activeSubTab === 'settings' ? 'Bot Settings' :
                     activeSubTab === 'security' ? 'Security & Antifraud' :
                     activeSubTab === 'diagnostics' ? 'Diagnostics Center' : 'Backup & Recovery'}
                  </span>
                </div>

                {/* Sub-tab 1: Channels & Groups */}
                {activeSubTab === 'channels' && (
                  <div className="space-y-6">
                    {/* Channel Manager */}
                    <div className="p-5 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                        <h3 className="text-sm font-bold tracking-wide text-white flex items-center gap-2">
                          <span className="p-1.5 bg-indigo-600/10 text-indigo-400 rounded-lg">
                            <Key className="w-4 h-4" />
                          </span>
                          Telegram Channel Manager
                        </h3>
                        <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-semibold">
                          {channels.length} Total
                        </span>
                      </div>

                      {/* Add Channel Form */}
                      <div className="bg-slate-900/50 p-4 border border-slate-850 rounded-xl space-y-3">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Add New Verification Channel</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block text-[10px] text-slate-400 font-medium mb-1">Channel Name</label>
                            <input 
                              type="text" 
                              placeholder="e.g. Roy Share Official" 
                              value={newChanName} 
                              onChange={(e) => setNewChanName(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-650 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 font-medium mb-1">Channel Link (Telegram Url)</label>
                            <input 
                              type="text" 
                              placeholder="https://t.me/royshare_chan" 
                              value={newChanUrl} 
                              onChange={(e) => setNewChanUrl(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-650 focus:outline-none font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-xs">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input 
                              type="checkbox" 
                              checked={newChanMandatory} 
                              onChange={(e) => setNewChanMandatory(e.target.checked)} 
                              className="w-4 h-4 text-indigo-600 rounded bg-slate-950 border-slate-800"
                            />
                            <span className="text-slate-400">Mandatory join verification</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input 
                              type="checkbox" 
                              checked={newChanEnabled} 
                              onChange={(e) => setNewChanEnabled(e.target.checked)} 
                              className="w-4 h-4 text-indigo-600 rounded bg-slate-950 border-slate-800"
                            />
                            <span className="text-slate-400">Enabled instantly</span>
                          </label>
                        </div>

                        <button 
                          onClick={handleAddChannel}
                          disabled={!newChanName || !newChanUrl}
                          className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-lg transition disabled:opacity-40 flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" /> Add Channel
                        </button>
                      </div>

                      {/* Channels List */}
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-455 font-mono">Priority-Ordered Channels List</h4>
                        {channels.length === 0 ? (
                          <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl text-slate-500">
                            <Key className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                            <p className="text-xs italic">No channel verification records configured.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {[...channels].sort((a, b) => (a.priority || 0) - (b.priority || 0)).map((c, idx, arr) => {
                              const isEditing = editingChanId === c.id;
                              return (
                                <div 
                                  key={c.id} 
                                  className={`p-3.5 rounded-xl border transition ${
                                    isEditing ? 'bg-slate-900 border-indigo-500/50' : c.enabled === false ? 'bg-slate-950/20 border-slate-850/50 opacity-60' : 'bg-slate-950/30 border-slate-850 hover:bg-slate-950/45'
                                  }`}
                                >
                                  {isEditing ? (
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                        <input 
                                          type="text" 
                                          value={editingChanName} 
                                          onChange={(e) => setEditingChanName(e.target.value)}
                                          className="bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
                                          placeholder="Channel Name"
                                        />
                                        <input 
                                          type="text" 
                                          value={editingChanUrl} 
                                          onChange={(e) => setEditingChanUrl(e.target.value)}
                                          className="bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white font-mono"
                                          placeholder="Channel Link"
                                        />
                                      </div>
                                      <div className="flex items-center justify-between text-xs pt-1">
                                        <div className="flex gap-4">
                                          <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input type="checkbox" checked={editingChanMandatory} onChange={(e) => setEditingChanMandatory(e.target.checked)} />
                                            <span>Mandatory</span>
                                          </label>
                                          <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input type="checkbox" checked={editingChanEnabled} onChange={(e) => setEditingChanEnabled(e.target.checked)} />
                                            <span>Enabled</span>
                                          </label>
                                        </div>
                                        <div className="flex gap-1.5">
                                          <button 
                                            onClick={() => handleUpdateChannel(c.id, editingChanName, editingChanUrl, editingChanMandatory, editingChanEnabled)}
                                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-[11px]"
                                          >
                                            Save
                                          </button>
                                          <button onClick={() => setEditingChanId(null)} className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded font-semibold text-[11px]">Cancel</button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-4 text-xs">
                                      <div className="flex items-center gap-3">
                                        <div className="flex flex-col items-center gap-1">
                                          <button disabled={idx === 0} onClick={() => handleMoveChannel(c.id, 'up')} className="p-1 hover:bg-slate-800 disabled:opacity-20 text-slate-450"><ArrowUpRight className="w-3.5 h-3.5 rotate-45" /></button>
                                          <span className="text-[9px] font-mono text-indigo-400 font-bold bg-indigo-950/40 px-1 py-0.2 rounded">P{c.priority || idx + 1}</span>
                                          <button disabled={idx === arr.length - 1} onClick={() => handleMoveChannel(c.id, 'down')} className="p-1 hover:bg-slate-800 disabled:opacity-20 text-slate-450"><ArrowDownLeft className="w-3.5 h-3.5 rotate-45" /></button>
                                        </div>
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <p className="font-bold text-slate-100">{c.name}</p>
                                            {c.mandatory && <span className="text-[8px] px-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">Mandatory</span>}
                                            <span className={`text-[8px] px-1 rounded ${c.enabled !== false ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-850 text-slate-500'}`}>{c.enabled !== false ? 'Active' : 'Disabled'}</span>
                                          </div>
                                          <a href={c.url} target="_blank" rel="noreferrer" className="text-[10px] text-indigo-400 font-mono block mt-1 hover:underline">{c.url}</a>
                                        </div>
                                      </div>
                                      <div className="flex items-center">
                                        <button onClick={() => { setEditingChanId(c.id); setEditingChanName(c.name); setEditingChanUrl(c.url); setEditingChanMandatory(c.mandatory); setEditingChanEnabled(c.enabled !== false); }} className="p-1.5 hover:bg-slate-800 text-slate-450 hover:text-indigo-400 rounded"><Edit className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => handleDeleteChannel(c.id)} className="p-1.5 hover:bg-rose-500/15 text-slate-455 hover:text-rose-400 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Group Manager */}
                    <div className="p-5 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                        <h3 className="text-sm font-bold tracking-wide text-white flex items-center gap-2">
                          <span className="p-1.5 bg-sky-600/10 text-sky-400 rounded-lg">
                            <Users className="w-4 h-4" />
                          </span>
                          Telegram Group Manager
                        </h3>
                        <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-full font-semibold">
                          {groups.length} Total
                        </span>
                      </div>

                      {/* Add Group Form */}
                      <div className="bg-slate-900/50 p-4 border border-slate-850 rounded-xl space-y-3">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Add New Verification Group</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block text-[10px] text-slate-400 font-medium mb-1">Group Name</label>
                            <input 
                              type="text" 
                              placeholder="e.g. Roy Share Community" 
                              value={newGrpName} 
                              onChange={(e) => setNewGrpName(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 font-medium mb-1">Group Link (Telegram Url)</label>
                            <input 
                              type="text" 
                              placeholder="https://t.me/royshare_group" 
                              value={newGrpUrl} 
                              onChange={(e) => setNewGrpUrl(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-xs">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={newGrpMandatory} onChange={(e) => setNewGrpMandatory(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded bg-slate-950 border-slate-800" />
                            <span className="text-slate-400">Mandatory join verification</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={newGrpEnabled} onChange={(e) => setNewGrpEnabled(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded bg-slate-950 border-slate-800" />
                            <span className="text-slate-400">Enabled instantly</span>
                          </label>
                        </div>

                        <button 
                          onClick={handleAddGroup}
                          disabled={!newGrpName || !newGrpUrl}
                          className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-lg transition disabled:opacity-40 flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" /> Add Group
                        </button>
                      </div>

                      {/* Groups List */}
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-455">Priority-Ordered Groups List</h4>
                        {groups.length === 0 ? (
                          <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl text-slate-500">
                            <Users className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                            <p className="text-xs italic">No group verification records configured.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {[...groups].sort((a, b) => (a.priority || 0) - (b.priority || 0)).map((g, idx, arr) => {
                              const isEditing = editingGrpId === g.id;
                              return (
                                <div 
                                  key={g.id} 
                                  className={`p-3.5 rounded-xl border transition ${
                                    isEditing ? 'bg-slate-900 border-indigo-500/50' : g.enabled === false ? 'bg-slate-950/20 border-slate-850/50 opacity-60' : 'bg-slate-950/30 border-slate-850 hover:bg-slate-950/45'
                                  }`}
                                >
                                  {isEditing ? (
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                        <input type="text" value={editingGrpName} onChange={(e) => setEditingGrpName(e.target.value)} className="bg-slate-950 border border-slate-800 rounded p-2 text-white" />
                                        <input type="text" value={editingGrpUrl} onChange={(e) => setEditingGrpUrl(e.target.value)} className="bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono" />
                                      </div>
                                      <div className="flex items-center justify-between text-xs pt-1">
                                        <div className="flex gap-4">
                                          <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input type="checkbox" checked={editingGrpMandatory} onChange={(e) => setEditingGrpMandatory(e.target.checked)} />
                                            <span>Mandatory</span>
                                          </label>
                                          <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input type="checkbox" checked={editingGrpEnabled} onChange={(e) => setEditingGrpEnabled(e.target.checked)} />
                                            <span>Enabled</span>
                                          </label>
                                        </div>
                                        <div className="flex gap-1.5">
                                          <button onClick={() => handleUpdateGroup(g.id, editingGrpName, editingGrpUrl, editingGrpMandatory, editingGrpEnabled)} className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-[11px]">Save</button>
                                          <button onClick={() => setEditingGrpId(null)} className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded font-semibold text-[11px]">Cancel</button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-4 text-xs">
                                      <div className="flex items-center gap-3">
                                        <div className="flex flex-col items-center gap-1">
                                          <button disabled={idx === 0} onClick={() => handleMoveGroup(g.id, 'up')} className="p-1 hover:bg-slate-800 disabled:opacity-20 text-slate-455"><ArrowUpRight className="w-3.5 h-3.5 rotate-45" /></button>
                                          <span className="text-[9px] font-mono text-indigo-400 font-bold bg-indigo-950/40 px-1 py-0.2 rounded">P{g.priority || idx + 1}</span>
                                          <button disabled={idx === arr.length - 1} onClick={() => handleMoveGroup(g.id, 'down')} className="p-1 hover:bg-slate-800 disabled:opacity-20 text-slate-455"><ArrowDownLeft className="w-3.5 h-3.5 rotate-45" /></button>
                                        </div>
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <p className="font-bold text-slate-100">{g.name}</p>
                                            {g.mandatory && <span className="text-[8px] px-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">Mandatory</span>}
                                            <span className={`text-[8px] px-1 rounded ${g.enabled !== false ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-850 text-slate-500'}`}>{g.enabled !== false ? 'Active' : 'Disabled'}</span>
                                          </div>
                                          <a href={g.url} target="_blank" rel="noreferrer" className="text-[10px] text-indigo-400 font-mono block mt-1 hover:underline">{g.url}</a>
                                        </div>
                                      </div>
                                      <div className="flex items-center">
                                        <button onClick={() => { setEditingGrpId(g.id); setEditingGrpName(g.name); setEditingGrpUrl(g.url); setEditingGrpMandatory(g.mandatory); setEditingGrpEnabled(g.enabled !== false); }} className="p-1.5 hover:bg-slate-800 text-slate-455 hover:text-indigo-400 rounded"><Edit className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => handleDeleteGroup(g.id)} className="p-1.5 hover:bg-rose-500/15 text-slate-455 hover:text-rose-400 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-tab 2: Users Manager */}
                {activeSubTab === 'users' && (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
                        <input 
                          type="text" 
                          placeholder="Search user by name, ID or mobile..." 
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-indigo-600"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Registered Members ({filteredUsers.length})</h3>
                      {filteredUsers.length === 0 ? (
                        <p className="text-xs text-slate-500 italic p-4 text-center border border-slate-850 rounded">No matching users found.</p>
                      ) : (
                        <div className="space-y-2">
                          {filteredUsers.map(u => (
                            <div 
                              key={u.telegramId} 
                              onClick={() => handleSelectUser(u)}
                              className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${selectedUser?.telegramId === u.telegramId ? 'bg-indigo-950/20 border-indigo-600/50' : 'bg-slate-950/30 border-slate-850 hover:bg-slate-950/45'}`}
                            >
                              <div>
                                <div className="flex items-center gap-1.5 text-xs">
                                  <h4 className="font-bold text-slate-100">{u.fullName}</h4>
                                  <span className={`text-[8px] px-1 rounded font-mono ${u.referralStatus === 'verified' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{u.referralStatus === 'verified' ? 'Verified' : 'Pending OTP'}</span>
                                  {u.isBlocked && <span className="text-[8px] px-1 bg-rose-500/20 text-rose-400 rounded font-semibold uppercase">Blocked</span>}
                                </div>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {u.telegramId} | @{u.username}</p>
                                <p className="text-[10px] text-slate-500">Mob: {u.mobileNumber}</p>
                              </div>
                              <div className="text-right text-xs">
                                <span className="font-bold text-yellow-500 block">₹{u.walletBalance.toFixed(2)}</span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">{u.referralCount} Invites</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {selectedUser && (
                      <div className="p-4 bg-slate-950 border border-indigo-900/30 rounded-xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                          <div>
                            <h3 className="text-xs font-bold text-indigo-400">{selectedUser.fullName}</h3>
                            <p className="text-[9px] text-slate-450 font-mono">TG ID: {selectedUser.telegramId}</p>
                          </div>
                          <button onClick={() => setSelectedUser(null)} className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 bg-slate-900 border border-slate-800 rounded">Close</button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-center text-[10px]">
                          <div className="bg-slate-900 p-2 rounded">
                            <span className="text-slate-500 block">Wallet Balance</span>
                            <span className="font-bold text-yellow-500 text-xs">₹{selectedUser.walletBalance.toFixed(2)}</span>
                          </div>
                          <div className="bg-slate-900 p-2 rounded">
                            <span className="text-slate-500 block">Total Earned</span>
                            <span className="font-bold text-emerald-400 text-xs">₹{selectedUser.totalEarned.toFixed(2)}</span>
                          </div>
                          <div className="bg-slate-900 p-2 rounded">
                            <span className="text-slate-500 block">Invited By</span>
                            <span className="font-mono text-indigo-300 block">{selectedUser.referredBy || 'Direct'}</span>
                          </div>
                          <div className="bg-slate-900 p-2 rounded truncate">
                            <span className="text-slate-500 block">Fingerprint</span>
                            <span className="font-mono text-slate-400 block truncate" title={selectedUser.deviceFingerprint}>{selectedUser.deviceFingerprint || 'None'}</span>
                          </div>
                        </div>

                        {/* Adjust Wallet Balance form */}
                        <div className="p-3 bg-slate-900 border border-slate-850 rounded-lg space-y-2 text-xs">
                          <h4 className="font-semibold text-slate-300">Direct Ledger Correction</h4>
                          <div className="flex gap-2">
                            <select value={walletAdjustAction} onChange={(e) => setWalletAdjustAction(e.target.value as any)} className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300">
                              <option value="credit">Add Balance (+)</option>
                              <option value="debit">Deduct Balance (-)</option>
                            </select>
                            <input type="number" placeholder="₹ Amount" value={walletAdjustAmount} onChange={(e) => setWalletAdjustAmount(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-right text-yellow-500 font-bold" />
                          </div>
                          <input type="text" placeholder="Adjustment comment..." value={walletAdjustDesc} onChange={(e) => setWalletAdjustDesc(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white" />
                          <button onClick={handleAdjustWallet} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 rounded text-xs">Post Ledger Entry</button>
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => handleToggleBlockUser(selectedUser.telegramId, selectedUser.isBlocked)} className={`flex-1 py-1.5 rounded font-bold text-xs ${selectedUser.isBlocked ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}>
                            {selectedUser.isBlocked ? 'Unblock Account' : 'Block Account'}
                          </button>
                          <button onClick={() => handleDeleteUser(selectedUser.telegramId)} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-1.5 rounded text-xs">Delete User</button>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5">
                          <div className="p-2.5 bg-slate-900 rounded-lg space-y-1">
                            <h5 className="text-[10px] font-bold text-slate-400 border-b border-slate-800 pb-0.5 font-mono">Transactions Log</h5>
                            {userTxHistory.length === 0 ? <p className="text-[9px] text-slate-500 italic">No transactions.</p> : (
                              <div className="max-h-20 overflow-y-auto space-y-1">
                                {userTxHistory.map(tx => (
                                  <div key={tx.id} className="text-[9px] flex justify-between font-mono">
                                    <span className="text-slate-350 truncate max-w-[140px]">{tx.description}</span>
                                    <span className={tx.type === 'credit' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{tx.type === 'credit' ? '+' : '-'}₹{tx.amount}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-tab 3: Referral Milestones */}
                {activeSubTab === 'milestones' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-450 flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5 text-indigo-400" /> Add Milestone Target
                      </h3>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">Referrals Required</label>
                          <input type="number" placeholder="5" value={newMilestoneReferrals} onChange={(e) => setNewMilestoneReferrals(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-right" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">Reward Amount (₹)</label>
                          <input type="number" placeholder="20" value={newMilestoneReward} onChange={(e) => setNewMilestoneReward(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-right text-yellow-500 font-bold" />
                        </div>
                      </div>
                      <button onClick={handleAddMilestone} disabled={!newMilestoneReferrals || !newMilestoneReward} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 rounded-lg transition disabled:opacity-40">Insert Milestone</button>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase text-slate-450">Active Milestones</h4>
                      <div className="space-y-2">
                        {milestones.map(m => (
                          <div key={m.id} className="p-3 bg-slate-950/30 border border-slate-850 rounded-xl flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                              <span className="p-2 bg-indigo-600/15 rounded-lg text-indigo-400 font-bold text-sm font-mono">{m.referralsRequired}</span>
                              <div>
                                <p className="font-semibold text-white">{m.referralsRequired} Verified Invites</p>
                                <p className="text-[10px] text-slate-450">Milestone Reward: <span className="font-bold text-yellow-500">₹{m.rewardAmount}</span></p>
                              </div>
                            </div>
                            <button onClick={() => handleDeleteMilestone(m.id)} className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-tab 4: Wallet Ledger */}
                {activeSubTab === 'wallet' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <span className="text-slate-450 text-[10px] uppercase block tracking-wider font-semibold">Total User Wallets Balance</span>
                        <span className="text-lg font-bold text-yellow-500 mt-1 block font-mono">₹{stats.totalWallet.toFixed(2)}</span>
                      </div>
                      <div className="p-2 bg-yellow-500/10 rounded-xl text-yellow-500"><Wallet className="w-5 h-5" /></div>
                    </div>

                    {/* Quick user selection and ledger correction */}
                    <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-3">
                      <h3 className="text-xs font-bold uppercase text-slate-400">Post Direct Wallet Transaction</h3>
                      
                      {/* Search & Selector */}
                      <div className="space-y-2">
                        <label className="block text-[10px] text-slate-500">Select Target User Account</label>
                        <div className="relative">
                          <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-slate-500" />
                          <input 
                            type="text" 
                            placeholder="Type user name, mobile or TG ID..." 
                            value={userSearch} 
                            onChange={(e) => setUserSearch(e.target.value)} 
                            className="w-full bg-slate-950 border border-slate-800 rounded pl-7 pr-2.5 py-1.5 text-xs text-white placeholder-slate-650"
                          />
                        </div>

                        {userSearch && (
                          <div className="max-h-36 overflow-y-auto border border-slate-850 bg-slate-950 rounded divide-y divide-slate-900 text-xs">
                            {filteredUsers.slice(0, 5).map(u => (
                              <button 
                                key={u.telegramId}
                                onClick={() => {
                                  handleSelectUser(u);
                                  setUserSearch('');
                                }}
                                className="w-full p-2 text-left hover:bg-indigo-600/10 block transition text-slate-300"
                              >
                                <span className="font-bold text-slate-100">{u.fullName}</span> (@{u.username}) — Bal: ₹{u.walletBalance.toFixed(2)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {selectedUser ? (
                        <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-3 text-xs">
                          <div className="flex justify-between items-center text-[11px] border-b border-slate-800 pb-1.5">
                            <span className="font-bold text-indigo-400">{selectedUser.fullName} (₹{selectedUser.walletBalance.toFixed(2)})</span>
                            <button onClick={() => setSelectedUser(null)} className="text-[10px] text-slate-400 hover:text-rose-400">Deselect</button>
                          </div>

                          <div className="flex gap-2">
                            <select value={walletAdjustAction} onChange={(e) => setWalletAdjustAction(e.target.value as any)} className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300">
                              <option value="credit">Credit Balance (+)</option>
                              <option value="debit">Debit Balance (-)</option>
                            </select>
                            <input type="number" placeholder="Amount (₹)" value={walletAdjustAmount} onChange={(e) => setWalletAdjustAmount(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-right text-yellow-500 font-bold" />
                          </div>

                          <input type="text" placeholder="Transaction remarks e.g., Contest Reward..." value={walletAdjustDesc} onChange={(e) => setWalletAdjustDesc(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white" />
                          <button onClick={handleAdjustWallet} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 rounded text-xs">Post Adjustment Transaction</button>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500 italic text-center py-2">Search and click on a user account above to post an adjustment entry.</p>
                      )}
                    </div>

                    {/* Global ledger log of the active bot */}
                    <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-2">
                      <h3 className="text-xs font-bold uppercase text-slate-400">Bot Real-Time Ledger Log</h3>
                      {globalTransactions.length === 0 ? (
                        <p className="text-xs text-slate-500 italic p-4 text-center border border-slate-850 rounded">No transactions recorded for this bot yet.</p>
                      ) : (
                        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 font-mono text-[10px]">
                          {globalTransactions.map(t => (
                            <div key={t.id} className="p-2 bg-slate-950/30 border border-slate-900 rounded flex justify-between gap-3">
                              <div className="truncate">
                                <span className="font-semibold text-slate-350 block truncate">{t.description}</span>
                                <span className="text-slate-500 text-[8px] block">{t.timestamp.split('T')[1].substring(0, 8)} | User ID: {t.telegramId}</span>
                              </div>
                              <span className={`font-bold shrink-0 self-center ${t.type === 'credit' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {t.type === 'credit' ? '+' : '-'}₹{t.amount}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sub-tab 5: Withdrawals */}
                {activeSubTab === 'withdrawals' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase text-slate-400">Withdrawal Request Ledger</h3>
                      {withdrawals.length === 0 ? (
                        <p className="text-xs text-slate-500 italic p-4 text-center border border-slate-850 rounded">No withdrawal requests found.</p>
                      ) : (
                        <div className="space-y-2">
                          {withdrawals.map(w => (
                            <div key={w.id} className="p-3 bg-slate-950/30 border border-slate-850 rounded-xl space-y-2 text-xs">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-bold text-slate-100">{w.fullName}</p>
                                  <p className="text-[10px] text-slate-450 font-mono">TG: {w.telegramId} | {w.timestamp.split('T')[0]}</p>
                                </div>
                                <div className="text-right">
                                  <span className="font-bold text-yellow-500 text-sm">₹{w.amount}</span>
                                  <span className={`block text-[9px] font-bold uppercase ${w.status === 'approved' ? 'text-emerald-400' : w.status === 'rejected' ? 'text-rose-400' : 'text-amber-400 animate-pulse'}`}>{w.status}</span>
                                </div>
                              </div>

                              <div className="p-2 bg-slate-900 border border-slate-850 rounded text-[11px] space-y-1 text-slate-300">
                                <p><span className="text-slate-500">Method:</span> {w.method}</p>
                                <p><span className="text-slate-500 font-mono text-[10px]">Recipient Details:</span> <span className="font-mono text-indigo-350">{w.details}</span></p>
                                {w.status === 'rejected' && <p><span className="text-rose-400">Rejection Reason:</span> {w.reason}</p>}
                              </div>

                              {w.status === 'pending' && (
                                <div className="flex gap-2">
                                  <button onClick={() => { if (window.confirm(`Approve payout of ₹${w.amount} to: ${w.details}?`)) handleProcessWithdraw(w.id, 'approve'); }} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 rounded transition text-[10px]">Approve Payment</button>
                                  <button onClick={() => setWdActiveModal(w)} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-1.5 rounded transition text-[10px]">Reject & Refund</button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {wdActiveModal && (
                      <div className="p-4 bg-slate-950 border border-rose-900/30 rounded-xl space-y-3">
                        <h4 className="text-xs font-bold text-rose-400">Reject Withdrawal & Refund Balance</h4>
                        <p className="text-[11px] text-slate-400">Provide rejection reason. Rejection immediately credits ₹{wdActiveModal.amount} back to the user's wallet.</p>
                        <input type="text" placeholder="e.g., Invalid UPI ID format..." value={wdRejectReason} onChange={(e) => setWdRejectReason(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs text-white" />
                        <div className="flex gap-2 text-xs">
                          <button onClick={() => handleProcessWithdraw(wdActiveModal.id, 'reject')} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-1.5 rounded transition">Confirm Rejection</button>
                          <button onClick={() => setWdActiveModal(null)} className="flex-1 bg-slate-800 text-slate-300 py-1.5 rounded">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-tab 6: Broadcast */}
                {activeSubTab === 'broadcast' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-400" /> Trigger Push Campaign Announcement
                      </h3>
                      <form onSubmit={handleSendBroadcast} className="space-y-3 text-xs">
                        <div>
                          <label className="block text-[10px] text-slate-455 mb-0.5">Push Title</label>
                          <input type="text" placeholder="e.g. ₹500 Mega Referral Contest is Live! 🎉" value={broadcastTitle} onChange={(e) => setBroadcastTitle(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-white" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-455 mb-0.5">Announcement Content Message</label>
                          <textarea placeholder="Type your broadcast body message details..." rows={4} value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-white" />
                        </div>
                        {broadcastSuccess && <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded">{broadcastSuccess}</p>}
                        <button type="submit" disabled={!broadcastTitle || !broadcastMessage} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-lg transition disabled:opacity-40 font-mono">Publish Push to Users</button>
                      </form>
                    </div>
                  </div>
                )}

                {/* Sub-tab 7: Analytics */}
                {activeSubTab === 'analytics' && (
                  <div className="space-y-4 text-xs font-mono">
                    {/* Visual metrics cards */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl">
                        <span className="text-[9px] text-slate-450 uppercase block font-semibold">Total Members</span>
                        <span className="text-lg font-bold block mt-0.5 text-slate-100">{stats.totalUsers}</span>
                      </div>
                      <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl">
                        <span className="text-[9px] text-slate-450 uppercase block font-semibold">Verified Users</span>
                        <span className="text-lg font-bold text-emerald-400 block mt-0.5">{stats.verifiedUsers}</span>
                      </div>
                      <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl">
                        <span className="text-[9px] text-slate-450 uppercase block font-semibold">Wallet Totals</span>
                        <span className="text-lg font-bold text-yellow-500 block mt-0.5">₹{stats.totalWallet.toFixed(2)}</span>
                      </div>
                      <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl">
                        <span className="text-[9px] text-slate-450 uppercase block font-semibold">Net Payouts</span>
                        <span className="text-lg font-bold text-indigo-400 block mt-0.5">₹{stats.totalWithdrawn.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Registrations Graph */}
                    <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-2">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Weekly Performance Curve</h3>
                      <div className="h-24 flex items-end justify-between pt-4 gap-2 border-b border-slate-800">
                        <div className="w-full flex flex-col items-center">
                          <div className="w-full bg-slate-800 rounded-t h-4 hover:bg-indigo-500 transition duration-300" title="Week 1" />
                          <span className="text-[8px] text-slate-500 mt-1">W1</span>
                        </div>
                        <div className="w-full flex flex-col items-center">
                          <div className="w-full bg-slate-800 rounded-t h-12 hover:bg-indigo-500 transition duration-300" title="Week 2" />
                          <span className="text-[8px] text-slate-500 mt-1">W2</span>
                        </div>
                        <div className="w-full flex flex-col items-center">
                          <div className="w-full bg-slate-800 rounded-t h-7 hover:bg-indigo-500 transition duration-300" title="Week 3" />
                          <span className="text-[8px] text-slate-500 mt-1">W3</span>
                        </div>
                        <div className="w-full flex flex-col items-center">
                          <div className="w-full bg-indigo-500 rounded-t h-20 hover:bg-indigo-400 transition duration-300" title="Current Week" />
                          <span className="text-[8px] text-indigo-400 mt-1 font-bold">ACTIVE</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-tab 8: Bot Settings */}
                {activeSubTab === 'settings' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-4 text-xs">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-850 pb-2">Configure General Bot Rules</h3>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded border border-slate-850">
                          <div>
                            <p className="font-semibold text-slate-100">Maintenance Mode</p>
                            <p className="text-[10px] text-slate-450">Toggles application global access</p>
                          </div>
                          <input type="checkbox" checked={maintenanceMode} onChange={(e) => setMaintenanceMode(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded bg-slate-950 border-slate-800 cursor-pointer" />
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded border border-slate-850">
                          <div>
                            <p className="font-semibold text-slate-100">Registration Enabled</p>
                            <p className="text-[10px] text-slate-450">Allows new user profiles to register</p>
                          </div>
                          <input type="checkbox" checked={registrationEnabled} onChange={(e) => setRegistrationEnabled(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded bg-slate-950 border-slate-800 cursor-pointer" />
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded border border-slate-850">
                          <div>
                            <p className="font-semibold text-slate-100">Referral Milestones Enabled</p>
                            <p className="text-[10px] text-slate-450">Enables dynamic milestone earnings</p>
                          </div>
                          <input type="checkbox" checked={referralEnabled} onChange={(e) => setReferralEnabled(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded bg-slate-950 border-slate-800 cursor-pointer" />
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded border border-slate-850">
                          <div>
                            <p className="font-semibold text-slate-100 font-sans">Minimum Withdrawal Limit (₹)</p>
                            <p className="text-[10px] text-slate-450 font-sans">Amount required to request payouts</p>
                          </div>
                          <input type="number" value={minWithdraw} onChange={(e) => setMinWithdraw(Number(e.target.value))} className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 w-20 text-right focus:outline-none focus:border-indigo-600 font-bold text-yellow-500 font-mono" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-450 font-semibold">Welcome Start / Greeting Message</label>
                        <textarea value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} rows={3} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white focus:outline-none focus:border-indigo-600" />
                      </div>

                      <button onClick={handleSaveSettings} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg transition text-xs">Save Settings Profile</button>
                    </div>
                  </div>
                )}

                {/* Sub-tab 9: Security & Antifraud */}
                {activeSubTab === 'security' && (
                  <div className="space-y-4">
                    {/* Antifraud duplicate accounts scanner */}
                    <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-455 flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-rose-400" /> Antifraud Fingerprint Monitor
                        </h3>
                        <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.2 rounded font-mono font-bold">Scanning active</span>
                      </div>

                      <p className="text-[10px] text-slate-450 leading-relaxed font-sans">
                        Tracks and groups user profiles registering with matching device fingerprints. Duplicate pairings usually point to referral farming attempts.
                      </p>

                      {/* Filter/Group calculation */}
                      {(() => {
                        const fingerprintGroups: Record<string, typeof users> = {};
                        users.forEach(u => {
                          if (u.deviceFingerprint && u.deviceFingerprint.trim() !== '') {
                            if (!fingerprintGroups[u.deviceFingerprint]) fingerprintGroups[u.deviceFingerprint] = [];
                            fingerprintGroups[u.deviceFingerprint].push(u);
                          }
                        });
                        const duplicates = Object.entries(fingerprintGroups).filter(([_, groupUsers]) => groupUsers.length > 1);

                        if (duplicates.length === 0) {
                          return (
                            <div className="p-4 text-center border border-slate-850/60 rounded bg-slate-950/20 text-slate-500 italic text-xs font-sans">
                              🟢 Clean record! No duplicate device fingerprints detected.
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3 font-mono text-[10px]">
                            {duplicates.map(([fp, groupUsers]) => (
                              <div key={fp} className="p-2.5 bg-slate-900/50 border border-rose-950/45 rounded-lg space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-rose-450 font-semibold block truncate max-w-[180px]">Fingerprint: {fp}</span>
                                  <span className="px-1.5 py-0.2 bg-rose-500/25 text-rose-455 rounded-full font-bold text-[8px] uppercase">{groupUsers.length} accounts matched</span>
                                </div>

                                <div className="space-y-1 bg-slate-950/45 p-1.5 rounded divide-y divide-slate-900">
                                  {groupUsers.map(gu => (
                                    <div key={gu.telegramId} className="py-1 flex justify-between items-center text-slate-300">
                                      <div>
                                        <p className="font-semibold text-slate-100">{gu.fullName} (@{gu.username})</p>
                                        <p className="text-[8px] text-slate-500 font-mono">TG ID: {gu.telegramId} | Mob: {gu.mobileNumber}</p>
                                      </div>
                                      <div className="flex gap-1 shrink-0">
                                        <button 
                                          onClick={() => handleToggleBlockUser(gu.telegramId, gu.isBlocked)} 
                                          className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${gu.isBlocked ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}
                                        >
                                          {gu.isBlocked ? 'Unblock' : 'Block'}
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Admin logs under security */}
                    <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-2">
                      <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wide font-sans">Bot Audit Trail Log</h3>
                      {logs.length === 0 ? (
                        <p className="text-xs text-slate-500 italic p-3 text-center border border-slate-850 rounded font-sans">No actions logged yet.</p>
                      ) : (
                        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                          {logs.map(l => (
                            <div key={l.id} className="p-2 bg-slate-950/20 border border-slate-850/60 rounded text-[9px] font-mono flex items-start justify-between gap-3 text-slate-450">
                              <span>{l.action}</span>
                              <span className="text-slate-650 shrink-0">{l.timestamp.split('T')[1].substring(0, 8)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sub-tab 10: Backup & Recovery */}
                {activeSubTab === 'backup' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-3 text-xs font-sans">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Database className="w-4 h-4 text-teal-400" /> Backup Database State
                      </h3>
                      <p className="text-[10px] text-slate-450 leading-relaxed">
                        Export and download the entire system state (Bots, users, transactions, settings, withdrawals history) as a single portable JSON file.
                      </p>

                      <button 
                        onClick={handleTriggerBackup} 
                        disabled={isBackingUp}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-lg transition disabled:opacity-40 flex items-center justify-center gap-1.5 text-xs"
                      >
                        {isBackingUp ? (
                          <>Generating Backup file...</>
                        ) : (
                          <>
                            <Database className="w-3.5 h-3.5" /> Trigger Complete DB Backup
                          </>
                        )}
                      </button>
                    </div>

                    <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-3 text-xs font-sans">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Restore System State</h3>
                      <p className="text-[10px] text-slate-450 leading-relaxed">
                        To restore a previous database state, paste the exported JSON backup code in the field below and hit Restore.
                      </p>

                      <textarea 
                        rows={5} 
                        placeholder="Paste your backup JSON contents here..." 
                        value={backupText} 
                        onChange={(e) => setBackupText(e.target.value)} 
                        className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-[10px] font-mono text-slate-350 focus:outline-none"
                      />

                      <button 
                        onClick={() => handleRestoreBackup(backupText)} 
                        disabled={isRestoring || !backupText}
                        className="w-full bg-teal-600 hover:bg-teal-500 text-white font-semibold py-2 rounded-lg transition disabled:opacity-45 text-xs"
                      >
                        {isRestoring ? 'Restoring state...' : 'Confirm Restore DB State'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Sub-tab 11: Diagnostics Center */}
                {activeSubTab === 'diagnostics' && (
                  <div className="space-y-4">
                    {/* Diagnostic Summary Header */}
                    <div className="p-4 bg-slate-950/45 border border-slate-850 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 font-sans">
                      <div>
                        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                          <Activity className="w-4 h-4 text-rose-500 animate-pulse" /> Live System Diagnostics
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                          Run real-time API integrations, check webhooks, and evaluate backend infrastructure.
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => runDiagnostics(activeBot.id, 'all')}
                          disabled={isDiagRunning}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition disabled:opacity-40 text-xs shadow-md shadow-indigo-600/10 flex items-center gap-1.5"
                        >
                          {isDiagRunning ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Scanning...
                            </>
                          ) : (
                            <>
                              <Activity className="w-3.5 h-3.5" /> Run Full Diagnostics
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Report Card Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: Component Statuses */}
                      <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-3 font-sans">
                        <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Infrastructure Checklist</h4>
                        <div className="space-y-2 text-[11px]">
                          {/* 1. Bot Token & API */}
                          <div className="flex justify-between items-center p-2 bg-slate-950/30 border border-slate-850 rounded">
                            <span className="text-slate-300 font-medium">Telegram API Status (getMe)</span>
                            <span className={`px-2 py-0.5 rounded font-mono font-bold text-[9px] ${
                              diagResults?.telegramApi?.status === 'SUCCESS' ? 'bg-emerald-500/15 text-emerald-400' :
                              diagResults?.telegramApi?.status === 'ERROR' ? 'bg-rose-500/15 text-rose-400' : 'bg-slate-800 text-slate-500'
                            }`}>
                              {diagResults?.telegramApi?.status || 'NOT SCANNED'}
                            </span>
                          </div>

                          {/* 2. Webhook Setup */}
                          <div className="flex justify-between items-center p-2 bg-slate-950/30 border border-slate-850 rounded">
                            <span className="text-slate-300 font-medium">Webhook Registration</span>
                            <span className={`px-2 py-0.5 rounded font-mono font-bold text-[9px] ${
                              diagResults?.webhook?.status === 'SUCCESS' ? 'bg-emerald-500/15 text-emerald-400' :
                              diagResults?.webhook?.status === 'WARNING' ? 'bg-amber-500/15 text-amber-400' :
                              diagResults?.webhook?.status === 'ERROR' ? 'bg-rose-500/15 text-rose-400' : 'bg-slate-800 text-slate-500'
                            }`}>
                              {diagResults?.webhook?.status || 'NOT SCANNED'}
                            </span>
                          </div>

                          {/* 3. Firebase/Firestore */}
                          <div className="flex justify-between items-center p-2 bg-slate-950/30 border border-slate-850 rounded">
                            <span className="text-slate-300 font-medium">Firebase Firestore DB Connection</span>
                            <span className={`px-2 py-0.5 rounded font-mono font-bold text-[9px] ${
                              diagResults?.firestore?.status === 'SUCCESS' ? 'bg-emerald-500/15 text-emerald-400' :
                              diagResults?.firestore?.status === 'WARNING' ? 'bg-amber-500/15 text-amber-400' :
                              diagResults?.firestore?.status === 'ERROR' ? 'bg-rose-500/15 text-rose-400' : 'bg-slate-800 text-slate-500'
                            }`}>
                              {diagResults?.firestore?.status || 'NOT SCANNED'}
                            </span>
                          </div>

                          {/* 4. Render Health */}
                          <div className="flex justify-between items-center p-2 bg-slate-950/30 border border-slate-850 rounded">
                            <span className="text-slate-300 font-medium">Render Engine Health Check</span>
                            <span className={`px-2 py-0.5 rounded font-mono font-bold text-[9px] ${
                              diagResults?.render?.status === 'SUCCESS' ? 'bg-emerald-500/15 text-emerald-400' :
                              diagResults?.render?.status === 'ERROR' ? 'bg-rose-500/15 text-rose-400' : 'bg-slate-800 text-slate-500'
                            }`}>
                              {diagResults?.render?.status || 'NOT SCANNED'}
                            </span>
                          </div>

                          {/* 5. Environment Config */}
                          <div className="flex justify-between items-center p-2 bg-slate-950/30 border border-slate-850 rounded">
                            <span className="text-slate-300 font-medium">Environment Variables</span>
                            <span className={`px-2 py-0.5 rounded font-mono font-bold text-[9px] ${
                              diagResults?.env?.status === 'SUCCESS' ? 'bg-emerald-500/15 text-emerald-400' :
                              diagResults?.env?.status === 'WARNING' ? 'bg-amber-500/15 text-amber-400' :
                              diagResults?.env?.status === 'ERROR' ? 'bg-rose-500/15 text-rose-400' : 'bg-slate-800 text-slate-500'
                            }`}>
                              {diagResults?.env?.status || 'NOT SCANNED'}
                            </span>
                          </div>
                        </div>

                        {/* Overall Bot Health Badge */}
                        <div className="pt-2 flex justify-between items-center border-t border-slate-850 text-xs">
                          <span className="font-bold text-slate-400">OVERALL SYSTEM HEALTH</span>
                          <span className={`px-2.5 py-0.5 rounded font-mono font-extrabold text-[10px] tracking-wide ${
                            overallPass ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {overallPass ? 'PASS (HEALTHY)' : 'FAIL (UNHEALTHY)'}
                          </span>
                        </div>
                      </div>

                      {/* Right: Manual Verification & Quick Tests */}
                      <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-3 font-sans">
                        <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Isolated Diagnostics Tests</h4>
                        <p className="text-[10px] text-slate-500 leading-normal">
                          Run targeted unit tests against individual services to debug local component failures.
                        </p>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => runDiagnostics(activeBot.id, 'getMe')}
                            disabled={isDiagRunning}
                            className="p-2 bg-slate-950 border border-slate-800 hover:border-indigo-500 text-slate-200 text-left rounded-lg text-[10px] transition font-semibold"
                          >
                            ⚡ Test getMe (Telegram Token)
                          </button>
                          <button
                            onClick={() => runDiagnostics(activeBot.id, 'webhook')}
                            disabled={isDiagRunning}
                            className="p-2 bg-slate-950 border border-slate-800 hover:border-indigo-500 text-slate-200 text-left rounded-lg text-[10px] transition font-semibold"
                          >
                            ⚡ Test Webhook URL
                          </button>
                          <button
                            onClick={() => runDiagnostics(activeBot.id, 'firestore')}
                            disabled={isDiagRunning}
                            className="p-2 bg-slate-950 border border-slate-800 hover:border-indigo-500 text-slate-200 text-left rounded-lg text-[10px] transition font-semibold"
                          >
                            ⚡ Test Firestore Connection
                          </button>
                          <button
                            onClick={() => runDiagnostics(activeBot.id, 'env')}
                            disabled={isDiagRunning}
                            className="p-2 bg-slate-950 border border-slate-800 hover:border-indigo-500 text-slate-200 text-left rounded-lg text-[10px] transition font-semibold"
                          >
                            ⚡ Test Environment & Port
                          </button>
                          <button
                            onClick={() => runDiagnostics(activeBot.id, 'render')}
                            disabled={isDiagRunning}
                            className="p-2 bg-slate-950 border border-slate-800 hover:border-indigo-500 text-slate-200 text-left rounded-lg text-[10px] transition font-semibold"
                          >
                            ⚡ Test Render Health Path
                          </button>
                          <button
                            onClick={() => runDiagnostics(activeBot.id, 'message')}
                            disabled={isDiagRunning}
                            className="p-2 bg-slate-950 border border-slate-800 hover:border-indigo-500 text-slate-200 text-left rounded-lg text-[10px] transition font-semibold"
                          >
                            ✉️ Test Backend Message
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Auto-Repair / Hook Management Panel */}
                    <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-3 font-sans">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Automated Repair Operations</h4>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                            Direct low-level system commands to hot-reset, repair, and clear webhooks and caching profiles.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <button
                          onClick={() => runAutoRepair(activeBot.id, 'resetWebhook')}
                          disabled={isRepairing !== null}
                          className="px-2.5 py-1.5 bg-slate-950 border border-rose-900 hover:border-rose-600 text-rose-400 hover:bg-rose-950/10 text-[10px] rounded-lg transition font-semibold flex items-center justify-center gap-1.5"
                        >
                          {isRepairing === 'resetWebhook' ? 'Executing...' : '♻️ Reset Webhook'}
                        </button>
                        <button
                          onClick={() => runAutoRepair(activeBot.id, 'registerWebhook')}
                          disabled={isRepairing !== null}
                          className="px-2.5 py-1.5 bg-slate-950 border border-emerald-900 hover:border-emerald-600 text-emerald-400 hover:bg-emerald-950/10 text-[10px] rounded-lg transition font-semibold flex items-center justify-center gap-1.5"
                        >
                          {isRepairing === 'registerWebhook' ? 'Executing...' : '⚡ Register Webhook'}
                        </button>
                        <button
                          onClick={() => runAutoRepair(activeBot.id, 'reloadToken')}
                          disabled={isRepairing !== null}
                          className="px-2.5 py-1.5 bg-slate-950 border border-indigo-900 hover:border-indigo-600 text-indigo-400 hover:bg-indigo-950/10 text-[10px] rounded-lg transition font-semibold flex items-center justify-center gap-1.5"
                        >
                          {isRepairing === 'reloadToken' ? 'Executing...' : '🔑 Reload Bot Token'}
                        </button>
                        <button
                          onClick={() => runAutoRepair(activeBot.id, 'refreshFirebase')}
                          disabled={isRepairing !== null}
                          className="px-2.5 py-1.5 bg-slate-950 border border-yellow-900 hover:border-yellow-600 text-yellow-400 hover:bg-yellow-950/10 text-[10px] rounded-lg transition font-semibold flex items-center justify-center gap-1.5"
                        >
                          {isRepairing === 'refreshFirebase' ? 'Executing...' : '🔥 Refresh Firebase Connection'}
                        </button>
                        <button
                          onClick={() => runAutoRepair(activeBot.id, 'restartSession')}
                          disabled={isRepairing !== null}
                          className="px-2.5 py-1.5 bg-slate-950 border border-sky-900 hover:border-sky-600 text-sky-400 hover:bg-sky-950/10 text-[10px] rounded-lg transition font-semibold flex items-center justify-center gap-1.5"
                        >
                          {isRepairing === 'restartSession' ? 'Executing...' : '🔄 Restart Telegram Session'}
                        </button>
                        <button
                          onClick={() => runAutoRepair(activeBot.id, 'clearCache')}
                          disabled={isRepairing !== null}
                          className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 hover:border-slate-500 text-slate-300 hover:bg-slate-950/50 text-[10px] rounded-lg transition font-semibold flex items-center justify-center gap-1.5"
                        >
                          {isRepairing === 'clearCache' ? 'Executing...' : '🗑️ Clear Config Cache'}
                        </button>
                      </div>
                    </div>

                    {/* Live Developer Console */}
                    <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-2">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          <h4 className="text-xs font-bold text-slate-400 tracking-wider font-mono uppercase">Live Diagnostics Console</h4>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(diagLogs.join('\n'));
                            showToast('Logs copied to clipboard', 'info');
                          }}
                          className="px-2 py-0.5 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white rounded border border-slate-800 text-[10px] font-mono transition"
                        >
                          Copy Logs
                        </button>
                      </div>

                      <div className="bg-slate-950 border border-slate-900 p-3 rounded font-mono text-[10px] leading-relaxed max-h-60 overflow-y-auto space-y-1 select-text scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                        {diagLogs.length === 0 ? (
                          <div className="text-slate-600 italic">No logs generated. Initiate diagnostics or repair to stream output...</div>
                        ) : (
                          diagLogs.map((log, index) => {
                            let textClass = "text-slate-300";
                            if (log.includes("[ERROR]")) textClass = "text-rose-400 font-bold";
                            else if (log.includes("[SUCCESS]")) textClass = "text-emerald-400 font-bold";
                            else if (log.includes("[WARNING]")) textClass = "text-amber-400 font-bold";
                            else if (log.includes("[INFO]")) textClass = "text-cyan-400";

                            return (
                              <div key={index} className={`${textClass} whitespace-pre-wrap break-all hover:bg-slate-900/50 p-0.5 rounded`}>
                                {log}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast Notification Overlay */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-2xl flex items-center gap-2.5 transition-all duration-300">
          <div className={`p-1 rounded-lg shrink-0 ${
            toast.type === 'success' ? 'bg-emerald-500/15 text-emerald-400' :
            toast.type === 'error' ? 'bg-rose-500/15 text-rose-400' :
            'bg-indigo-500/15 text-indigo-400'
          }`}>
            {toast.type === 'success' && <CheckCircle className="w-4 h-4" />}
            {toast.type === 'error' && <XCircle className="w-4 h-4" />}
            {toast.type === 'info' && <Bell className="w-4 h-4" />}
          </div>
          <p className="text-xs font-semibold text-slate-100">{toast.message}</p>
        </div>
      )}
    </div>
  );
}
