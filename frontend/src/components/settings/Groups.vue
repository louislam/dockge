<template>
    <div>
        <p class="my-4">{{ $t("Manage groups and assign users and stacks to them.") }}</p>

        <div class="mb-3">
            <button class="btn btn-primary" @click="showCreateModal = true">
                <font-awesome-icon icon="plus" /> {{ $t("Create Group") }}
            </button>
        </div>

        <table class="table table-hover">
            <thead>
                <tr>
                    <th>{{ $t("Group Name") }}</th>
                    <th>{{ $t("Description") }}</th>
                    <th>{{ $t("Users") }}</th>
                    <th>{{ $t("Stacks") }}</th>
                    <th>{{ $t("Actions") }}</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="group in groups" :key="group.id">
                    <td>{{ group.name }}</td>
                    <td>{{ group.description || $t("No description") }}</td>
                    <td>
                        <span class="badge bg-secondary">{{ group.users.length }} {{ $t("users") }}</span>
                    </td>
                    <td>
                        <span class="badge bg-secondary">{{ group.stacks.length }} {{ $t("stacks") }}</span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-primary me-1" @click="manageGroup(group)">
                            <font-awesome-icon icon="cog" /> {{ $t("Manage") }}
                        </button>
                        <button class="btn btn-sm btn-primary me-1" @click="editGroup(group)">
                            <font-awesome-icon icon="edit" /> {{ $t("Edit") }}
                        </button>
                        <button class="btn btn-sm btn-danger" @click="confirmDeleteGroup(group)">
                            <font-awesome-icon icon="trash" /> {{ $t("Delete") }}
                        </button>
                    </td>
                </tr>
                <tr v-if="!groups || groups.length === 0">
                    <td colspan="5" class="text-center text-muted">{{ $t("No groups found") }}</td>
                </tr>
            </tbody>
        </table>

        <!-- Create Group Modal -->
        <div v-if="showCreateModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5)">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">{{ $t("Create Group") }}</h5>
                        <button type="button" class="btn-close" @click="showCreateModal = false"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">{{ $t("Group Name") }}</label>
                            <input v-model="newGroup.name" type="text" class="form-control" required />
                        </div>
                        <div class="mb-3">
                            <label class="form-label">{{ $t("Description") }}</label>
                            <textarea v-model="newGroup.description" class="form-control" rows="3"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" @click="showCreateModal = false">{{ $t("Cancel") }}</button>
                        <button type="button" class="btn btn-primary" @click="createGroup">{{ $t("Create") }}</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Edit Group Modal -->
        <div v-if="showEditModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5)">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">{{ $t("Edit Group") }}</h5>
                        <button type="button" class="btn-close" @click="showEditModal = false"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">{{ $t("Group Name") }}</label>
                            <input v-model="editingGroup.name" type="text" class="form-control" required />
                        </div>
                        <div class="mb-3">
                            <label class="form-label">{{ $t("Description") }}</label>
                            <textarea v-model="editingGroup.description" class="form-control" rows="3"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" @click="showEditModal = false">{{ $t("Cancel") }}</button>
                        <button type="button" class="btn btn-primary" @click="updateGroup">{{ $t("Save") }}</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Manage Group Modal (Users and Stacks) -->
        <div v-if="showManageModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5)">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">{{ $t("Manage Group") }}: {{ managingGroup.name }}</h5>
                        <button type="button" class="btn-close" @click="showManageModal = false"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h6>{{ $t("Users in Group") }}</h6>
                                <div class="mb-3">
                                    <select v-model="selectedUserId" class="form-select">
                                        <option :value="null">{{ $t("Select a user to add") }}</option>
                                        <option v-for="user in availableUsers" :key="user.id" :value="user.id">
                                            {{ user.username }}
                                        </option>
                                    </select>
                                    <button class="btn btn-sm btn-primary mt-2" @click="addUserToGroup" :disabled="!selectedUserId">
                                        <font-awesome-icon icon="plus" /> {{ $t("Add User") }}
                                    </button>
                                </div>
                                <ul class="list-group">
                                    <li v-for="user in managingGroup.users" :key="user.id" class="list-group-item d-flex justify-content-between align-items-center">
                                        {{ user.username }}
                                        <button class="btn btn-sm btn-danger" @click="removeUserFromGroup(user.id)">
                                            <font-awesome-icon icon="times" />
                                        </button>
                                    </li>
                                    <li v-if="!managingGroup.users || managingGroup.users.length === 0" class="list-group-item text-muted">
                                        {{ $t("No users in this group") }}
                                    </li>
                                </ul>
                            </div>
                            <div class="col-md-6">
                                <h6>{{ $t("Stacks Assigned to Group") }}</h6>
                                <div class="mb-3">
                                    <select v-model="selectedStackName" class="form-select">
                                        <option :value="null">{{ $t("Select a stack to add") }}</option>
                                        <option v-for="stack in availableStacks" :key="stack" :value="stack">
                                            {{ getStackDisplayName(stack) }}
                                        </option>
                                    </select>
                                    <button class="btn btn-sm btn-primary mt-2" @click="addStackToGroup" :disabled="!selectedStackName">
                                        <font-awesome-icon icon="plus" /> {{ $t("Add Stack") }}
                                    </button>
                                </div>
                                <ul class="list-group">
                                    <li v-for="stack in managingGroup.stacks" :key="stack" class="list-group-item d-flex justify-content-between align-items-center">
                                        {{ getStackDisplayName(stack) }}
                                        <button class="btn btn-sm btn-danger" @click="removeStackFromGroup(stack)">
                                            <font-awesome-icon icon="times" />
                                        </button>
                                    </li>
                                    <li v-if="!managingGroup.stacks || managingGroup.stacks.length === 0" class="list-group-item text-muted">
                                        {{ $t("No stacks assigned to this group") }}
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" @click="showManageModal = false">{{ $t("Close") }}</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Delete Confirmation Modal -->
        <Confirm ref="confirmDelete" btn-style="btn-danger" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="deleteGroup">
            <template #body>
                {{ $t("Are you sure you want to delete this group?") }}
            </template>
        </Confirm>
    </div>
