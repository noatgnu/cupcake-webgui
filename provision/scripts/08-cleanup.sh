#!/bin/bash
set -eux

cat > /etc/systemd/system/cupcake-firstboot.service << 'UNITEOF'
[Unit]
Description=Cupcake First Boot Setup
After=local-fs.target
Before=cupcake-backend.service

[Service]
Type=oneshot
RemainAfterExit=yes
User=root
ExecStart=/opt/cupcake/first-boot.sh

[Install]
WantedBy=multi-user.target
UNITEOF

cat > /etc/systemd/system/cupcake-backend.service << 'UNITEOF'
[Unit]
Description=Cupcake Django Backend (Gunicorn)
After=network.target postgresql.service redis-server.service cupcake-firstboot.service
Requires=postgresql.service redis-server.service
Wants=cupcake-firstboot.service

[Service]
Type=simple
User=cupcake-svc
Group=cupcake-svc
WorkingDirectory=/opt/cupcake/backend
EnvironmentFile=/opt/cupcake/.env
ExecStart=/opt/cupcake/venv/bin/gunicorn cupcake_vanilla.asgi:application \
    --bind 127.0.0.1:8000 \
    --workers 4 \
    --timeout 300 \
    -k uvicorn.workers.UvicornWorker \
    --log-level info \
    --access-logfile /var/log/cupcake/gunicorn-access.log \
    --error-logfile /var/log/cupcake/gunicorn-error.log
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNITEOF

cat > /etc/systemd/system/cupcake-rqworker.service << 'UNITEOF'
[Unit]
Description=Cupcake RQ Worker (default high low)
After=cupcake-backend.service
Requires=cupcake-backend.service

[Service]
Type=simple
User=cupcake-svc
Group=cupcake-svc
WorkingDirectory=/opt/cupcake/backend
EnvironmentFile=/opt/cupcake/.env
ExecStartPre=/opt/cupcake/venv/bin/python manage.py cleanup_dead_workers
ExecStart=/opt/cupcake/venv/bin/python manage.py rqworker default high low
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNITEOF

cat > /etc/systemd/system/cupcake-transcribe-worker.service << 'UNITEOF'
[Unit]
Description=Cupcake Transcribe Worker
After=cupcake-backend.service
Requires=cupcake-backend.service

[Service]
Type=simple
User=cupcake-svc
Group=cupcake-svc
WorkingDirectory=/opt/cupcake/backend
EnvironmentFile=/opt/cupcake/.env
ExecStartPre=/opt/cupcake/venv/bin/python manage.py cleanup_dead_workers
ExecStart=/opt/cupcake/venv/bin/python manage.py rqworker transcribe
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNITEOF

systemctl daemon-reload
systemctl enable cupcake-firstboot.service
systemctl enable cupcake-backend.service
systemctl enable cupcake-rqworker.service
systemctl enable cupcake-transcribe-worker.service

cp "$(dirname "$0")/update.sh" /opt/cupcake/update.sh
chmod +x /opt/cupcake/update.sh
chown root:root /opt/cupcake/update.sh

apt-get clean
apt-get autoremove -y
rm -rf /var/lib/apt/lists/*
rm -rf /tmp/*
