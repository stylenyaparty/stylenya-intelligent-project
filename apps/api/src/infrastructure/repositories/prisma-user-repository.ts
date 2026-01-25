// apps/api/src/infrastructure/repositories/prisma-user-repository.ts
import { prisma } from "../db/prisma";
import type { UserRepository } from "../../domain/ports/user-repository";
import { User } from "../../domain/entities/user";
import { UserRole } from "../../domain/enums/user-role";

export class PrismaUserRepository implements UserRepository {
    async countUsers(): Promise<number> {
        return prisma.user.count();
    }

    async findByEmail(email: string): Promise<User | null> {
        const row = await prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() },
        });

        if (!row) return null;

        return User.fromPersistence({
            id: row.id,
            email: row.email,
            name: row.name,
            role: row.role as UserRole,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        });
    }

    async create(user: User): Promise<void> {
        await prisma.user.create({
            data: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
        });
    }
}

