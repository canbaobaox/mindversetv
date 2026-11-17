import { Tooltip } from "antd";
import { ArrowLeft, Globe, MessagesSquare, Star } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import Github from "@lobehub/icons/es/Github";
import { aceternityMotion } from "@/lib/aceternity-motion";
import { cn } from "@/lib/utils";
import { resolveEmbeddedAssetUrl } from "@/lib/embedded-runtime";
import { getDesktopAppBinding } from "@/services/desktop-runtime";


export function WorkspaceSidebarSocialLinks({ collapsed, onExpand }: { collapsed: boolean; onExpand: () => void }) {
    const [expanded, setExpanded] = useState(false);
    const [wechatOpen, setWechatOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const backRef = useRef<HTMLButtonElement>(null);
    const wasExpanded = useRef(false);
    const reducedMotion = useReducedMotion();
    const active = expanded && !collapsed;
    const transition = { duration: reducedMotion ? 0 : aceternityMotion.duration.state, ease: aceternityMotion.easing.enter };

    useEffect(() => {
        if (collapsed) {
            wasExpanded.current = false;
            setExpanded(false);
            setWechatOpen(false);
            return;
        }
        if (!active) setWechatOpen(false);
        if (wasExpanded.current === active) return;
        wasExpanded.current = active;
        (active ? backRef : triggerRef).current?.focus({ preventScroll: true });
    }, [active, collapsed]);

    const close = () => setExpanded(false);
    const openGitHub = async (event: React.MouseEvent<HTMLAnchorElement>) => {
        const openInBrowser = getDesktopAppBinding()?.OpenBeefTVGitHub;
        if (!openInBrowser) return;
        event.preventDefault();
        await openInBrowser();
    };

    return (
        <div className="app-workspace-sidebar-contact-row" onKeyDown={(event) => {
            if (active && event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                close();
            }
        }}>
            <motion.button
                ref={triggerRef}
                type="button"
                className={cn("app-workspace-nav-link group relative flex w-full items-center gap-2 rounded-[var(--r-md)] text-left", collapsed && "is-collapsed")}
                aria-label="联系我们"
                title="联系我们"
                aria-expanded={active}
                aria-hidden={active}
                inert={active}
                initial={false}
                animate={{ opacity: active ? 0 : 1, x: reducedMotion ? 0 : active ? -8 : 0 }}
                transition={transition}
                onClick={() => {
                    if (collapsed) onExpand();
                    setExpanded(true);
                }}
            >
                <span className="app-workspace-nav-main flex min-w-0 items-center gap-2.5">
                    <span className="app-workspace-nav-icon" aria-hidden="true"><MessagesSquare className="size-4" strokeWidth={1.8} /></span>
                    {!collapsed ? <span className="app-workspace-nav-title truncate">联系我们</span> : null}
                </span>
            </motion.button>
            <motion.div
                className="app-workspace-social-links"
                role="group"
                aria-label="联系方式"
                aria-hidden={!active}
                inert={!active}
                initial={false}
                animate={{ opacity: active ? 1 : 0, x: reducedMotion ? 0 : active ? 0 : 8 }}
                transition={transition}
            >
                <button ref={backRef} type="button" className="app-workspace-social-action" aria-label="收起联系方式" title="收起联系方式" onClick={close}>
                    <ArrowLeft aria-hidden="true" strokeWidth={1.8} />
                </button>
                <Tooltip
                    placement="top"
                    trigger={["hover", "focus"]}
                    mouseEnterDelay={0.15}
                    mouseLeaveDelay={0.1}
                    rootClassName="app-workspace-github-tooltip"
                    title={<span className="app-workspace-github-hint">点点 star <Star aria-hidden="true" /></span>}
                >
                    <a className="app-workspace-social-action" href="https://github.com/canbaobaox/mindversetv" target="_blank" rel="noopener noreferrer" aria-label="打开 MindVerseTV GitHub 仓库" onClick={openGitHub}>
                        <Github aria-hidden="true" />
                    </a>
                </Tooltip>
            </motion.div>
        </div>
    );
}
