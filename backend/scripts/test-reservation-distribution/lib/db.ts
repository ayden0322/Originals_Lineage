/**
 * 直接連 PostgreSQL（platform_db）與 MySQL（endless_paradise）做驗證。
 */
import { Client } from 'pg';
import mysql from 'mysql2/promise';

// 自動判斷執行環境：容器內用 service name，host 端用 localhost
const INSIDE = process.env.INSIDE_DOCKER === '1' || !!process.env.POSTGRES_HOST;

export const PG_CONFIG = {
  host: INSIDE ? process.env.POSTGRES_HOST || 'postgres' : 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  user: process.env.POSTGRES_USER || 'platform_admin',
  password: process.env.POSTGRES_PASSWORD || 'changeme',
  database: process.env.POSTGRES_DB || 'platform_db',
};

export const MYSQL_CONFIG = {
  host: INSIDE ? 'mysql' : 'localhost',
  port: 3306,
  user: 'root',
  password: 'root',
  database: 'endless_paradise',
  charset: 'utf8mb4',
};

export async function pgQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = new Client(PG_CONFIG);
  await client.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows as T[];
  } finally {
    await client.end();
  }
}

export async function pgExec(sql: string, params: unknown[] = []): Promise<void> {
  const client = new Client(PG_CONFIG);
  await client.connect();
  try {
    await client.query(sql, params);
  } finally {
    await client.end();
  }
}

export async function mysqlQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const conn = await mysql.createConnection(MYSQL_CONFIG);
  try {
    const [rows] = await conn.execute(sql, params);
    return rows as T[];
  } finally {
    await conn.end();
  }
}

export async function mysqlExec(
  sql: string,
  params: unknown[] = [],
): Promise<void> {
  const conn = await mysql.createConnection(MYSQL_CONFIG);
  try {
    await conn.execute(sql, params);
  } finally {
    await conn.end();
  }
}
