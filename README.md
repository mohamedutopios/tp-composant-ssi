# HôpitalSim V1

SI hospitalier avec 3 applications React + Keycloak + Vault.

---

## Démarrage en 3 étapes

### Étape 1 — Lancer la stack

```bash
docker compose up -d
```

### Étape 2 — Attendre Keycloak (2-3 minutes)

```bash
# Surveiller le démarrage
docker compose logs -f keycloak | grep -E "started|ERROR"

# Ou vérifier manuellement
curl -s http://localhost:8080/realms/hopital/.well-known/openid-configuration | head -c 50
# Doit retourner {"issuer":"http://localhost:8080/...
```

### Étape 3 — Créer les utilisateurs (une seule fois)

```bash
bash scripts/init-keycloak.sh
```

Résultat attendu :
```
✅ jean.dupont créé — rôle 'medecin' assigné
✅ marie.manager créé — rôle 'manager' assigné
✅ pierre.employe créé — rôle 'employe' assigné
✅ admin.hopital créé — rôle 'admin' assigné
```

---

## Applications

| App | URL | Compte |
|-----|-----|--------|
| DPI — Dossier Patient | http://localhost:3001 | jean.dupont / Jean2024! |
| RDV — Rendez-vous | http://localhost:3002 | pierre.employe / Pierre2024! |
| RH — Ressources Humaines | http://localhost:3003 | marie.manager / Marie2024! |

---

## Interfaces de gestion

| Service | URL | Credentials |
|---------|-----|-------------|
| Keycloak Admin | http://localhost:8080 | admin / admin |
| Vault | http://localhost:8200 | Token: myroot_token_12345 |

---

## Tests Kali

```bash
docker exec -it hopital-kali bash
bash /kali/attaques.sh
```

---

## Arrêt

```bash
docker compose down        # arrêt (données conservées)
docker compose down -v     # arrêt + reset complet
```

> Après un `down -v`, relancer `bash scripts/init-keycloak.sh` pour recréer les utilisateurs.
