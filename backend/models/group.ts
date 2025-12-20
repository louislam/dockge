import { R } from "redbean-node";
import { BeanModel } from "redbean-node/dist/bean-model";

export class Group extends BeanModel {
    /**
     * Get all groups
     * @returns {Promise<Group[]>}
     */
    static async getAll(): Promise<Group[]> {
        return await R.findAll("group", " ORDER BY name ASC ");
    }

    /**
     * Get a group by ID
     * @param {number} id
     * @returns {Promise<Group | null>}
     */
    static async getById(id: number): Promise<Group | null> {
        return await R.findOne("group", " id = ? ", [id]);
    }

    /**
     * Get a group by name
     * @param {string} name
     * @returns {Promise<Group | null>}
     */
    static async getByName(name: string): Promise<Group | null> {
        return await R.findOne("group", " name = ? ", [name]);
    }

    /**
     * Get all users in this group
     * @returns {Promise<any[]>}
     */
    async getUsers(): Promise<any[]> {
        return await R.getAll(`
            SELECT u.* FROM user u
            INNER JOIN user_group ug ON u.id = ug.user_id
            WHERE ug.group_id = ?
            ORDER BY u.username ASC
        `, [this.id]);
    }

    /**
     * Get all stacks assigned to this group
     * @returns {Promise<string[]>}
     */
    async getStacks(): Promise<string[]> {
        const rows = await R.getAll(`
            SELECT stack_name FROM stack_group
            WHERE group_id = ?
            ORDER BY stack_name ASC
        `, [this.id]);
        return rows.map((row: any) => row.stack_name);
    }

    /**
     * Add a user to this group
     * @param {number} userId
     * @returns {Promise<void>}
     */
    async addUser(userId: number): Promise<void> {
        const existing = await R.findOne("user_group", " user_id = ? AND group_id = ? ", [userId, this.id]);
        if (!existing) {
            await R.exec("INSERT INTO user_group (user_id, group_id) VALUES (?, ?)", [userId, this.id]);
        }
    }

    /**
     * Remove a user from this group
     * @param {number} userId
     * @returns {Promise<void>}
     */
    async removeUser(userId: number): Promise<void> {
        await R.exec("DELETE FROM user_group WHERE user_id = ? AND group_id = ?", [userId, this.id]);
    }

    /**
     * Add a stack to this group
     * @param {string} stackName
     * @returns {Promise<void>}
     */
    async addStack(stackName: string): Promise<void> {
        const existing = await R.findOne("stack_group", " stack_name = ? AND group_id = ? ", [stackName, this.id]);
        if (!existing) {
            await R.exec("INSERT INTO stack_group (stack_name, group_id) VALUES (?, ?)", [stackName, this.id]);
        }
    }

    /**
     * Remove a stack from this group
     * @param {string} stackName
     * @returns {Promise<void>}
     */
    async removeStack(stackName: string): Promise<void> {
        await R.exec("DELETE FROM stack_group WHERE stack_name = ? AND group_id = ?", [stackName, this.id]);
    }

    /**
     * Get all groups that a user belongs to
     * @param {number} userId
     * @returns {Promise<Group[]>}
     */
    static async getUserGroups(userId: number): Promise<Group[]> {
        return await R.getAll(`
            SELECT g.* FROM \`group\` g
            INNER JOIN user_group ug ON g.id = ug.group_id
            WHERE ug.user_id = ?
            ORDER BY g.name ASC
        `, [userId]);
    }

    /**
     * Get all groups that have access to a stack
     * @param {string} stackName
     * @returns {Promise<Group[]>}
     */
    static async getStackGroups(stackName: string): Promise<Group[]> {
        return await R.getAll(`
            SELECT g.* FROM \`group\` g
            INNER JOIN stack_group sg ON g.id = sg.group_id
            WHERE sg.stack_name = ?
            ORDER BY g.name ASC
        `, [stackName]);
    }

    /**
     * Check if a stack is assigned to any group
     * @param {string} stackName
     * @returns {Promise<boolean>}
     */
    static async isStackAssigned(stackName: string): Promise<boolean> {
        const result = await R.getRow(`
            SELECT COUNT(*) as count FROM stack_group
            WHERE stack_name = ?
        `, [stackName]);
        return result.count > 0;
    }

    /**
     * Get stack names accessible by a user (through their groups)
     * @param {number} userId
     * @returns {Promise<string[]>}
     */
    static async getAccessibleStacks(userId: number): Promise<string[]> {
        const rows = await R.getAll(`
            SELECT DISTINCT sg.stack_name FROM stack_group sg
            INNER JOIN user_group ug ON sg.group_id = ug.group_id
            WHERE ug.user_id = ?
            ORDER BY sg.stack_name ASC
        `, [userId]);
        return rows.map((row: any) => row.stack_name);
    }

    /**
     * Convert to JSON
     * @returns {Promise<object>}
     */
    async toJSON(): Promise<object> {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            created_at: this.created_at,
            updated_at: this.updated_at,
        };
    }
}

export default Group;
