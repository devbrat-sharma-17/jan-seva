// ============================================================
// Admin Civic Initiatives Manager — JAN-SEVA Phase 5
// ============================================================

import { useState } from 'react';
import { getAdminInitiatives } from '../../../services/adminService';
import type { AdminInitiative } from '../../../types/admin';
import '../admin-shared.css';
import '../Complaints/AdminComplaints.css';

export function InitiativeManager() {
  const [initiatives, setInitiatives] = useState<AdminInitiative[]>(() => getAdminInitiatives());
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newDept, setNewDept] = useState<
    'roads' | 'sanitation' | 'water' | 'electrical' | 'infrastructure'
  >('sanitation');

  const handleAddInitiative = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const created: AdminInitiative = {
      id: `ini-${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim() || 'Civic improvement initiative underway.',
      department: newDept,
      status: 'active',
      startDate: new Date().toISOString(),
      progress: 10,
      relatedComplaints: 0,
      location: newLocation.trim() || 'Gwalior Municipal Area',
    };

    setInitiatives([created, ...initiatives]);
    setShowAddModal(false);
    setNewTitle('');
    setNewDesc('');
    setNewLocation('');
  };

  return (
    <div className="admin-complaints">
      {' '}
      <div className="admin-complaints__header">
        {' '}
        <div className="admin-complaints__title-group">
          {' '}
          <h1>Civic Initiatives & Ward Missions</h1>{' '}
          <p>
            Oversee city-level targeted campaigns, cleanliness drives, and infrastructure
            modernization
          </p>{' '}
        </div>{' '}
        <button
          type="button"
          className="admin-action-btn admin-action-btn--reassign"
          onClick={() => setShowAddModal(true)}
        >
          {' '}
          Launch New Initiative
        </button>{' '}
      </div>{' '}
      {/* Initiatives Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {' '}
        {initiatives.map((ini) => (
          <div
            key={ini.id}
            className="admin-panel"
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
          >
            {' '}
            <div>
              {' '}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                }}
              >
                {' '}
                <span className="admin-dept-pill" style={{ textTransform: 'capitalize' }}>
                  {' '}
                  {ini.department}
                </span>{' '}
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.5rem',
                    borderRadius: '9999px',
                    background: ini.status === 'active' ? 'var(--color-success-bg)' : 'var(--color-surface-sunken)',
                    color: ini.status === 'active' ? 'var(--color-success-fg)' : 'var(--color-text-muted)',
                  }}
                >
                  {' '}
                  {ini.status.toUpperCase()}
                </span>{' '}
              </div>{' '}
              <h3
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 800,
                  color: 'var(--color-text)',
                  margin: '0 0 0.5rem',
                }}
              >
                {' '}
                {ini.title}
              </h3>{' '}
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.5,
                  margin: '0 0 1rem',
                }}
              >
                {' '}
                {ini.description}
              </p>{' '}
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                {' '}
                <strong>Location:</strong> {ini.location}
              </div>{' '}
            </div>{' '}
            <div>
              {' '}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  marginBottom: '4px',
                }}
              >
                {' '}
                <span style={{ color: 'var(--color-text-muted)' }}>Mission Progress</span>{' '}
                <span style={{ color: 'var(--color-civic-blue-dark)' }}>{ini.progress}%</span>{' '}
              </div>{' '}
              <div
                style={{
                  height: '8px',
                  background: 'var(--color-surface-sunken)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                {' '}
                <div
                  style={{
                    height: '100%',
                    width: `${ini.progress}%`,
                    background: 'var(--color-civic-blue-dark)',
                    borderRadius: '4px',
                  }}
                />{' '}
              </div>{' '}
            </div>{' '}
          </div>
        ))}
      </div>{' '}
      {/* Add Initiative Modal */}
      {showAddModal && (
        <div className="admin-modal-overlay" onClick={() => setShowAddModal(false)}>
          {' '}
          <div className="admin-modal-box" onClick={(e) => e.stopPropagation()}>
            {' '}
            <h3 className="admin-modal-title">Launch Civic Initiative</h3>{' '}
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
              {' '}
              Create a new municipal campaign to target clustered civic grievances.
            </p>{' '}
            <form className="admin-modal-form" onSubmit={handleAddInitiative}>
              {' '}
              <div className="admin-modal-field">
                {' '}
                <label>Initiative Title</label>{' '}
                <input
                  type="text"
                  placeholder="e.g. Ward 14 Pothole Rapid Fill Drive"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: '0.5rem',
                  }}
                  required
                />{' '}
              </div>{' '}
              <div className="admin-modal-field">
                {' '}
                <label>Responsible Department</label>{' '}
                <select
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value as typeof newDept)}
                >
                  {' '}
                  <option value="roads">Public Works (Roads)</option>{' '}
                  <option value="sanitation">Municipal Sanitation</option>{' '}
                  <option value="water">Water Works</option>{' '}
                  <option value="electrical">Electrical & Streetlights</option>{' '}
                  <option value="infrastructure">Public Infrastructure</option>{' '}
                </select>{' '}
              </div>{' '}
              <div className="admin-modal-field">
                {' '}
                <label>Location / Covered Wards</label>{' '}
                <input
                  type="text"
                  placeholder="e.g. Maharaj Bada, Phool Bagh Corridor"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: '0.5rem',
                  }}
                  required
                />{' '}
              </div>{' '}
              <div className="admin-modal-field">
                {' '}
                <label>Mission Description</label>{' '}
                <textarea
                  rows={3}
                  placeholder="Describe the objectives and key deliverables..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />{' '}
              </div>{' '}
              <div className="admin-modal-actions">
                {' '}
                <button
                  type="button"
                  className="admin-action-btn"
                  onClick={() => setShowAddModal(false)}
                >
                  {' '}
                  Cancel
                </button>{' '}
                <button type="submit" className="admin-action-btn admin-action-btn--reassign">
                  {' '}
                  Create Initiative
                </button>{' '}
              </div>{' '}
            </form>{' '}
          </div>{' '}
        </div>
      )}
    </div>
  );
}
