import { UserRepository } from "../../domain/ports/user-repository";

export type BootstrapStatus = {
    usersCount: number;
    shouldShowInitialSetup: boolean;
};

export class GetBootstrapStatusUseCase {
    constructor(private readonly users: UserRepository) { }

    async execute(): Promise<BootstrapStatus> {
        const usersCount = await this.users.countUsers();

        return {
            usersCount,
            shouldShowInitialSetup: usersCount === 0
        };
    }
}