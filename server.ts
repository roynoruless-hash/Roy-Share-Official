import express from 'express';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import { createServer as createViteServer } from 'vite';
import { db, Bot, User, Transaction, Withdraw, ClaimHistory, Notification, AdminLog } from './src/server/db.js';
import { getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// -------------------------------------------------------------
// STARTUP VALIDATION & DIAGNOSTICS
// -------------------------------------------------------------
let isFirebaseInitialized = false;
let isFirestoreConnected = false;

const startupDiagnostics = async () => {
  console.log('==================================================');
  console.log('🚀 SYSTEM STARTUP DIAGNOSTICS');
  console.log('==================================================');
  
  const requiredVars = ['APP_URL'];
  const missingVars = requiredVars.filter(v => !process.env[v]);
  
  if (missingVars.length > 0) {
    console.error(`❌ CRITICAL ERROR: Missing mandatory environment variables: ${missingVars.join(', ')}`);
    console.error('Startup halted.');
    process.exit(1);
  }

  const appUrl = process.env.APP_URL!;
  console.log(`✅ APP_URL configured as: ${appUrl}`);

  if (appUrl.trim() === '' || appUrl.includes(' ')) {
    console.error(`❌ CRITICAL ERROR: APP_URL is empty or contains spaces: "${appUrl}"`);
    process.exit(1);
  }

  if (appUrl.includes('localhost') || appUrl.includes('127.0.0.1') || appUrl.includes('firebaseapp.com') || appUrl.includes('web.app')) {
    console.error(`❌ CRITICAL ERROR: APP_URL is invalid for Telegram webhooks: ${appUrl}`);
    console.error('Do not use localhost or Firebase Hosting URLs. Please use the Render URL.');
    process.exit(1);
  }

  let hostname = '';
  try {
    const parsedUrl = new URL(appUrl);
    hostname = parsedUrl.hostname;
    if (!hostname || !hostname.includes('.')) {
      throw new Error('Invalid domain structure.');
    }
  } catch (err: any) {
    console.error(`❌ CRITICAL ERROR: APP_URL format is invalid: ${appUrl}`);
    process.exit(1);
  }

  try {
    await new Promise((resolve, reject) => {
      dns.lookup(hostname, (err, address) => {
        if (err) reject(err);
        else resolve(address);
      });
    });
    console.log(`✅ APP_URL DNS resolution successful (${hostname}).`);
  } catch (err: any) {
    console.error(`❌ CRITICAL ERROR: DNS resolution failed for hostname "${hostname}": ${err.message}`);
    process.exit(1);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'roy-share-official';
  if (!process.env.FIREBASE_PROJECT_ID) {
    console.warn(`⚠️ WARNING: FIREBASE_PROJECT_ID environment variable is missing. Defaulting to: ${projectId}.`);
  } else if (projectId !== 'roy-share-official') {
    console.warn(`⚠️ WARNING: FIREBASE_PROJECT_ID is ${projectId}, expected roy-share-official.`);
  }

  try {
    if (!getApps().length) {
      let credential;
      let credentialSource = '';
      let serviceAccountLoaded = false;
      
      const localServiceAccountPath = path.join(process.cwd(), '.firebase-service-account.json');
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        credentialSource = 'FIREBASE_SERVICE_ACCOUNT_JSON env var';
        credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
        serviceAccountLoaded = true;
      } else if (fs.existsSync(localServiceAccountPath)) {
        credentialSource = 'Local .firebase-service-account.json file';
        const serviceAccountRaw = fs.readFileSync(localServiceAccountPath, 'utf-8');
        credential = cert(JSON.parse(serviceAccountRaw));
        serviceAccountLoaded = true;
      } else {
        credentialSource = 'Application Default Credentials (ADC)';
        credential = applicationDefault();
      }

      console.log(`\n--- Firebase Admin SDK Initialization ---`);
      console.log(`projectId: ${projectId}`);
      console.log(`credential source: ${credentialSource}`);
      console.log(`service account loaded?: ${serviceAccountLoaded ? 'Yes' : 'No'}`);

      initializeApp({
        projectId: projectId,
        credential: credential
      });
      isFirebaseInitialized = true;
      console.log(`database initialized?: Yes`);
    } else {
      isFirebaseInitialized = true;
      console.log(`✅ Firebase Admin already initialized.`);
    }

    const firestoreTest = getFirestore();
    // Test connection
    const testDoc = await firestoreTest.collection('startup_diagnostics').doc('test').set({ timestamp: new Date().toISOString() });
    isFirestoreConnected = true;
    console.log(`✅ Firestore connected successfully (Test Write ID: ${testDoc.writeTime.toDate().toISOString()})`);
  } catch (err: any) {
    console.error(`❌ CRITICAL ERROR: Firebase Admin SDK initialization or connection failed:`, err.message);
    if (err.message.includes('credential')) {
      console.error('Make sure GOOGLE_APPLICATION_CREDENTIALS is set to a valid Service Account JSON file path or configured correctly in Render.');
    }
  }

  // Telegram webhook status diagnostic
  console.log('\n--- Telegram Webhook Diagnostics ---');
  const bots = db.getBots();
  if (bots.length === 0) {
    console.log('No bots configured in the database yet.');
  } else {
    for (const bot of bots) {
      try {
        const fetchRes = await fetch(`https://api.telegram.org/bot${bot.token}/getWebhookInfo`);
        const data = await fetchRes.json();
        if (data.ok) {
          const currentUrl = data.result.url;
          const expectedUrl = `${appUrl}/api/webhook/${bot.id}`;
          if (!currentUrl) {
            console.warn(`⚠️ Bot @${bot.username || bot.id} has NO webhook configured.`);
          } else if (currentUrl !== expectedUrl) {
            console.warn(`⚠️ Bot @${bot.username || bot.id} webhook MISMATCH: ${currentUrl} (expected ${expectedUrl})`);
          } else {
            console.log(`✅ Bot @${bot.username || bot.id} webhook is correctly configured: ${currentUrl}`);
          }
        } else {
          console.error(`❌ Failed to get webhook info for Bot ${bot.id}: ${data.description}`);
        }
      } catch (err: any) {
        console.error(`❌ Error connecting to Telegram API for Bot ${bot.id}: ${err.message}`);
      }
    }
  }
  
  console.log('==================================================');
};

// In-memory OTP Store
// key: botId_telegramId -> { otp: string, mobileNumber: string, attempts: number, expiresAt: number }
const otpStore: Record<string, { otp: string; mobileNumber: string; attempts: number; expiresAt: number }> = {};

// In-memory rate limiting store for OTP
// key: botId_telegramId -> lastRequestTime
const otpRateLimit: Record<string, number> = {};

// Default Milestones if none configured for a bot
const DEFAULT_MILESTONES = [
  { id: 'm1', referralsRequired: 5, rewardAmount: 20, enabled: true },
  { id: 'm2', referralsRequired: 10, rewardAmount: 50, enabled: true },
  { id: 'm3', referralsRequired: 25, rewardAmount: 150, enabled: true },
  { id: 'm4', referralsRequired: 50, rewardAmount: 400, enabled: true },
  { id: 'm5', referralsRequired: 100, rewardAmount: 1000, enabled: true }
];

// Helper to check device fingerprint duplication
function checkFingerprintDuplication(botId: string, fingerprint: string, currentTelegramId: string): boolean {
  if (!fingerprint) return false;
  const users = db.getUsers(botId);
  return users.some(u => u.deviceFingerprint === fingerprint && u.telegramId !== currentTelegramId);
}

// -------------------------------------------------------------
// BOT MANAGEMENT ENDPOINTS
// -------------------------------------------------------------

// 1. Get all bots
app.get('/api/bots', (req, res) => {
  try {
    const bots = db.getBots();
    res.json({ success: true, bots });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Create/Register bot using token
app.post('/api/bots', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, message: 'Bot Token is required' });
  }

  try {
    // Attempt Telegram getMe API
    let botId = '';
    let botName = 'Simulated Bot';
    let botUsername = 'simulated_bot';
    let photoUrl = 'https://images.unsplash.com/photo-1527474305487-b87b222841cc?q=80&w=150&auto=format&fit=crop';
    let isMock = false;

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      if (response.ok) {
        const tgData = await response.json();
        if (tgData.ok) {
          botId = String(tgData.result.id);
          botName = tgData.result.first_name;
          botUsername = tgData.result.username;
          // Attempt to get user profile photo, otherwise default
          photoUrl = `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=150&auto=format&fit=crop`;
        } else {
          isMock = true;
        }
      } else {
        isMock = true;
      }
    } catch (e) {
      isMock = true;
    }

    if (isMock) {
      // If the token is fake or network offline, we format a mock bot based on token
      // Tokens look like: 123456:ABC-DEF
      const match = token.match(/^([0-9]+):/);
      botId = match ? match[1] : String(Math.floor(100000000 + Math.random() * 900000000));
      botUsername = `roy_bot_${botId.substring(0, 4)}_bot`;
      botName = `Roy Share Bot #${botId.substring(0, 4)}`;
    }

    // Check if bot already exists
    const existing = db.getBot(botId);
    if (existing) {
      return res.status(400).json({ success: false, message: `Bot with Username @${botUsername} is already registered.` });
    }

    const newBot: Bot = {
      id: botId,
      token,
      name: botName,
      username: botUsername,
      photoUrl,
      status: 'active',
      settings: {
        welcomeMessage: 'Welcome to Roy Share! Complete simple tasks to earn big rewards. Refer your friends and milestones to get extra wallet balance instantly.',
        maintenanceMode: false,
        registrationEnabled: true,
        minWithdraw: 100, // ₹100
        referralEnabled: true,
        walletEnabled: true,
      },
      channels: [
        { id: 'chan1', name: 'Roy Share Channel', url: 'https://t.me/royshare_chan', mandatory: true, enabled: true, priority: 1 }
      ],
      groups: [
        { id: 'grp1', name: 'Roy Share Community', url: 'https://t.me/royshare_group', mandatory: true, enabled: true, priority: 1 }
      ],
      milestones: [...DEFAULT_MILESTONES]
    };

    db.saveBot(newBot);
    db.addAdminLog(botId, {
      id: 'log_' + Date.now(),
      action: `Created Telegram Bot: @${botUsername}`,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: 'Bot registered successfully', bot: newBot, isMock });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Toggle bot status
app.post('/api/bots/:botId/toggle', (req, res) => {
  const { botId } = req.params;
  const bot = db.getBot(botId);
  if (!bot) return res.status(404).json({ success: false, message: 'Bot not found' });

  bot.status = bot.status === 'active' ? 'disabled' : 'active';
  db.saveBot(bot);
  db.addAdminLog(botId, {
    id: 'log_' + Date.now(),
    action: `Toggled Bot Status to: ${bot.status}`,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, bot });
});

// 4. Delete bot
app.delete('/api/bots/:botId', (req, res) => {
  const { botId } = req.params;
  const bot = db.getBot(botId);
  if (!bot) return res.status(404).json({ success: false, message: 'Bot not found' });

  db.deleteBot(botId);
  res.json({ success: true, message: 'Bot deleted successfully' });
});

// 5. Update bot settings
app.put('/api/bots/:botId/settings', (req, res) => {
  const { botId } = req.params;
  const { settings } = req.body;
  const bot = db.getBot(botId);
  if (!bot) return res.status(404).json({ success: false, message: 'Bot not found' });

  bot.settings = { ...bot.settings, ...settings };
  db.saveBot(bot);
  db.addAdminLog(botId, {
    id: 'log_' + Date.now(),
    action: `Updated bot general settings`,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, bot });
});

// 6. Manage Channels (Add/Delete/Toggle mandatory)
app.post('/api/bots/:botId/channels', (req, res) => {
  const { botId } = req.params;
  const { channels } = req.body; // expectation: entire array of channels
  const bot = db.getBot(botId);
  if (!bot) return res.status(404).json({ success: false, message: 'Bot not found' });

  bot.channels = channels;
  db.saveBot(bot);
  db.addAdminLog(botId, {
    id: 'log_' + Date.now(),
    action: `Updated mandatory channels configuration`,
    timestamp: new Date().toISOString()
  });
  res.json({ success: true, channels: bot.channels });
});

// 7. Manage Groups (Add/Delete/Toggle mandatory)
app.post('/api/bots/:botId/groups', (req, res) => {
  const { botId } = req.params;
  const { groups } = req.body; // expectation: entire array of groups
  const bot = db.getBot(botId);
  if (!bot) return res.status(404).json({ success: false, message: 'Bot not found' });

  bot.groups = groups;
  db.saveBot(bot);
  db.addAdminLog(botId, {
    id: 'log_' + Date.now(),
    action: `Updated mandatory groups configuration`,
    timestamp: new Date().toISOString()
  });
  res.json({ success: true, groups: bot.groups });
});

// 8. Manage Milestones (Add/Edit/Delete/Toggle)
app.post('/api/bots/:botId/milestones', (req, res) => {
  const { botId } = req.params;
  const { milestones } = req.body;
  const bot = db.getBot(botId);
  if (!bot) return res.status(404).json({ success: false, message: 'Bot not found' });

  bot.milestones = milestones;
  db.saveBot(bot);
  db.addAdminLog(botId, {
    id: 'log_' + Date.now(),
    action: `Updated milestone parameters`,
    timestamp: new Date().toISOString()
  });
  res.json({ success: true, milestones: bot.milestones });
});


// -------------------------------------------------------------
// USER ENDPOINTS (FRONTEND BOT USER FLOW & MINI APP)
// -------------------------------------------------------------

// 1. Get/Fetch or Init User
app.get('/api/bots/:botId/users/:telegramId', (req, res) => {
  const { botId, telegramId } = req.params;
  const bot = db.getBot(botId);
  if (!bot) return res.status(404).json({ success: false, message: 'Bot not found' });

  const user = db.getUser(botId, telegramId);
  if (!user) {
    return res.json({ success: true, exists: false });
  }

  res.json({ success: true, exists: true, user });
});

// 2. Register User (Under specified bot ID)
app.post('/api/bots/:botId/users/register', (req, res) => {
  const { botId } = req.params;
  const { telegramId, username, fullName, mobileNumber, referredBy, deviceFingerprint } = req.body;

  if (!telegramId || !fullName || !mobileNumber) {
    return res.status(400).json({ success: false, message: 'Telegram ID, Full Name, and Mobile Number are required.' });
  }

  const bot = db.getBot(botId);
  if (!bot) return res.status(404).json({ success: false, message: 'Bot not found' });

  // 1. Duplicate Telegram Account Check
  const existingUserByTg = db.getUser(botId, telegramId);
  if (existingUserByTg) {
    return res.status(400).json({ success: false, message: 'This Telegram account is already registered.' });
  }

  // 2. Duplicate Mobile Number Check
  const allUsers = db.getUsers(botId);
  const existingUserByMobile = allUsers.find(u => u.mobileNumber === mobileNumber);
  if (existingUserByMobile) {
    return res.status(400).json({ success: false, message: 'This Mobile Number is already in use.' });
  }

  // 3. Referral Fraud Check (Device Fingerprint match)
  const isDuplicateFingerprint = checkFingerprintDuplication(botId, deviceFingerprint, telegramId);

  // Initialize new user as pending (or verified after OTP)
  // Let's create user with referralStatus: 'pending' (pending OTP verification)
  const newUser: User = {
    telegramId,
    username: username || `user_${telegramId}`,
    fullName,
    mobileNumber,
    walletBalance: 0,
    totalEarned: 0,
    referralEarnings: 0,
    claimedRewards: 0,
    pendingWithdraw: 0,
    totalWithdrawn: 0,
    referredBy: referredBy && referredBy !== telegramId ? referredBy : '',
    referralCount: 0,
    referralStatus: 'pending',
    isBlocked: false,
    createdAt: new Date().toISOString(),
    deviceFingerprint: deviceFingerprint || ''
  };

  db.saveUser(botId, newUser);

  res.json({
    success: true,
    message: 'Registration initialized. Please complete OTP verification.',
    user: newUser,
    fraudWarning: isDuplicateFingerprint ? 'Suspicious device pairing detected.' : null
  });
});

// 3. OTP Request
app.post('/api/bots/:botId/otp/request', (req, res) => {
  const { botId } = req.params;
  const { telegramId, mobileNumber } = req.body;

  if (!telegramId || !mobileNumber) {
    return res.status(400).json({ success: false, message: 'Telegram ID and Mobile Number are required.' });
  }

  const bot = db.getBot(botId);
  if (!bot) return res.status(404).json({ success: false, message: 'Bot not found' });

  // Rate limiting check
  const rateKey = `${botId}_${telegramId}`;
  const now = Date.now();
  if (otpRateLimit[rateKey] && now - otpRateLimit[rateKey] < 30000) {
    // Limit to 1 request per 30 seconds
    return res.status(429).json({ success: false, message: 'Please wait 30 seconds before requesting another OTP.' });
  }

  // Generate 6-digit OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = now + 5 * 60 * 1000; // 5 minutes expiry

  otpStore[rateKey] = {
    otp,
    mobileNumber,
    attempts: 0,
    expiresAt
  };
  otpRateLimit[rateKey] = now;

  console.log(`[OTP] Generated OTP for TG ${telegramId} on bot @${bot.username}: ${otp}`);

  // Send real message if real Telegram token, or let simulator display it
  // We'll also return it in the JSON for the simulator preview interface!
  res.json({
    success: true,
    message: 'OTP sent successfully! Check your bot messages or use the Simulator.',
    otp // For testing & simulation convenience
  });
});

// 4. OTP Verification
app.post('/api/bots/:botId/otp/verify', (req, res) => {
  const { botId } = req.params;
  const { telegramId, otp } = req.body;

  if (!telegramId || !otp) {
    return res.status(400).json({ success: false, message: 'Telegram ID and OTP are required.' });
  }

  const user = db.getUser(botId, telegramId);
  if (!user) return res.status(404).json({ success: false, message: 'User registration not found.' });

  const rateKey = `${botId}_${telegramId}`;
  const record = otpStore[rateKey];

  if (!record) {
    return res.status(400).json({ success: false, message: 'No OTP requested or OTP expired.' });
  }

  if (Date.now() > record.expiresAt) {
    delete otpStore[rateKey];
    return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
  }

  if (record.attempts >= 3) {
    delete otpStore[rateKey];
    return res.status(400).json({ success: false, message: 'Maximum attempts reached. Please request a new OTP.' });
  }

  if (record.otp !== otp) {
    record.attempts += 1;
    return res.status(400).json({
      success: false,
      message: `Invalid OTP. You have ${3 - record.attempts} attempts remaining.`
    });
  }

  // OTP verified successfully!
  delete otpStore[rateKey];

  // Mark user as verified
  user.referralStatus = 'verified';
  db.saveUser(botId, user);

  // Check if referred by another user
  if (user.referredBy) {
    const referrer = db.getUser(botId, user.referredBy);
    if (referrer) {
      // Increment referrer's verified referral count
      referrer.referralCount += 1;
      db.saveUser(botId, referrer);

      // Create transaction/notification records for the referrer
      db.addTransaction(botId, {
        id: 'tx_ref_' + Date.now(),
        telegramId: referrer.telegramId,
        type: 'credit',
        amount: 0, // Milestone system means they don't get flat cash instantly
        description: `Referral verification success for @${user.username || user.fullName}`,
        timestamp: new Date().toISOString()
      });

      db.addNotification(botId, {
        id: 'notif_ref_' + Date.now(),
        title: 'Referral Verified 🎉',
        message: `Your referral @${user.username || user.fullName} completed verification! Your total referrals: ${referrer.referralCount}`,
        type: 'system',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Add system notification for registration complete
  db.addNotification(botId, {
    id: 'notif_reg_' + Date.now(),
    title: 'Welcome to Roy Share! 🚀',
    message: 'Your registration is completed. Start inviting friends to earn milestone cash rewards!',
    type: 'system',
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    message: 'OTP verification complete! Registration is fully verified.',
    user
  });
});

// 5. Claim Milestone Reward
app.post('/api/bots/:botId/users/:telegramId/claim', (req, res) => {
  const { botId, telegramId } = req.params;
  const { milestoneId } = req.body;

  const bot = db.getBot(botId);
  if (!bot) return res.status(404).json({ success: false, message: 'Bot not found' });

  const user = db.getUser(botId, telegramId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const milestone = bot.milestones.find(m => m.id === milestoneId);
  if (!milestone || !milestone.enabled) {
    return res.status(400).json({ success: false, message: 'Milestone is either invalid or disabled.' });
  }

  // Verify referral target met
  if (user.referralCount < milestone.referralsRequired) {
    return res.status(400).json({
      success: false,
      message: `Required referrals: ${milestone.referralsRequired}. You currently have: ${user.referralCount}`
    });
  }

  // Verify not already claimed
  const claims = db.getClaimHistory(botId);
  const alreadyClaimed = claims.some(c => c.telegramId === telegramId && c.milestoneId === milestoneId);
  if (alreadyClaimed) {
    return res.status(400).json({ success: false, message: 'You have already claimed this milestone reward.' });
  }

  // Grant Reward!
  user.walletBalance += milestone.rewardAmount;
  user.totalEarned += milestone.rewardAmount;
  user.claimedRewards += milestone.rewardAmount;
  user.referralEarnings += milestone.rewardAmount;

  db.saveUser(botId, user);

  // Record Claim History
  db.addClaimHistory(botId, {
    id: 'claim_' + Date.now(),
    telegramId,
    milestoneId,
    rewardAmount: milestone.rewardAmount,
    timestamp: new Date().toISOString()
  });

  // Log transaction
  db.addTransaction(botId, {
    id: 'tx_claim_' + Date.now(),
    telegramId,
    type: 'credit',
    amount: milestone.rewardAmount,
    description: `Claimed ${milestone.referralsRequired} Referrals Milestone Reward`,
    timestamp: new Date().toISOString()
  });

  // Log Notification
  db.addNotification(botId, {
    id: 'notif_claim_' + Date.now(),
    title: 'Milestone Claimed! 💰',
    message: `Successfully claimed ₹${milestone.rewardAmount} for completing the ${milestone.referralsRequired} referrals milestone. Check your wallet balance!`,
    type: 'system',
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    message: `Milestone reward of ₹${milestone.rewardAmount} claimed successfully!`,
    user
  });
});

// 6. Submit Withdraw Request
app.post('/api/bots/:botId/users/:telegramId/withdraw', (req, res) => {
  const { botId, telegramId } = req.params;
  const { amount, method, details } = req.body;

  if (!amount || !method || !details) {
    return res.status(400).json({ success: false, message: 'Amount, method, and withdraw account details are required.' });
  }

  const bot = db.getBot(botId);
  if (!bot) return res.status(404).json({ success: false, message: 'Bot not found' });

  const user = db.getUser(botId, telegramId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  // Verification checks
  const minWithdraw = bot.settings.minWithdraw;
  if (amount < minWithdraw) {
    return res.status(400).json({ success: false, message: `Minimum withdrawal limit is ₹${minWithdraw}.` });
  }

  if (user.walletBalance < amount) {
    return res.status(400).json({ success: false, message: 'Insufficient wallet balance for this withdrawal.' });
  }

  // Process debit
  user.walletBalance -= amount;
  user.pendingWithdraw += amount;
  db.saveUser(botId, user);

  // Save withdraw request
  const newWithdraw: Withdraw = {
    id: 'withdraw_' + Date.now(),
    telegramId,
    fullName: user.fullName,
    method,
    details,
    amount,
    status: 'pending',
    reason: '',
    timestamp: new Date().toISOString()
  };

  db.saveWithdraw(botId, newWithdraw);

  // Transaction Record
  db.addTransaction(botId, {
    id: 'tx_wd_' + Date.now(),
    telegramId,
    type: 'debit',
    amount,
    description: `Withdrawal request submitted via ${method}`,
    timestamp: new Date().toISOString()
  });

  // Notification Record
  db.addNotification(botId, {
    id: 'notif_wd_' + Date.now(),
    title: 'Withdrawal Pending ⏳',
    message: `Your withdrawal request of ₹${amount} via ${method} is submitted and is pending administrator approval.`,
    type: 'system',
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    message: 'Withdrawal request submitted successfully.',
    user
  });
});

// 7. Get Transaction History
app.get('/api/bots/:botId/transactions/:telegramId', (req, res) => {
  const { botId, telegramId } = req.params;
  const txs = db.getTransactions(botId).filter(t => t.telegramId === telegramId);
  res.json({ success: true, transactions: txs });
});

// 8. Get Withdraw History
app.get('/api/bots/:botId/withdraws/:telegramId', (req, res) => {
  const { botId, telegramId } = req.params;
  const wds = db.getWithdraws(botId).filter(w => w.telegramId === telegramId);
  res.json({ success: true, withdraws: wds });
});

// 9. Get Notifications (Unread Count + list)
app.get('/api/bots/:botId/notifications', (req, res) => {
  const { botId } = req.params;
  const notifications = db.getNotifications(botId);
  res.json({ success: true, notifications });
});


// -------------------------------------------------------------
// ADMIN MANAGEMENT ENDPOINTS (BY BOT ID)
// -------------------------------------------------------------

// 1. Analytics & Overview Dashboard
app.get('/api/bots/:botId/analytics', (req, res) => {
  const { botId } = req.params;
  const bot = db.getBot(botId);
  if (!bot) return res.status(404).json({ success: false, message: 'Bot not found' });

  const users = db.getUsers(botId);
  const withdraws = db.getWithdraws(botId);
  const transactions = db.getTransactions(botId);

  // Calculate metrics
  const totalUsers = users.length;
  const verifiedUsers = users.filter(u => u.referralStatus === 'verified').length;
  const today = new Date().toISOString().split('T')[0];
  const todayUsers = users.filter(u => u.createdAt.startsWith(today)).length;

  let totalWallet = 0;
  let totalWithdrawn = 0;
  let pendingWithdraw = 0;
  users.forEach(u => {
    totalWallet += u.walletBalance;
    totalWithdrawn += u.totalWithdrawn;
    pendingWithdraw += u.pendingWithdraw;
  });

  const referralCount = users.reduce((acc, u) => acc + u.referralCount, 0);
  const withdrawCount = withdraws.length;

  res.json({
    success: true,
    analytics: {
      totalUsers,
      todayUsers,
      verifiedUsers,
      totalWallet,
      pendingWithdraw,
      totalWithdrawn,
      referralCount,
      withdrawCount,
    }
  });
});

// 2. Fetch Users (With search & filtering)
app.get('/api/bots/:botId/admin/users', (req, res) => {
  const { botId } = req.params;
  const { query, filterBlocked } = req.query;

  let users = db.getUsers(botId);

  if (query) {
    const q = String(query).toLowerCase();
    users = users.filter(u =>
      u.fullName.toLowerCase().includes(q) ||
      u.telegramId.toLowerCase().includes(q) ||
      u.mobileNumber.includes(q) ||
      (u.username && u.username.toLowerCase().includes(q))
    );
  }

  if (filterBlocked === 'true') {
    users = users.filter(u => u.isBlocked);
  }

  res.json({ success: true, users });
});

// 3. User block / unblock status
app.post('/api/bots/:botId/admin/users/:telegramId/status', (req, res) => {
  const { botId, telegramId } = req.params;
  const { block, deleteUser } = req.body;

  const bot = db.getBot(botId);
  if (!bot) return res.status(404).json({ success: false, message: 'Bot not found' });

  const user = db.getUser(botId, telegramId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  if (deleteUser) {
    // Delete user from DB
    db.deleteUser(botId, telegramId);

    db.addAdminLog(botId, {
      id: 'log_' + Date.now(),
      action: `Deleted user profile: ${telegramId} (${user.fullName})`,
      timestamp: new Date().toISOString()
    });

    return res.json({ success: true, message: 'User profile permanently deleted' });
  }

  user.isBlocked = !!block;
  db.saveUser(botId, user);

  db.addAdminLog(botId, {
    id: 'log_' + Date.now(),
    action: `${block ? 'Blocked' : 'Unblocked'} user: ${telegramId} (${user.fullName})`,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, user });
});

// 4. Adjust user wallet directly (Credit / Debit)
app.post('/api/bots/:botId/admin/users/:telegramId/wallet', (req, res) => {
  const { botId, telegramId } = req.params;
  const { action, amount, description } = req.body; // action: 'credit' | 'debit'

  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid transaction amount' });
  }

  const user = db.getUser(botId, telegramId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  if (action === 'credit') {
    user.walletBalance += amount;
    user.totalEarned += amount;
  } else if (action === 'debit') {
    if (user.walletBalance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient user wallet balance' });
    }
    user.walletBalance -= amount;
  } else {
    return res.status(400).json({ success: false, message: 'Action must be credit or debit' });
  }

  db.saveUser(botId, user);

  // Log transaction
  db.addTransaction(botId, {
    id: 'tx_adj_' + Date.now(),
    telegramId,
    type: action,
    amount,
    description: description || `Administrator adjustment: ${action}`,
    timestamp: new Date().toISOString()
  });

  // Notify user
  db.addNotification(botId, {
    id: 'notif_adj_' + Date.now(),
    title: action === 'credit' ? 'Wallet Credited 🪙' : 'Wallet Debited 💸',
    message: `Your wallet balance has been adjusted by administration. Amount: ₹${amount}. Description: ${description || 'N/A'}.`,
    type: 'system',
    timestamp: new Date().toISOString()
  });

  db.addAdminLog(botId, {
    id: 'log_' + Date.now(),
    action: `Wallet Adjust (${action}) on user ${telegramId}: ₹${amount}`,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, user });
});

// 5. Fetch withdrawals
app.get('/api/bots/:botId/admin/withdraws', (req, res) => {
  const { botId } = req.params;
  const { status } = req.query; // pending | approved | rejected

  let withdraws = db.getWithdraws(botId);
  if (status) {
    withdraws = withdraws.filter(w => w.status === status);
  }

  res.json({ success: true, withdraws });
});

// 6. Approve / Reject withdrawal
app.post('/api/bots/:botId/admin/withdraws/:id/action', (req, res) => {
  const { botId, id } = req.params;
  const { action, reason } = req.body; // action: 'approve' | 'reject'

  const withdraws = db.getWithdraws(botId);
  const wd = withdraws.find(w => w.id === id);
  if (!wd) return res.status(404).json({ success: false, message: 'Withdrawal request not found' });

  if (wd.status !== 'pending') {
    return res.status(400).json({ success: false, message: 'Withdrawal request has already been processed.' });
  }

  const user = db.getUser(botId, wd.telegramId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  if (action === 'approve') {
    wd.status = 'approved';
    user.pendingWithdraw -= wd.amount;
    user.totalWithdrawn += wd.amount;

    db.addNotification(botId, {
      id: 'notif_approve_' + Date.now(),
      title: 'Withdrawal Approved! 🟢',
      message: `Your withdrawal request of ₹${wd.amount} has been approved by admin!`,
      type: 'system',
      timestamp: new Date().toISOString()
    });
  } else if (action === 'reject') {
    wd.status = 'rejected';
    wd.reason = reason || 'Rejected by administrator';

    // Refund wallet balance
    user.walletBalance += wd.amount;
    user.pendingWithdraw -= wd.amount;

    // Log credit transaction for refund
    db.addTransaction(botId, {
      id: 'tx_refund_' + Date.now(),
      telegramId: wd.telegramId,
      type: 'credit',
      amount: wd.amount,
      description: `Refund for rejected withdrawal request: ${wd.reason}`,
      timestamp: new Date().toISOString()
    });

    db.addNotification(botId, {
      id: 'notif_reject_' + Date.now(),
      title: 'Withdrawal Rejected 🔴',
      message: `Your withdrawal request of ₹${wd.amount} has been rejected. Reason: ${wd.reason}. Your funds have been refunded to your wallet.`,
      type: 'system',
      timestamp: new Date().toISOString()
    });
  } else {
    return res.status(400).json({ success: false, message: 'Invalid action. Must be approve or reject.' });
  }

  db.saveWithdraw(botId, wd);
  db.saveUser(botId, user);

  db.addAdminLog(botId, {
    id: 'log_' + Date.now(),
    action: `Withdrawal ${action}ed for user ${wd.telegramId}, amount: ₹${wd.amount}`,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, withdraw: wd });
});

// 7. Broadcast Campaign Manager
app.post('/api/bots/:botId/admin/broadcast', (req, res) => {
  const { botId } = req.params;
  const { title, message } = req.body;

  if (!title || !message) {
    return res.status(400).json({ success: false, message: 'Title and message are required for broadcasts.' });
  }

  const newBroadcast: Notification = {
    id: 'broad_' + Date.now(),
    title,
    message,
    type: 'broadcast',
    timestamp: new Date().toISOString()
  };

  db.addNotification(botId, newBroadcast);

  db.addAdminLog(botId, {
    id: 'log_' + Date.now(),
    action: `Sent broadcast notification: ${title}`,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, message: 'Broadcast campaign initiated successfully.', broadcast: newBroadcast });
});

// 8. Admin audit log list
app.get('/api/bots/:botId/admin/logs', (req, res) => {
  const { botId } = req.params;
  const logs = db.getAdminLogs(botId);
  res.json({ success: true, logs });
});

// 8.1 Global transaction log list
app.get('/api/bots/:botId/admin/transactions', (req, res) => {
  const { botId } = req.params;
  const transactions = db.getTransactions(botId);
  res.json({ success: true, transactions });
});

// 9. Global database backup and recovery endpoints
app.get('/api/admin/backup', (req, res) => {
  try {
    const rawBackup = db.exportBackup();
    res.json({ success: true, backup: rawBackup });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/backup/restore', (req, res) => {
  const { backup } = req.body;
  if (!backup) {
    return res.status(400).json({ success: false, message: 'Backup payload is required.' });
  }
  try {
    const success = db.importBackup(backup);
    if (success) {
      res.json({ success: true, message: 'Database state restored successfully.' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid database backup structure.' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// -------------------------------------------------------------
// FIREBASE / FIRESTORE INTEGRATION
// -------------------------------------------------------------
let firestoreDb: Firestore | null = null;
let firebaseInitError: any = null;

function getFirestoreDb(): Firestore {
  if (firestoreDb) return firestoreDb;
  if (firebaseInitError) throw firebaseInitError;

  try {
    if (!getApps().length) {
      initializeApp();
    }
    firestoreDb = getFirestore();
    return firestoreDb;
  } catch (err: any) {
    firebaseInitError = err;
    console.error('Firebase initialization error in getFirestoreDb:', err);
    throw err;
  }
}

function resetFirebaseDb() {
  firestoreDb = null;
  firebaseInitError = null;
}


// -------------------------------------------------------------
// TELEGRAM WEBHOOK RECEIVER ENDPOINT
// -------------------------------------------------------------
app.post('/api/webhook/:botId', async (req, res) => {
  const { botId } = req.params;
  const update = req.body;
  
  console.log(`[Webhook] Update received for bot ${botId}:`, JSON.stringify(update));

  try {
    const bot = db.getBot(botId);
    if (!bot) {
      console.error(`[Webhook] Bot ${botId} not found in database.`);
      return res.status(404).json({ success: false, message: 'Bot not found' });
    }

    if (update.message && update.message.text) {
      const text = update.message.text.trim();
      const chatId = update.message.chat.id;
      const fromId = String(update.message.from.id);
      const username = update.message.from.username || '';
      const firstName = update.message.from.first_name || '';
      const lastName = update.message.from.last_name || '';
      const fullName = [firstName, lastName].filter(Boolean).join(' ');

      // Check if starting with referral
      if (text.startsWith('/start')) {
        let referredBy = '';
        const parts = text.split(' ');
        if (parts.length > 1 && parts[1].startsWith('ref_')) {
          referredBy = parts[1].substring(4);
        }

        const appUrl = process.env.APP_URL || `http://localhost:3000`;
        const webAppUrl = `${appUrl}/?botId=${botId}&tgId=${fromId}&username=${username}&fullName=${encodeURIComponent(fullName)}&referredBy=${referredBy}`;
        
        const welcomeText = `👋 *Hello ${fullName || 'User'}!*\n\n${bot.settings.welcomeMessage || 'Welcome to our platform!'}\n\n🏆 Complete tasks, invite your friends, and claim cash milestones directly inside our secure Web Mini App below!`;

        const replyMarkup = {
          inline_keyboard: [
            [
              {
                text: '🚀 Launch Web Mini App',
                web_app: { url: webAppUrl }
              }
            ],
            [
              {
                text: '📢 Join Channel',
                url: bot.channels[0]?.url || 'https://t.me/royshare_chan'
              }
            ]
          ]
        };

        const tgRes = await fetch(`https://api.telegram.org/bot${bot.token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: welcomeText,
            parse_mode: 'Markdown',
            reply_markup: replyMarkup
          })
        });

        if (tgRes.ok) {
          console.log(`[Webhook] Welcome message sent successfully to user ${fromId}`);
        } else {
          const tgErr = await tgRes.text();
          console.error(`[Webhook] Failed to send Telegram message:`, tgErr);
        }
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error(`[Webhook] Error processing update:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// -------------------------------------------------------------
// DIAGNOSTICS & HEALTH API ENDPOINTS
// -------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/bots/:botId/diagnostics', async (req, res) => {
  const { botId } = req.params;
  const { test } = req.body;
  
  const bot = db.getBot(botId);
  if (!bot) {
    return res.status(404).json({ success: false, message: 'Bot not found in local database.' });
  }

  const logs: string[] = [];
  const addLog = (level: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR', msg: string) => {
    const ts = new Date().toISOString().split('T')[1].substring(0, 12);
    logs.push(`[${ts}] [${level}] ${msg}`);
  };

  addLog('INFO', `Starting comprehensive diagnostics session for @${bot.username}...`);

  const results: Record<string, any> = {
    getMe: { status: 'PENDING' },
    getWebhookInfo: { status: 'PENDING' },
    setWebhook: { status: 'PENDING' },
    deleteWebhook: { status: 'PENDING' },
    sendMessage: { status: 'PENDING' },
    firestoreRead: { status: 'PENDING' },
    firestoreWrite: { status: 'PENDING' },
    envVars: { status: 'PENDING' },
    renderHealth: { status: 'PENDING' },
    overallStatus: 'FAIL'
  };

  const appUrl = process.env.APP_URL || 'https://domain';
  const expectedWebhookUrl = `${appUrl}/api/webhook/${botId}`;

  // 1. envVars
  const runEnvVars = () => {
    addLog('INFO', 'Running Environment Variables test...');
    const missing = [];
    if (!process.env.GEMINI_API_KEY) missing.push('GEMINI_API_KEY');
    if (!process.env.APP_URL) missing.push('APP_URL');
    
    if (missing.length > 0) {
      addLog('WARNING', `Missing recommended environment variables: ${missing.join(', ')}`);
      results.envVars = { status: 'WARNING', details: `Missing: ${missing.join(', ')}` };
    } else {
      addLog('SUCCESS', 'All core environment variables verified.');
      results.envVars = { status: 'SUCCESS' };
    }
  };

  // 2. renderHealth
  const runRenderHealth = async () => {
    addLog('INFO', 'Running Render Health test...');
    const start = Date.now();
    try {
      const fetchRes = await fetch(`http://localhost:3000/api/health`);
      const latency = Date.now() - start;
      if (fetchRes.ok) {
        addLog('SUCCESS', 'Render health check returned OK.');
        results.renderHealth = { status: 'SUCCESS', latency };
      } else {
        throw new Error(`HTTP status ${fetchRes.status}`);
      }
    } catch (err: any) {
      addLog('ERROR', `Render Health failed: ${err.message}`);
      results.renderHealth = { status: 'ERROR', error: err.message, stack: err.stack };
    }
  };

  // 3. getMe
  const runGetMe = async () => {
    addLog('INFO', 'Running getMe test...');
    const start = Date.now();
    try {
      const fetchRes = await fetch(`https://api.telegram.org/bot${bot.token}/getMe`);
      const latency = Date.now() - start;
      const data = await fetchRes.json();
      if (fetchRes.ok && data.ok) {
        addLog('SUCCESS', `getMe success. Bot @${data.result.username}`);
        results.getMe = { status: 'SUCCESS', latency, response: data };
      } else {
        throw new Error(data.description || `HTTP ${fetchRes.status}`);
      }
    } catch (err: any) {
      addLog('ERROR', `getMe failed: ${err.message}`);
      results.getMe = { status: 'ERROR', error: err.message, stack: err.stack };
    }
  };

  // 4. getWebhookInfo
  const runGetWebhookInfo = async () => {
    addLog('INFO', 'Running getWebhookInfo test...');
    const start = Date.now();
    try {
      const fetchRes = await fetch(`https://api.telegram.org/bot${bot.token}/getWebhookInfo`);
      const latency = Date.now() - start;
      const data = await fetchRes.json();
      if (fetchRes.ok && data.ok) {
        addLog('SUCCESS', `getWebhookInfo success. Webhook URL: ${data.result.url || 'None'}`);
        results.getWebhookInfo = { status: 'SUCCESS', latency, url: data.result.url, response: data };
      } else {
        throw new Error(data.description || `HTTP ${fetchRes.status}`);
      }
    } catch (err: any) {
      addLog('ERROR', `getWebhookInfo failed: ${err.message}`);
      results.getWebhookInfo = { status: 'ERROR', error: err.message, stack: err.stack };
    }
  };

  // 5. setWebhook
  const runSetWebhook = async () => {
    addLog('INFO', 'Running setWebhook test...');
    addLog('INFO', `Webhook URL: ${expectedWebhookUrl}`);
    
    try {
      const urlObj = new URL(expectedWebhookUrl);
      addLog('INFO', `Host: ${urlObj.host}`);
      addLog('INFO', `Path: ${urlObj.pathname}`);
    } catch (e) {
      addLog('ERROR', `Invalid URL format for expectedWebhookUrl.`);
    }

    const start = Date.now();
    try {
      const fetchRes = await fetch(`https://api.telegram.org/bot${bot.token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: expectedWebhookUrl })
      });
      const latency = Date.now() - start;
      const data = await fetchRes.json();
      
      addLog('INFO', `HTTP Status: ${fetchRes.status}`);
      addLog('INFO', `Telegram Response: ${JSON.stringify(data)}`);

      if (fetchRes.ok && data.ok) {
        addLog('SUCCESS', `setWebhook success. Webhook mapped to: ${expectedWebhookUrl}`);
        results.setWebhook = { status: 'SUCCESS', latency, response: data };
      } else {
        throw new Error(data.description || `HTTP ${fetchRes.status}`);
      }
    } catch (err: any) {
      addLog('ERROR', `setWebhook failed: ${err.message}`);
      results.setWebhook = { status: 'ERROR', error: err.message, stack: err.stack };
    }
  };

  // 6. deleteWebhook
  const runDeleteWebhook = async () => {
    addLog('INFO', 'Running deleteWebhook test...');
    const start = Date.now();
    try {
      const fetchRes = await fetch(`https://api.telegram.org/bot${bot.token}/deleteWebhook`);
      const latency = Date.now() - start;
      const data = await fetchRes.json();
      if (fetchRes.ok && data.ok) {
        addLog('SUCCESS', 'deleteWebhook success. Instantly restoring webhook connection...');
        // Restore webhook immediately
        await fetch(`https://api.telegram.org/bot${bot.token}/setWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: expectedWebhookUrl })
        });
        results.deleteWebhook = { status: 'SUCCESS', latency, response: data };
      } else {
        throw new Error(data.description || `HTTP ${fetchRes.status}`);
      }
    } catch (err: any) {
      addLog('ERROR', `deleteWebhook failed: ${err.message}`);
      results.deleteWebhook = { status: 'ERROR', error: err.message, stack: err.stack };
    }
  };

  // 7. sendMessage
  const runSendMessage = async () => {
    addLog('INFO', 'Running sendMessage test...');
    const start = Date.now();
    try {
      const usersList = db.getUsers(botId);
      const targetChatId = usersList.length > 0 ? usersList[0].telegramId : '123456789';
      addLog('INFO', `Sending diagnostic Telegram message to target chat ID: ${targetChatId}...`);
      
      const testMsg = `⚙️ *System Diagnostics Check*\nThis is an automated connection check.`;
      const fetchRes = await fetch(`https://api.telegram.org/bot${bot.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: testMsg,
          parse_mode: 'Markdown'
        })
      });
      const latency = Date.now() - start;
      const data = await fetchRes.json();
      
      if (fetchRes.status === 401) {
        throw new Error('Unauthorized (Invalid Bot Token)');
      }

      const isAcceptedError = data.description && (
        data.description.includes('chat not found') ||
        data.description.includes('peer not found') ||
        data.description.includes('bot was blocked') ||
        data.description.includes('chat_id is empty')
      );

      if (fetchRes.ok || data.ok || isAcceptedError) {
        addLog('SUCCESS', `sendMessage API is functional (Response status/reason: ${data.description || 'OK'}).`);
        results.sendMessage = { status: 'SUCCESS', latency, response: data };
      } else {
        throw new Error(data.description || `HTTP ${fetchRes.status}`);
      }
    } catch (err: any) {
      addLog('ERROR', `sendMessage test failed: ${err.message}`);
      results.sendMessage = { status: 'ERROR', error: err.message, stack: err.stack };
    }
  };

  // 8. firestoreRead
  const runFirestoreRead = async () => {
    addLog('INFO', 'Running Firestore Read test...');
    const start = Date.now();
    try {
      const firestore = getFirestoreDb();
      const testDocRef = firestore.collection('diagnostics_tests').doc(botId);
      await testDocRef.get();
      const latency = Date.now() - start;
      addLog('SUCCESS', 'Firestore Read successful.');
      results.firestoreRead = { status: 'SUCCESS', latency };
    } catch (err: any) {
      addLog('ERROR', `Firestore Read failed: ${err.message}`);
      results.firestoreRead = { status: 'ERROR', error: err.message, stack: err.stack };
    }
  };

  // 9. firestoreWrite
  const runFirestoreWrite = async () => {
    addLog('INFO', 'Running Firestore Write test...');
    const start = Date.now();
    try {
      const firestore = getFirestoreDb();
      const testDocRef = firestore.collection('diagnostics_tests').doc(botId);
      await testDocRef.set({
        botId,
        testRun: true,
        timestamp: new Date().toISOString()
      });
      const latency = Date.now() - start;
      addLog('SUCCESS', 'Firestore Write successful.');
      results.firestoreWrite = { status: 'SUCCESS', latency };
    } catch (err: any) {
      addLog('ERROR', `Firestore Write failed: ${err.message}`);
      results.firestoreWrite = { status: 'ERROR', error: err.message, stack: err.stack };
    }
  };

  // Execute specified test or all
  if (test === 'getMe') {
    await runGetMe();
  } else if (test === 'getWebhookInfo') {
    await runGetWebhookInfo();
  } else if (test === 'setWebhook') {
    await runSetWebhook();
  } else if (test === 'deleteWebhook') {
    await runDeleteWebhook();
  } else if (test === 'sendMessage') {
    await runSendMessage();
  } else if (test === 'firestoreRead') {
    await runFirestoreRead();
  } else if (test === 'firestoreWrite') {
    await runFirestoreWrite();
  } else if (test === 'envVars') {
    runEnvVars();
  } else if (test === 'renderHealth') {
    await runRenderHealth();
  } else {
    // Run all
    runEnvVars();
    await runRenderHealth();
    await runGetMe();
    await runGetWebhookInfo();
    await runSetWebhook();
    await runDeleteWebhook();
    await runSendMessage();
    await runFirestoreRead();
    await runFirestoreWrite();
  }

  // Calculate Bot start response capabilities
  const botRespondsToStart = 
    results.getMe?.status === 'SUCCESS' &&
    results.getWebhookInfo?.status === 'SUCCESS' &&
    results.getWebhookInfo?.url === expectedWebhookUrl &&
    results.renderHealth?.status === 'SUCCESS';

  if (!botRespondsToStart) {
    addLog('ERROR', '🚨 TELEGRAM BOT WILL NOT RESPOND TO /start: getMe, getWebhookInfo or renderHealth failed/mismatched.');
  } else {
    addLog('SUCCESS', '🟢 Webhook and API active. Bot is ready to respond to telegram /start command.');
  }

  // Calculate Overall PASS
  // All 9 tests must succeed AND the bot must respond to /start
  const allTestsPassed = 
    results.getMe?.status === 'SUCCESS' &&
    results.getWebhookInfo?.status === 'SUCCESS' &&
    results.setWebhook?.status === 'SUCCESS' &&
    results.deleteWebhook?.status === 'SUCCESS' &&
    results.sendMessage?.status === 'SUCCESS' &&
    results.firestoreRead?.status === 'SUCCESS' &&
    results.firestoreWrite?.status === 'SUCCESS' &&
    results.envVars?.status === 'SUCCESS' &&
    results.renderHealth?.status === 'SUCCESS' &&
    botRespondsToStart;

  results.overallStatus = allTestsPassed ? 'PASS' : 'FAIL';

  if (allTestsPassed) {
    addLog('SUCCESS', '🎉 CONGRATULATIONS: Overall diagnostics status is PASS. All infrastructure fully active!');
  } else {
    addLog('ERROR', '🚨 DIAGNOSTICS FAILURE: Some core/mandatory tests failed. Overall status is FAIL.');
  }

  res.json({
    success: true,
    results,
    logs
  });
});

// Helper function to handle execution-timed diagnostic endpoints
async function runDiagnosticEndpoint(
  req: express.Request,
  res: express.Response,
  operation: (bot: any) => Promise<{ telegram_response?: any; firebase_response?: any }>
) {
  const start = Date.now();
  const { botId } = req.body;
  if (!botId) {
    return res.status(400).json({
      success: false,
      error: 'botId is required in request body',
      telegram_response: null,
      firebase_response: null,
      execution_time: Date.now() - start,
      stack_trace: new Error('botId is required').stack || null
    });
  }

  const bot = db.getBot(botId);
  if (!bot) {
    return res.status(404).json({
      success: false,
      error: `Bot not found with ID ${botId}`,
      telegram_response: null,
      firebase_response: null,
      execution_time: Date.now() - start,
      stack_trace: null
    });
  }

  try {
    const result = await operation(bot);
    const execution_time = Date.now() - start;
    return res.json({
      success: true,
      error: null,
      telegram_response: result.telegram_response || null,
      firebase_response: result.firebase_response || null,
      execution_time,
      stack_trace: null
    });
  } catch (err: any) {
    const execution_time = Date.now() - start;
    return res.status(500).json({
      success: false,
      error: err.message || String(err),
      telegram_response: err.telegram_response || null,
      firebase_response: err.firebase_response || null,
      execution_time,
      stack_trace: err.stack || null
    });
  }
}

// -------------------------------------------------------------
// REAL DEDICATED DIAGNOSTICS REPAIR ENDPOINTS
// -------------------------------------------------------------

app.post('/api/diagnostics/register-webhook', async (req, res) => {
  await runDiagnosticEndpoint(req, res, async (bot) => {
    const appUrl = process.env.APP_URL || `https://domain`;
    const webhookUrl = `${appUrl}/api/webhook/${bot.id}`;
    
    const setRes = await fetch(`https://api.telegram.org/bot${bot.token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    });
    const setData = await setRes.json();
    if (!setRes.ok || !setData.ok) {
      const err: any = new Error(setData.description || `HTTP ${setRes.status} on setWebhook`);
      err.telegram_response = setData;
      throw err;
    }
    
    db.addAdminLog(bot.id, {
      id: 'log_' + Date.now(),
      action: `Registered Telegram Webhook: ${webhookUrl}`,
      timestamp: new Date().toISOString()
    });

    return { telegram_response: setData };
  });
});

app.post('/api/diagnostics/reset-webhook', async (req, res) => {
  await runDiagnosticEndpoint(req, res, async (bot) => {
    const delRes = await fetch(`https://api.telegram.org/bot${bot.token}/deleteWebhook`);
    const delData = await delRes.json();
    
    const appUrl = process.env.APP_URL || `https://domain`;
    const webhookUrl = `${appUrl}/api/webhook/${bot.id}`;
    
    const setRes = await fetch(`https://api.telegram.org/bot${bot.token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    });
    const setData = await setRes.json();
    if (!setRes.ok || !setData.ok) {
      const err: any = new Error(setData.description || `Failed to set webhook after deletion`);
      err.telegram_response = { delete: delData, set: setData };
      throw err;
    }
    
    db.addAdminLog(bot.id, {
      id: 'log_' + Date.now(),
      action: `Reset & Re-registered Telegram Webhook: ${webhookUrl}`,
      timestamp: new Date().toISOString()
    });

    return { telegram_response: { delete: delData, set: setData } };
  });
});

app.post('/api/diagnostics/reload-token', async (req, res) => {
  await runDiagnosticEndpoint(req, res, async (bot) => {
    const tgRes = await fetch(`https://api.telegram.org/bot${bot.token}/getMe`);
    const tgData = await tgRes.json();
    if (!tgRes.ok || !tgData.ok) {
      const err: any = new Error(tgData.description || `HTTP ${tgRes.status} on getMe`);
      err.telegram_response = tgData;
      throw err;
    }
    
    bot.name = tgData.result.first_name;
    bot.username = tgData.result.username;
    db.saveBot(bot);

    db.addAdminLog(bot.id, {
      id: 'log_' + Date.now(),
      action: `Reloaded Bot Token. Credentials updated for @${bot.username}`,
      timestamp: new Date().toISOString()
    });

    return { telegram_response: tgData };
  });
});

app.post('/api/diagnostics/refresh-firestore', async (req, res) => {
  await runDiagnosticEndpoint(req, res, async (bot) => {
    resetFirebaseDb();
    const dbInstance = getFirestoreDb();
    
    // Validate instantly with a real write/read test
    const testDocRef = dbInstance.collection('diagnostics_tests').doc(bot.id);
    await testDocRef.set({
      botId: bot.id,
      timestamp: new Date().toISOString(),
      refreshed: true
    });
    
    const snap = await testDocRef.get();
    const data = snap.data();
    await testDocRef.delete();

    return {
      firebase_response: {
        status: 'SUCCESS',
        write: 'SUCCESS',
        read: 'SUCCESS',
        data
      }
    };
  });
});

app.post('/api/diagnostics/restart-session', async (req, res) => {
  await runDiagnosticEndpoint(req, res, async (bot) => {
    // Restart session by calling deleteWebhook with drop_pending_updates: true, then restoring it
    const delRes = await fetch(`https://api.telegram.org/bot${bot.token}/deleteWebhook?drop_pending_updates=true`);
    const delData = await delRes.json();
    
    const appUrl = process.env.APP_URL || `https://domain`;
    const webhookUrl = `${appUrl}/api/webhook/${bot.id}`;
    
    const setRes = await fetch(`https://api.telegram.org/bot${bot.token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    });
    const setData = await setRes.json();

    return {
      telegram_response: {
        drop_pending: delData,
        re_register: setData
      }
    };
  });
});

app.post('/api/diagnostics/clear-cache', async (req, res) => {
  await runDiagnosticEndpoint(req, res, async (bot) => {
    resetFirebaseDb();
    return {
      firebase_response: {
        cache_cleared: true,
        firebase_db_reset: true
      }
    };
  });
});

// Legacy support route
app.post('/api/bots/:botId/repair', async (req, res) => {
  const { botId } = req.params;
  const { action } = req.body;
  
  const bot = db.getBot(botId);
  if (!bot) {
    return res.status(404).json({ success: false, message: 'Bot not found' });
  }

  const logs: string[] = [];
  const addLog = (level: 'INFO' | 'SUCCESS' | 'ERROR', msg: string) => {
    const ts = new Date().toISOString().split('T')[1].substring(0, 12);
    logs.push(`[${ts}] [${level}] ${msg}`);
  };

  try {
    if (action === 'reset_webhook' || action === 'resetWebhook') {
      addLog('INFO', 'De-registering previous webhook on Telegram...');
      await fetch(`https://api.telegram.org/bot${bot.token}/deleteWebhook`);
      const appUrl = process.env.APP_URL || `https://domain`;
      const webhookUrl = `${appUrl}/api/webhook/${botId}`;
      addLog('INFO', `Registering fresh webhook URL: "${webhookUrl}"...`);
      const tgRes = await fetch(`https://api.telegram.org/bot${bot.token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl })
      });
      const tgData = await tgRes.json();
      if (tgRes.ok && tgData.ok) {
        addLog('SUCCESS', `Successfully registered webhook on Telegram!`);
      } else {
        throw new Error(tgData.description || 'setWebhook rejected by Telegram');
      }
    } else if (action === 'reload_token' || action === 'reloadToken') {
      const tgRes = await fetch(`https://api.telegram.org/bot${bot.token}/getMe`);
      const tgData = await tgRes.json();
      if (tgRes.ok && tgData.ok) {
        bot.name = tgData.result.first_name;
        bot.username = tgData.result.username;
        db.saveBot(bot);
        addLog('SUCCESS', `Successfully reloaded bot credentials for @${bot.username}!`);
      } else {
        throw new Error(tgData.description);
      }
    } else {
      addLog('INFO', `Forwarded custom action: ${action}`);
    }
    res.json({ success: true, logs });
  } catch (err: any) {
    res.json({ success: false, error: err.message, logs });
  }
});


// -------------------------------------------------------------
// VITE AND STATIC ASSETS SERVING SETUP
// -------------------------------------------------------------
async function startServer() {
  // Run startup diagnostics before listening
  await startupDiagnostics();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
