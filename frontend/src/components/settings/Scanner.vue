<template>
    <div>
        <div v-if="settingsLoaded" class="my-4">
            <h5 class="my-4 settings-subheading">Image Vulnerability Scanner</h5>
            
            <div class="shadow-box p-4 mb-4" style="background-color: var(--m3-surface-container); border: 1px solid rgba(120, 120, 120, 0.15); border-radius: var(--m3-card-radius);">
                <form @submit.prevent="runScan">
                    <div class="mb-3">
                        <label for="image-name" class="form-label">Docker Image Name</label>
                        <input
                            id="image-name"
                            v-model="imageName"
                            type="text"
                            class="form-control font-monospace"
                            placeholder="e.g. library/nginx:latest or alpine:3.18"
                            required
                        />
                    </div>

                    <div class="mb-3">
                        <label class="form-label d-block">Vulnerability Scanner</label>
                        <div class="form-check form-check-inline me-4">
                            <input id="scan-both" v-model="scanner" type="radio" value="both" class="form-check-input" />
                            <label for="scan-both" class="form-check-label">Both (Grype & Trivy)</label>
                        </div>
                        <div class="form-check form-check-inline me-4">
                            <input id="scan-trivy" v-model="scanner" type="radio" value="trivy" class="form-check-input" />
                            <label for="scan-trivy" class="form-check-label">Trivy Only</label>
                        </div>
                        <div class="form-check form-check-inline">
                            <input id="scan-grype" v-model="scanner" type="radio" value="grype" class="form-check-input" />
                            <label for="scan-grype" class="form-check-label">Grype Only</label>
                        </div>
                    </div>

                    <div class="mt-4">
                        <button class="btn btn-primary px-4 py-2" type="submit" :disabled="scanning">
                            <font-awesome-icon v-if="scanning" icon="spinner" spin class="me-2" />
                            <font-awesome-icon v-else icon="search" class="me-2" />
                            Scan Image
                        </button>
                    </div>
                </form>
            </div>

            <!-- Scan Progress Bar & Timer -->
            <div v-if="scanning" class="shadow-box p-4 mb-4 text-center" style="background-color: var(--m3-surface-container); border: 1px solid rgba(120, 120, 120, 0.15); border-radius: var(--m3-card-radius);">
                <div class="spinner-border text-primary mb-3" role="status"></div>
                <h5 class="fw-bold mb-2">{{ scanProgressText || 'Initializing scan...' }}</h5>
                
                <div class="progress mb-3" style="height: 12px; border-radius: 6px; background-color: rgba(255,255,255,0.1); overflow: hidden;">
                    <div class="progress-bar progress-bar-striped progress-bar-animated bg-primary" role="progressbar" :style="{ width: progressPercent + '%' }"></div>
                </div>
                
                <div class="d-flex justify-content-between text-secondary small">
                    <span>Progress: {{ progressPercent }}%</span>
                    <span>Time Elapsed: {{ scanElapsedTime }}s</span>
                </div>
            </div>

            <div v-else-if="scanned">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="settings-subheading mb-0">Scan Results for {{ lastScannedImage }}</h5>
                    <span class="badge bg-secondary">{{ vulnerabilities.length }} Vulnerabilities Found</span>
                </div>

                <div v-if="error" class="alert alert-warning mb-3">
                    {{ error }}
                </div>

                <div v-if="vulnerabilities.length > 0" class="row g-4">
                    <!-- Trivy Column -->
                    <div class="col-lg-6 col-12">
                        <div class="shadow-box p-3 mb-3 d-flex justify-content-between align-items-center" style="background-color: var(--m3-surface-container); border: 1px solid rgba(120, 120, 120, 0.15); border-radius: var(--m3-card-radius);">
                            <h6 class="text-info fw-bold mb-0">Trivy Vulnerabilities</h6>
                            <span class="badge bg-info">{{ trivyVulnerabilities.length }}</span>
                        </div>
                        <div v-if="trivyVulnerabilities.length > 0" class="table-responsive shadow-box p-0 overflow-hidden" style="border-radius: var(--m3-card-radius);">
                            <table class="table table-hover table-dark mb-0 align-middle">
                                <thead>
                                    <tr>
                                        <th>Severity</th>
                                        <th>CVE ID</th>
                                        <th>Package</th>
                                        <th>Current Version</th>
                                        <th>Fixed Version</th>
                                        <th>Info</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(vuln, index) in trivyVulnerabilities" :key="index">
                                        <td>
                                            <span class="badge" :class="severityClass(vuln.severity)">
                                                {{ vuln.severity }}
                                            </span>
                                        </td>
                                        <td class="fw-semibold small">{{ vuln.id }}</td>
                                        <td>{{ vuln.pkgName }}</td>
                                        <td class="font-monospace text-secondary small">{{ vuln.installedVersion }}</td>
                                        <td class="font-monospace text-success small">{{ vuln.fixedVersion }}</td>
                                        <td>
                                            <a :href="vuln.url" target="_blank" rel="noopener" class="btn btn-sm btn-outline-primary py-0 px-2" style="font-size: 11px;">
                                                Link
                                            </a>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div v-else class="alert alert-success py-3 text-center small">
                            No Trivy vulnerabilities found
                        </div>
                    </div>

                    <!-- Grype Column -->
                    <div class="col-lg-6 col-12">
                        <div class="shadow-box p-3 mb-3 d-flex justify-content-between align-items-center" style="background-color: var(--m3-surface-container); border: 1px solid rgba(120, 120, 120, 0.15); border-radius: var(--m3-card-radius);">
                            <h6 class="text-primary fw-bold mb-0">Grype Vulnerabilities</h6>
                            <span class="badge bg-primary">{{ grypeVulnerabilities.length }}</span>
                        </div>
                        <div v-if="grypeVulnerabilities.length > 0" class="table-responsive shadow-box p-0 overflow-hidden" style="border-radius: var(--m3-card-radius);">
                            <table class="table table-hover table-dark mb-0 align-middle">
                                <thead>
                                    <tr>
                                        <th>Severity</th>
                                        <th>CVE ID</th>
                                        <th>Package</th>
                                        <th>Current Version</th>
                                        <th>Fixed Version</th>
                                        <th>Info</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(vuln, index) in grypeVulnerabilities" :key="index">
                                        <td>
                                            <span class="badge" :class="severityClass(vuln.severity)">
                                                {{ vuln.severity }}
                                            </span>
                                        </td>
                                        <td class="fw-semibold small">{{ vuln.id }}</td>
                                        <td>{{ vuln.pkgName }}</td>
                                        <td class="font-monospace text-secondary small">{{ vuln.installedVersion }}</td>
                                        <td class="font-monospace text-success small">{{ vuln.fixedVersion }}</td>
                                        <td>
                                            <a :href="vuln.url" target="_blank" rel="noopener" class="btn btn-sm btn-outline-primary py-0 px-2" style="font-size: 11px;">
                                                Link
                                            </a>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div v-else class="alert alert-success py-3 text-center small">
                            No Grype vulnerabilities found
                        </div>
                    </div>
                </div>

                <div v-else class="alert alert-success p-4 text-center">
                    🎉 No vulnerabilities detected by selected scanner(s)!
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            imageName: "",
            scanner: "both",
            scanning: false,
            scanned: false,
            lastScannedImage: "",
            vulnerabilities: [],
            error: "",
            progressPercent: 0,
            scanProgressText: "",
            scanElapsedTime: 0,
            timerInterval: null
        };
    },
    computed: {
        settingsLoaded() {
            return this.$parent.$parent.$parent.settingsLoaded;
        },
        trivyVulnerabilities() {
            return this.vulnerabilities.filter(v => v.scanner === "Trivy");
        },
        grypeVulnerabilities() {
            return this.vulnerabilities.filter(v => v.scanner === "Grype");
        }
    },
    beforeUnmount() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
    },
    methods: {
        runScan() {
            this.scanning = true;
            this.scanned = false;
            this.error = "";
            this.progressPercent = 5;
            this.scanProgressText = "Preparing to connect to Docker daemon...";
            
            this.scanStartTime = Date.now();
            this.scanElapsedTime = 0;
            this.timerInterval = setInterval(() => {
                this.scanElapsedTime = Math.floor((Date.now() - this.scanStartTime) / 1000);
            }, 1000);

            const progressListener = (data) => {
                console.log("scanProgress event received:", data);
                this.scanProgressText = data.message;
                if (data.step === "trivy_pull") this.progressPercent = 25;
                else if (data.step === "trivy_scan") this.progressPercent = 50;
                else if (data.step === "grype_pull") this.progressPercent = 75;
                else if (data.step === "grype_scan") this.progressPercent = 90;
                else if (data.step === "done") this.progressPercent = 100;
            };
            this.$root.getSocket().on("scanProgress", progressListener);

            this.$root.getSocket().emit("scanImage", this.imageName, this.scanner, (res) => {
                this.scanning = false;
                this.scanned = true;
                this.lastScannedImage = this.imageName;
                
                clearInterval(this.timerInterval);
                this.$root.getSocket().off("scanProgress", progressListener);

                if (res.ok) {
                    this.vulnerabilities = res.vulnerabilities;
                    this.error = res.error;
                } else {
                    this.vulnerabilities = [];
                    this.error = res.error || "An unknown error occurred during scanning.";
                    this.$root.toastError("Scanning failed: " + this.error);
                }
            });
        },
        severityClass(severity) {
            const sev = severity ? severity.toUpperCase() : "";
            if (sev === "CRITICAL" || sev === "HIGH") return "bg-danger text-white";
            if (sev === "MEDIUM") return "bg-warning text-dark";
            return "bg-info text-dark";
        }
    }
};
</script>
