# PDFHorse — deploy notes

## Bestanden

| Bestand | Doel |
|---|---|
| `nginx-pdfhorse.conf` | nginx-snippet voor `/PDFHorse/` (frontend) + `/PDFHorse/api/` (proxy → :3963) |
| `pdfhorse.service` | systemd-unit voor FastAPI backend op HC55 |
| `cleanup.cron` | (TBD v0.0.3) cron-regel voor `/tmp/pdfhorse/*` cleanup |

## HC55 install (TBD v0.0.3)

```bash
# 1. systeem-deps
sudo apt update && sudo apt install -y tesseract-ocr tesseract-ocr-nld tesseract-ocr-eng ghostscript unpaper qpdf

# 2. user + dirs
sudo useradd -r -s /bin/false -d /opt/pdfhorse pdfhorse
sudo mkdir -p /opt/pdfhorse /var/www/pdfhorse /tmp/pdfhorse
sudo chown -R pdfhorse:pdfhorse /opt/pdfhorse /tmp/pdfhorse

# 3. code + venv
sudo -u pdfhorse git clone https://github.com/cpaglebbeek/PDFHorse.git /opt/pdfhorse
cd /opt/pdfhorse
sudo -u pdfhorse python3 -m venv venv
sudo -u pdfhorse venv/bin/pip install -r backend/requirements.txt

# 4. frontend rsync (lokaal → HC55)
rsync -avz --delete /opt/pdfhorse/frontend/ /var/www/pdfhorse/frontend/

# 5. .env (mode 600)
sudo cp .env.example /opt/pdfhorse/.env
sudo nano /opt/pdfhorse/.env    # vul SMTP_PASS in
sudo chown pdfhorse:pdfhorse /opt/pdfhorse/.env
sudo chmod 600 /opt/pdfhorse/.env

# 6. systemd
sudo cp deploy/pdfhorse.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pdfhorse
sudo systemctl status pdfhorse

# 7. nginx
sudo cp deploy/nginx-pdfhorse.conf /etc/nginx/snippets/
# In hoofd-server-block: include snippets/nginx-pdfhorse.conf;
sudo nginx -t && sudo systemctl reload nginx

# 8. smoke-test
curl -fsS https://icthorse.nl/PDFHorse/api/health | jq
```

## Shared-infrastructure-checklist (P-TECH-04)

Bij elke nginx-wijziging:
1. `nginx -t` vóór reload
2. Verifieer dat ALLE bestaande location-blocks (`/HorseSafe/`, `/sms-inbox/`, `/dashboard/`, etc.) intact zijn
3. Bij twijfel: `Meta_Master/SHARED_INFRASTRUCTURE.md` raadplegen
