/**
 * Resets a user's login password directly in the database — there is no
 * self-service "forgot password" flow yet (no email/SMTP integration), so
 * this is the only recovery path for a locked-out account.
 *
 * Connects with whatever DATABASE_URL is in the environment/.env, which must
 * be the Postgres *owner* connection (same requirement as scripts/backup.sh)
 * — it bypasses Row-Level Security the same way `prisma migrate`/`seed` do,
 * which the restricted runtime `app_user` connection cannot.
 *
 * Usage:
 *   pnpm --filter @accora/api reset-password <email> <newPassword>
 */
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

async function main() {
  const [email, newPassword] = process.argv.slice(2);
  if (!email || !newPassword) {
    console.error("Usage: reset-password <email> <newPassword>");
    process.exit(1);
  }
  if (newPassword.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`No user found with email: ${email}`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.user.update({ where: { email }, data: { passwordHash } });
    console.log(`Password reset for ${email}. They can log in with the new password now.`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
