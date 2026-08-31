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
        className="admin-card-grid"
      >
        {' '}
        {initiatives.map((ini) => (
          <div
            key={ini.id}
            className="admin-panel admin-u-fill"

          >
            {' '}
            <div>
              {' '}
              <div
                className="admin-u-split"
              >
                {' '}
                <span className="admin-dept-pill admin-u-capitalize">
                  {' '}
                  {ini.department}
                </span>{' '}
                <span
                  className={`admin-ini__status${
                    ini.status === 'active' ? ' admin-ini__status--active' : ''
                  }`}
                >
                  {' '}
                  {ini.status.toUpperCase()}
                </span>{' '}
              </div>{' '}
              <h3
                className="admin-ini__title"
              >
                {' '}
                {ini.title}
              </h3>{' '}
              <p
                className="admin-ini__desc"
              >
                {' '}
                {ini.description}
              </p>{' '}
              <div className="admin-u-note admin-u-gap-md">
                {' '}
                <strong>Location:</strong> {ini.location}
              </div>{' '}
            </div>{' '}
            <div>
              {' '}
              <div
                className="admin-ini__progress-head"
              >
                {' '}
                <span className="admin-u-muted">Mission Progress</span>{' '}
                <span className="admin-u-info">{ini.progress}%</span>{' '}
              </div>{' '}
              <div
                className="admin-ini__track"
              >
                {' '}
                <div
                  className="admin-ini__fill"
                  style={{ width: `${ini.progress}%` }}
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
            <p className="admin-u-caption">
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
                  className="admin-input"
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
                  className="admin-input"
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
