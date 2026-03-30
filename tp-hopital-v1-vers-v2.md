# TP — Migration HôpitalSim V1 → V2 : Mise en place d'une couche SSI

**Durée estimée :** 3h  
**Niveau :** Master 2 — Cybersécurité  
**Prérequis :** HôpitalSim V1 fonctionnel, Docker Compose maîtrisé, Kali ayant confirmé les 6 failles

---

## Contexte pédagogique

Dans le TP précédent, vous avez exploité 6 failles sur le SI hospitalier V1 :
- **A1** Brute-force Keycloak — aucun rate-limiting
- **A2** Injection SQL DPI — paramètre `?search=` non sécurisé
- **A3** IDOR RH — fiches de paie et IBAN accessibles sans contrôle
- **A4** Énumération LDAP — annuaire accessible en clair
- **A5** Vol de JWT — token réutilisable 1h, pas de révocation
- **A6** Dump Vault — token root exposé dans `docker-compose.yml`

**Toutes les attaques ont réussi. Aucune alerte n'a été générée.**

L'objectif de ce TP est de construire la **V2** : vous conservez le SI métier identique (même code, mêmes failles intentionnelles) et vous ajoutez une **couche SSI** capable de détecter ces mêmes attaques en temps réel.

> **Règle du TP :** vous ne corrigez aucune faille applicative. Vous instrumetez le SI pour le surveiller.

---

## Architecture cible V2

```
┌─────────────────────────────────────────────────────────┐
│  COUCHE UTILISATEURS                                    │
│  jean.dupont · marie.manager · pierre.employe           │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP (navigateur)
┌────────────────────────▼────────────────────────────────┐
│  COUCHE IAM (identique V1)                              │
│  Keycloak :8080  ·  Vault :8200  ·  PostgreSQL KC       │
└────────────────────────┬────────────────────────────────┘
                         │ JWT RS256
┌────────────────────────▼────────────────────────────────┐
│  COUCHE APPLICATIONS (identique V1)                     │
│  DPI :3001  ·  RDV :3002  ·  RH :3003                  │
│  (même code, mêmes failles)                             │
└──────────┬──────────────────────────┬───────────────────┘
           │ logs (HEC + syslog)      │ audit
┌──────────▼──────────────────────────▼───────────────────┐
│  COUCHE SSI — soc_net 172.22.0.0/24  ← NOUVEAU         │
│                                                         │
│  Splunk SIEM :8000/:8088                                │
│  Wazuh Manager :1514/:55000                             │
│  Wazuh Indexer :9200 (OpenSearch)                       │
│  Wazuh Dashboard :5601                                  │
└─────────────────────────────────────────────────────────┘
```

---

## Partie 1 — Comprendre les composants SSI

Avant de modifier quoi que ce soit, répondez aux questions suivantes. Les réponses guideront vos choix d'implémentation.

### 1.1 Splunk — SIEM (Security Information and Event Management)

**Rôle :** Splunk est le **centre de collecte et de corrélation** des logs. Il reçoit les événements de tous les composants du SI, les indexe, et permet de les interroger avec le langage SPL (Search Processing Language).

**Ce qu'il fait concrètement dans V2 :**
- Reçoit les logs applicatifs (DPI, RDV, RH) via **HEC** (HTTP Event Collector) sur le port `:8088`
- Reçoit les alertes Wazuh via un forwarder
- Reçoit l'audit log de Vault
- Permet de corréler des événements de sources différentes (ex: login Keycloak suspect + accès Vault depuis la même IP)
- Affiche des dashboards SOC sur `:8000`

**Où le mettre dans le `docker-compose.yml` :**
- Dans le réseau `soc_net` uniquement
- Les backends doivent aussi rejoindre `soc_net` pour pouvoir envoyer leurs logs

**Question 1.1 :** Pourquoi Splunk ne doit-il PAS être dans `app_net` ou `iam_net` directement, mais dans un `soc_net` dédié ?

---

### 1.2 Wazuh Manager — EDR (Endpoint Detection and Response)

**Rôle :** Wazuh Manager est le **moteur de détection en temps réel**. Il reçoit les événements des agents/sources, les analyse contre un ensemble de règles, et déclenche des alertes ou des **active responses** (actions automatiques).

