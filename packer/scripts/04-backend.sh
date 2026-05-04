#!/bin/bash
set -eux

# Create virtualenv
python3.12 -m venv /opt/cupcake/venv
chown -R cupcake:cupcake /opt/cupcake/venv

# Clone backend
cd /opt/cupcake/backend
if [ ! -d ".git" ]; then
    git clone --depth 1 --branch "${BACKEND_REF}" https://github.com/noatgnu/cupcake_vanilla.git /opt/cupcake/backend
else
    cd /opt/cupcake/backend && git fetch origin "${BACKEND_REF}" && git checkout "${BACKEND_REF}"
fi

# Install Python dependencies
/opt/cupcake/venv/bin/pip install --upgrade pip
/opt/cupcake/venv/bin/pip install -r /opt/cupcake/backend/requirements.txt
/opt/cupcake/venv/bin/pip install gunicorn uvicorn[standard] psycopg2-binary

# Create .env file
cat > /opt/cupcake/.env << 'EOF'
POSTGRES_DB=cupcake_vanilla_db
POSTGRES_USER=cupcake_vanilla
POSTGRES_PASSWORD=cupcake_vanilla_pass
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
DJANGO_SETTINGS_MODULE=cupcake_vanilla.settings
SECRET_KEY=change-me-in-production
DEBUG=False
ALLOWED_HOSTS=cupcake.local,vanilla.local,cupcake,vanilla,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://cupcake.local,http://vanilla.local,http://localhost
STATIC_ROOT=/opt/cupcake/static
MEDIA_ROOT=/opt/cupcake/media
EOF

chown cupcake:cupcake /opt/cupcake/.env

# Run Django setup
cd /opt/cupcake/backend
source /opt/cupcake/.env
/opt/cupcake/venv/bin/python manage.py migrate
/opt/cupcake/venv/bin/python manage.py collectstatic --noinput

chown -R cupcake:cupcake /opt/cupcake/backend
