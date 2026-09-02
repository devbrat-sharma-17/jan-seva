// ============================================================
// SupabaseComplaintRepository — Supabase / PostgREST Implementation
// ============================================================
// Bridges the frontend Complaint domain model with the Supabase schema
// defined in 0001_core_schema.sql.
//
// In accordance with spec §18 and the database security model:
// - Direct reads/writes check the active auth token or fall back gracefully.
// - All mutations preserve optimistic concurrency counters (`version`).

import type { Complaint } from '../../types';
import type { ComplaintRepository } from './ComplaintRepository';

interface SupabaseComplaintRow {
  id: string;
  city_id: string;
  civic_issue_id?: string | null;
  status: string;
  moderation?: string;
  department_id?: string | null;
  assigned_to?: string | null;
  category: string;
  severity?: string | null;
  priority_score?: number;
  lat: number;
  lng: number;
  location_source?: 'gps' | 'manual';
  gps_lat?: number | null;
  gps_lng?: number | null;
  gps_accuracy_m?: number | null;
  gps_captured_at?: string | null;
  formatted_address?: string | null;
  locality?: string | null;
  postal_code?: string | null;
  ward_id?: string | null;
  reporter_name?: string | null;
  identity_reference?: string | null;
  identity_method?: 'mobile' | 'aadhaar' | null;
  identity_masked?: string | null;
  identity_verified?: boolean;
  sla_due_at?: string | null;
  sla_state?: string;
  escalated_at?: string | null;
  escalation_level?: string | null;
  resolved_at?: string | null;
  citizen_verified?: boolean;
  citizen_verified_at?: string | null;
  issue: {
    category?: string;
    title?: string;
    description?: string;
    photos?: string[];
  };
  ai_analysis?: Record<string, unknown> | null;
  resolution?: Record<string, unknown> | null;
  verification?: Record<string, unknown> | null;
  feedback?: Record<string, unknown> | null;
  duplicate_link?: Record<string, unknown> | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export class SupabaseComplaintRepository implements ComplaintRepository {
  private readonly baseUrl: string;
  private readonly anonKey: string;

  constructor(url?: string, anonKey?: string) {
    this.baseUrl = (url || import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
    this.anonKey = anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  }

  private getHeaders(authToken?: string): Record<string, string> {
    const token = authToken || this.anonKey;
    return {
      apikey: this.anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    };
  }

  /** Converts a database row to the frontend Complaint model. */
  private mapRowToComplaint(row: SupabaseComplaintRow): Complaint {
    return {
      id: row.id,
      cityId: row.city_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status as Complaint['status'],
      issue: {
        category: row.category || row.issue?.category || '',
        title: row.issue?.title || '',
        description: row.issue?.description || '',
      },
      photos: row.issue?.photos || [],
      location: {
        latitude: row.lat,
        longitude: row.lng,
        address: row.formatted_address || '',
        locality: row.locality || '',
        city: row.city_id,
        state: 'Madhya Pradesh',
        source: row.location_source || 'gps',
        gps: row.gps_lat && row.gps_lng ? {
          latitude: row.gps_lat,
          longitude: row.gps_lng,
          accuracy: row.gps_accuracy_m ?? undefined,
          detectedAt: row.gps_captured_at ?? undefined,
        } : undefined,
      },
      department: {
        id: row.department_id ?? undefined,
        name: row.department_id ? row.department_id.toUpperCase() : 'General Triage',
        division: 'Municipal',
        helpline: '1800-233-0000',
      },
      reporter: {
        name: row.reporter_name || '',
        mobileMasked: row.identity_masked || undefined,
        identityMethod: row.identity_method || undefined,
        identityVerified: Boolean(row.identity_verified),
        identityReference: row.identity_reference || undefined,
      },
      sla: {
        dueAt: row.sla_due_at || row.created_at,
        status: (row.sla_state as 'normal' | 'approaching' | 'exceeded') || 'normal',
        escalatedAt: row.escalated_at ?? undefined,
        escalationLevel: row.escalation_level ?? undefined,
      },
      timeline: [],
      latestUpdate: {
        title: 'Complaint Registered',
        description: 'Your complaint has been logged and assigned for processing.',
        timestamp: row.created_at,
      },
      version: row.version,
    };
  }

  /** Converts a frontend Complaint to database row representation. */
  private mapComplaintToRow(c: Complaint): Partial<SupabaseComplaintRow> {
    return {
      id: c.id,
      city_id: c.cityId,
      status: c.status,
      category: c.issue?.category || 'general',
      department_id: c.department?.id || null,
      lat: c.location.latitude,
      lng: c.location.longitude,
      formatted_address: c.location.address || null,
      locality: c.location.locality || null,
      location_source: c.location.source || 'gps',
      gps_lat: c.location.gps?.latitude || null,
      gps_lng: c.location.gps?.longitude || null,
      gps_accuracy_m: c.location.gps?.accuracy || null,
      gps_captured_at: c.location.gps?.detectedAt || null,
      reporter_name: c.reporter.name || null,
      identity_reference: c.reporter.identityReference || null,
      identity_masked: c.reporter.mobileMasked || null,
      identity_method: c.reporter.identityMethod || null,
      identity_verified: c.reporter.identityVerified,
      priority_score: c.aiAnalysis?.priorityScore ?? 0,
      issue: {
        category: c.issue?.category,
        title: c.issue?.title,
        description: c.issue?.description,
        photos: c.photos,
      },
      version: (c.version ?? 0) + 1,
      updated_at: new Date().toISOString(),
    };
  }

  async getById(id: string): Promise<Complaint | null> {
    if (!this.baseUrl) return null;
    const cleanId = id.toUpperCase().replace(/\s+/g, '').trim();
    try {
      const response = await fetch(
        `${this.baseUrl}/rest/v1/complaints?id=eq.${encodeURIComponent(cleanId)}&limit=1`,
        { headers: this.getHeaders() }
      );
      if (!response.ok) return null;
      const rows = (await response.json()) as SupabaseComplaintRow[];
      return rows.length > 0 ? this.mapRowToComplaint(rows[0]) : null;
    } catch {
      return null;
    }
  }

  async getAll(): Promise<Complaint[]> {
    if (!this.baseUrl) return [];
    try {
      const response = await fetch(
        `${this.baseUrl}/rest/v1/complaints?select=*&order=created_at.desc`,
        { headers: this.getHeaders() }
      );
      if (!response.ok) return [];
      const rows = (await response.json()) as SupabaseComplaintRow[];
      return rows.map((r) => this.mapRowToComplaint(r));
    } catch {
      return [];
    }
  }

  async getByCity(cityId: string): Promise<Complaint[]> {
    if (!this.baseUrl) return [];
    try {
      const response = await fetch(
        `${this.baseUrl}/rest/v1/complaints?city_id=eq.${encodeURIComponent(cityId)}&order=created_at.desc`,
        { headers: this.getHeaders() }
      );
      if (!response.ok) return [];
      const rows = (await response.json()) as SupabaseComplaintRow[];
      return rows.map((r) => this.mapRowToComplaint(r));
    } catch {
      return [];
    }
  }

  async getByDepartment(departmentId: string): Promise<Complaint[]> {
    if (!this.baseUrl) return [];
    try {
      const response = await fetch(
        `${this.baseUrl}/rest/v1/complaints?department_id=eq.${encodeURIComponent(departmentId)}&order=created_at.desc`,
        { headers: this.getHeaders() }
      );
      if (!response.ok) return [];
      const rows = (await response.json()) as SupabaseComplaintRow[];
      return rows.map((r) => this.mapRowToComplaint(r));
    } catch {
      return [];
    }
  }

  async save(complaint: Complaint): Promise<Complaint> {
    if (!this.baseUrl) throw new Error('Supabase URL not configured');
    const row = this.mapComplaintToRow(complaint);
    const response = await fetch(`${this.baseUrl}/rest/v1/complaints`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(row),
    });

    if (!response.ok) {
      throw new Error(`Failed to save complaint to Supabase: HTTP ${response.status}`);
    }

    const savedRows = (await response.json()) as SupabaseComplaintRow[];
    return savedRows.length > 0 ? this.mapRowToComplaint(savedRows[0]) : complaint;
  }

  subscribe(_onChange: () => void): () => void {
    // Supabase Realtime channel subscription placeholder
    return () => {};
  }
}
