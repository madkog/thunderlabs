import { compare } from "bcryptjs";
import { AppError } from "../errors.js";
import { findUserByEmail, findUserById } from "../repositories/users.js";

// Compared against when the email doesn't exist, so a wrong email takes as
// long as a wrong password and response times don't reveal which emails exist.
const DUMMY_HASH = "$2b$10$aDjsrZV4nTehISxjVeEtb.81cWY9DuLWSwUIfsEEpG1.iZfMrJCou";

/** Checks an email and password. Gives the same error for an unknown email and a wrong password. */
export async function authenticate(email: string, password: string) {
  const user = await findUserByEmail(email);
  const passwordOk = await compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }
  return { id: user.id, email: user.email, role: user.role };
}

/** The user behind a valid token. 401 if the account has since been deleted. */
export async function getCurrentUser(id: number) {
  const user = await findUserById(id);
  if (!user) throw new AppError(401, "UNAUTHENTICATED", "Log in to continue.");
  return user;
}
