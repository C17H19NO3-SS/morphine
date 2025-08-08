import bcrypt from "bcrypt";
import type { QueryResult, ResultSetHeader } from "mysql2";
import type { UserInterface, UserTokenInterface } from "../../types/types";
import { Database } from "./Database";
import jwt from "@elysiajs/jwt";

export class User {
  public static async findUserByUsername(
    username: string,
    password: boolean = false
  ): Promise<UserInterface | null> {
    const user = await Database.query<UserInterface & QueryResult>(
      password
        ? "SELECT id, username, email, password FROM users WHERE username = ?"
        : "SELECT id, username, email FROM users WHERE username = ?",
      username
    );

    if (user.length !== 1) return null;
    return user[0] as UserInterface;
  }

  public static async createUser(user: UserInterface) {
    const result = await Database.execute<ResultSetHeader>(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      user.username,
      user.email,
      bcrypt.hashSync(
        user.password as string,
        Number(process.env.BCRYPT_SALT_ROUND)
      )
    );

    return result.insertId;
  }
}
