export interface UserRepository {
    countUsers(): Promise<number>;
}