</template>

<script>
import Confirm from "../Confirm.vue";

export default {
    components: {
        Confirm,
    },
    data() {
        return {
            groups: [],
            users: [],
            stacks: [],
            showCreateModal: false,
            showEditModal: false,
            showManageModal: false,
            newGroup: {
                name: "",
                description: "",
            },
            editingGroup: {},
            managingGroup: {},
            selectedUserId: null,
            selectedStackName: null,
            groupToDelete: null,
        };
    },
    computed: {
        availableUsers() {
            if (!this.managingGroup.users) return this.users;
            const groupUserIds = this.managingGroup.users.map(u => u.id);
            return this.users.filter(u => !groupUserIds.includes(u.id));
        },
        availableStacks() {
            if (!this.managingGroup.stacks) return this.stacks;
            return this.stacks.filter(s => !this.managingGroup.stacks.includes(s));
        },
    },
    mounted() {
        // Check if user is admin, redirect if not
        if (!this.$root.info || !this.$root.info.isAdmin) {
            this.$router.push("/settings/appearance");
            return;
        }
        this.loadGroups();
        this.loadUsers();
        this.loadStacks();
    },
    methods: {
        loadGroups() {
            this.$root.getSocket().emit("getGroupList", (res) => {
                if (res.ok) {
                    this.groups = res.groups;
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },
        loadUsers() {
            this.$root.getSocket().emit("getUserList", (res) => {
                if (res.ok) {
                    this.users = res.users;
                }
            });
        },
        loadStacks() {
            // Get complete stack list from $root (includes local and agent stacks)
            if (this.$root.completeStackList) {
                this.stacks = Object.keys(this.$root.completeStackList).map(key => {
                    // Extract the stack name with endpoint suffix
                    // Format: stackName_ (local) or stackName_endpoint (agent)
                    return key;
                });
            }
        },
        getStackDisplayName(stackKey) {
            // stackKey format: "stackName_" (local) or "stackName_endpoint" (agent)
            const parts = stackKey.split('_');
            const stackName = parts.slice(0, -1).join('_') || parts[0];
            const endpoint = parts[parts.length - 1];
            
            if (!endpoint || endpoint === '') {
                // Local stack
                return `${stackName} (${this.$t("currentEndpoint")})`;
            } else {
                // Agent stack
                return `${stackName} (${endpoint})`;
            }
        },
        createGroup() {
            if (!this.newGroup.name) {
                this.$root.toastError(this.$t("Group name is required"));
                return;
            }
            
            this.$root.getSocket().emit("createGroup", this.newGroup, (res) => {
                if (res.ok) {
                    this.$root.toastSuccess(res.msg);
                    this.showCreateModal = false;
                    this.newGroup = { name: "", description: "" };
                    this.loadGroups();
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },
        editGroup(group) {
            this.editingGroup = {
                id: group.id,
                name: group.name,
                description: group.description,
            };
            this.showEditModal = true;
        },
        updateGroup() {
            this.$root.getSocket().emit("updateGroup", this.editingGroup.id, {
                name: this.editingGroup.name,
                description: this.editingGroup.description,
            }, (res) => {
                if (res.ok) {
                    this.$root.toastSuccess(res.msg);
                    this.showEditModal = false;
                    this.loadGroups();
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },
        manageGroup(group) {
            this.managingGroup = { ...group };
            this.selectedUserId = null;
            this.selectedStackName = null;
            this.showManageModal = true;
        },
        addUserToGroup() {
            if (!this.selectedUserId) return;
            
            this.$root.getSocket().emit("addUserToGroup", this.selectedUserId, this.managingGroup.id, (res) => {
                if (res.ok) {
                    this.$root.toastSuccess(res.msg);
                    this.selectedUserId = null;
                    // Reload groups and then update the managing group
                    this.$root.getSocket().emit("getGroupList", (groupRes) => {
                        if (groupRes.ok) {
                            this.groups = groupRes.groups;
                            // Update the managing group data
                            const updatedGroup = this.groups.find(g => g.id === this.managingGroup.id);
                            if (updatedGroup) {
                                this.managingGroup = { ...updatedGroup };
                            }
                        }
                    });
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },
        removeUserFromGroup(userId) {
            this.$root.getSocket().emit("removeUserFromGroup", userId, this.managingGroup.id, (res) => {
                if (res.ok) {
                    this.$root.toastSuccess(res.msg);
                    // Reload groups and then update the managing group
                    this.$root.getSocket().emit("getGroupList", (groupRes) => {
                        if (groupRes.ok) {
                            this.groups = groupRes.groups;
                            // Update the managing group data
                            const updatedGroup = this.groups.find(g => g.id === this.managingGroup.id);
                            if (updatedGroup) {
                                this.managingGroup = { ...updatedGroup };
                            }
                        }
                    });
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },
        addStackToGroup() {
            if (!this.selectedStackName) return;
            
            this.$root.getSocket().emit("assignStackToGroup", this.selectedStackName, this.managingGroup.id, (res) => {
                if (res.ok) {
                    this.$root.toastSuccess(res.msg);
                    this.selectedStackName = null;
                    // Reload groups and then update the managing group
                    this.$root.getSocket().emit("getGroupList", (groupRes) => {
                        if (groupRes.ok) {
                            this.groups = groupRes.groups;
                            // Update the managing group data
                            const updatedGroup = this.groups.find(g => g.id === this.managingGroup.id);
                            if (updatedGroup) {
                                this.managingGroup = { ...updatedGroup };
                            }
                        }
                    });
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },
        removeStackFromGroup(stackName) {
            this.$root.getSocket().emit("removeStackFromGroup", stackName, this.managingGroup.id, (res) => {
                if (res.ok) {
                    this.$root.toastSuccess(res.msg);
                    // Reload groups and then update the managing group
                    this.$root.getSocket().emit("getGroupList", (groupRes) => {
                        if (groupRes.ok) {
                            this.groups = groupRes.groups;
                            // Update the managing group data
                            const updatedGroup = this.groups.find(g => g.id === this.managingGroup.id);
                            if (updatedGroup) {
                                this.managingGroup = { ...updatedGroup };
                            }
                        }
                    });
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },
        confirmDeleteGroup(group) {
            this.groupToDelete = group;
            this.$refs.confirmDelete.show();
        },
        deleteGroup() {
            if (!this.groupToDelete) return;
            
            this.$root.getSocket().emit("deleteGroup", this.groupToDelete.id, (res) => {
                if (res.ok) {
                    this.$root.toastSuccess(res.msg);
                    this.loadGroups();
                } else {
                    this.$root.toastError(res.msg);
                }
                this.groupToDelete = null;
            });
        },
    },
};
</script>