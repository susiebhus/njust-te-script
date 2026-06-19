// ==UserScript==
// @name         NJUST 教学评价一键填写
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  南理工教务系统教学评价快速填写
// @match        *://bkjw.njust.edu.cn/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function trigger(el, type) {
        el.dispatchEvent(new Event(type, { bubbles: true }));
    }

    async function fillEvaluation() {
        console.log("开始填写教学评价...");

        // 找到所有单选框
        const radios = Array.from(document.querySelectorAll('input[type="radio"]'));

        if (radios.length === 0) {
            alert("没有找到评价选项，请确认当前页面是教学评价页面");
            return;
        }

        // 按 name 分组：每一个评价指标通常是一组 radio
        const groups = {};

        radios.forEach(radio => {
            const name = radio.name || radio.getAttribute("name");
            if (!name) return;

            if (!groups[name]) groups[name] = [];
            groups[name].push(radio);
        });

        // 每组选择第一个，也就是“很符合”
        Object.values(groups).forEach(group => {
            const best = group[0];

            best.checked = true;
            best.click();

            trigger(best, "input");
            trigger(best, "change");
        });

        await sleep(300);

        // 自动填文本框，如果页面有的话
        const commentText = "老师教学认真负责，课程内容清晰，讲解准确，课堂安排合理，对学习很有帮助。";

        document.querySelectorAll("textarea").forEach(textarea => {
            if (!textarea.value.trim()) {
                textarea.value = commentText;
                trigger(textarea, "input");
                trigger(textarea, "change");
            }
        });

        alert("已自动选择“很符合”。建议你确认一下再点提交。");
    }

    function createButton() {
        if (document.getElementById("njust-auto-eval-btn")) return;

        const btn = document.createElement("button");
        btn.id = "njust-auto-eval-btn";
        btn.innerText = "一键很符合";

        btn.style.position = "fixed";
        btn.style.right = "28px";
        btn.style.bottom = "120px";
        btn.style.zIndex = "999999";
        btn.style.padding = "10px 16px";
        btn.style.background = "#4b7bec";
        btn.style.color = "#fff";
        btn.style.border = "none";
        btn.style.borderRadius = "8px";
        btn.style.fontSize = "14px";
        btn.style.fontWeight = "bold";
        btn.style.cursor = "pointer";
        btn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";

        btn.addEventListener("click", fillEvaluation);

        document.body.appendChild(btn);
    }

    window.addEventListener("load", () => {
        setTimeout(createButton, 1000);
    });
})();