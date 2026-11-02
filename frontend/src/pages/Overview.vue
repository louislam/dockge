<template>
    <div class="overview">
        <h1>{{ $t(management ? 'quickLinks' : 'overview') }}</h1>
        <div v-if="error" class="alert alert-danger">{{ error }} <button class="btn btn-sm btn-outline-danger" @click="load">{{ $t('retry') }}</button></div>
        <div v-if="warning" class="alert alert-warning">{{ $t('dashboardCorrupt') }}</div>
        <template v-if="config">
            <div v-if="!management && config.settings.showStats" class="stats">
                <div class="shadow-box"><span>{{ $t('runningContainers') }}</span><strong>{{ runningContainers }}</strong></div>
                <div class="shadow-box"><span>{{ $t('onlineServices') }}</span><strong>{{ onlineServices }}</strong><small>{{ $t('stackStatusHint') }}</small></div>
                <div class="shadow-box"><span>{{ $t('shortcuts') }}</span><strong>{{ visibleLinks.length }}</strong></div>
            </div>
            <template v-if="management">
                <div class="toolbar">
                    <input v-model="search" class="form-control" :placeholder="$t('searchLinks')">
                    <button class="btn btn-primary" @click="editLink()">+ {{ $t('addService') }}</button>
                    <button class="btn btn-normal" @click="addGroup">+ {{ $t('addGroup') }}</button>
                    <button class="btn btn-normal" @click="showSettings = !showSettings">{{ $t('dashboardSettings') }}</button>
                </div>
                <div v-if="showSettings" class="shadow-box settings">
                    <h2>{{ $t('dashboardSettings') }}</h2>
                    <label v-for="key in ['showStats', 'showUrls', 'showStackUrls', 'showOffline', 'defaultOpenInNewTab']" :key="key" class="setting"><input v-model="config.settings[key]" type="checkbox"> {{ $t(key) }}</label>
                    <label class="setting">{{ $t('cardSize') }} <select v-model="config.settings.cardSize" class="form-select"><option value="small">{{ $t('small') }}</option><option value="medium">{{ $t('medium') }}</option><option value="large">{{ $t('large') }}</option></select></label>
                    <label class="setting">{{ $t('columns') }} <select v-model="config.settings.columns" class="form-select"><option value="auto">{{ $t('auto') }}</option><option v-for="n in 6" :key="n" :value="n">{{ n }}</option></select></label>
                    <button class="btn btn-primary" @click="save">{{ $t('Save') }}</button>
                </div>
            </template>
            <section v-for="group in sortedGroups" :key="group.id" class="group" :class="{ disabled: !group.enabled }" @dragover.prevent @drop.prevent="drop(group.id)">
                <div class="group-heading">
                    <h2>{{ group.name === 'localServices' ? $t('localServices') : group.name }}</h2>
                    <div v-if="management" class="actions">
                        <button class="btn btn-sm btn-normal" @click="moveGroup(group, -1)">↑</button><button class="btn btn-sm btn-normal" @click="moveGroup(group, 1)">↓</button>
                        <button class="btn btn-sm btn-normal" @click="renameGroup(group)">{{ $t('Edit') }}</button>
                        <button class="btn btn-sm btn-normal" @click="group.enabled = !group.enabled; save()">{{ $t(group.enabled ? 'disable' : 'enable') }}</button>
                        <button class="btn btn-sm btn-danger" @click="deleteGroup(group)">{{ $t('Delete') }}</button>
                    </div>
                    <button v-else class="btn btn-sm btn-normal" @click="editLink(null, group.id)">+</button>
                </div>
                <div class="cards" :style="gridStyle">
                    <div v-for="link in groupLinks(group.id)" :key="link.id" class="card-wrap" :class="{ disabled: link.enabled === false || link.hidden }" :draggable="management && link.source !== 'builtin'" @dragstart="dragId = link.id" @dragover.prevent @drop.stop.prevent="drop(group.id, link.id)">
                        <a class="service-card shadow-box" :href="link.url" :target="link.openInNewTab === false ? '_self' : '_blank'" rel="noopener noreferrer">
                            <span class="service-icon">{{ iconFor(link.icon) }}</span>
                            <strong>{{ link.name }}</strong>
                            <small v-if="config.settings.showUrls">{{ displayUrl(link.url) }}</small>
                            <small v-if="link.description">{{ link.description }}</small>
                            <small v-if="link.source === 'stack'">{{ link.endpoint || 'local' }} · {{ $t(link.status === 'online' ? 'running' : link.status === 'offline' ? 'offline' : 'unknown') }}</small>
                        </a>
                        <div v-if="management && link.source !== 'builtin'" class="card-actions">
                            <button class="btn btn-sm btn-normal" @click="editLink(link)">{{ $t('Edit') }}</button>
                            <button class="btn btn-sm btn-normal" @click="toggleLink(link)">{{ $t(link.enabled === false || link.hidden ? 'enable' : 'disable') }}</button>
                            <button class="btn btn-sm btn-normal" @click="copyUrl(link.url)">{{ $t('copyUrl') }}</button>
                            <button v-if="link.source === 'manual'" class="btn btn-sm btn-danger" @click="deleteLink(link)">{{ $t('Delete') }}</button>
                            <router-link v-else class="btn btn-sm btn-normal" :to="stackRoute(link)">{{ $t('dockerManagement') }}</router-link>
                        </div>
                    </div>
                    <button v-if="!management" class="service-card add-card shadow-box" @click="editLink(null, group.id)"><span class="service-icon">+</span>{{ $t('addService') }}</button>
                </div>
            </section>
            <div v-if="editing" class="dialog-backdrop" @click.self="editing = null">
                <form class="dialog shadow-box" @submit.prevent="saveLink">
                    <h2>{{ $t(editing.id ? 'editService' : 'addService') }}</h2>
                    <label>{{ $t('serviceName') }} <input v-model.trim="editing.name" class="form-control" maxlength="100" required></label>
                    <label v-if="editing.source !== 'stack'">URL <input v-model.trim="editing.url" class="form-control" type="url" required placeholder="http://"></label>
                    <label>{{ $t('icon') }} <select v-model="editing.icon" class="form-select"><option v-for="icon in icons" :key="icon" :value="icon">{{ icon }}</option></select></label>
                    <label>{{ $t('group') }} <select v-model="editing.groupId" class="form-select"><option v-for="g in sortedGroups" :key="g.id" :value="g.id">{{ g.name === 'localServices' ? $t('localServices') : g.name }}</option></select></label>
                    <label v-if="editing.source !== 'stack'">{{ $t('description') }} <input v-model="editing.description" class="form-control" maxlength="500"></label>
                    <label v-if="editing.source !== 'stack'"><input v-model="editing.openInNewTab" type="checkbox"> {{ $t('openInNewTab') }}</label>
                    <div v-if="formError" class="text-danger">{{ formError }}</div>
                    <div><button type="button" class="btn btn-normal me-2" @click="editing = null">{{ $t('Cancel') }}</button><button class="btn btn-primary">{{ $t('Save') }}</button></div>
                </form>
            </div>
        </template>
    </div>
