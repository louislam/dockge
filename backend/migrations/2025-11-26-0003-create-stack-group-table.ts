import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Create the stack_group association table
    return knex.schema.createTable("stack_group", (table) => {
        table.increments("id");
        table.string("stack_name", 255).notNullable();
        table.integer("group_id").unsigned().notNullable();
        table.timestamp("created_at").defaultTo(knex.fn.now());
        
        // Foreign key to group
        table.foreign("group_id").references("id").inTable("group").onDelete("CASCADE");
        
        // Ensure unique stack-group pairs
        table.unique(["stack_name", "group_id"]);
        
        // Add index for faster lookups
        table.index("stack_name");
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable("stack_group");
}
