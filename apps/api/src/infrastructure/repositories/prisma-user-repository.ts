import { prisma } from "../db/prisma";
import { UserRepository } from "../../domain/ports/user-repository";

export class PrismaUserRepository implements UserRepository {
    async countUsers(): Promise<number> {
        return prisma.user.count();
    }
}
