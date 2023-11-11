import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Create the user table
    return knex.schema.createTable("user", (table) => {
        table.increments("id");
        table.string("username", 255).notNullable().unique().collate("utf8_general_ci");
        table.string("password", 255);
        table.boolean("active").notNullable().defaultTo(true);
        table.string("timezone", 150);
        table.string("twofa_secret", 64);
        table.boolean("twofa_status").notNullable().defaultTo(false);
        table.string("twofa_last_token", 6);
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable("user");
}
