-- DPI — Schéma PostgreSQL et données de test
DROP TABLE IF EXISTS prescriptions CASCADE;
DROP TABLE IF EXISTS consultations CASCADE;
DROP TABLE IF EXISTS patients CASCADE;

CREATE TABLE patients (
  id             SERIAL PRIMARY KEY,
  nom            VARCHAR(100) NOT NULL,
  prenom         VARCHAR(100) NOT NULL,
  date_naissance DATE NOT NULL,
  nss            VARCHAR(20) UNIQUE NOT NULL,
  service        VARCHAR(100),
  allergie       TEXT,
  groupe_sanguin VARCHAR(5),
  medecin_ref    VARCHAR(100),
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE consultations (
  id          SERIAL PRIMARY KEY,
  patient_id  INT REFERENCES patients(id) ON DELETE CASCADE,
  medecin     VARCHAR(100),
  date        TIMESTAMP DEFAULT NOW(),
  motif       TEXT,
  diagnostic  TEXT,
  notes       TEXT
);

CREATE TABLE prescriptions (
  id          SERIAL PRIMARY KEY,
  patient_id  INT REFERENCES patients(id) ON DELETE CASCADE,
  medecin     VARCHAR(100),
  date        TIMESTAMP DEFAULT NOW(),
  medicament  VARCHAR(200),
  dosage      VARCHAR(100),
  duree       VARCHAR(50),
  renouveler  BOOLEAN DEFAULT false
);

-- Données de test
INSERT INTO patients (nom,prenom,date_naissance,nss,service,allergie,groupe_sanguin,medecin_ref) VALUES
('Dupont',  'Jean',    '1985-06-15','1 85 06 75 001 001 23','Cardiologie','Pénicilline','A+','jean.dupont'),
('Martin',  'Sophie',  '1990-03-22','2 90 03 75 001 002 45','Neurologie', NULL,         'O-','jean.dupont'),
('Bernard', 'Paul',    '1978-11-08','1 78 11 13 001 003 67','Cardiologie','Aspirine',   'B+','jean.dupont'),
('Moreau',  'Claire',  '1965-04-30','2 65 04 31 001 004 89','Oncologie',  NULL,         'AB+','jean.dupont'),
('Lambert', 'Thomas',  '1992-08-19','1 92 08 06 001 005 12','Neurologie', NULL,         'A-','jean.dupont'),
('Petit',   'Emma',    '1988-01-05','2 88 01 59 001 006 34','Cardiologie','Latex',      'O+','jean.dupont'),
('Roux',    'Michel',  '1955-09-25','1 55 09 67 001 007 56','Oncologie',  NULL,         'B-','jean.dupont'),
('Simon',   'Isabelle','1975-12-01','2 75 12 33 001 008 78','Neurologie', 'Iode',       'A+','jean.dupont'),
('Laurent', 'André',   '1968-07-14','1 68 07 44 001 009 90','Cardiologie',NULL,         'AB-','jean.dupont'),
('Lefevre', 'Nathalie','1982-02-28','2 82 02 69 001 010 11','Oncologie',  'Codéine',    'O+','jean.dupont');

INSERT INTO consultations (patient_id,medecin,date,motif,diagnostic,notes) VALUES
(1,'jean.dupont','2024-11-15 09:00','Contrôle tension',   'HTA stade 1',              'Continuer amlodipine 5mg'),
(1,'jean.dupont','2024-08-20 10:30','Essoufflement',       'Dyspnée effort',           'ECG prescrit'),
(3,'jean.dupont','2024-12-05 08:30','Douleurs thoraciques','Angor instable',           'Hospitalisation urgente'),
(4,'jean.dupont','2024-11-28 14:00','Suivi chimio cycle 3','Cancer sein - réponse partielle','Poursuivre protocole'),
(7,'jean.dupont','2024-12-03 15:30','Bilan semestriel',    'Lymphome - rémission',     'Contrôle M6');

INSERT INTO prescriptions (patient_id,medecin,date,medicament,dosage,duree,renouveler) VALUES
(1,'jean.dupont','2024-11-15','Amlodipine','5mg/j',  '90 jours',true),
(1,'jean.dupont','2024-11-15','Ramipril',  '5mg/j',  '90 jours',true),
(3,'jean.dupont','2024-12-05','Trinitrine','0.4mg',  '30 jours',false),
(4,'jean.dupont','2024-11-28','Ondansétron','8mg x2','14 jours',false);
