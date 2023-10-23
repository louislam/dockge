/**
 * Limit Queue
 * The first element will be removed when the length exceeds the limit
 */
export class LimitQueue<T> extends Array<T> {
    __limit;
    __onExceed = null;

    constructor(limit: number) {
        super();
        this.__limit = limit;
    }

    push(value : T) {
        super.push(value);
        if (this.length > this.__limit) {
            const item = this.shift();
            if (this.__onExceed) {
                this.__onExceed(item);
            }
        }
    }

}
