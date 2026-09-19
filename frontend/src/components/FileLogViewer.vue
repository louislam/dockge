<template>
    <div ref="viewerHost" class="file-log-viewer"></div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { dracula as editorTheme } from "thememirror";

const MAX_CONTENT_LENGTH = 2 * 1024 * 1024;
const props = defineProps({
    dark: { type: Boolean,
        default: false },
    follow: { type: Boolean,
        default: true },
});
const emit = defineEmits([ "follow-change", "selection-change" ]);
const viewerHost = ref();
const themeCompartment = new Compartment();
const noFocusOutline = EditorView.theme({
    "&.cm-focused": { outline: "none !important" },
    ".cm-content:focus-visible": { outline: "none !important" },
});
let editorView;
let automaticScroll = false;
let hasSelection = false;

onMounted(() => {
    editorView = new EditorView({
        parent: viewerHost.value,
        state: EditorState.create({
            extensions: [
                minimalSetup,
                EditorState.readOnly.of(true),
                EditorView.editable.of(false),
                EditorView.lineWrapping,
                noFocusOutline,
                themeCompartment.of(props.dark ? editorTheme : []),
                EditorView.updateListener.of(update => {
                    if (update.selectionSet || update.docChanged) {
                        const selection = update.state.selection.main;
                        const nextHasSelection = selection.from !== selection.to;
                        if (nextHasSelection !== hasSelection) {
                            hasSelection = nextHasSelection;
                            emit("selection-change", hasSelection);
                        }
                    }
                }),
            ],
        }),
    });
    editorView.scrollDOM.addEventListener("scroll", handleScroll, { passive: true });
});

watch(() => props.dark, dark => {
    editorView?.dispatch({ effects: themeCompartment.reconfigure(dark ? editorTheme : []) });
});

watch(() => props.follow, follow => {
    if (follow) {
        scrollToEnd();
    }
});

onBeforeUnmount(() => {
    editorView?.scrollDOM.removeEventListener("scroll", handleScroll);
    editorView?.destroy();
    editorView = undefined;
});

function handleScroll() {
    if (!automaticScroll && props.follow && !isNearBottom()) {
        emit("follow-change", false);
    }
}

function isNearBottom() {
    if (!editorView) {
        return true;
    }
    const scroll = editorView.scrollDOM;
    return scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight <= 24;
}

function append(content, reset = false) {
    if (!editorView) {
        return;
    }
    if (reset) {
        editorView.dispatch({ changes: { from: 0,
            to: editorView.state.doc.length,
            insert: content } });
    } else if (content) {
        editorView.dispatch({ changes: { from: editorView.state.doc.length,
            insert: content } });
    }

    const overflow = editorView.state.doc.length - MAX_CONTENT_LENGTH;
    if (overflow > 0) {
        const line = editorView.state.doc.lineAt(Math.min(overflow, editorView.state.doc.length));
        const trimEnd = line.to < editorView.state.doc.length ? line.to + 1 : overflow;
        editorView.dispatch({ changes: { from: 0,
            to: trimEnd } });
    }
    if (props.follow) {
        scrollToEnd();
    }
}

function scrollToEnd() {
    if (!editorView) {
        return;
    }
    automaticScroll = true;
    editorView.dispatch({ effects: EditorView.scrollIntoView(editorView.state.doc.length, { y: "end" }) });
    window.requestAnimationFrame(() => {
        automaticScroll = false;
    });
}

function clear() {
    append("", true);
}

async function copySelection() {
    if (!editorView) {
        return false;
    }
    const selection = editorView.state.selection.main;
    if (selection.from === selection.to) {
        return false;
    }
    const text = editorView.state.sliceDoc(selection.from, selection.to);
    try {
        if (!navigator.clipboard?.writeText) {
            throw new Error("Clipboard API unavailable");
        }
        await navigator.clipboard.writeText(text);
    } catch {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) {
            return false;
        }
    }
    return true;
}

defineExpose({ append,
    clear,
    copySelection,
    scrollToEnd });
</script>

<style scoped>
.file-log-viewer {
    width: 100%;
    height: 100%;
    min-height: 0;
}

.file-log-viewer :deep(.cm-editor),
.file-log-viewer :deep(.cm-scroller) {
    height: 100%;
    min-height: 0;
}

.file-log-viewer :deep(.cm-editor.cm-focused),
.file-log-viewer :deep(.cm-content:focus-visible) {
    outline: none !important;
}
</style>
