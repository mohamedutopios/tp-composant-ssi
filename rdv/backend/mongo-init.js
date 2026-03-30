// mongo-init.js — données initiales RDV
db = db.getSiblingDB('rdv_hopital');

db.praticiens.insertMany([
  { userId:'jean.dupont',   nom:'Dupont',  prenom:'Jean',    specialite:'Cardiologie',    service:'Cardiologie' },
  { userId:'dr.bernard',    nom:'Bernard', prenom:'Marc',    specialite:'Neurologie',     service:'Neurologie' },
  { userId:'dr.petit',      nom:'Petit',   prenom:'Claire',  specialite:'Oncologie',      service:'Oncologie' },
  { userId:'dr.moreau',     nom:'Moreau',  prenom:'Sophie',  specialite:'Radiologie',     service:'Radiologie' },
  { userId:'dr.leroy',      nom:'Leroy',   prenom:'Antoine', specialite:'Urgences',       service:'Urgences' },
]);

const now = new Date();
const d = (days, h) => { const dt = new Date(now); dt.setDate(dt.getDate()+days); dt.setHours(h,0,0,0); return dt; };

db.rendezvous.insertMany([
  { patientId:'pierre.employe', patientNom:'Pierre Employe', praticienId:'jean.dupont', praticienNom:'Dr. Jean Dupont', specialite:'Cardiologie', date:d(3,9),  heure:'09:00', motif:'Contrôle tension artérielle', type:'presentiel',       statut:'confirme', createdAt:now, updatedAt:now },
  { patientId:'pierre.employe', patientNom:'Pierre Employe', praticienId:'dr.bernard',  praticienNom:'Dr. Marc Bernard', specialite:'Neurologie',  date:d(7,10), heure:'10:00', motif:'Suivi migraines chroniques',  type:'teleconsultation', statut:'confirme', createdAt:now, updatedAt:now },
  { patientId:'marie.manager',  patientNom:'Marie Manager',  praticienId:'jean.dupont', praticienNom:'Dr. Jean Dupont', specialite:'Cardiologie', date:d(1,14), heure:'14:00', motif:'Bilan annuel cardiaque',       type:'presentiel',       statut:'en_attente', createdAt:now, updatedAt:now },
  { patientId:'pierre.employe', patientNom:'Pierre Employe', praticienId:'dr.petit',    praticienNom:'Dr. Claire Petit',  specialite:'Oncologie',   date:d(-3,9), heure:'09:00', motif:'Résultats analyses',          type:'presentiel',       statut:'termine', createdAt:now, updatedAt:now },
]);

print('✅ Données RDV initialisées');
