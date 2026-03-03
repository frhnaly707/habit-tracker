#!/bin/bash

# Habit Tracker Telegram Bot - Setup Script
# Run this script on your DigitalOcean droplet

set -e

echo "🚀 Setting up Habit Tracker Telegram Bot..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js
echo -e "${YELLOW}Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
fi

node --version
npm --version

# Check if project directory exists
if [ -d "habit-tracker" ]; then
    echo -e "${YELLOW}Project directory exists. Updating...${NC}"
    cd habit-tracker
else
    echo "Creating project directory..."
    mkdir -p habit-tracker
    cd habit-tracker
fi

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install

# Check .env file
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ .env file created. Please edit it and add your TELEGRAM_BOT_TOKEN${NC}"
    echo "Run: nano .env"
    echo "Then add: TELEGRAM_BOT_TOKEN=your-token-here"
    exit 0
fi

# Ask about PM2 setup
echo ""
echo -e "${YELLOW}Setup PM2 for auto-start? (y/n)${NC}"
read -r response

if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
    # Install PM2
    echo "Installing PM2..."
    npm install -g pm2

    # Start bot with PM2
    echo "Starting bot with PM2..."
    pm2 start bot.js --name habit-bot
    pm2 save

    # Setup PM2 startup
    echo "Setting up PM2 startup..."
    pm2 startup | tail -n 1 > /tmp/pm2_startup.sh
    bash /tmp/pm2_startup.sh
    rm /tmp/pm2_startup.sh

    echo -e "${GREEN}✅ PM2 setup complete!${NC}"
    echo "Bot is now running and will auto-start on reboot."
    echo ""
    echo "Monitor bot: pm2 logs habit-bot"
    echo "Check status: pm2 status"
else
    echo "Skipping PM2 setup."
    echo "To run manually: npm start"
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "📱 Test your bot on Telegram!"
echo "Send /start to your bot."
