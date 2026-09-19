import { api } from "./client";

export interface CompanyUser {
  userId: string;
  email: string;
  fullName: string;
  roleId: string;
  roleName: string;
}

export interface Role {
  id: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
}

export const settingsApi = {
  users: {
    list: () => api.get<CompanyUser[]>("/users"),
  },
  roles: {
    list: () => api.get<Role[]>("/roles"),
  },
};
