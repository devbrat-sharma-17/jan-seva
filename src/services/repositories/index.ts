// ============================================================
// Complaint Repository Layer — Factory & Exports (DATABASE.md §6)
// ============================================================

import type { ComplaintRepository } from './ComplaintRepository';
import { LocalDemoComplaintRepository } from './LocalDemoComplaintRepository';
import { SupabaseComplaintRepository } from './SupabaseComplaintRepository';
import { demoSeedDataAllowed } from '../../config/appMode';

export type { ComplaintRepository } from './ComplaintRepository';
export { LocalDemoComplaintRepository } from './LocalDemoComplaintRepository';
export { SupabaseComplaintRepository } from './SupabaseComplaintRepository';

let activeRepository: ComplaintRepository | null = null;

/**
 * Returns the configured repository instance.
 *
 * Defaults to LocalDemoComplaintRepository in demo/offline mode,
 * or SupabaseComplaintRepository when live Supabase configuration is present.
 */
export function getComplaintRepository(): ComplaintRepository {
  if (activeRepository) return activeRepository;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && anonKey && !demoSeedDataAllowed()) {
    activeRepository = new SupabaseComplaintRepository(supabaseUrl, anonKey);
  } else {
    activeRepository = new LocalDemoComplaintRepository();
  }

  return activeRepository;
}

/** Allows overriding the repository for tests. */
export function setComplaintRepository(repo: ComplaintRepository | null): void {
  activeRepository = repo;
}
