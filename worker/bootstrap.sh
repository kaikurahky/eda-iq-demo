#!/usr/bin/env bash
set -euo pipefail

install_dir=/opt/opc-worker
storage_account_name="${1:?storage account name is required}"

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv
python3 -m venv "$install_dir/.venv"
"$install_dir/.venv/bin/pip" install --no-cache-dir -r "$install_dir/requirements.txt"

cat >/etc/systemd/system/opc-worker.service <<EOF
[Unit]
Description=Synthetic OPC Azure queue worker
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$install_dir
Environment=AZURE_STORAGE_ACCOUNT_NAME=$storage_account_name
Environment=OPC_QUEUE_NAME=opc-jobs
Environment=OPC_RESULTS_CONTAINER=opc-results
ExecStart=$install_dir/.venv/bin/python $install_dir/azure_worker.py
Restart=always
RestartSec=5
User=opcworker
Group=opcworker
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

id opcworker >/dev/null 2>&1 || useradd --system --home "$install_dir" --shell /usr/sbin/nologin opcworker
chown -R opcworker:opcworker "$install_dir"
systemctl daemon-reload
systemctl enable --now opc-worker.service