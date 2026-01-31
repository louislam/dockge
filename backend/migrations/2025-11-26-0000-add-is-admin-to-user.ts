import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Add is_admin column to user table
    return knex.schema.alterTable("user", (table) => {
        table.boolean("is_admin").notNullable().defaultTo(false);
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.alterTable("user", (table) => {
        table.dropColumn("is_admin");
    });
}
