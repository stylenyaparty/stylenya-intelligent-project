import type { UserRepository } from "../../domain/ports/user-repository";
import { User } from "../../domain/entities/user";
import { UserRole } from "../../domain/enums/user-role";
import bcrypt from "bcryptjs";

export class SetupAlreadyCompletedError extends Error {
    constructor() {
        super("Initial setup already completed");
        this.name = "SetupAlreadyCompletedError";
    }
}

export class EmailAlreadyExistsError extends Error {
    constructor() {
        super("Email already exists");
        this.name = "EmailAlreadyExistsError";
    }
}

type Input = {
    email: string;
    name?: string;
    password: string;
};

type SafeUser = {
    id: string;
    email: string;
    name: string | null;
    role: "ADMIN" | "USER";
    createdAt: Date;
    updatedAt: Date;
};

type Output =
    | { created: true; user: SafeUser }
    | { created: false; reason: "SETUP_ALREADY_COMPLETED" | "EMAIL_ALREADY_EXISTS" };

export class CreateInitialAdminUseCase {
    constructor(private readonly users: UserRepository) { }

    async execute(input: Input): Promise<Output> {
        const usersCount = await this.users.countUsers();
        if (usersCount > 0) return { created: false, reason: "SETUP_ALREADY_COMPLETED" };

        const exists = await this.users.findByEmail(input.email);
        if (exists) return { created: false, reason: "EMAIL_ALREADY_EXISTS" };

        const passwordHash = await bcrypt.hash(input.password, 10);

        const createdUser = await this.users.create({
            email: input.email,
            name: input.name ?? null,
            role: "ADMIN",
            passwordHash,
        });

        const safeUser: SafeUser = {
            id: createdUser.id,
            email: createdUser.email,
            name: createdUser.name ?? null,
            role: createdUser.role,
            createdAt: createdUser.createdAt,
            updatedAt: createdUser.updatedAt,
        };

        return { created: true, user: safeUser };
    }
}
