import { Pool } from 'pg';
const poolConfig = process.env.NEON_HOST
    ? {
        host: process.env.NEON_HOST,
        database: process.env.NEON_DATABASE,
        user: process.env.NEON_USER,
        password: process.env.NEON_DATABASE_PASSWORD,
        port: 5432,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    }
    : process.env.DATABASE_URL
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        }
        : {
            host: process.env.PGHOST,
            database: process.env.PGDATABASE,
            user: process.env.PGUSER,
            password: process.env.PGPASSWORD,
            port: Number(process.env.PGPORT) || 5432,
            ssl: { rejectUnauthorized: false },
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        };
const pool = new Pool(poolConfig);
pool.on('error', (err) => {
    console.error('[NeonDB] Unexpected pool error:', err.message);
});
export async function query(sql, params) {
    const client = await pool.connect();
    try {
        const result = await client.query(sql, params);
        return result.rows;
    }
    finally {
        client.release();
    }
}
export async function queryOne(sql, params) {
    const rows = await query(sql, params);
    return rows[0] ?? null;
}
export async function execute(sql, params) {
    const client = await pool.connect();
    try {
        const result = await client.query(sql, params);
        return result.rowCount ?? 0;
    }
    finally {
        client.release();
    }
}
export { pool };
console.log('✓ DB pool initialised');
