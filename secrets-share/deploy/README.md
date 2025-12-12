# Production Deployment

Deploy secrets-share to a VPS with Caddy.

## Prerequisites

- VPS with SSH access: `user@0.0.0.0`
- Caddy installed and running
- Domain `secrets.example.com` pointing to VPS

## 1. Install Bun on VPS

```bash
ssh user@0.0.0.0
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
```

## 2. Initial setup

Create the bare git repo manually, or use `setup.sh` after the first deploy:

```bash
ssh user@0.0.0.0

# Create directories
mkdir -p ~/repos/bunfx.git
mkdir -p ~/apps/bunfx/secrets-share
cd ~/repos/bunfx.git
git init --bare
```

## 3. Add git remote locally

```bash
git remote add prod user@0.0.0.0:repos/bunfx.git
git push prod main
```

## 4. Install deploy files on server

After the first push, the deploy files are available:

```bash
ssh user@0.0.0.0

# Install post-receive hook
cp ~/apps/bunfx/secrets-share/deploy/post-receive ~/repos/bunfx.git/hooks/
chmod +x ~/repos/bunfx.git/hooks/post-receive

# Install systemd service (substitutes %USER% and %HOME%)
sed "s|%USER%|$USER|g; s|%HOME%|$HOME|g" \
    ~/apps/bunfx/secrets-share/deploy/secrets-share.service \
    | sudo tee /etc/systemd/system/secrets-share.service

sudo systemctl daemon-reload
sudo systemctl enable secrets-share
```

## 5. Configure environment

```bash
ssh user@0.0.0.0
cat > ~/apps/bunfx/secrets-share/.env << 'EOF'
DATABASE_URL=sqlite://./data.db
APP_SECRET=<run: openssl rand -base64 32>
APP_URL=https://secrets.example.com

MAILER_PROVIDER=mailgun
MAILGUN_API_KEY=key-xxxxxxxx
MAILGUN_DOMAIN=mg.example.com
EOF
```

## 6. Configure Caddy

Add to `/etc/caddy/Caddyfile`:

```
secrets.example.com {
    reverse_proxy localhost:3000
}
```

```bash
sudo systemctl reload caddy
```

## 7. Deploy

```bash
git push prod main
```

The post-receive hook handles: checkout, `bun install`, migrations, and service restart.

## Files

- `secrets-share.service` — systemd unit template
- `post-receive` — git hook for deployments
- `setup.sh` — optional one-time setup script

## Useful commands

```bash
# View logs
journalctl -u secrets-share -f

# Restart service
sudo systemctl restart secrets-share

# Check status
sudo systemctl status secrets-share
```
