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
  referredBy: string;
  referralCount: number;
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
