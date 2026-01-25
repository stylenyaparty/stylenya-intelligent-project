// apps/api/src/domain/ports/user-repositories/user-repository.ts
import type { User } from "../entities/user";

export interface UserRepository {
    countUsers(): Promise<number>;
    findByEmail(email: string): Promise<User | null>;
    create(user: User): Promise<void>;
}