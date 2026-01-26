import bcrypt from "bcryptjs";

const FAKE_HASH =
    "$2a$10$0vvh1q1uJYQfQz2cQe8p6eYkS3hP1xHq9mVqZgq1rXQw7o3mX8t8u";

export async function hashPassword(plain: string) {
    return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string | null) {
    return bcrypt.compare(plain, hash ?? FAKE_HASH);
}