**Ce qu'il fait concrètement dans V2 :**
- Reçoit les logs des backends sur le port `:1514` (UDP/TCP)
- Applique les règles custom `hopital.xml` (règles 100001–100100)
- Génère des alertes JSON pour chaque règle qui matche
- Déclenche automatiquement `firewall-drop` contre les IP attaquantes
- Expose une API REST sur `:55000` pour le Dashboard

**Où le mettre :**
- Dans `soc_net` (pour communiquer avec l'Indexer)
- **Aussi** dans `app_net` et `iam_net` (pour recevoir les logs des backends)

**Question 1.2 :** Wazuh Manager est le seul service SSI à appartenir à plusieurs réseaux. Expliquez pourquoi c'est nécessaire.

---

### 1.3 Wazuh Indexer — Stockage des alertes

**Rôle :** Wazuh Indexer est une instance **OpenSearch** (fork d'Elasticsearch). Il stocke de manière persistante toutes les alertes générées par le Manager, et permet au Dashboard de les rechercher et visualiser.

**Ce qu'il fait concrètement dans V2 :**
- Reçoit les alertes JSON du Manager via HTTP REST sur `:9200`
- Indexe les alertes dans des index horodatés (`wazuh-alerts-YYYY.MM.DD`)
- Répond aux requêtes du Dashboard (agrégations, recherche full-text)

**Prérequis système :**
```bash
# OBLIGATOIRE avant docker compose up — sinon l'Indexer crashe
sudo sysctl -w vm.max_map_count=262144
```

**Où le mettre :**
- Dans `soc_net` uniquement — il ne parle qu'au Manager et au Dashboard

**Question 1.3 :** Quel est l'impact de ne pas définir `vm.max_map_count=262144` ? Que se passe-t-il pour le conteneur ?

---

### 1.4 Wazuh Dashboard — Visualisation

**Rôle :** Interface web OpenSearch Dashboards, préconfiguré pour afficher les alertes Wazuh. C'est l'interface de l'**analyste SOC** pour consulter les Security Events.

**Ce qu'il fait concrètement dans V2 :**
- Interroge l'Indexer `:9200` pour afficher les alertes
- Fournit des vues préconçues : Security Events, Agents, Rules
- Permet de filtrer par règle, niveau, IP source, période

**Accès :** `http://localhost:5601` — `admin / admin`

**Où le mettre :**
- Dans `soc_net` uniquement — dépend de l'Indexer et du Manager

**Question 1.4 :** Quelle est la différence entre le **Wazuh Dashboard** et **Splunk** du point de vue de l'analyste SOC ? Dans quel cas utiliseriez-vous l'un plutôt que l'autre ?

---

## Partie 2 — Mise en place du réseau SSI

### Étape 2.1 — Créer le répertoire de travail

```bash
# Depuis le répertoire parent contenant hopital-v1-clean/
mkdir hopital-v2
cd hopital-v2
cp -r ../hopital-v1-clean/. .
mkdir -p soc/splunk soc/wazuh/rules scripts
```

### Étape 2.2 — Ajouter le réseau `soc_net`

Ouvrez `docker-compose.yml` et ajoutez le réseau `soc_net` dans la section `networks` :

```yaml
networks:
  iam_net:  { driver: bridge, ipam: { config: [{ subnet: 172.20.0.0/24 }] } }
  app_net:  { driver: bridge, ipam: { config: [{ subnet: 172.21.0.0/24 }] } }
  soc_net:  { driver: bridge, ipam: { config: [{ subnet: 172.22.0.0/24 }] } }  # ← NOUVEAU
  kali_net: { driver: bridge, ipam: { config: [{ subnet: 172.25.0.0/24 }] } }
```

**Question 2.2 :** Pourquoi utiliser un sous-réseau `/24` dédié `172.22.0.0` plutôt que de simplement ajouter les services SSI dans `app_net` ?

### Étape 2.3 — Raccorder les backends à `soc_net`

Pour que les backends puissent envoyer leurs logs à Splunk et Wazuh, ils doivent appartenir à `soc_net`. Modifiez chaque backend :

```yaml
# Avant (V1)
dpi-backend:
  networks: [app_net]

# Après (V2) — ajout de soc_net
dpi-backend:
  networks: [app_net, soc_net]
```

Faites de même pour `rdv-backend`, `rh-backend`, `keycloak`, et `vault`.

**Question 2.3 :** Si les backends ne sont PAS dans `soc_net`, que se passe-t-il quand ils tentent d'envoyer un log à `hopital-splunk:8088` ?

---

## Partie 3 — Ajout de Splunk

### Étape 3.1 — Créer les fichiers de configuration Splunk

Créez `soc/splunk/indexes.conf` :

```ini
[hopital-dpi]
homePath   = $SPLUNK_DB/hopital-dpi/db
coldPath   = $SPLUNK_DB/hopital-dpi/colddb
thawedPath = $SPLUNK_DB/hopital-dpi/thaweddb
maxTotalDataSizeMB = 512

[hopital-rh]
homePath   = $SPLUNK_DB/hopital-rh/db
coldPath   = $SPLUNK_DB/hopital-rh/colddb
thawedPath = $SPLUNK_DB/hopital-rh/thaweddb
maxTotalDataSizeMB = 512

[hopital-rdv]
homePath   = $SPLUNK_DB/hopital-rdv/db
coldPath   = $SPLUNK_DB/hopital-rdv/colddb
thawedPath = $SPLUNK_DB/hopital-rdv/thaweddb
maxTotalDataSizeMB = 512

[hopital-keycloak]
homePath   = $SPLUNK_DB/hopital-keycloak/db
coldPath   = $SPLUNK_DB/hopital-keycloak/colddb
thawedPath = $SPLUNK_DB/hopital-keycloak/thaweddb
maxTotalDataSizeMB = 256

[hopital-vault]
homePath   = $SPLUNK_DB/hopital-vault/db
coldPath   = $SPLUNK_DB/hopital-vault/colddb
thawedPath = $SPLUNK_DB/hopital-vault/thaweddb
maxTotalDataSizeMB = 256

[wazuh-alerts]
homePath   = $SPLUNK_DB/wazuh-alerts/db
coldPath   = $SPLUNK_DB/wazuh-alerts/colddb
thawedPath = $SPLUNK_DB/wazuh-alerts/thaweddb
maxTotalDataSizeMB = 1024
```

Créez `soc/splunk/inputs.conf` :

```ini
[http]
disabled = 0
port     = 8088

[http://hopital-hec]
token    = hopital-hec-2024
indexes  = hopital-dpi,hopital-rh,hopital-rdv,hopital-keycloak,hopital-vault
```

> **Important :** Ces fichiers sont montés dans `/opt/splunk/etc/apps/hopital/local/` (pas dans `system/local/` — ce chemin est réservé à Splunk et provoquerait une erreur `Device or resource busy`).

### Étape 3.2 — Ajouter Splunk dans `docker-compose.yml`

```yaml
volumes:
  splunk_var:
  splunk_etc:

services:
  splunk:
    image: splunk/splunk:9.3.2
    platform: linux/amd64        # ← obligatoire sur Apple Silicon
    container_name: hopital-splunk
    restart: unless-stopped
    environment:
      SPLUNK_START_ARGS: "--accept-license"
      SPLUNK_PASSWORD:   "Admin1234!"
      SPLUNK_HEC_TOKEN:  "hopital-hec-2024"
    ports:
      - "8000:8000"   # UI web
      - "8088:8088"   # HEC — réception des logs applicatifs
      - "8089:8089"   # REST API
    volumes:
      - splunk_var:/opt/splunk/var
      - splunk_etc:/opt/splunk/etc
      # Montage dans une app custom — évite le conflit avec system/local
      - ./soc/splunk/indexes.conf:/opt/splunk/etc/apps/hopital/local/indexes.conf
      - ./soc/splunk/inputs.conf:/opt/splunk/etc/apps/hopital/local/inputs.conf
    networks: [soc_net]
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:8000 > /dev/null 2>&1"]
      interval: 30s
      timeout: 10s
      retries: 20
      start_period: 120s
```

**Question 3.2 :** Pourquoi monter `indexes.conf` et `inputs.conf` dans `apps/hopital/local/` plutôt que dans `system/local/` ? Que se passe-t-il dans le cas contraire ?

### Étape 3.3 — Instrumenter les backends pour envoyer des logs

Chaque backend Node.js doit envoyer ses événements à Splunk HEC. Voici la fonction à ajouter dans `src/index.js` de chaque backend :

```javascript
// Fonction d'envoi HEC — à ajouter dans chaque backend
async function logToSplunk(event) {
  const payload = {
    event: {
      timestamp: new Date().toISOString(),
      service:   'dpi-backend',   // adapter par service
      ...event
    },
    index: 'hopital-dpi'          // adapter par service
  };
  try {
    await fetch('http://hopital-splunk:8088/services/collector/event', {
      method:  'POST',
      headers: { 'Authorization': 'Splunk hopital-hec-2024', 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });
  } catch (e) {
    // Ne pas bloquer l'API si Splunk est indisponible
    console.error('HEC error:', e.message);
  }
}

// Exemple d'utilisation dans une route
app.get('/api/patients', checkJwt, async (req, res) => {
  const { search } = req.query;
  const result = await db.query(`SELECT * FROM patients WHERE nom LIKE '%${search}%'`);
  
  // Log vers Splunk
  await logToSplunk({
    action:  'GET_PATIENTS',
    user:    req.auth?.sub,
    src_ip:  req.ip,
    query:   search,
    rows:    result.rows.length,
    status:  200
  });
  
  res.json(result.rows);
});
```

---

## Partie 4 — Ajout de Wazuh

### Étape 4.1 — Créer la configuration Wazuh

Créez `soc/wazuh/ossec.conf` :

```xml
<ossec_config>
  <global>
    <jsonout_output>yes</jsonout_output>
    <alerts_log>yes</alerts_log>
    <logall>no</logall>
    <logall_json>no</logall_json>
    <email_notification>no</email_notification>
    <host_information>yes</host_information>
    <integrity_checking>yes</integrity_checking>
    <rootkit_detection>yes</rootkit_detection>
    <active-response>yes</active-response>
  </global>

  <!-- Réception des logs depuis les conteneurs -->
  <remote>
    <connection>syslog</connection>
    <port>1514</port>
    <protocol>udp</protocol>
  </remote>

  <!-- Indexer OpenSearch -->
  <indexer>
    <enabled>yes</enabled>
    <hosts>
      <host>http://wazuh-indexer:9200</host>
    </hosts>
    <ssl>
      <certificate_authorities></certificate_authorities>
      <certificate></certificate>
      <key></key>
    </ssl>
  </indexer>

  <!-- Active response — blocage automatique -->
  <active-response>
    <command>firewall-drop</command>
    <location>local</location>
    <rules_id>100002,100011</rules_id>  <!-- Brute-force + SQLi répétée -->
    <timeout>600</timeout>              <!-- 10 minutes -->
  </active-response>

  <active-response>
    <command>firewall-drop</command>
    <location>local</location>
    <rules_id>100011</rules_id>
    <timeout>3600</timeout>             <!-- 1 heure pour SQLi grave -->
  </active-response>
</ossec_config>
```

### Étape 4.2 — Créer les règles de détection custom

Créez `soc/wazuh/rules/hopital.xml` :

```xml
<group name="hopital,">

  <!-- A1 — Brute-force Keycloak -->
  <rule id="100001" level="5">
    <if_sid>0</if_sid>
    <field name="service">keycloak</field>
    <field name="event">LOGIN_ERROR</field>
    <description>Échec de connexion Keycloak</description>
    <group>authentication_failed,</group>
  </rule>

  <rule id="100002" level="12" frequency="5" timeframe="60">
    <if_matched_sid>100001</if_matched_sid>
    <same_field>src_ip</same_field>
    <description>Brute-force Keycloak — 5 échecs en 60s depuis $(src_ip)</description>
    <group>authentication_failures,brute_force,</group>
    <!-- → firewall-drop 10 min via active-response -->
  </rule>

  <!-- A2 — SQL Injection DPI -->
  <rule id="100010" level="10">
    <if_sid>0</if_sid>
    <field name="service">dpi-backend</field>
    <field name="query">['"]|OR|AND|UNION|SELECT|DROP|INSERT</field>
    <description>Tentative d'injection SQL sur DPI ($(query))</description>
    <group>sql_injection,web_attack,</group>
  </rule>

  <rule id="100011" level="13" frequency="3" timeframe="300">
    <if_matched_sid>100010</if_matched_sid>
    <same_field>src_ip</same_field>
    <description>SQL injection répétée — $(src_ip) a tenté 3+ injections en 5 min</description>
    <group>sql_injection,attack,</group>
    <!-- → firewall-drop 1h via active-response -->
  </rule>

  <!-- A3 — IDOR Fiches de paie -->
  <rule id="100021" level="11" frequency="4" timeframe="30">
    <if_sid>0</if_sid>
    <field name="service">rh-backend</field>
    <field name="action">GET_PAIE</field>
    <same_field>src_ip</same_field>
    <description>IDOR possible — $(src_ip) a accédé à 4+ fiches de paie en 30s</description>
    <group>idor,data_exfiltration,</group>
  </rule>

  <!-- A4 — Énumération LDAP -->
  <rule id="100031" level="9">
    <if_sid>0</if_sid>
    <field name="program">ldapsearch</field>
    <description>Scan LDAP détecté depuis $(src_ip)</description>
    <group>ldap_enum,recon,</group>
  </rule>

  <!-- A5 — Vol de JWT (IP différente) -->
  <rule id="100040" level="10">
    <if_sid>0</if_sid>
    <field name="action">JWT_IP_MISMATCH</field>
    <description>JWT utilisé depuis une IP différente de l'IP de login — possible vol de token</description>
    <group>session_hijacking,</group>
  </rule>

  <!-- A6 — Dump Vault -->
  <rule id="100050" level="8">
    <if_sid>0</if_sid>
    <field name="service">vault</field>
    <field name="event_type">secret_read</field>
    <description>Lecture de secret Vault par $(auth_token)</description>
    <group>vault_access,</group>
  </rule>

  <rule id="100051" level="13" frequency="4" timeframe="5">
    <if_matched_sid>100050</if_matched_sid>
    <same_field>auth_token</same_field>
    <description>Dump Vault massif — 4+ secrets lus en 5s (token: $(auth_token))</description>
    <group>vault_dump,critical,data_exfiltration,</group>
  </rule>

</group>
```

### Étape 4.3 — Ajouter Wazuh dans `docker-compose.yml`

```yaml
volumes:
  wazuh_idx:
  wazuh_mgr_etc:
  wazuh_mgr_var:

services:

  wazuh-indexer:
    image: wazuh/wazuh-indexer:4.8.0
    platform: linux/amd64
    container_name: hopital-wazuh-indexer
    restart: unless-stopped
    environment:
      OPENSEARCH_JAVA_OPTS:      "-Xms512m -Xmx512m"
      discovery.type:            single-node
      plugins.security.disabled: "true"
    ulimits:
      memlock: { soft: -1, hard: -1 }
      nofile:  { soft: 65536, hard: 65536 }
    ports: ["9200:9200"]
    volumes:
      - wazuh_idx:/var/lib/wazuh-indexer
    networks: [soc_net]
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:9200/_cluster/health | grep -q status"]
      interval: 20s
      timeout: 10s
      retries: 15
      start_period: 60s

  wazuh-manager:
    image: wazuh/wazuh-manager:4.8.0
    platform: linux/amd64
    container_name: hopital-wazuh-manager
    restart: unless-stopped
    environment:
      INDEXER_URL:                    "http://wazuh-indexer:9200"
      INDEXER_USERNAME:               "admin"
      INDEXER_PASSWORD:               "admin"
      FILEBEAT_SSL_VERIFICATION_MODE: "none"
    ports:
      - "1514:1514/udp"
      - "1514:1514/tcp"
      - "1515:1515"
      - "55000:55000"
    volumes:
      - wazuh_mgr_etc:/var/ossec/etc
      - wazuh_mgr_var:/var/ossec/var
      - ./soc/wazuh/ossec.conf:/var/ossec/etc/ossec.conf
      - ./soc/wazuh/rules/hopital.xml:/var/ossec/etc/rules/hopital.xml
    depends_on:
      wazuh-indexer: { condition: service_healthy }
    # Wazuh Manager doit voir les backends (soc_net) ET l'IAM (iam_net)
    networks: [soc_net, app_net, iam_net]
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:55000/ > /dev/null 2>&1"]
      interval: 20s
      timeout: 10s
      retries: 10
      start_period: 60s

  wazuh-dashboard:
    image: wazuh/wazuh-dashboard:4.8.0
    platform: linux/amd64
    container_name: hopital-wazuh-dashboard
    restart: unless-stopped
    environment:
      INDEXER_USERNAME:   "admin"
      INDEXER_PASSWORD:   "admin"
      WAZUH_API_URL:      "http://wazuh-manager"
      SERVER_SSL_ENABLED: "false"
      OPENSEARCH_HOSTS:   "http://wazuh-indexer:9200"
    ports: ["5601:5601"]
    depends_on:
      wazuh-indexer: { condition: service_healthy }
      wazuh-manager: { condition: service_healthy }
    networks: [soc_net]
```

**Question 4.3 :** Expliquez pourquoi `wazuh-manager` a besoin d'être dans `soc_net`, `app_net` ET `iam_net`, alors que `wazuh-dashboard` n'a besoin que de `soc_net`.

---

## Partie 5 — Démarrage et vérification

### Étape 5.1 — Prérequis et démarrage

```bash
# 1. Prérequis Wazuh Indexer (obligatoire)
sudo sysctl -w vm.max_map_count=262144

# 2. Arrêter V1 si elle tourne encore
cd ../hopital-v1-clean
docker compose down
cd ../hopital-v2

# 3. Lancer V2
docker compose up -d

# 4. Surveiller le démarrage (5-8 minutes)
docker compose ps
```

### Étape 5.2 — Initialisation

Une fois tous les services démarrés :

```bash
# Créer les utilisateurs Keycloak
bash scripts/init-keycloak.sh

# Initialiser les secrets Vault
docker exec hopital-vault sh /vault/init.sh
```

### Étape 5.3 — Vérification des interfaces

| Interface         | URL                       | Credentials        |
|-------------------|---------------------------|--------------------|
| DPI               | http://localhost:3001     | jean.dupont / Jean2024! |
| RDV               | http://localhost:3002     | pierre.employe / Pierre2024! |
| RH                | http://localhost:3003     | marie.manager / Marie2024! |
| Keycloak Admin    | http://localhost:8080     | admin / admin      |
| Vault UI          | http://localhost:8200     | Token: myroot_token_12345 |
| **Splunk**        | **http://localhost:8000** | **admin / Admin1234!** |
| **Wazuh**         | **http://localhost:5601** | **admin / admin**  |

### Étape 5.4 — Vérifier que les logs arrivent dans Splunk

```bash
# Test HEC manuel
curl -k -X POST http://localhost:8088/services/collector/event \
  -H "Authorization: Splunk hopital-hec-2024" \
  -d '{"event": {"test": "hopital-v2-ok", "service": "dpi"}, "index": "hopital-dpi"}'

# Réponse attendue
# {"text":"Success","code":0}
```

Puis dans Splunk (`localhost:8000`) :
```
Search & Reporting → index=hopital-dpi | table _time, service, test
```

### Étape 5.5 — Vérifier Wazuh

Dans Wazuh Dashboard (`localhost:5601`) :

```
Menu → Security → Events
Filtre : rule.id >= 100001
```

---

## Partie 6 — Validation — Rejouer les attaques

### Étape 6.1 — Relancer le script Kali

```bash
docker exec -it hopital-kali bash
bash /kali/attaques.sh
```

### Étape 6.2 — Observer dans Splunk

```spl
# Voir toutes les alertes des dernières 15 minutes
index=wazuh-alerts | table _time, rule.id, rule.description, src_ip | sort -_time

# Corrélation : même IP dans tous les logs
index=hopital-* OR index=wazuh-alerts src_ip=172.25.0.2 | sort _time | table _time, index, action, rule.description
```

### Étape 6.3 — Observer dans Wazuh Dashboard

- `Security Events` → filtrer `rule.level >= 10`
- Vérifier que la règle **100002** (brute-force) a déclenché une **active response**
- Vérifier que l'IP Kali est temporairement inaccessible après le brute-force

### Étape 6.4 — Tableau comparatif à compléter

| Attaque | V1 — Détectée ? | V2 — Détectée ? | V2 — Bloquée ? | Règle Wazuh |
|---------|-----------------|-----------------|----------------|-------------|
| A1 Brute-force Keycloak | Non | | | |
| A2 SQL Injection DPI    | Non | | | |
| A3 IDOR Fiches de paie  | Non | | | |
| A4 Énumération LDAP     | Non | | | |
| A5 Vol de JWT           | Non | | | |
| A6 Dump Vault           | Non | | | |

---

## Partie 7 — Questions de synthèse

**Q7.1 — Isolation réseau**  
Vous avez créé un `soc_net` dédié. Quels seraient les risques si tous les services SSI étaient simplement ajoutés dans `app_net` sans réseau séparé ?

**Q7.2 — Séparation des rôles SIEM vs EDR**  
Dans ce TP, Splunk joue le rôle de SIEM et Wazuh celui d'EDR. Décrivez en une phrase ce que chacun fait que l'autre ne fait pas.

**Q7.3 — Active response**  
L'active response de Wazuh bloque l'IP attaquante. Quelles sont les limites de cette approche dans un contexte réel (pensez aux faux positifs, à l'IP spoofing, aux utilisateurs légitimes) ?

**Q7.4 — Corrélation cross-source**  
Proposez une requête SPL Splunk qui détecte un scénario d'attaque complet : un utilisateur qui se connecte, puis accède à plusieurs fiches de paie, puis lit des secrets Vault — le tout en moins de 2 minutes depuis la même IP.

**Q7.5 — Limites de la V2**  
La V2 détecte les attaques mais ne corrige pas les failles. Citez au moins 3 corrections applicatives qu'il faudrait apporter pour sécuriser réellement le SI (au-delà de la surveillance).

---

## Annexe — Structure finale du projet

```
hopital-v2/
├── docker-compose.yml          ← V1 + Wazuh + Splunk + soc_net
├── README.md
├── scripts/
│   └── init-keycloak.sh        ← identique V1
├── keycloak/
│   └── realm-hopital.json      ← identique V1
├── vault/
│   └── init.sh                 ← identique V1
├── soc/                        ← NOUVEAU
│   ├── splunk/
│   │   ├── indexes.conf        ← 6 index (hopital-* + wazuh-alerts)
│   │   └── inputs.conf         ← HEC token hopital-hec-2024
│   └── wazuh/
│       ├── ossec.conf          ← config Manager + active response
│       └── rules/
│           └── hopital.xml     ← règles 100001–100051
├── dpi/                        ← identique V1
├── rdv/                        ← identique V1
├── rh/                         ← identique V1 (sauf logToSplunk ajouté)
└── kali/
    └── attaques.sh             ← identique V1
```

## Annexe — Commandes de diagnostic

```bash
# État de tous les conteneurs
docker compose ps --format "table {{.Name}}\t{{.Status}}"

# Logs Wazuh Manager (règles déclenchées)
docker logs hopital-wazuh-manager --tail 50 | grep -E "Alert|active-response"

# Logs Splunk (Ansible provisionning)
docker compose logs splunk | grep -E "PLAY RECAP|failed|ok="

# Tester la connectivité HEC depuis un backend
docker exec hopital-dpi-backend \
  wget -qO- --post-data='{"event":{"test":"ok"},"index":"hopital-dpi"}' \
  --header='Authorization: Splunk hopital-hec-2024' \
  http://hopital-splunk:8088/services/collector/event

# Vérifier que Wazuh Indexer est healthy
curl -sf http://localhost:9200/_cluster/health | python3 -m json.tool
```

---

*TP réalisé dans le cadre de la formation Cybersécurité — Utopios · Master 2*
