// ============================================================
// LocalDemoComplaintRepository — LocalStorage Implementation
// ============================================================
// Keeps Demo mode fully functional using the browser's local store.

import type { Complaint } from '../../types';
import type { ComplaintRepository } from './ComplaintRepository';
import {
  getStoredComplaints,
  saveComplaintToStore,
  subscribeToComplaints,
  matchesDepartment,
} from '../complaintService';

export class LocalDemoComplaintRepository implements ComplaintRepository {
  async getById(id: string): Promise<Complaint | null> {
    const list = getStoredComplaints();
    const cleanId = id.toUpperCase().replace(/\s+/g, '').trim();
    return list.find((c) => c.id.toUpperCase() === cleanId) ?? null;
  }

  async getAll(): Promise<Complaint[]> {
    return getStoredComplaints();
  }

  async getByCity(cityId: string): Promise<Complaint[]> {
    const list = getStoredComplaints();
    return list.filter((c) => c.cityId.toLowerCase() === cityId.toLowerCase());
  }

  async getByDepartment(departmentId: string): Promise<Complaint[]> {
    const list = getStoredComplaints();
    return list.filter((c) => matchesDepartment(c, departmentId));
  }

  async save(complaint: Complaint): Promise<Complaint> {
    saveComplaintToStore(complaint);
    return complaint;
  }

  subscribe(onChange: () => void): () => void {
    return subscribeToComplaints(onChange);
  }
}
