export function peekCachedResourceObjectUrl() {
    return "";
}

export function cacheResourceObjectUrl(storageKey: string, forceRefresh?: boolean) {
    const win = window as unknown as {
        __angleFallbackCalls?: Array<{ storageKey: string; forceRefresh?: boolean }>;
        __angleFallbackUrl?: string;
    };
    win.__angleFallbackCalls = win.__angleFallbackCalls || [];
    win.__angleFallbackCalls.push({ storageKey, forceRefresh });
    return Promise.resolve(win.__angleFallbackUrl ?? "");
}

// 一期换皮后角度弹窗经 canvas-project-domain 间接拉入 file-storage，
// 打包时需要 resource-blob-cache 的这三个导出；角度测试不走它们，
// 这里只给空实现。
export async function getCachedResourceBlob(_storageKey: string): Promise<Blob | undefined> {
    return undefined;
}

export async function getCachedResourceObjectUrl(_storageKey: string): Promise<string> {
    return "";
}

export async function primeResourceBlobCache(_storageKey: string, _blob: Blob): Promise<void> {
}

// 同上：打包图里其它模块还用到这两个导出，角度测试不走它们，
// 这里只给空实现。
export async function cacheResourceImagePreviewObjectUrl(_storageKey: string, _maxSize: number): Promise<string> {
    return "";
}

export function peekFallbackResourceImagePreviewUrl(_storageKey: string): string {
    return "";
}