</template>

<script>
import { RUNNING, EXITED } from "../../../common/util-common";

export default {
    props: { management: { type: Boolean,
        default: false } },
    data() {
        return { config: null,
            warning: false,
            error: "",
            formError: "",
            editing: null,
            search: "",
            showSettings: false,
            dragId: null,
            stackData: {},
            generation: 0,
            icons: [ "link", "server", "router", "database", "video", "chart", "globe", "terminal", "folder", "settings", "docker" ] };
    },
    computed: {
        sortedGroups() {
            return [ ...this.config.groups ].filter(g => this.management || g.enabled).sort((a, b) => a.order - b.order);
        },
        allLinks() {
            const c = this.config;
            const builtin = { id: "builtin:dockge",
                name: "Dockge",
                url: window.location.origin,
                groupId: c.groups[0].id,
                order: -1,
                icon: "docker",
                source: "builtin",
                openInNewTab: c.settings.defaultOpenInNewTab };
            const stackLinks = Object.values(this.stackData).flatMap(item => item.links || []).map(link => {
                const override = c.stackLinkOverrides[link.id] || {};
                return { ...link,
                    groupId: override.groupId || c.groups[0].id,
                    order: override.order ?? 1000,
                    icon: override.icon || "server",
                    name: override.displayName || link.name,
                    hidden: override.hidden || false,
                    openInNewTab: c.settings.defaultOpenInNewTab };
            });
            return [ builtin, ...c.manualLinks, ...(c.settings.showStackUrls || this.management ? stackLinks : []) ];
        },
        visibleLinks() {
            const groups = new Set(this.config.groups.filter(g => g.enabled).map(g => g.id));
            return this.allLinks.filter(l => groups.has(l.groupId) && l.enabled !== false && !l.hidden && (l.source !== "stack" || (this.config.settings.showStackUrls && (this.config.settings.showOffline || l.status !== "offline"))));
        },
        onlineServices() {
            return this.visibleLinks.filter(l => l.source === "stack" && l.status === "online").length;
        },
        runningContainers() {
            return Object.values(this.stackData).reduce((sum, item) => sum + (item.runningContainers || 0), 0);
        },
        gridStyle() {
            const s = this.config.settings;
            return { gridTemplateColumns: s.columns === "auto" ? `repeat(auto-fill, minmax(${ { small: 160,
                medium: 220,
                large: 280 }[s.cardSize] }px, 1fr))` : `repeat(auto-fit, minmax(min(100%, ${Math.max(150, Math.floor(1000 / s.columns))}px), 1fr))` };
        },
    },
    watch: { "$root.completeStackList": { handler() {
        this.refreshStacks();
    },
    deep: true } },
    mounted() {
        this.showSettings = this.$route.query.settings === "1";
        this.load();
        this.$root.getSocket().on("dashboard:changed", this.load);
        this.refreshStacks();
    },
    beforeUnmount() {
        this.generation++;
        this.$root.getSocket().off("dashboard:changed", this.load);
    },
    methods: {
        newId() {
            const bytes = new Uint8Array(16);
            crypto.getRandomValues(bytes);
            return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
        },
        load() {
            this.$root.getSocket().emit("dashboard:get", res => {
                if (res.ok) {
                    this.config = res.config;
                    this.warning = res.warning;
                    this.error = "";
                } else {
                    this.error = res.msg || this.$t("dashboardLoadFailed");
                }
            });
        },
        save() {
            if (this.warning) {
                this.error = this.$t("dashboardCorrupt");
                return;
            }
            this.$root.getSocket().emit("dashboard:saveConfig", JSON.parse(JSON.stringify(this.config)), res => {
                if (!res.ok) {
                    this.error = res.msg;
                } else {
                    this.error = "";
                }
            });
        },
        refreshStacks() {
            const generation = ++this.generation;
            const data = {};
            for (const stack of Object.values(this.$root.completeStackList)) {
                if (!stack.isManagedByDockge) {
                    continue;
                }
                const key = `${stack.endpoint || ""}/${stack.name}`;
                this.$root.emitAgent(stack.endpoint || "", "dashboard:stack", stack.name, res => {
                    if (generation !== this.generation || !res.ok) {
                        return;
                    }
                    const status = stack.status === RUNNING ? "online" : stack.status === EXITED ? "offline" : "unknown";
                    data[key] = { links: res.links.map(link => ({ ...link,
                        status })),
                    runningContainers: res.runningContainers };
                    this.stackData = { ...data };
                });
            }
            this.stackData = data;
        },
        groupLinks(id) {
            const links = this.management ? this.allLinks : this.visibleLinks;
            return links.filter(l => l.groupId === id && (!this.search || `${l.name} ${l.url}`.toLowerCase().includes(this.search.toLowerCase()))).sort((a, b) => a.order - b.order);
        },
        editLink(link = null, groupId = null) {
            this.formError = "";
            this.editing = link ? { ...link } : { name: "",
                url: "",
                icon: "link",
                description: "",
                groupId: groupId || this.config.groups[0].id,
                openInNewTab: this.config.settings.defaultOpenInNewTab,
                source: "manual" };
        },
        saveLink() {
            const l = this.editing;
            if (!l.name.trim()) {
                this.formError = this.$t("serviceName");
                return;
            }
            if (l.source === "stack") {
                this.config.stackLinkOverrides[l.id] = { ...(this.config.stackLinkOverrides[l.id] || {}),
                    displayName: l.name,
                    groupId: l.groupId,
                    icon: l.icon };
            } else {
                try {
                    const u = new URL(l.url);
                    if (![ "http:", "https:" ].includes(u.protocol) || u.username || u.password) {
                        throw new Error();
                    }
                } catch {
                    this.formError = this.$t("invalidDashboardUrl");
                    return;
                }
                if (l.id) {
                    Object.assign(this.config.manualLinks.find(x => x.id === l.id), l);
                } else {
                    this.config.manualLinks.push({ ...l,
                        id: `manual:${this.newId()}`,
                        enabled: true,
                        order: Date.now() });
                }
            }
            this.editing = null;
            this.save();
        },
        toggleLink(l) {
            if (l.source === "stack") {
                const o = this.config.stackLinkOverrides[l.id] ||= {};
                o.hidden = !l.hidden;
            } else {
                l.enabled = !l.enabled;
            }
            this.save();
        },
        deleteLink(l) {
            if (window.confirm(this.$t("confirmDeleteService"))) {
                this.config.manualLinks = this.config.manualLinks.filter(x => x.id !== l.id);
                this.save();
            }
        },
        addGroup() {
            const name = window.prompt(this.$t("groupName"));
            if (name?.trim()) {
                this.config.groups.push({ id: `group:${this.newId()}`,
                    name: name.trim().slice(0, 100),
                    order: Date.now(),
                    enabled: true });
                this.save();
            }
        },
        renameGroup(g) {
            const name = window.prompt(this.$t("groupName"), g.name === "localServices" ? this.$t("localServices") : g.name);
            if (name?.trim()) {
                g.name = name.trim().slice(0, 100);
                this.save();
            }
        },
        deleteGroup(g) {
            if (this.config.groups.length === 1) {
                this.error = this.$t("lastGroup");
                return;
            }
            if (!window.confirm(this.$t("confirmDeleteGroup"))) {
                return;
            }
            const target = this.config.groups.find(x => x.id !== g.id).id;
            this.config.manualLinks.forEach(l => {
                if (l.groupId === g.id) {
                    l.groupId = target;
                }
            });
            Object.values(this.config.stackLinkOverrides).forEach(o => {
                if (o.groupId === g.id) {
                    o.groupId = target;
                }
            });
            this.config.groups = this.config.groups.filter(x => x.id !== g.id);
            this.save();
        },
        moveGroup(g, direction) {
            const groups = this.sortedGroups;
            const i = groups.indexOf(g);
            const j = i + direction;
            if (j < 0 || j >= groups.length) {
                return;
            }
            [ groups[i], groups[j] ] = [ groups[j], groups[i] ];
            groups.forEach((x, n) => {
                x.order = n;
            });
            this.save();
        },
        drop(groupId, targetId) {
            const l = this.allLinks.find(x => x.id === this.dragId);
            this.dragId = null;
            if (!l || l.source === "builtin") {
                return;
            }
            const links = this.groupLinks(groupId).filter(x => x.id !== l.id && x.source !== "builtin");
            const index = links.findIndex(x => x.id === targetId);
            links.splice(index < 0 ? links.length : index, 0, l);
            links.forEach((item, i) => {
                if (item.source === "stack") {
                    Object.assign(this.config.stackLinkOverrides[item.id] ||= {}, { groupId,
                        order: i });
                } else {
                    item.groupId = groupId;
                    item.order = i;
                }
            });
            this.save();
        },
        copyUrl(url) {
            navigator.clipboard.writeText(url).catch(() => {
                this.error = this.$t("copyFailed");
            });
        },
        displayUrl(url) {
            try {
                const u = new URL(url);
                return u.host + (u.pathname === "/" ? "" : u.pathname) + u.search;
            } catch {
                return url;
            }
        },
        iconFor(icon) {
            return ({ docker: "◈",
                server: "▣",
                router: "⌁",
                database: "▤",
                video: "▶",
                chart: "▥",
                globe: "◎",
                terminal: "⌘",
                folder: "▰",
                settings: "⚙",
                link: "↗" })[icon] || "↗";
        },
        stackRoute(l) {
            return `/compose/${encodeURIComponent(l.stackName)}${l.endpoint ? "/" + encodeURIComponent(l.endpoint) : ""}`;
        },
    },
};
</script>

