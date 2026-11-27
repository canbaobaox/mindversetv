// 胶囊浮条下的通用模板下拉面板：分节列出选项，点选即执行。
// 禁用项必须带原因（按钮要么能用、要么明确说为什么用不了，不许留点了没反应的按钮）。
// 样式复用拆分选择器的 dock token（--dock-surface / --dock-border / --fg），深浅主题通用。

import type { ReactNode } from "react";

import "./canvas-template-picker.css";

export type CanvasTemplatePickerItem = {
    id: string;
    label: string;
    disabled?: boolean;
    disabledReason?: string;
};

export type CanvasTemplatePickerSection = {
    title?: string;
    items: CanvasTemplatePickerItem[];
};

export function CanvasTemplatePicker({ title, sections, header, onPick }: { title: string; sections: CanvasTemplatePickerSection[]; header?: ReactNode; onPick: (id: string) => void }) {
    return (
        <div className="canvas-template-picker" role="menu" aria-label={title} data-canvas-no-zoom onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
            <div className="canvas-template-picker-head">{title}</div>
            {header ? <div className="canvas-template-picker-header">{header}</div> : null}
            {sections.map((section, index) => (
                <div key={section.title || index} className="canvas-template-picker-section">
                    {section.title ? <div className="canvas-template-picker-section-title">{section.title}</div> : null}
                    {section.items.map((item) => (
                        <button key={item.id} type="button" role="menuitem" className="canvas-template-picker-item" disabled={item.disabled} title={item.disabled ? item.disabledReason : item.label} onClick={() => onPick(item.id)}>
                            <span className="canvas-template-picker-item-label">{item.label}</span>
                            {item.disabled && item.disabledReason ? <span className="canvas-template-picker-item-reason">{item.disabledReason}</span> : null}
                        </button>
                    ))}
                </div>
            ))}
        </div>
    );
}
