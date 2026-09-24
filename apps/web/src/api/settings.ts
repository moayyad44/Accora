import { api } from "./client";

export interface CompanyUser {
  userId: string;
  email: string;
  fullName: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
}

export interface Role {
  id: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
}

export interface CreateUserInput {
  fullName: string;
  email: string;
  password: string;
  roleId: string;
}

export interface UpdateUserInput {
  roleId?: string;
  isActive?: boolean;
}

export const settingsApi = {
  users: {
    list: () => api.get<CompanyUser[]>("/users"),
    create: (input: CreateUserInput) => api.post<CompanyUser>("/users", input),
    update: (userId: string, input: UpdateUserInput) => api.patch<CompanyUser>(`/users/${userId}`, input),
  },
  roles: {
    list: () => api.get<Role[]>("/roles"),
  },
};
