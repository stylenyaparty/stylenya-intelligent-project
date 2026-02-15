import type { UserRepository } from "../../domain/ports/user-repository";

import { verifyPassword } from "../../infrastructure/security/password";
import { signAccessToken } from "../../infrastructure/security/jwt";

export class InvalidCredentialsError extends Error {
    constructor() {
        super("Invalid credentials");
    }
}

export class AccountDisabledError extends Error {
    constructor() {
        super("Account disabled");
    }
}

export class LoginUserUseCase {
    constructor(private readonly users: UserRepository) { }

    async execute(input: { email: string; password: string }) {
        const email = input.email.trim().toLowerCase();

        const user = await this.users.findByEmail(email);

        const ok = await verifyPassword(input.password, user?.passwordHash ?? null);
        if (!user || !ok) throw new InvalidCredentialsError();
        if (user.archivedAt) throw new AccountDisabledError();

        const token = signAccessToken({
            sub: user.id,
            email: user.email,
            role: user.role,
        });

        return {
            token,
            user: { id: user.id, email: user.email, role: user.role },
        };
    }
}
