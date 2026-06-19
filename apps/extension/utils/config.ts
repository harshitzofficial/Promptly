// Central configuration for the extension.
// To point to a deployed backend, set WXT_BACKEND_URL in apps/extension/.env
export const BACKEND_URL = import.meta.env.WXT_BACKEND_URL || 'http://localhost:3005';
