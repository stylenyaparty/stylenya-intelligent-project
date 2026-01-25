// apps/api/src/infrastructure/repositories/prisma-user-repository.ts
import { prisma } from "../db/prisma";
import type { UserRepository, CreateUserInput, User } from "../../domain/ports/user-repository";

export class PrismaUserRepository implements UserRepository {
    async countUsers(): Promise<number> {
        return prisma.user.count();
    }

    async findByEmail(email: string): Promise<User | null> {
        const u = await prisma.user.findUnique({ where: { email } });
        return u as User | null;
    }

    async create(input: CreateUserInput): Promise<User> {
        const u = await prisma.user.create({ data: input });
        return u as User;
    }
}