<style scoped>
.overview { max-width: 1500px; margin: auto; padding: 1rem; }
.stats, .cards { display: grid; gap: 1rem; }
.stats { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin: 1.5rem 0 2rem; }
.stats > div { padding: 1.4rem; display: flex; flex-direction: column; gap: .4rem; }
.stats strong { font-size: 2rem; }.stats small { opacity: .65; }
.group { margin: 2rem 0; }.group-heading { display: flex; justify-content: space-between; align-items: center; gap: .5rem; flex-wrap: wrap; margin-bottom: 1rem; }.group-heading h2 { margin: 0; }
.service-card { display: flex; width: 100%; min-height: 170px; padding: 1.2rem; flex-direction: column; justify-content: center; align-items: center; gap: .45rem; color: inherit; text-decoration: none; transition: transform .15s; overflow: hidden; }.service-card:hover { transform: translateY(-3px); color: inherit; }.service-card strong, .service-card small { max-width: 100%; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }.service-card small { opacity: .65; }.service-icon { font-size: 2rem; }.add-card { border: 1px dashed #888; background: transparent; color: inherit; }.disabled { opacity: .5; }.toolbar, .actions, .card-actions { display: flex; gap: .4rem; flex-wrap: wrap; }.toolbar .form-control { max-width: 260px; }.card-actions { margin-top: .4rem; }.settings { padding: 1.5rem; margin-top: 1rem; }.setting { display: inline-block; margin: .5rem 1rem .5rem 0; }.dialog-backdrop { position: fixed; z-index: 2000; inset: 0; background: #0009; display: flex; justify-content: center; align-items: center; padding: 1rem; }.dialog { width: min(100%, 500px); padding: 1.5rem; background: var(--bs-body-bg); max-height: 95vh; overflow: auto; }.dialog label { display: block; margin: .8rem 0; }
</style>
