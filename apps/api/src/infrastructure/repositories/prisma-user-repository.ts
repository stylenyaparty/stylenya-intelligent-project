// apps/api/src/infrastructure/repositories/prisma-user-repository.ts
import { prisma } from "../db/prisma.js";
import type { UserRepository, CreateUserInput, User } from "../../domain/ports/user-repository.js";

function toDomainUser(u: any): User {
    return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash: u.passwordHash,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
    };
}

export class PrismaUserRepository implements UserRepository {
    async countUsers(): Promise<number> {
        return prisma.user.count();
    }

    async findByEmail(email: string): Promise<User | null> {
        const u = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                passwordHash: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return u ? toDomainUser(u) : null;
    }

    async create(input: CreateUserInput): Promise<User> {
        const u = await prisma.user.create({
            data: input,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                passwordHash: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return toDomainUser(u);
    }
}
