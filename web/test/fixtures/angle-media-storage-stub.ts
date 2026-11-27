export function resolvePreviewImageUrl(storageKey?: string, fallback = "") {
    const win = window as unknown as {
        __angleMediaCalls?: Array<{ storageKey?: string; fallback: string }>;
        __resolveAngleMedia?: (url: string) => void;
    };
    win.__angleMediaCalls = win.__angleMediaCalls || [];
    win.__angleMediaCalls.push({ storageKey, fallback });
    return new Promise<string>((resolveUrl) => {
        win.__resolveAngleMedia = resolveUrl;
    });
}

// 一期换皮后角度弹窗经 canvas-project-domain 间接拉入 file-storage，
// 打包时需要 image-storage 的 uploadImage 导出；角度测试不走上传，
// 这里只占位，调用即报错。
export async function uploadImage(_input: string | Blob): Promise<never> {
    throw new Error("uploadImage is stubbed out in angle-media harness");
}

// 同上：打包图里其它模块还用到 image-storage 的这些导出，角度测试
// 不走它们，这里只给空实现。
export async function getImageBlob(_storageKey: string): Promise<Blob | undefined> {
    return undefined;
}

export async function setImageBlob(_storageKey: string, _blob: Blob): Promise<void> {
}

export async function imageToDataUrl(_image: { url?: string; dataUrl?: string; storageKey?: string }): Promise<string> {
    return "";
}

export async function resolveImageUrl(_storageKey?: string, fallback = ""): Promise<string> {
    return fallback;
}

export async function cleanupUnusedImages(): Promise<void> {
}

export function collectImageStorageKeys(_value: unknown, keys = new Set<string>()): Set<string> {
    return keys;
}
