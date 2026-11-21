import { Button } from "antd";
import { useCallback, useEffect, useState } from "react";

import { getDesktopAppBinding } from "@/services/desktop-runtime";
import { beefTVConnectionLabel } from "@/services/api/beeftv-connection";
import { getMyxsaiBalance, type MyxsaiBalance } from "@/services/api/myxsai-account";
import { channelHasGenerationCredential, useEffectiveConfig } from "@/stores/use-config-store";
import { useBeefTVConnection } from "@/components/layout/beeftv-connection-provider";

const formatMoney = (value: number) => value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 账号与余额页只联动梦由心生：余额由后端用已存的渠道 Key 在服务端查询，
// 充值不在应用内收钱，只打开梦由心生官网。原来整套 BeefTV 官方充值 UI
// （金额档、微信/支付宝/国际卡、订单 reconcile 轮询）已随官方账号移除。
// 只保留一处官方连接的残留处理：陈旧的待确认连接（pending/connecting）
// 仍可取消，否则用户会被卡在一个无法清除的状态。
export function AccountBalancePane() {
    const config = useEffectiveConfig();
    const myxsai = config.channels.find((channel) => channel.id === "myxsai");
    const hasKey = Boolean(myxsai && channelHasGenerationCredential(myxsai));
    const account = useBeefTVConnection();
    const connection = account.connection;
    const pending = connection?.state === "pending" || connection?.state === "connecting";

    const [balance, setBalance] = useState<MyxsaiBalance | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const refresh = useCallback(async (signal?: AbortSignal) => {
        if (!hasKey) return;
        setLoading(true);
        setError("");
        try {
            setBalance(await getMyxsaiBalance(signal));
        } catch (cause) {
            if (signal?.aborted) return;
            setBalance(null);
            setError(cause instanceof Error ? cause.message : "余额读取失败，请稍后重试");
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [hasKey]);

    useEffect(() => {
        const controller = new AbortController();
        void refresh(controller.signal);
        return () => controller.abort();
    }, [refresh]);

    // 桌面端优先走 Wails 绑定开系统浏览器；没有绑定时走普通外链。
    const openMyxsaiSite = async (event: React.MouseEvent<HTMLElement>) => {
        const openInBrowser = getDesktopAppBinding()?.OpenMyxsaiRecharge;
        if (!openInBrowser) return;
        event.preventDefault();
        await openInBrowser();
    };

    const displayedBalance = !hasKey
        ? "—"
        : balance && balance.hasBalance
            ? `${balance.currency ? `${balance.currency} ` : ""}${formatMoney(balance.balance)}`
            : "—";

    return <>
        <div className="account-balance-identity">
            <div className="account-balance-identity-meta"><h3>梦由心生AI</h3>
                <p role="status" aria-live="polite">{hasKey ? "已填写 API Key" : "未填写 API Key，请先在模型渠道填写梦由心生 Key"}</p>
            </div>
        </div>
        {connection && connection.state !== "connected" && connection.state !== "disconnected" ? <p role="status">{beefTVConnectionLabel(connection)}</p> : null}
        {pending ? <div className="account-login-actions">
            <Button loading={account.busy} onClick={() => void account.cancel()}>取消本次登录</Button>
        </div> : null}
        <div className="account-balance-overview">
            <div><span className="account-balance-label">可用余额</span><div className="account-balance-value">{displayedBalance}</div>
                {!hasKey ? <p>填好 Key 后这里显示梦由心生账户余额</p> : error ? <p role="status">{error}</p> : balance && !balance.hasBalance ? <p role="status">余额返回格式未识别，需真 Key 核对后更新</p> : null}
            </div>
            <div className="account-balance-identity-actions">
                <Button loading={loading} disabled={!hasKey} onClick={() => void refresh()}>刷新余额</Button>
                <Button href="https://myxsai.com" target="_blank" rel="noreferrer" onClick={(event) => void openMyxsaiSite(event)}>余额与用量</Button>
            </div>
        </div>
        <section className="account-recharge" aria-labelledby="account-recharge-title">
            <div className="account-recharge-heading">
                <h3 id="account-recharge-title">账户充值</h3>
            </div>
            <p className="account-recharge-hint">应用内不收钱。充值请去梦由心生官网完成，充完回来点“刷新余额”即可看到。</p>
            <Button
                type="primary"
                href="https://myxsai.com"
                target="_blank"
                rel="noreferrer"
                onClick={(event) => void openMyxsaiSite(event)}
            >
                去充值
            </Button>
        </section>
    </>;
}
