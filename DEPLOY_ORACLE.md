# Oracle Free Tier Deployment Guide

Free forever. No credit card charges after the free tier.
This gives you a real VPS to run PolyBot 24/7 at zero cost.

---

## Step 1 — Create Oracle Cloud Account

1. Go to **cloud.oracle.com** → click "Start for free"
2. Sign up with your email
3. You'll need a credit card for verification — you **will not be charged** on the Always Free tier
4. Select your home region (pick somewhere geographically close to you)
5. Complete email verification

---

## Step 2 — Create a Free VM

1. Log into **cloud.oracle.com**
2. Top-left menu → **Compute** → **Instances** → **Create Instance**
3. Configure:
   - **Name**: `polybot`
   - **Image**: Ubuntu 22.04 (click "Change Image" if needed)
   - **Shape**: Click "Change Shape" → select **VM.Standard.A1.Flex** (ARM, Always Free)
     - Set OCPUs: **1**, Memory: **6 GB** (Free tier allows up to 4 OCPUs / 24 GB total)
   - **SSH Key**: Click "Generate a key pair" → **Download both keys** (save them safely)
4. Click **Create**
5. Wait ~2 minutes for the instance to become RUNNING
6. **Copy the Public IP address** (you'll need this for the dashboard)

---

## Step 3 — Open the Firewall Port

Oracle blocks all inbound ports by default. You must open port 3001 for the dashboard.

**In the Oracle Console:**
1. Click your instance → scroll down to **Primary VNIC** → click the subnet link
2. Click **Default Security List** → **Add Ingress Rules**
3. Add this rule:
   - Source Type: CIDR
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: TCP
   - Destination Port Range: `3001`
4. Click **Add Ingress Rules**

**On the VM itself (also required):**
```bash
# Ubuntu's firewall also needs the port opened
sudo iptables -I INPUT -p tcp --dport 3001 -j ACCEPT
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

---

## Step 4 — SSH Into Your Server

```bash
# On your computer (Mac/Linux):
chmod 400 ~/Downloads/ssh-key-*.key
ssh -i ~/Downloads/ssh-key-*.key ubuntu@YOUR_VM_PUBLIC_IP

# On Windows: use PuTTY or Windows Terminal with the .ppk key
```

---

## Step 5 — Install Node.js and PM2

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version   # should show v20.x.x
npm --version

# Install PM2 globally
sudo npm install -g pm2

# Install git and unzip
sudo apt install -y git unzip
```

---

## Step 6 — Deploy PolyBot

**Option A — Upload the zip (easiest):**
```bash
# From your computer, upload the zip:
scp -i ~/Downloads/ssh-key-*.key polybot-btc-hft.zip ubuntu@YOUR_VM_IP:~

# On the server:
unzip polybot-btc-hft.zip
cd polybot
npm install
```

**Option B — Git (if you push to GitHub):**
```bash
git clone https://github.com/YOUR_USERNAME/polybot-btc-hft.git polybot
cd polybot
npm install
```

---

## Step 7 — Configure the Bot

```bash
cd ~/polybot
cp .env.example .env
nano .env
```

Fill in:
```
PRIVATE_KEY=0xYOUR_WALLET_PRIVATE_KEY
CLOB_API_KEY=your_api_key
CLOB_API_SECRET=your_api_secret
CLOB_API_PASSPHRASE=your_passphrase
BANKROLL=200
DASHBOARD_TOKEN=pick_a_long_random_string_here_eg_polybot_abc123xyz
```

Save with `Ctrl+X`, then `Y`, then `Enter`.

---

## Step 8 — Test Run (dry run first!)

```bash
# Run directly to check for errors — uses dry run if keys aren't valid
node src/index.js
```

You should see:
```
═══════════════════════════════════════════════════════
  POLYBOT BTC HFT ENGINE
═══════════════════════════════════════════════════════
  Bankroll: $200
  ...
📡 Status server live on port 3001
⚡ HFT Engine starting...
Found X active BTC markets
```

Press `Ctrl+C` to stop. If it looks good, proceed.

---

## Step 9 — Run Permanently with PM2

```bash
# Start with PM2
pm2 start ecosystem.config.cjs

# Check it's running
pm2 status

# View live logs
pm2 logs polybot

# Save process list (survives reboots)
pm2 save

# Set PM2 to auto-start on server reboot
pm2 startup
# Copy and run the command it prints (starts with "sudo env PATH=...")
```

---

## Step 10 — Connect the Mobile Dashboard

1. Open `dashboard/index.html` in your phone browser
   - You can host it anywhere — email it to yourself, open from Files app, or put it on GitHub Pages
   - Or just open it directly in Chrome on your phone from the downloaded file
2. Enter:
   - **VPS IP**: Your Oracle VM public IP
   - **Port**: 3001
   - **Token**: The `DASHBOARD_TOKEN` you set in `.env`
3. Tap **CONNECT**

---

## Management Commands

```bash
# View live logs
pm2 logs polybot

# Restart bot
pm2 restart polybot

# Stop bot
pm2 stop polybot

# View stats
pm2 monit

# Check bot is running after reboot
pm2 status

# Update bot (after pulling new code)
pm2 stop polybot
npm install
pm2 start ecosystem.config.cjs
```

---

## Troubleshooting

**"Connection refused" on dashboard:**
- Check Oracle security list has port 3001 open
- Check iptables rule: `sudo iptables -L INPUT -n | grep 3001`
- Confirm bot is running: `pm2 status`

**"Unauthorized" on dashboard:**
- Check DASHBOARD_TOKEN in .env matches what you typed in the app

**Bot not finding markets:**
- Check internet connectivity: `curl https://gamma-api.polymarket.com/markets?limit=1`
- Oracle VMs have full internet access by default

**Bot crashes on startup:**
- Check logs: `pm2 logs polybot --lines 50`
- Most common cause: malformed .env (check for stray spaces around `=`)

---

## Security Notes

- Your `.env` contains your wallet private key — never share it or commit it to git
- Add `.env` to `.gitignore` if using git
- Consider using a dedicated trading wallet with only your trading bankroll
- The dashboard token protects the status server — use a long random string
- Oracle VM is accessible by SSH key only (no password) by default — keep your key safe
