export class AgentSocket {

    eventList : Map<string, (...args : unknown[]) => void> = new Map();

    on<TArgs extends unknown[]>(event : string, callback : (...args : TArgs) => void) {
        this.eventList.set(event, callback as (...args : unknown[]) => void);
    }

    call(eventName : string, ...args : unknown[]) {
        const callback = this.eventList.get(eventName);
        if (callback) {
            callback(...args);
        }
    }
}
