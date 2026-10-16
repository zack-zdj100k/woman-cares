import pg from "pg";

/** Direct access to the TEST database for setup and for reading emailed links. */
export function testDb() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/test/i.test(url)) throw new Error("TEST_DATABASE_URL must point to a test database.");
  return new pg.Client({ connectionString: url.replace(/\?schema=public$/, "") });
}

/** Returns the link from the newest queued email of a template sent to an address. */
export async function linkFromEmail(to: string, template: string) {
  const db = testDb();
  await db.connect();
  try {
    for (let i = 0; i < 20; i++) {
      const { rows } = await db.query(
        `SELECT payload FROM "OutboxEvent" WHERE payload->>'to' = $1 AND payload->>'template' = $2 ORDER BY "createdAt" DESC LIMIT 1`,
        [to, template],
      );
      if (rows[0]) return rows[0].payload.data.url as string;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`No ${template} email for ${to}`);
  } finally {
    await db.end();
  }
}
