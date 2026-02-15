// apps/api/src/domain/ports/user-repository.ts
export type UserRole = "ADMIN" | "USER";

export type User = {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    isReviewer: boolean;
    archivedAt: Date | null;
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;
};

export type CreateUserInput = {
    email: string;
    name: string | null;
    role: UserRole;
    isReviewer?: boolean;
    archivedAt?: Date | null;
    passwordHash: string;
};

export interface UserRepository {
    countUsers(): Promise<number>;
    findByEmail(email: string): Promise<User | null>;
    create(input: CreateUserInput): Promise<User>;
}
