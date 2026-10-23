// ReKYC admin roles. These accounts live in rekyc_admin_users and have no access to the
// KYC Admin, Globe or AP portals (and those portals' accounts have no access here).
const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",
  REQUEST_VIEW: "request.view",
  MAKER_ACTION: "request.maker",
  CHECKER_ACTION: "request.checker",
  BACKOFFICE_PUSH: "request.backoffice",
  REQUEST_TRASH: "request.trash",
  REPORT_EXPORT: "report.export",
  ESTAMP_MANAGE: "estamp.manage",
  USER_MANAGE: "user.manage",
  AUDIT_VIEW: "audit.view",
};

const ALL = Object.values(PERMISSIONS);

const ROLES = {
  rekyc_admin: {
    label: "Super Admin",
    permissions: ALL,
  },
  rekyc_maker: {
    label: "Maker",
    permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.REQUEST_VIEW, PERMISSIONS.MAKER_ACTION, PERMISSIONS.REPORT_EXPORT],
  },
  rekyc_checker: {
    label: "Checker",
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.REQUEST_VIEW,
      PERMISSIONS.CHECKER_ACTION,
      PERMISSIONS.BACKOFFICE_PUSH,
      PERMISSIONS.REPORT_EXPORT,
    ],
  },
  rekyc_viewer: {
    label: "Viewer",
    permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.REQUEST_VIEW],
  },
};

function permissionsFor(role) {
  return ROLES[role]?.permissions || [];
}

function hasPermission(role, permission) {
  return permissionsFor(role).includes(permission);
}

module.exports = { PERMISSIONS, ROLES, permissionsFor, hasPermission };
