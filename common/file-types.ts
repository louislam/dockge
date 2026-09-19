const BINARY_FILE_EXTENSIONS = new Set([
    "7z", "avi", "bin", "bmp", "bz2", "class", "db", "dll", "dmg", "doc", "docx", "eot", "exe",
    "flac", "gif", "gz", "ico", "iso", "jar", "jpeg", "jpg", "m4a", "mkv", "mov", "mp3", "mp4",
    "ogg", "otf", "pdf", "png", "ppt", "pptx", "rar", "so", "sqlite", "sqlite3", "tar", "tgz",
    "tif", "tiff", "ttf", "wav", "webm", "webp", "woff", "woff2", "xls", "xlsx", "xz", "zip",
]);

export function isKnownBinaryFileName(fileName : string) {
    const extension = fileName.split(".").pop()?.toLowerCase() || "";
    return BINARY_FILE_EXTENSIONS.has(extension);
}

export function isLogFileName(fileName : string) {
    const lower = fileName.toLowerCase();
    return /\.(?:log|out|err|trace)$/.test(lower) || /\.log\.\d+$/.test(lower);
}
