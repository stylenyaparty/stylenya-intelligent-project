import type { UserRepository } from "../../domain/ports/user-repository";
import { User } from "../../domain/entities/user";
import { UserRole } from "../../domain/enums/user-role";

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
    name?: string | null;
};

type Output =
    | { created: true; user: ReturnType<User["toPrimitives"]> }
    | { created: false; reason: "SETUP_ALREADY_COMPLETED" | "EMAIL_ALREADY_EXISTS" };

export class CreateInitialAdminUseCase {
    constructor(private readonly users: UserRepository) { }

    async execute(input: Input): Promise<Output> {
        const usersCount = await this.users.countUsers();

        if (usersCount > 0) {
            return { created: false, reason: "SETUP_ALREADY_COMPLETED" };
        }

        const existing = await this.users.findByEmail(input.email);
        if (existing) {
            return { created: false, reason: "EMAIL_ALREADY_EXISTS" };
        }

        const admin = User.create({
            email: input.email,
            name: input.name ?? null,
            role: UserRole.ADMIN,
        });

        await this.users.create(admin);

        return {
            created: true,
            user: admin.toPrimitives(),
        };
    }
}
