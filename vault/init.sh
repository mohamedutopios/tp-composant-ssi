#!/bin/sh
# vault/init.sh — initialisation Vault pour Hôpital Utopios
export VAULT_ADDR=http://127.0.0.1:8200
export VAULT_TOKEN=myroot_token_12345

echo "⏳ Attente Vault..."
until vault status >/dev/null 2>&1; do sleep 2; done
echo "✅ Vault prêt"

vault secrets enable -path=hopital kv-v2 2>/dev/null || true

vault kv put hopital/dpi/db   host=postgres-dpi  db=dpi_hopital  user=dpi_user    password=dpi_pass_2024
vault kv put hopital/rdv/db   uri="mongodb://rdv_admin:rdv_pass_2024@mongo-rdv:27017/rdv_hopital?authSource=admin"
vault kv put hopital/rh/db    host=postgres-rh   db=rh_hopital   user=rh_user     password=rh_pass_2024
vault kv put hopital/keycloak url=http://keycloak:8080 realm=hopital \
  dpi_secret=dpi-secret-2024 rdv_secret=rdv-secret-2024 rh_secret=rh-secret-2024

vault audit enable file file_path=/vault/logs/audit.log 2>/dev/null || true

echo "✅ Secrets initialisés"
echo "✅ Audit log activé"
