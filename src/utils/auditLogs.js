/**
 * Audit log action definitions and formatting helpers.
 * Shared between AdminDashboard and AdminLogsView.
 */

export const ACTION_OPTIONS = [
  { value: '', label: 'All action types' },
  { value: 'approve_educator', label: 'Approve educator' },
  { value: 'reject_educator', label: 'Reject educator' },
  { value: 'create_classroom', label: 'Create classroom' },
  { value: 'update_classroom', label: 'Update classroom' },
  { value: 'delete_classroom', label: 'Delete classroom' },
  { value: 'reassign_classroom', label: 'Reassign classroom (historical)' },
  { value: 'register_player', label: 'Player registration' },
  { value: 'register_web_user', label: 'Educator registration' },
  { value: 'login', label: 'User login' },
  { value: 'join_classroom', label: 'Join classroom' },
  { value: 'leave_classroom', label: 'Leave classroom' },
]

export const getActionLabel = (actionType) => {
  const match = ACTION_OPTIONS.find((opt) => opt.value === actionType)
  return match ? match.label : actionType || 'Unknown action'
}

export const getActionBadgeClass = (actionType) => {
  switch (actionType) {
    case 'approve_educator':
      return 'badge-success'
    case 'reject_educator':
    case 'delete_classroom':
      return 'badge-danger'
    case 'create_classroom':
    case 'register_web_user':
    case 'register_player':
      return 'badge-primary'
    case 'update_classroom':
    case 'reassign_classroom':
      return 'badge-warning'
    default:
      return 'badge-neutral'
  }
}
