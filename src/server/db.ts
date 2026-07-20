import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

export interface Bot {
  id: string;
  token: string;
  name: string;
  username: string;
  photoUrl: string;
  status: 'active' | 'disabled';
  settings: {
    welcomeMessage: string;
    maintenanceMode: boolean;
    registrationEnabled: boolean;
    minWithdraw: number;
    referralEnabled: boolean;
    walletEnabled: boolean;
  };
  channels: { id: string; name: string; url: string; mandatory: boolean; enabled: boolean; priority: number }[];
  groups: { id: string; name: string; url: string; mandatory: boolean; enabled: boolean; priority: number }[];
  milestones: { id: string; referralsRequired: number; rewardAmount: number; enabled: boolean }[];
}

export interface User {
  telegramId: string;
  username: string;
  fullName: string;
  mobileNumber: string;
  walletBalance: number;
  totalEarned: number;
  referralEarnings: number;
  claimedRewards: number;
  pendingWithdraw: number;
  totalWithdrawn: number;
  referredBy: string; // telegramId
  referralCount: number; // verified referrals
  referralStatus: 'pending' | 'verified';
  isBlocked: boolean;
  createdAt: string;
  deviceFingerprint: string;
}

export interface Transaction {
  id: string;
  telegramId: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  timestamp: string;
}

export interface Withdraw {
  id: string;
  telegramId: string;
  fullName: string;
  method: 'UPI' | 'Redeem Code';
  details: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  timestamp: string;
}

export interface ClaimHistory {
  id: string;
  telegramId: string;
  milestoneId: string;
  rewardAmount: number;
  timestamp: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'broadcast' | 'system';
  timestamp: string;
}

export interface AdminLog {
  id: string;
  action: string;
  timestamp: string;
}

export interface BotData {
  users: User[];
  transactions: Transaction[];
  withdraws: Withdraw[];
  claimHistory: ClaimHistory[];
  notifications: Notification[];
  adminLogs: AdminLog[];
}

interface DatabaseSchema {
  bots: Bot[];
  botData: Record<string, BotData>;
}

const DEFAULT_DB: DatabaseSchema = {
  bots: [],
  botData: {}
};

class LocalDB {
  private data: DatabaseSchema = { ...DEFAULT_DB };

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        this.data = JSON.parse(raw);
        // Ensure standard structure
        if (!this.data.bots) this.data.bots = [];
        if (!this.data.botData) this.data.botData = {};
      } else {
        this.save();
      }
    } catch (e) {
      console.error('Error loading DB, resetting to default', e);
      this.data = { ...DEFAULT_DB };
      this.save();
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving DB', e);
    }
  }

  private initBotData(botId: string) {
    if (!this.data.botData[botId]) {
      this.data.botData[botId] = {
        users: [],
        transactions: [],
        withdraws: [],
        claimHistory: [],
        notifications: [],
        adminLogs: []
      };
      this.save();
    }
  }

  // BOT METHODS
  getBots(): Bot[] {
    return this.data.bots;
  }

  getBot(botId: string): Bot | undefined {
    return this.data.bots.find(b => b.id === botId);
  }

  saveBot(bot: Bot) {
    const idx = this.data.bots.findIndex(b => b.id === bot.id);
    if (idx >= 0) {
      this.data.bots[idx] = bot;
    } else {
      this.data.bots.push(bot);
    }
    this.initBotData(bot.id);
    this.save();
  }

  deleteBot(botId: string) {
    this.data.bots = this.data.bots.filter(b => b.id !== botId);
    delete this.data.botData[botId];
    this.save();
  }

  // USER METHODS
  getUsers(botId: string): User[] {
    this.initBotData(botId);
    return this.data.botData[botId].users;
  }

  getUser(botId: string, telegramId: string): User | undefined {
    return this.getUsers(botId).find(u => u.telegramId === telegramId);
  }

  saveUser(botId: string, user: User) {
    this.initBotData(botId);
    const users = this.data.botData[botId].users;
    const idx = users.findIndex(u => u.telegramId === user.telegramId);
    if (idx >= 0) {
      users[idx] = user;
    } else {
      users.push(user);
    }
    this.save();
  }

  deleteUser(botId: string, telegramId: string) {
    this.initBotData(botId);
    this.data.botData[botId].users = this.data.botData[botId].users.filter(u => u.telegramId !== telegramId);
    this.save();
  }

  // TRANSACTION METHODS
  getTransactions(botId: string): Transaction[] {
    this.initBotData(botId);
    return this.data.botData[botId].transactions;
  }

  addTransaction(botId: string, tx: Transaction) {
    this.initBotData(botId);
    this.data.botData[botId].transactions.unshift(tx);
    this.save();
  }

  // WITHDRAW METHODS
  getWithdraws(botId: string): Withdraw[] {
    this.initBotData(botId);
    return this.data.botData[botId].withdraws;
  }

  saveWithdraw(botId: string, withdraw: Withdraw) {
    this.initBotData(botId);
    const withdraws = this.data.botData[botId].withdraws;
    const idx = withdraws.findIndex(w => w.id === withdraw.id);
    if (idx >= 0) {
      withdraws[idx] = withdraw;
    } else {
      withdraws.unshift(withdraw);
    }
    this.save();
  }

  // CLAIM HISTORY METHODS
  getClaimHistory(botId: string): ClaimHistory[] {
    this.initBotData(botId);
    return this.data.botData[botId].claimHistory;
  }

  addClaimHistory(botId: string, claim: ClaimHistory) {
    this.initBotData(botId);
    this.data.botData[botId].claimHistory.unshift(claim);
    this.save();
  }

  // NOTIFICATION METHODS
  getNotifications(botId: string): Notification[] {
    this.initBotData(botId);
    return this.data.botData[botId].notifications;
  }

  addNotification(botId: string, notif: Notification) {
    this.initBotData(botId);
    this.data.botData[botId].notifications.unshift(notif);
    this.save();
  }

  // ADMIN LOGS
  getAdminLogs(botId: string): AdminLog[] {
    this.initBotData(botId);
    return this.data.botData[botId].adminLogs;
  }

  addAdminLog(botId: string, log: AdminLog) {
    this.initBotData(botId);
    this.data.botData[botId].adminLogs.unshift(log);
    this.save();
  }

  // BACKUP AND RECOVERY METHODS
  exportBackup(): string {
    return JSON.stringify(this.data, null, 2);
  }

  importBackup(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (typeof parsed === 'object' && parsed !== null) {
        // Simple structural validation
        if (!parsed.bots) parsed.bots = [];
        if (!parsed.botData) parsed.botData = {};
        this.data = parsed;
        this.save();
        return true;
      }
    } catch (e) {
      console.error('Failed to import backup:', e);
    }
    return false;
  }
}

export const db = new LocalDB();
