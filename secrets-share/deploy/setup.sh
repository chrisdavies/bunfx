#!/bin/bash
#
# One-time setup for secrets-share on a new VPS.
# Run this script on the server, not locally.
#
set -e

echo "Setting up secrets-share..."

# Create directories
mkdir -p ~/repos/bunfx.git
mkdir -p ~/apps/bunfx/secrets-share

# Initialize bare git repo
cd ~/repos/bunfx.git
git init --bare

echo "Created git repo at ~/repos/bunfx.git"

# Install systemd service
SERVICE_FILE="/etc/systemd/system/secrets-share.service"
TEMPLATE="$HOME/apps/bunfx/secrets-share/deploy/secrets-share.service"

if [ -f "$TEMPLATE" ]; then
    sed "s|%USER%|$USER|g; s|%HOME%|$HOME|g" "$TEMPLATE" | sudo tee "$SERVICE_FILE" >/dev/null
    sudo systemctl daemon-reload
    sudo systemctl enable secrets-share
    echo "Installed systemd service"
else
    echo "Note: Deploy files first, then run:"
    echo "  sed \"s|%USER%|\$USER|g; s|%HOME%|\$HOME|g\" ~/apps/bunfx/secrets-share/deploy/secrets-share.service | sudo tee $SERVICE_FILE"
    echo "  sudo systemctl daemon-reload && sudo systemctl enable secrets-share"
fi

# Reminder for .env
echo ""
echo "Next steps:"
echo "  1. Add git remote locally: git remote add prod user@host:repos/bunfx.git"
echo "  2. Push code: git push prod main"
echo "  3. SSH in and copy the post-receive hook:"
echo "     cp ~/apps/bunfx/secrets-share/deploy/post-receive ~/repos/bunfx.git/hooks/"
echo "     chmod +x ~/repos/bunfx.git/hooks/post-receive"
echo "  4. Create .env file at ~/apps/bunfx/secrets-share/.env"
echo "  5. Push again to trigger full deploy"
