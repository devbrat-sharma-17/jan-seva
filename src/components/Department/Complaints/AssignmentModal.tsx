import React, { useState } from 'react';
import { DeptModal } from './DeptModal';
import type { Complaint } from '../../../types';
import type { DepartmentConfig } from '../../../types/department';

interface AssignmentModalProps {
  complaint: Complaint;
  deptConfig: DepartmentConfig;
  isOpen: boolean;
  onClose: () => void;
  onAssign: (
    officer: { name: string; designation: string; staffId: string; team?: string; phone?: string },
    teamName: string
  ) => Promise<void>;
}

export function AssignmentModal({
  complaint,
  deptConfig,
  isOpen,
  onClose,
  onAssign,
}: AssignmentModalProps) {
  const [selectedStaffId, setSelectedStaffId] = useState(
    complaint.assignedOfficer?.staffId || deptConfig.mockStaff[0]?.id || ''
  );
  const [selectedTeam, setSelectedTeam] = useState(
    complaint.department.assignedTeam || deptConfig.mockTeams[0] || 'Operations Team 1'
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const staff = deptConfig.mockStaff.find((s) => s.id === selectedStaffId) || deptConfig.mockStaff[0];
    if (!staff) return;

    setSubmitting(true);
    try {
      await onAssign(
        {
          name: staff.name,
          designation: staff.designation,
          staffId: staff.id,
          team: selectedTeam,
          phone: staff.phone,
        },
        selectedTeam
      );
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DeptModal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign this complaint"
      subtitle={`${complaint.id} · ${complaint.issue.title}`}
    >
      <form onSubmit={handleSubmit} className="dept-modal__form">
        <div className="dept-field">
          <label className="dept-field__label" htmlFor="assign-team">
            Operational team
          </label>
          <select
            id="assign-team"
            className="dept-select"
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
          >
            {deptConfig.mockTeams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </div>

        <div className="dept-field">
          <label className="dept-field__label" htmlFor="assign-officer">
            Officer
          </label>
          <select
            id="assign-officer"
            className="dept-select"
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
          >
            {deptConfig.mockStaff.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name} — {staff.designation}
              </option>
            ))}
          </select>
          <span className="dept-field__hint">
            {deptConfig.mockStaff.find((s) => s.id === selectedStaffId)?.currentWorkload ?? 0} tasks
            already open for this officer.
          </span>
        </div>

        <div className="dept-modal__footer">
          <button type="button" className="dept-modal-btn dept-modal-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="dept-modal-btn dept-modal-btn--primary" disabled={submitting}>
            {submitting ? 'Assigning…' : 'Confirm assignment'}
          </button>
        </div>
      </form>
    </DeptModal>
  );
}
