-- RH — Schéma PostgreSQL
DROP TABLE IF EXISTS planning_shifts CASCADE;
DROP TABLE IF EXISTS fiches_paie CASCADE;
DROP TABLE IF EXISTS conges CASCADE;
DROP TABLE IF EXISTS contrats CASCADE;
DROP TABLE IF EXISTS employes CASCADE;

CREATE TABLE employes (
  id            SERIAL PRIMARY KEY,
  matricule     VARCHAR(20) UNIQUE NOT NULL,
  nom           VARCHAR(100) NOT NULL,
  prenom        VARCHAR(100) NOT NULL,
  date_naiss    DATE,
  nss           VARCHAR(20),
  email         VARCHAR(150),
  service       VARCHAR(100),
  poste         VARCHAR(100),
  type_contrat  VARCHAR(20) DEFAULT 'CDI',
  statut        VARCHAR(20) DEFAULT 'actif',
  date_embauche DATE,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE contrats (
  id           SERIAL PRIMARY KEY,
  employe_id   INT REFERENCES employes(id) ON DELETE CASCADE,
  type         VARCHAR(20),
  date_debut   DATE,
  date_fin     DATE,
  salaire_brut NUMERIC(10,2),
  temps_travail NUMERIC(4,2) DEFAULT 1.0,
  statut       VARCHAR(20) DEFAULT 'actif'
);

CREATE TABLE fiches_paie (
  id           SERIAL PRIMARY KEY,
  employe_id   INT REFERENCES employes(id) ON DELETE CASCADE,
  mois         INT,
  annee        INT,
  salaire_brut NUMERIC(10,2),
  cotisations  NUMERIC(10,2),
  salaire_net  NUMERIC(10,2),
  prime        NUMERIC(10,2) DEFAULT 0,
  iban         VARCHAR(34),
  date_virement DATE,
  UNIQUE (employe_id, mois, annee)
);

CREATE TABLE conges (
  id          SERIAL PRIMARY KEY,
  employe_id  INT REFERENCES employes(id) ON DELETE CASCADE,
  type        VARCHAR(20),
  date_debut  DATE,
  date_fin    DATE,
  nb_jours    INT,
  motif       TEXT,
  statut      VARCHAR(20) DEFAULT 'en_attente',
  approuve_par VARCHAR(100)
);

CREATE TABLE planning_shifts (
  id          SERIAL PRIMARY KEY,
  employe_id  INT REFERENCES employes(id) ON DELETE CASCADE,
  date_shift  DATE,
  heure_debut TIME,
  heure_fin   TIME,
  type_shift  VARCHAR(30),
  service     VARCHAR(100)
);

-- Données de test
INSERT INTO employes (matricule,nom,prenom,date_naiss,nss,email,service,poste,type_contrat,date_embauche) VALUES
('HU-001','Dupont',  'Jean',    '1980-03-15','1 80 03 75 001 001 23','jean.dupont@utopios.local',   'Cardiologie','Médecin PH',         'CDI','2010-09-01'),
('HU-002','Manager', 'Marie',   '1975-07-22','2 75 07 75 001 002 45','marie.manager@utopios.local', 'RH',         'Responsable RH',     'CDI','2008-02-15'),
('HU-003','Employe', 'Pierre',  '1990-06-18','1 90 06 75 001 003 67','pierre.employe@utopios.local','Accueil',    'Agent accueil',      'CDI','2018-01-10'),
('HU-004','Hopital', 'Admin',   '1972-12-10','2 72 12 75 001 004 89','admin@utopios.local',         'DSI',        'Admin système',      'CDI','2005-01-10'),
('HU-005','Bernard', 'Sophie',  '1985-04-22','2 85 04 75 001 005 12','s.bernard@utopios.local',     'Neurologie', 'Infirmière DE',      'CDI','2012-06-01'),
('HU-006','Laurent', 'Thomas',  '1993-09-08','1 93 09 75 001 006 34','t.laurent@utopios.local',     'Urgences',   'Aide-soignant',      'CDD','2022-01-15');

INSERT INTO contrats (employe_id,type,date_debut,salaire_brut,statut) VALUES
(1,'CDI','2010-09-01',5500.00,'actif'),
(2,'CDI','2008-02-15',4600.00,'actif'),
(3,'CDI','2018-01-10',2400.00,'actif'),
(4,'CDI','2005-01-10',3900.00,'actif'),
(5,'CDI','2012-06-01',2800.00,'actif'),
(6,'CDD','2022-01-15',2100.00,'actif');

INSERT INTO fiches_paie (employe_id,mois,annee,salaire_brut,cotisations,salaire_net,prime,iban,date_virement) VALUES
(1,12,2024,5500.00,2145.00,3355.00,200.00,'FR76 3000 6000 0112 3456 7890 189','2024-12-27'),
(2,12,2024,4600.00,1794.00,2806.00,0.00,  'FR76 3000 6000 0223 4567 8901 278','2024-12-27'),
(3,12,2024,2400.00, 936.00,1464.00,0.00,  'FR76 3000 6000 0334 5678 9012 367','2024-12-27'),
(4,12,2024,3900.00,1521.00,2379.00,150.00,'FR76 3000 6000 0445 6789 0123 456','2024-12-27'),
(5,12,2024,2800.00,1092.00,1708.00,0.00,  'FR76 3000 6000 0556 7890 1234 545','2024-12-27'),
(6,12,2024,2100.00, 819.00,1281.00,0.00,  'FR76 3000 6000 0667 8901 2345 634','2024-12-27'),
(1,11,2024,5500.00,2145.00,3355.00,0.00,  'FR76 3000 6000 0112 3456 7890 189','2024-11-28'),
(2,11,2024,4600.00,1794.00,2806.00,0.00,  'FR76 3000 6000 0223 4567 8901 278','2024-11-28');

INSERT INTO conges (employe_id,type,date_debut,date_fin,nb_jours,motif,statut) VALUES
(3,'conges_payes','2025-02-10','2025-02-21',10,'Vacances familiales','en_attente'),
(5,'rtt','2025-01-20','2025-01-20',1,'RTT','approuve'),
(6,'maladie','2024-12-18','2024-12-20',3,'Arrêt maladie','approuve');

INSERT INTO planning_shifts (employe_id,date_shift,heure_debut,heure_fin,type_shift,service) VALUES
(3,'2025-01-13','08:00','16:00','matin','Accueil'),
(3,'2025-01-14','08:00','16:00','matin','Accueil'),
(5,'2025-01-13','07:30','15:30','matin','Neurologie'),
(5,'2025-01-14','15:30','23:30','apres_midi','Neurologie'),
(6,'2025-01-13','07:30','15:30','matin','Urgences');
