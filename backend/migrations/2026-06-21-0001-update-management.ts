import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("stack_setting", (table) => {
        table.string("stack_name", 255).notNullable();
        table.string("endpoint", 255).notNullable().defaultTo("");
        table.boolean("auto_update").notNullable().defaultTo(false);
        table.unique([ "stack_name", "endpoint" ]);
    });

    await knex.schema.createTable("update_history", (table) => {
        table.increments("id");
        table.string("stack_name", 255).notNullable();
        table.string("endpoint", 255).notNullable().defaultTo("");
        table.string("trigger_type", 50).notNullable();
        table.boolean("success").notNullable();
        table.text("output");
        table.text("error_message");
        table.string("started_at", 50).notNullable();
        table.string("completed_at", 50);
        table.integer("duration_ms");
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable("update_history");
    await knex.schema.dropTable("stack_setting");
}
