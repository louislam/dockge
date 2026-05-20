import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    const hasName = await knex.schema.hasColumn("agent", "name");

    if (!hasName) {
        await knex.schema.alterTable("agent", (table) => {
            table.string("name", 255);
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    const hasName = await knex.schema.hasColumn("agent", "name");

    if (hasName) {
        await knex.schema.alterTable("agent", (table) => {
            table.dropColumn("name");
        });
    }
}
