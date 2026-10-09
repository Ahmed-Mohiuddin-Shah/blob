/** App session shape (compat with former Auth.js Session.user). */
export type AppSessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  username: string;
  displayName: string;
  role: string;
  accountStatus: string;
};
