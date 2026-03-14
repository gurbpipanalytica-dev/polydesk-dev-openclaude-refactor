#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════╗
# ║  POLYDESK — Deploy Script                                           ║
# ║  Run on your VPS: bash deploy.sh                                   ║
# ╚══════════════════════════════════════════════════════════════════════╝

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "${GREEN}"
echo "  ██████╗  ██████╗ ██╗  ██╗   ██╗██████╗ ███████╗███████╗██╗  ██╗"
echo "  ██╔══██╗██╔═══██╗██║  ╚██╗ ██╔╝██╔══██╗██╔════╝██╔════╝██║ ██╔╝"
echo "  ██████╔╝██║   ██║██║   ╚████╔╝ ██║  ██║█████╗  ███████╗█████╔╝ "
echo "  ██╔═══╝ ██║   ██║██║    ╚██╔╝  ██║  ██║██╔══╝  ╚════██║██╔═██╗ "
echo "  ██║     ╚██████╔╝███████╗██║   ██████╔╝███████╗███████║██║  ██╗"
echo "  ╚═╝      ╚═════╝ ╚══════╝╚═╝   ╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═╝"
echo -e "${NC}"
echo "  Deploy script — Polydesk v9"
echo ""

DEPLOY_DIR="/home/ubuntu/polydesk"

# ── STEP 1: Create folder structure ──────────────────────────────────────────
echo -e "${YELLOW}[1/6] Creating folder structure...${NC}"
mkdir -p $DEPLOY_DIR/{bond_bot,rebates_bot,btc5m_bot,copier_bot,orchestrator,nginx,state,commands,logs}

# ── STEP 2: Copy all files ────────────────────────────────────────────────────
echo -e "${YELLOW}[2/6] Copying files...${NC}"

# Shared modules — go into every bot folder
for folder in bond_bot rebates_bot btc5m_bot copier_bot orchestrator; do
  cp polydesk_state_bridge.py $DEPLOY_DIR/$folder/
  cp polydesk_db.py           $DEPLOY_DIR/$folder/
done

# Bot files
cp polydesk_bond_bot.py          $DEPLOY_DIR/bond_bot/polydesk_bond_bot.py
cp polydesk_maker_rebates_bot.py $DEPLOY_DIR/rebates_bot/polydesk_maker_rebates_bot.py
cp polydesk_btc5m_bot.py         $DEPLOY_DIR/btc5m_bot/polydesk_btc5m_bot.py
cp polydesk_copier_bot.py        $DEPLOY_DIR/copier_bot/polydesk_copier_bot.py
cp orchestrator.py               $DEPLOY_DIR/orchestrator/orchestrator.py

# Docker files
cp docker-compose.yml            $DEPLOY_DIR/docker-compose.yml
cp nginx/nginx.conf              $DEPLOY_DIR/nginx/nginx.conf

# Dockerfiles + requirements
for folder in bond_bot rebates_bot btc5m_bot copier_bot orchestrator; do
  cp $folder/Dockerfile         $DEPLOY_DIR/$folder/Dockerfile
  cp $folder/requirements.txt   $DEPLOY_DIR/$folder/requirements.txt
done

echo -e "${GREEN}  ✓ Files copied${NC}"

# ── STEP 3: Create .env ───────────────────────────────────────────────────────
echo -e "${YELLOW}[3/6] Setting up .env...${NC}"

if [ ! -f "$DEPLOY_DIR/.env" ]; then
  cp .env.template $DEPLOY_DIR/.env
  echo ""
  echo -e "${RED}  ⚠  .env created from template. Fill in your keys:${NC}"
  echo -e "${YELLOW}  nano $DEPLOY_DIR/.env${NC}"
  echo ""
  echo "  Keys you NEED before going live:"
  echo "  - POLYMARKET_PRIVATE_KEY"
  echo "  - POLYMARKET_API_KEY / SECRET / PASSPHRASE"
  echo "  - GEMINI_API_KEY (free at aistudio.google.com)"
  echo "  - ANTHROPIC_API_KEY (for dashboard chat)"
  echo ""
  echo "  Keys already filled:"
  echo "  ✓ SUPABASE_URL"
  echo "  ✓ SUPABASE_SERVICE_KEY"
  echo "  ✓ SUPABASE_ANON_KEY"
  echo ""
  read -p "  Press Enter after filling .env to continue..."
else
  echo -e "${GREEN}  ✓ .env already exists — skipping${NC}"
fi

chmod 600 $DEPLOY_DIR/.env

# ── STEP 4: Install Docker if needed ─────────────────────────────────────────
echo -e "${YELLOW}[4/6] Checking Docker...${NC}"
if ! command -v docker &> /dev/null; then
  echo "  Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker ubuntu
  echo -e "${GREEN}  ✓ Docker installed${NC}"
else
  echo -e "${GREEN}  ✓ Docker already installed: $(docker --version)${NC}"
fi

# ── STEP 5: Build and start ───────────────────────────────────────────────────
echo -e "${YELLOW}[5/6] Building containers...${NC}"
cd $DEPLOY_DIR
docker compose down 2>/dev/null || true
docker compose build --no-cache
echo -e "${GREEN}  ✓ Build complete${NC}"

echo -e "${YELLOW}[6/6] Starting containers...${NC}"
docker compose up -d
sleep 4

# ── STEP 6: Health check ──────────────────────────────────────────────────────
echo ""
echo "  Container status:"
docker compose ps

echo ""
echo "  API health check:"
sleep 2
curl -s http://localhost/health 2>/dev/null && echo "" || echo -e "${YELLOW}  (API warming up — try again in 10s)${NC}"

VPS_IP=$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_VPS_IP")

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  POLYDESK IS RUNNING                                 ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  API:       http://$VPS_IP/api/status                ║${NC}"
echo -e "${GREEN}║  Health:    http://$VPS_IP/health                    ║${NC}"
echo -e "${GREEN}║  Logs:      docker compose logs -f bond_bot          ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Update dashboard:                                   ║${NC}"
echo -e "${GREEN}║  ORCHESTRATOR_URL = \"http://$VPS_IP/api\"             ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Useful commands:"
echo "  docker compose logs -f bond_bot       # watch bond bot"
echo "  docker compose logs -f orchestrator   # watch AI brain"
echo "  docker compose ps                     # all container status"
echo "  docker compose restart bond_bot       # restart one bot"
