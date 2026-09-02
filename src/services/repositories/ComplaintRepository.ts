// ============================================================
// ComplaintRepository — Abstract Data Access Contract (Spec §6)
// ============================================================
// Decouples UI and services from the underlying persistence mechanism
// (localStorage in Demo Mode vs Supabase / PostgREST in Production).

import type { Complaint } from '../../types';

export interface ComplaintRepository {
  /** Retrieves a single complaint by its canonical ID. */
  getById(id: string): Promise<Complaint | null>;

  /** Retrieves all complaints. */
  getAll(): Promise<Complaint[]>;

  /** Retrieves complaints for a specific city. */
  getByCity(cityId: string): Promise<Complaint[]>;

  /** Retrieves complaints assigned or routed to a department. */
  getByDepartment(departmentId: string): Promise<Complaint[]>;

  /** Saves a new or updated complaint to the persistent store. */
  save(complaint: Complaint): Promise<Complaint>;

  /** Subscribes to complaint changes (storage events or realtime). */
  subscribe(onChange: () => void): () => void;
}
