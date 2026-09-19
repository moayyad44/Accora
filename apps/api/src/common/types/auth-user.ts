/** Shape of the JWT access-token payload, and what JwtAuthGuard attaches to
 * `request.user`. `companyId`/`roleId` are only present once the user has
 * picked (or been issued a token for) an active company — see
 * AuthService.issueAccessToken. */
export interface AccessTokenPayload {
  sub: string; // userId
  email: string;
  companyId: string | null;
  roleId: string | null;
  isSuperAdmin: boolean;
}

export interface RefreshTokenPayload {
  sub: string; // userId
  tokenType: "refresh";
}
