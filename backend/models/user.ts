import jwt from "jsonwebtoken";
import { R } from "redbean-node";
import { BeanModel } from "redbean-node/dist/bean-model";
import { generatePasswordHash, shake256, SHAKE256_LENGTH } from "../password-hash";

export class User extends BeanModel {
    
    /**
     * Check if this user is an admin
     * @returns {boolean}
     */
    isAdmin(): boolean {
        // @ts-ignore
        return this.is_admin === true || this.is_admin === 1;
    }

    /**
     * Get all non-admin users
     * @returns {Promise<User[]>}
     */
    static async getAllUsers(): Promise<User[]> {
        return await R.findAll("user", " ORDER BY username ASC ");
    }

    /**
     * Get groups this user belongs to
     * @returns {Promise<any[]>}
     */
    async getGroups(): Promise<any[]> {
        return await R.getAll(`
            SELECT g.* FROM \`group\` g
            INNER JOIN user_group ug ON g.id = ug.group_id
            WHERE ug.user_id = ?
            ORDER BY g.name ASC
        `, [
            // @ts-ignore
            this.id
        ]);
    }

    /**
     * Get stacks accessible to this user (through groups)
     * @returns {Promise<string[]>}
     */
    async getAccessibleStacks(): Promise<string[]> {
        const rows = await R.getAll(`
            SELECT DISTINCT sg.stack_name FROM stack_group sg
            INNER JOIN user_group ug ON sg.group_id = ug.group_id
            WHERE ug.user_id = ?
            ORDER BY sg.stack_name ASC
        `, [
            // @ts-ignore
            this.id
        ]);
        return rows.map((row: any) => row.stack_name);
    }

    /**
     * Check if user has access to a specific stack
     * @param {string} stackName
     * @returns {Promise<boolean>}
     */
    async hasStackAccess(stackName: string): Promise<boolean> {
        if (this.isAdmin()) {
            return true;
        }
        const result = await R.getRow(`
            SELECT COUNT(*) as count FROM stack_group sg
            INNER JOIN user_group ug ON sg.group_id = ug.group_id
            WHERE ug.user_id = ? AND sg.stack_name = ?
        `, [
            // @ts-ignore
            this.id, 
            stackName
        ]);
        return result.count > 0;
    }
    /**
     * Reset user password
     * Fix #1510, as in the context reset-password.js, there is no auto model mapping. Call this static function instead.
     * @param {number} userID ID of user to update
     * @param {string} newPassword Users new password
     * @returns {Promise<void>}
     */
    static async resetPassword(userID : number, newPassword : string) {
        await R.exec("UPDATE `user` SET password = ? WHERE id = ? ", [
            generatePasswordHash(newPassword),
            userID
        ]);
    }

    /**
     * Reset this users password
     * @param {string} newPassword
     * @returns {Promise<void>}
     */
    async resetPassword(newPassword : string) {
        await User.resetPassword(this.id, newPassword);
        this.password = newPassword;
    }

    /**
     * Create a new JWT for a user
     * @param {User} user The User to create a JsonWebToken for
     * @param {string} jwtSecret The key used to sign the JsonWebToken
     * @returns {string} the JsonWebToken as a string
     */
    static createJWT(user : User, jwtSecret : string) {
        return jwt.sign({
            username: user.username,
            h: shake256(user.password, SHAKE256_LENGTH),
        }, jwtSecret);
    }

}

export default User;
