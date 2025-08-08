import { createPool, type Pool, type QueryResult } from "mysql2/promise";

export class Database {
  private static pool: Pool;

  public static async getPool() {
    if (!this.pool) {
      this.pool = await createPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        database: process.env.DB_NAME,
      });
    }
    return this.pool;
  }

  public static async query<T extends QueryResult>(
    query: string,
    ...parameters: any[]
  ): Promise<T[]> {
    const pool = await this.getPool();
    const [rows] = await pool.query<T>(query, parameters);

    return rows as T[];
  }

  public static async execute<T extends QueryResult>(
    query: string,
    ...parameters: any[]
  ) {
    const pool = await this.getPool();
    const [rows] = await pool.execute<T>(query, parameters);

    return rows as T;
  }
}
