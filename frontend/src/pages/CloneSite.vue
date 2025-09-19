<template>
  <div class="p-4 max-w-xl space-y-4">
    <h1 class="text-2xl font-semibold">Clonar WordPress (baseelementor)</h1>

    <form @submit.prevent="run" class="space-y-3">
      <div>
        <label class="block text-sm font-medium">Slug</label>
        <input v-model="slug" class="border rounded w-full p-2" placeholder="ex: site2" />
      </div>
      <div>
        <label class="block text-sm font-medium">Domínio</label>
        <input v-model="domain" class="border rounded w-full p-2" placeholder="ex: site2.aconcaia.com.br" />
      </div>
      <button :disabled="loading" class="px-4 py-2 rounded bg-black text-white">
        {{ loading ? "Executando..." : "Clonar" }}
      </button>
    </form>

    <div v-if="output" class="bg-black text-green-200 p-3 rounded whitespace-pre-wrap text-sm">
      <pre>{{ output }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
const slug = ref(""); const domain = ref("");
const output = ref(""); const loading = ref(false);

async function run() {
  output.value = ""; loading.value = true;
  try {
    const resp = await fetch("/api/custom/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: slug.value.trim(), domain: domain.value.trim() }),
    });
    const reader = resp.body?.getReader(); const dec = new TextDecoder();
    while (reader) {
      const { value, done } = await reader.read();
      if (done) break;
      output.value += dec.decode(value);
    }
  } catch (e:any) {
    output.value += `\n[error] ${e?.message || e}\n`;
  } finally {
    loading.value = false;
  }
}
</script>
