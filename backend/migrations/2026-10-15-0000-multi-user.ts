import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("user", (table) => {
        table.string("role", 20).notNullable().defaultTo("user");
        table.float("cpu_limit").notNullable().defaultTo(0);
        table.bigInteger("memory_limit").notNullable().defaultTo(0);
    });

    await knex("user")
        .where("id", knex("user").select("id").orderBy("id").first())
        .update("role", "admin");

    await knex.schema.createTable("stack_owner", (table) => {
        table.increments("id");
        table.string("endpoint", 255).notNullable().defaultTo("");
        table.string("stack_name", 255).notNullable();
        table.integer("user_id").notNullable();
        table.float("cpu").notNullable().defaultTo(0);
        table.bigInteger("memory").notNullable().defaultTo(0);
        table.boolean("cpu_complete").notNullable().defaultTo(false);
        table.boolean("memory_complete").notNullable().defaultTo(false);
        table.index("user_id");
        table.unique([ "endpoint", "stack_name" ]);
        table.foreign("user_id").references("user.id").onDelete("CASCADE");
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable("stack_owner");
    await knex.schema.alterTable("user", (table) => {
        table.dropColumn("role");
        table.dropColumn("cpu_limit");
        table.dropColumn("memory_limit");
    });
}
