// ==UserScript==
// @name         NJUST 教学评价一键填写
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  南理工教务系统教学评价快速填写
// @match        *://bkjw.njust.edu.cn/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        // 0 = 很符合，1 = 较符合，2 = 一般，3 = 不符合，4 = 极不符合
        defaultOptionIndex: 0,
        fallbackOptionIndex: 1,
        commentText: "老师教学认真负责，课程内容清晰，讲解准确，课堂安排合理，对学习很有帮助。",
        panelId: "njust-auto-eval-panel",
    };

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function trigger(el, type) {
        el.dispatchEvent(new Event(type, { bubbles: true }));
    }

    function isVisible(el) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    }

    function escapeSelectorValue(value) {
        if (window.CSS && typeof window.CSS.escape === "function") {
            return window.CSS.escape(value);
        }

        return value.replace(/["\\]/g, "\\$&");
    }

    function getClickableTarget(radio) {
        if (radio.id) {
            const label = document.querySelector(`label[for="${escapeSelectorValue(radio.id)}"]`);
            if (label) return label;
        }

        return radio.closest("label") || radio;
    }

    function setRadioChecked(radio) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked").set;
        setter.call(radio, true);

        const target = getClickableTarget(radio);
        target.click();

        ["mousedown", "mouseup", "click", "input", "change"].forEach(type => trigger(radio, type));
    }

    function uniqueByNode(nodes) {
        return Array.from(new Set(nodes));
    }

    function randomIndex(length) {
        if (window.crypto && typeof window.crypto.getRandomValues === "function") {
            const values = new Uint32Array(1);
            window.crypto.getRandomValues(values);
            return values[0] % length;
        }

        return Math.floor(Math.random() * length);
    }

    function collectRadioGroups() {
        const radios = Array.from(document.querySelectorAll('input[type="radio"]'))
            .filter(radio => !radio.disabled && isVisible(radio));

        const byName = new Map();
        const unnamed = [];

        radios.forEach(radio => {
            const name = radio.getAttribute("name");
            if (!name) {
                unnamed.push(radio);
                return;
            }

            if (!byName.has(name)) byName.set(name, []);
            byName.get(name).push(radio);
        });

        const groups = Array.from(byName.values());

        unnamed.forEach(radio => {
            const row = radio.closest("tr");
            if (!row) {
                groups.push([radio]);
                return;
            }

            const rowRadios = Array.from(row.querySelectorAll('input[type="radio"]'))
                .filter(item => !item.disabled && isVisible(item));

            if (rowRadios.length > 0 && !groups.some(group => group.some(item => rowRadios.includes(item)))) {
                groups.push(rowRadios);
            }
        });

        return groups
            .map(group => uniqueByNode(group))
            .filter(group => group.length > 0)
            .sort((a, b) => {
                const pos = a[0].compareDocumentPosition(b[0]);
                return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
            });
    }

    function isCommentField(field) {
        if (field.tagName === "TEXTAREA") return true;

        const hint = [
            field.name,
            field.id,
            field.placeholder,
            field.getAttribute("aria-label"),
        ].filter(Boolean).join(" ").toLowerCase();

        return /comment|remark|opinion|suggest|pj|yj|bz|评价|意见|建议|备注/.test(hint);
    }

    function fillComments() {
        let filled = 0;

        document.querySelectorAll("textarea, input[type='text']").forEach(textarea => {
            if (textarea.disabled || textarea.readOnly || !isVisible(textarea)) return;
            if (!isCommentField(textarea)) return;

            const maxLength = Number(textarea.getAttribute("maxlength"));
            const value = maxLength > 0 ? CONFIG.commentText.slice(0, maxLength) : CONFIG.commentText;

            if (!textarea.value.trim()) {
                textarea.value = value;
                trigger(textarea, "input");
                trigger(textarea, "change");
                filled += 1;
            }
        });

        return filled;
    }

    function selectGroupOption(group, optionIndex) {
        const target = group[Math.min(optionIndex, group.length - 1)];

        if (!target.checked) {
            setRadioChecked(target);
            return true;
        }

        return false;
    }

    async function fillEvaluation(options = {}) {
        console.log("开始填写教学评价...");

        const groups = collectRadioGroups();

        if (groups.length === 0) {
            alert("没有找到评价选项，请确认当前页面是教学评价页面");
            return;
        }

        let checkedCount = 0;

        groups.forEach(group => {
            if (selectGroupOption(group, CONFIG.defaultOptionIndex)) {
                checkedCount += 1;
            }
        });

        const fallbackGroups = groups.filter(group => group.length > CONFIG.fallbackOptionIndex);
        let fallbackGroupNumber = 0;

        if (fallbackGroups.length > 0) {
            const fallbackGroup = fallbackGroups[randomIndex(fallbackGroups.length)];
            fallbackGroupNumber = groups.indexOf(fallbackGroup) + 1;

            if (selectGroupOption(fallbackGroup, CONFIG.fallbackOptionIndex)) {
                checkedCount += 1;
            }
        }

        await sleep(300);

        const commentCount = fillComments();
        const result = {
            checkedCount: checkedCount || groups.length,
            commentCount,
            groupCount: groups.length,
            fallbackGroupNumber,
        };

        if (options.showAlert !== false) {
            alert(`已填写 ${result.groupCount} 组评价，其中第 ${fallbackGroupNumber || "?"} 组随机设为“较符合”${commentCount ? `，并填写 ${commentCount} 处文字意见` : ""}。请确认无误后再保存或提交。`);
        }

        return result;
    }

    function findButtonByText(textList) {
        const candidates = Array.from(document.querySelectorAll("button, input[type='button'], input[type='submit'], a"));

        return candidates.find(el => {
            if (!isVisible(el) || el.disabled) return false;

            const text = (el.innerText || el.value || el.textContent || "").replace(/\s+/g, "");
            return textList.some(target => text === target || text.includes(target));
        });
    }

    function clickPageButton(textList, missingMessage) {
        const btn = findButtonByText(textList);

        if (!btn) {
            alert(missingMessage);
            return;
        }

        btn.click();
    }

    async function fillAndClick(textList, missingMessage) {
        const result = await fillEvaluation({ showAlert: false });
        await sleep(500);
        clickPageButton(textList, missingMessage);
        return result;
    }

    function makePanelButton(text, onClick, isPrimary) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.innerText = text;

        btn.style.padding = "9px 12px";
        btn.style.background = isPrimary ? "#4b7bec" : "#eef3ff";
        btn.style.color = isPrimary ? "#fff" : "#234";
        btn.style.border = "1px solid #9bb8ec";
        btn.style.borderRadius = "6px";
        btn.style.fontSize = "14px";
        btn.style.fontWeight = "700";
        btn.style.cursor = "pointer";
        btn.style.whiteSpace = "nowrap";

        btn.addEventListener("click", onClick);
        return btn;
    }

    function createButton() {
        if (document.getElementById(CONFIG.panelId) || !document.body) return;

        const panel = document.createElement("div");
        panel.id = CONFIG.panelId;
        panel.style.position = "fixed";
        panel.style.right = "24px";
        panel.style.bottom = "88px";
        panel.style.zIndex = "999999";
        panel.style.display = "flex";
        panel.style.gap = "8px";
        panel.style.alignItems = "center";
        panel.style.padding = "10px";
        panel.style.background = "rgba(255,255,255,0.96)";
        panel.style.border = "1px solid #c9d7f2";
        panel.style.borderRadius = "8px";
        panel.style.boxShadow = "0 6px 18px rgba(0,0,0,0.18)";

        const title = document.createElement("span");
        title.innerText = "脚本控制";
        title.style.fontSize = "13px";
        title.style.fontWeight = "700";
        title.style.color = "#345";
        title.style.padding = "0 2px";
        title.style.whiteSpace = "nowrap";

        panel.appendChild(title);
        panel.appendChild(makePanelButton("一键填写", fillEvaluation, true));
        panel.appendChild(makePanelButton("一键填写保存", () => fillAndClick(["保存"], "没有找到页面上的“保存”按钮"), false));
        panel.appendChild(makePanelButton("一键填写提交", () => fillAndClick(["提交"], "没有找到页面上的“提交”按钮"), false));

        document.body.appendChild(panel);
    }

    function init() {
        createButton();

        const observer = new MutationObserver(() => createButton());
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    if (document.readyState === "loading") {
        window.addEventListener("load", () => {
            setTimeout(init, 1000);
        });
    } else {
        setTimeout(init, 1000);
    }
})();
