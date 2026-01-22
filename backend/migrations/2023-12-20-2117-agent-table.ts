import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Create the user table
    return knex.schema.createTable("agent", (table) => {
        table.increments("id");
        table.string("url", 255).notNullable().unique();
        table.string("username", 255).notNullable();
        table.string("password", 255).notNullable();
        table.string("name", 255);
        table.boolean("active").notNullable().defaultTo(true);
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable("agent");
}
