import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://netgmadtongdspojqaue.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ldGdtYWR0b25nZHNwb2pxYXVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgxMTg3NDIsImV4cCI6MjA2MzY5NDc0Mn0.h6lHxp0xUjiB2mE6OT-ePqNanmSFKs7zhvvHRtwKXKI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// src/types/index.ts

export interface Profile {
  id: string;
  company_name: string;
  address?: string;
  phone?: string;
  email?: string;
  nif?: string;
  rc?: string;
  is_active: boolean;
  created_at: string;
}

export interface Produit {
  id: string;
  user_id: string;
  nom: string;
  reference?: string;
  categorie: string;
  couleur?: string;
  format?: string;
  stock_m2: number;
  prix_m2: number;
  seuil_alerte: number;
  photo_url?: string;
  actif: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  nom: string;
  phone?: string;
  adresse?: string;
  email?: string;
  created_at: string;
}

export interface LigneFacture {
  id?: string;
  facture_id?: string;
  produit_id?: string;
  designation: string;
  reference?: string;
  couleur?: string;
  format?: string;
  quantite_m2: number;
  prix_unitaire: number;
  total_ligne: number;
  ordre: number;
}

export interface Facture {
  id: string;
  user_id: string;
  numero: string;
  client_id?: string;
  client_nom: string;
  client_phone?: string;
  client_adresse?: string;
  date_facture: string;
  echeance?: string;
  sous_total: number;
  tva_pct: number;
  tva_montant: number;
  remise_pct: number;
  remise_montant: number;
  total_ttc: number;
  statut: 'brouillon' | 'emise' | 'payee' | 'annulee';
  notes?: string;
  created_at: string;
  lignes?: LigneFacture[];
}

export type StatutFacture = 'brouillon' | 'emise' | 'payee' | 'annulee';

export interface DashboardStats {
  chiffre_affaires_mois: number;
  chiffre_affaires_total: number;
  factures_emises: number;
  factures_payees: number;
  factures_en_attente: number;
  produits_stock_bas: number;
  clients_total: number;
}