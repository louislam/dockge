import jwt from "jsonwebtoken";
import { R } from "redbean-node";
import { BeanModel } from "redbean-node/dist/bean-model";
import { generatePasswordHash, shake256, SHAKE256_LENGTH } from "../password-hash";

export class User extends BeanModel {
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
