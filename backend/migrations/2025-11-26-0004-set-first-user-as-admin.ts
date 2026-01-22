import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Set the first user as admin (if exists)
    const firstUser = await knex("user").orderBy("id", "asc").first();
    if (firstUser) {
        await knex("user").where("id", firstUser.id).update({ is_admin: true });
    }
}

export async function down(knex: Knex): Promise<void> {
    // No need to revert this change
}
