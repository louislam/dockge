// Generate on GitHub
const input = `
* Fixed envsubst issue by @louislam in https://github.com/louislam/dockge/pull/301
* Fix: Only adding folders to stack with a compose file. by @Ozy-Viking in https://github.com/louislam/dockge/pull/299
* Terminal text cols adjusts to terminal container.  by @Ozy-Viking in https://github.com/louislam/dockge/pull/285
* Update Docker Dompose plugin to 2.23.3 by @louislam in https://github.com/louislam/dockge/pull/303
* Translations update from Kuma Weblate by @UptimeKumaBot in https://github.com/louislam/dockge/pull/302
`;

const template = `

> [!WARNING]
>

### 🆕 New Features
-

### ⬆️ Improvements
-

### 🐛 Bug Fixes
-

### 🦎 Translation Contributions
-

### ⬆️ Security Fixes
-

### Others
- Other small changes, code refactoring and comment/doc updates in this repo:
- 

Please let me know if your username is missing, if your pull request has been merged in this version, or your commit has been included in one of the pull requests.
`;

const lines = input.split("\n").filter((line) => line.trim() !== "");

for (const line of lines) {
    // Split the last " by "
    const usernamePullRequesURL = line.split(" by ").pop();

    if (!usernamePullRequesURL) {
        console.log("Unable to parse", line);
        continue;
    }

    const [ username, pullRequestURL ] = usernamePullRequesURL.split(" in ");
    const pullRequestID = "#" + pullRequestURL.split("/").pop();
    let message = line.split(" by ").shift();

    if (!message) {
        console.log("Unable to parse", line);
        continue;
    }

    message = message.split("* ").pop();

    let thanks = "";
    if (username != "@louislam") {
        thanks = `(Thanks ${username})`;
    }

    console.log(pullRequestID, message, thanks);
}
console.log(template);
