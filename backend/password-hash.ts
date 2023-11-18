import bcrypt from "bcryptjs";
import crypto from "crypto";
const saltRounds = 10;

/**
 * Hash a password
 * @param {string} password Password to hash
 * @returns {string} Hash
 */
export function generatePasswordHash(password : string) {
    return bcrypt.hashSync(password, saltRounds);
}

/**
 * Verify a password against a hash
 * @param {string} password Password to verify
 * @param {string} hash Hash to verify against
 * @returns {boolean} Does the password match the hash?
 */
export function verifyPassword(password : string, hash : string) {
    return bcrypt.compareSync(password, hash);
}

/**
 * Does the hash need to be rehashed?
 * @param {string} hash Hash to check
 * @returns {boolean} Needs to be rehashed?
 */
export function needRehashPassword(hash : string) : boolean {
    return false;
}

export const SHAKE256_LENGTH = 16;

/**
 * @param {string} data The data to be hashed
 * @param {number} len Output length of the hash
 * @returns {string} The hashed data in hex format
 */
export function shake256(data : string, len : number) {
    if (!data) {
        return "";
    }
    return crypto.createHash("shake256", { outputLength: len })
        .update(data)
        .digest("hex");
}
