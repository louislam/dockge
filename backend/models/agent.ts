import { BeanModel } from "redbean-node/dist/bean-model";
import { R } from "redbean-node";
import { LooseObject } from "../../common/util-common";

export class Agent extends BeanModel {

    static async getAgentList() : Promise<Record<string, Agent>> {
        let list = await R.findAll("agent") as Agent[];
        let result : Record<string, Agent> = {};
        for (let agent of list) {
            result[agent.endpoint] = agent;
        }
        return result;
    }

    get endpoint() : string {
        let obj = new URL(this.url);
        return obj.host;
    }

    toJSON() : LooseObject {
        return {
            url: this.url,
            username: this.username,
            endpoint: this.endpoint,
            name: this.name,
        };
    }

}

export default Agent;
