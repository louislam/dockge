import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Create the group table
    return knex.schema.createTable("group", (table) => {
        table.increments("id");
        table.string("name", 255).notNullable().unique();
        table.text("description");
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table.timestamp("updated_at").defaultTo(knex.fn.now());
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable("group");
}
