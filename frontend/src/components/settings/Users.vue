<template>
    <div>
        <h2>{{ $t("User Management") }}</h2>
        <p class="mb-3">{{ $t("Manage users and their access permissions. Only administrators can manage users.") }}</p>

        <div class="mb-3">
            <button class="btn btn-primary" @click="showCreateModal = true">
                <font-awesome-icon icon="plus" /> {{ $t("Create User") }}
            </button>
        </div>

        <div class="shadow-box">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>{{ $t("Username") }}</th>
                        <th>{{ $t("Role") }}</th>
                        <th>{{ $t("Status") }}</th>
                        <th>{{ $t("Groups") }}</th>
                        <th>{{ $t("Actions") }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="user in users" :key="user.id">
                        <td>{{ user.username }}</td>
                        <td>
                            <span v-if="user.is_admin" class="badge bg-danger">{{ $t("Admin") }}</span>
                            <span v-else class="badge bg-secondary">{{ $t("User") }}</span>
                        </td>
                        <td>
                            <span v-if="user.active" class="badge bg-success">{{ $t("Active") }}</span>
                            <span v-else class="badge bg-warning">{{ $t("Inactive") }}</span>
                        </td>
                        <td>
                            <span v-for="group in user.groups" :key="group.id" class="badge bg-info me-1">
                                {{ group.name }}
                            </span>
                            <span v-if="!user.groups || user.groups.length === 0" class="text-muted">
                                {{ $t("No groups") }}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-primary me-1" @click="editUser(user)">
                                <font-awesome-icon icon="edit" /> {{ $t("Edit") }}
                            </button>
                            <button class="btn btn-sm btn-danger" @click="confirmDeleteUser(user)" :disabled="user.id === currentUserId">
                                <font-awesome-icon icon="trash" /> {{ $t("Delete") }}
                            </button>
                        </td>
                    </tr>
                    <tr v-if="!users || users.length === 0">
                        <td colspan="5" class="text-center text-muted">{{ $t("No users found") }}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Create User Modal -->
        <div v-if="showCreateModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5)">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">{{ $t("Create User") }}</h5>
                        <button type="button" class="btn-close" @click="showCreateModal = false"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">{{ $t("Username") }}</label>
                            <input v-model="newUser.username" type="text" class="form-control" required />
                        </div>
                        <div class="mb-3">
                            <label class="form-label">{{ $t("Password") }}</label>
                            <input v-model="newUser.password" type="password" class="form-control" required />
                        </div>
                        <div class="mb-3">
                            <div class="form-check">
                                <input v-model="newUser.is_admin" type="checkbox" class="form-check-input" id="isAdminCreate" />
                                <label class="form-check-label" for="isAdminCreate">
                                    {{ $t("Administrator") }}
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" @click="showCreateModal = false">{{ $t("Cancel") }}</button>
                        <button type="button" class="btn btn-primary" @click="createUser">{{ $t("Create") }}</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Edit User Modal -->
        <div v-if="showEditModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5)">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">{{ $t("Edit User") }}</h5>
                        <button type="button" class="btn-close" @click="showEditModal = false"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">{{ $t("Username") }}</label>
                            <input v-model="editingUser.username" type="text" class="form-control" disabled />
                        </div>
                        <div class="mb-3">
                            <label class="form-label">{{ $t("New Password") }} ({{ $t("leave empty to keep current") }})</label>
                            <input v-model="editingUser.password" type="password" class="form-control" />
                        </div>
                        <div class="mb-3">
                            <div class="form-check">
                                <input v-model="editingUser.active" type="checkbox" class="form-check-input" id="isActive" />
                                <label class="form-check-label" for="isActive">
                                    {{ $t("Active") }}
                                </label>
                            </div>
                        </div>
                        <div class="mb-3">
                            <div class="form-check">
                                <input v-model="editingUser.is_admin" type="checkbox" class="form-check-input" id="isAdminEdit" :disabled="editingUser.id === currentUserId" />
                                <label class="form-check-label" for="isAdminEdit">
                                    {{ $t("Administrator") }}
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" @click="showEditModal = false">{{ $t("Cancel") }}</button>
                        <button type="button" class="btn btn-primary" @click="updateUser">{{ $t("Save") }}</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Delete Confirmation Modal -->
        <Confirm ref="confirmDelete" btn-style="btn-danger" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="deleteUser">
            <template #body>
                {{ $t("Are you sure you want to delete this user?") }}
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
            users: [],
            showCreateModal: false,
            showEditModal: false,
            newUser: {
                username: "",
                password: "",
                is_admin: false,
            },
            editingUser: {},
            currentUserId: null,
            userToDelete: null,
        };
    },
    mounted() {
        // Check if user is admin, redirect if not
        if (!this.$root.info || !this.$root.info.isAdmin) {
            this.$router.push("/settings/appearance");
            return;
        }
        this.loadUsers();
        this.loadCurrentUser();
    },
    methods: {
        loadUsers() {
            this.$root.getSocket().emit("getUserList", (res) => {
                if (res.ok) {
                    this.users = res.users;
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },
        loadCurrentUser() {
            this.$root.getSocket().emit("getUserInfo", (res) => {
                if (res.ok) {
                    this.currentUserId = res.user.id;
                }
            });
        },
        createUser() {
            if (!this.newUser.username || !this.newUser.password) {
                this.$root.toastError(this.$t("Username and password are required"));
                return;
            }
            
            this.$root.getSocket().emit("createUser", this.newUser, (res) => {
                if (res.ok) {
                    this.$root.toastSuccess(res.msg);
                    this.showCreateModal = false;
                    this.newUser = { username: "", password: "", is_admin: false };
                    this.loadUsers();
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },
        editUser(user) {
            this.editingUser = {
                id: user.id,
                username: user.username,
                active: user.active,
                is_admin: user.is_admin,
                password: "",
            };
            this.showEditModal = true;
        },
        updateUser() {
            const updateData = {
                active: this.editingUser.active,
                is_admin: this.editingUser.is_admin,
            };
            
            if (this.editingUser.password) {
                updateData.password = this.editingUser.password;
            }
            
            this.$root.getSocket().emit("updateUser", this.editingUser.id, updateData, (res) => {
                if (res.ok) {
                    this.$root.toastSuccess(res.msg);
                    this.showEditModal = false;
                    this.loadUsers();
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },
        confirmDeleteUser(user) {
            this.userToDelete = user;
            this.$refs.confirmDelete.show();
        },
        deleteUser() {
            if (!this.userToDelete) return;
            
            this.$root.getSocket().emit("deleteUser", this.userToDelete.id, (res) => {
                if (res.ok) {
                    this.$root.toastSuccess(res.msg);
                    this.loadUsers();
                } else {
                    this.$root.toastError(res.msg);
                }
                this.userToDelete = null;
            });
        },
    },
};
</script>

<style lang="scss" scoped>
.shadow-box {
    padding: 20px;
    margin-bottom: 20px;
}

.badge {
    font-size: 0.8rem;
}
</style>
