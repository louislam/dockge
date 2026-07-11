<template>
    <transition name="slide-fade" appear>
        <div class="container-fluid py-4">
            <div class="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3 mb-4">
                <h1 class="h3 mb-0">Docker Image Management</h1>
                <button class="btn btn-outline-danger w-100 w-sm-auto px-4 py-2" @click="confirmPrune">
                    <font-awesome-icon icon="trash" class="me-2" />
                    Prune Unused Images
                </button>
            </div>

            <!-- Docker Disk Usage Stats -->
            <div class="row g-4 mb-4">
                <div v-for="item in diskUsage" :key="item.Type" class="col-xl-3 col-md-6 col-12">
                    <div class="shadow-box p-4 stat-card" style="background-color: var(--m3-surface-container); border: 1px solid rgba(120, 120, 120, 0.15); border-radius: var(--m3-card-radius);">
                        <div class="text-secondary small fw-semibold uppercase mb-1">{{ item.Type }}</div>
                        <div class="h3 font-semibold mb-2 text-primary">{{ item.Size }}</div>
                        <div class="d-flex justify-content-between text-secondary small">
                            <span>Count: {{ item.TotalCount }} (Active: {{ item.Active }})</span>
                            <span v-if="item.Reclaimable !== '0B' && item.Reclaimable !== '0B (0%)'" class="text-warning">Reclaimable: {{ item.Reclaimable }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Pull Image Panel -->
            <div class="row g-4 mb-4">
                <div class="col-12">
                    <div class="shadow-box p-4" style="background-color: var(--m3-surface-container); border: 1px solid rgba(120, 120, 120, 0.15); border-radius: var(--m3-card-radius); height: 100%;">
                        <h5 class="fw-bold mb-3"><font-awesome-icon icon="cloud-arrow-down" class="me-2 text-info" />Pull Image from Registry</h5>
                        <form @submit.prevent="pullImage">
                            <div class="input-group mb-3">
                                <input
                                    v-model="pullImageName"
                                    type="text"
                                    class="form-control font-monospace"
                                    placeholder="e.g. nginx:alpine or library/ubuntu:latest"
                                    required
                                    :disabled="pulling"
                                />
                                <button class="btn btn-primary" type="submit" :disabled="pulling">
                                    <font-awesome-icon v-if="pulling" icon="spinner" spin class="me-1" />
                                    <span v-else>Pull</span>
                                </button>
                            </div>
                        </form>
                        <!-- Pull Console -->
                        <div v-if="pullConsole.length > 0 || pulling" class="console-box mt-3 p-3">
                            <div class="console-header d-flex justify-content-between small text-secondary mb-2">
                                <span>Pull Output: {{ pullImageName }}</span>
                                <button class="btn btn-link btn-sm py-0 text-secondary" @click="pullConsole = []">Clear</button>
                            </div>
                            <pre ref="pullPre" class="console-content small m-0">{{ pullConsole.join('') }}</pre>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Images Table Card -->
            <div class="shadow-box p-4" style="background-color: var(--m3-surface-container); border: 1px solid rgba(120, 120, 120, 0.15); border-radius: var(--m3-card-radius);">
                <div class="row g-3 justify-content-between align-items-center mb-4">
                    <div class="col-md-4 col-12">
                        <div class="search-input-group">
                            <input
                                v-model="filterText"
                                type="text"
                                class="form-control"
                                placeholder="Search by Repository, Tag, or ID..."
                            />
                        </div>
                    </div>
                    <div class="col-md-auto col-12">
                        <span class="badge bg-secondary">{{ filteredImages.length }} of {{ images.length }} images</span>
                    </div>
                </div>

                <div v-if="loading" class="text-center py-5">
                    <div class="spinner-border text-primary" role="status"></div>
                    <div class="mt-2 text-secondary">Loading Docker images...</div>
                </div>

                <div v-else-if="filteredImages.length > 0">
                    <!-- Desktop/Tablet View: Table -->
                    <div class="table-responsive d-none d-md-block">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>Repository</th>
                                    <th>Tag</th>
                                    <th>Image ID</th>
                                    <th>Size</th>
                                    <th>Created</th>
                                    <th>Containers</th>
                                    <th class="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="img in filteredImages" :key="img.ID">
                                    <td class="fw-semibold">{{ img.Repository }}</td>
                                    <td>
                                        <span class="badge bg-secondary font-monospace">{{ img.Tag }}</span>
                                    </td>
                                    <td>
                                        <span class="badge bg-dark font-monospace text-secondary" style="font-size: 11px;">
                                            {{ img.ID }}
                                        </span>
                                    </td>
                                    <td class="font-monospace small">{{ img.Size }}</td>
                                    <td class="small text-secondary">{{ img.CreatedSince }}</td>
                                    <td>
                                        <span v-if="img.Containers > 0" class="badge bg-info">
                                            Used by {{ img.Containers }}
                                        </span>
                                        <span v-else class="badge bg-secondary opacity-50">Unused</span>
                                    </td>
                                    <td class="text-end">
                                        <button class="btn btn-sm btn-outline-danger" @click="confirmDelete(img)">
                                            <font-awesome-icon icon="trash" />
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Mobile View: Card Stack -->
                    <div class="d-md-none">
                        <div v-for="img in filteredImages" :key="img.ID" class="shadow-box p-3 mb-3" style="background-color: var(--m3-surface-variant); border: 1px solid rgba(120, 120, 120, 0.15); border-radius: var(--m3-card-radius);">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <div class="text-break" style="max-width: 80%;">
                                    <h6 class="mb-1 fw-bold text-primary" style="font-size: 15px;">{{ img.Repository }}</h6>
                                    <span class="badge bg-secondary font-monospace">{{ img.Tag }}</span>
                                </div>
                                <button class="btn btn-sm btn-outline-danger" @click="confirmDelete(img)">
                                    <font-awesome-icon icon="trash" />
                                </button>
                            </div>
                            <div class="small mb-3" style="color: var(--m3-on-surface-variant);">
                                <strong>ID:</strong> <code class="font-monospace text-secondary" style="font-size: 11px;">{{ img.ID.substring(0, 12) }}</code>
                            </div>
                            <div class="row g-2 pt-2 border-top border-secondary border-opacity-10 text-secondary small">
                                <div class="col-6">
                                    <span class="fw-semibold">Size:</span> {{ img.Size }}
                                </div>
                                <div class="col-6">
                                    <span class="fw-semibold">Created:</span> {{ img.CreatedSince }}
                                </div>
                                <div class="col-12 mt-2">
                                    <span v-if="img.Containers > 0" class="badge bg-info">
                                        Used by {{ img.Containers }}
                                    </span>
                                    <span v-else class="badge bg-secondary opacity-50">Unused</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-else class="text-center py-5 text-secondary">
                    No images match the search criteria.
                </div>
            </div>

            <!-- Warning Prune Dialog -->
            <Confirm ref="pruneModal" yes-variant="danger" yes-text="Prune All" no-text="Cancel" @yes="pruneImages">
                Are you sure you want to prune unused Docker images? This will remove all dangling images and images not used by any container. This action cannot be undone.
            </Confirm>

            <!-- Warning Delete Dialog -->
            <Confirm ref="deleteModal" yes-variant="danger" yes-text="Delete" no-text="Cancel" @yes="deleteImage">
                Are you sure you want to delete image <strong>{{ imageToDelete?.Repository }}:{{ imageToDelete?.Tag }}</strong> ({{ imageToDelete?.ID }})?
            </Confirm>
        </div>
    </transition>
</template>

<script>
import Confirm from "../components/Confirm.vue";

export default {
    components: {
        Confirm
    },
    data() {
        return {
            images: [],
            diskUsage: [],
            loading: true,
            filterText: "",
            
            // Pulling
            pullImageName: "",
            pulling: false,
            pullConsole: [],
            
            // Deletion
            imageToDelete: null,
        };
    },
    computed: {
        filteredImages() {
            const query = this.filterText.trim().toLowerCase();
            if (!query) return this.images;
            return this.images.filter(img => 
                (img.Repository && img.Repository.toLowerCase().includes(query)) ||
                (img.Tag && img.Tag.toLowerCase().includes(query)) ||
                (img.ID && img.ID.toLowerCase().includes(query))
            );
        }
    },
    mounted() {
        this.fetchImages();
        this.fetchDiskUsage();
        
        // Register streaming listeners
        this.$root.getSocket().on("dockerPullProgress", this.onPullProgress);
    },
    beforeUnmount() {
        this.$root.getSocket().off("dockerPullProgress", this.onPullProgress);
    },
    methods: {
        fetchImages() {
            this.loading = true;
            this.$root.getSocket().emit("dockerGetImages", (res) => {
                this.loading = false;
                if (res.ok) {
                    this.images = res.images || [];
                } else {
                    this.$root.toastError("Failed to fetch Docker images: " + res.error);
                }
            });
        },
        fetchDiskUsage() {
            this.$root.getSocket().emit("dockerGetDiskUsage", (res) => {
                if (res.ok) {
                    this.diskUsage = res.usage || [];
                }
            });
        },
        pullImage() {
            this.pulling = true;
            this.pullConsole = ["Pulling starting...\n"];
            this.$root.getSocket().emit("dockerPullImage", { image: this.pullImageName }, (res) => {
                this.pulling = false;
                if (res.ok) {
                    this.$root.toastSuccess(`Successfully pulled image ${this.pullImageName}`);
                    this.pullImageName = "";
                    this.fetchImages();
                    this.fetchDiskUsage();
                } else {
                    this.$root.toastError("Pull failed: " + res.error);
                }
            });
        },
        onPullProgress(data) {
            if (data.image === this.pullImageName) {
                this.pullConsole.push(data.output);
                this.$nextTick(() => {
                    if (this.$refs.pullPre) {
                        this.$refs.pullPre.scrollTop = this.$refs.pullPre.scrollHeight;
                    }
                });
            }
        },
        confirmDelete(img) {
            this.imageToDelete = img;
            this.$refs.deleteModal.show();
        },
        deleteImage() {
            if (!this.imageToDelete) return;
            const target = this.imageToDelete;
            this.$root.getSocket().emit("dockerDeleteImage", target.ID, (res) => {
                if (res.ok) {
                    this.$root.toastSuccess(`Deleted image ${target.Repository}:${target.Tag}`);
                    this.fetchImages();
                    this.fetchDiskUsage();
                } else {
                    this.$root.toastError(`Failed to delete image: ${res.error}`);
                }
            });
        },
        confirmPrune() {
            this.$refs.pruneModal.show();
        },
        pruneImages() {
            this.$root.getSocket().emit("dockerPruneImages", (res) => {
                if (res.ok) {
                    this.$root.toastSuccess("Successfully pruned unused images");
                    this.fetchImages();
                    this.fetchDiskUsage();
                } else {
                    this.$root.toastError("Pruning failed: " + res.error);
                }
            });
        }
    }
};
</script>

<style scoped>
.console-box {
    background-color: #121212 !important;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
}
.console-content {
    max-height: 250px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-all;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    color: #e0e0e0;
}
.uppercase {
    text-transform: uppercase;
}
.stat-card {
    transition: transform 0.2s ease;
}
.stat-card:hover {
    transform: translateY(-2px);
}
</style>
