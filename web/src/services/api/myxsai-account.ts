import { http } from "@/services/api/request";

export type MyxsaiBalance = {
    balance: number;
    currency?: string;
    hasBalance: boolean;
};

// 余额由后端用已存的梦由心生渠道 Key 在服务端查询，Key 不下发到浏览器。
export function getMyxsaiBalance(signal?: AbortSignal) {
    return http.get<MyxsaiBalance>("/account/myxsai-balance", { signal });
}
