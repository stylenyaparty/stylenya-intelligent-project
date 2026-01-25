import { UserRole } from "../enums/user-role";

export type UserProps = {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
};

export class User {
    private constructor(private readonly props: UserProps) { }

    static create(input: {
        email: string;
        name?: string | null;
        role: UserRole;
    }): User {
        return new User({
            id: crypto.randomUUID(),
            email: input.email.toLowerCase().trim(),
            name: input.name ?? null,
            role: input.role,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }

    static fromPersistence(props: UserProps): User {
        return new User(props);
    }

    // getters (opcional pero sano)
    get id() {
        return this.props.id;
    }
    get email() {
        return this.props.email;
    }
    get name() {
        return this.props.name;
    }
    get role() {
        return this.props.role;
    }

    /** 👇 ESTE ES EL FIX CLAVE */
    toPrimitives() {
        return { ...this.props };
    }
}
