import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Create the user_group association table
    return knex.schema.createTable("user_group", (table) => {
        table.increments("id");
        table.integer("user_id").unsigned().notNullable();
        table.integer("group_id").unsigned().notNullable();
        table.timestamp("created_at").defaultTo(knex.fn.now());
        
        // Foreign keys
        table.foreign("user_id").references("id").inTable("user").onDelete("CASCADE");
        table.foreign("group_id").references("id").inTable("group").onDelete("CASCADE");
        
        // Ensure unique user-group pairs
        table.unique(["user_id", "group_id"]);
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable("user_group");
}
