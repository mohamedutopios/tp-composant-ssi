#!/bin/bash
# =============================================================================
# init-keycloak.sh — Initialisation des utilisateurs Keycloak
# À lancer UNE FOIS après docker compose up -d
# Usage : bash scripts/init-keycloak.sh
# =============================================================================

KC="http://localhost:8080"

echo "⏳ Attente de Keycloak..."
until curl -sf "$KC/realms/hopital/.well-known/openid-configuration" > /dev/null 2>&1; do
  sleep 3
done
echo "✅ Keycloak prêt"

# Token admin
TOKEN=$(curl -s -X POST "$KC/realms/master/protocol/openid-connect/token" \
  -d "client_id=admin-cli&grant_type=password&username=admin&password=admin" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")

if [ -z "$TOKEN" ]; then
  echo "❌ Impossible d'obtenir le token admin"
  exit 1
fi
echo "✅ Token admin obtenu"

# Fonction création utilisateur
create_user() {
  local USERNAME=$1 FIRSTNAME=$2 LASTNAME=$3 EMAIL=$4 PASSWORD=$5 ROLE=$6

  # Vérifier si l'utilisateur existe déjà
  EXISTS=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "$KC/admin/realms/hopital/users?username=$USERNAME" \
    | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null)

  if [ "$EXISTS" != "0" ]; then
    echo "  ⚠️  $USERNAME existe déjà — skip"
    return
  fi

  # Créer l'utilisateur
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$KC/admin/realms/hopital/users" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"username\": \"$USERNAME\",
      \"firstName\": \"$FIRSTNAME\",
      \"lastName\": \"$LASTNAME\",
      \"email\": \"$EMAIL\",
      \"enabled\": true,
      \"credentials\": [{\"type\": \"password\", \"value\": \"$PASSWORD\", \"temporary\": false}]
    }")

  if [ "$HTTP" = "201" ]; then
    echo "  ✅ $USERNAME créé"
  else
    echo "  ❌ $USERNAME échoué (HTTP $HTTP)"
    return
  fi

  # Récupérer l'ID de l'utilisateur
  USER_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "$KC/admin/realms/hopital/users?username=$USERNAME" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['id'] if d else '')")

  if [ -z "$USER_ID" ]; then
    echo "  ❌ Impossible de récupérer l'ID de $USERNAME"
    return
  fi

  # Récupérer l'ID du rôle
  ROLE_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "$KC/admin/realms/hopital/roles/$ROLE" \
    | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))")

  if [ -z "$ROLE_ID" ]; then
    echo "  ⚠️  Rôle $ROLE introuvable"
    return
  fi

  # Assigner le rôle
  curl -s -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    "$KC/admin/realms/hopital/users/$USER_ID/role-mappings/realm" \
    -d "[{\"id\": \"$ROLE_ID\", \"name\": \"$ROLE\"}]" > /dev/null

  echo "  ✅ Rôle '$ROLE' assigné à $USERNAME"
}

echo ""
echo "👥 Création des utilisateurs..."
create_user "jean.dupont"   "Jean"   "Dupont"  "jean.dupont@utopios.local"   "Jean2024!"   "medecin"
create_user "marie.manager" "Marie"  "Manager" "marie.manager@utopios.local" "Marie2024!"  "manager"
create_user "pierre.employe" "Pierre" "Employe" "pierre.employe@utopios.local" "Pierre2024!" "employe"
create_user "admin.hopital" "Admin"  "Hopital" "admin@utopios.local"         "Admin2024!"  "admin"

echo ""
echo "✅ Initialisation terminée !"
echo ""
echo "Accès aux applications :"
echo "  DPI : http://localhost:3001  →  jean.dupont / Jean2024!"
echo "  RDV : http://localhost:3002  →  pierre.employe / Pierre2024!"
echo "  RH  : http://localhost:3003  →  marie.manager / Marie2024!"
