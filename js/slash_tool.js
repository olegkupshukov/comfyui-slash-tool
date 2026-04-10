/**
 * Slash Tool — toggle with X, drag to cut connection wires.
 * X = toggle on/off, Escape = cancel.
 * Uses pointer events (capture) to intercept before LiteGraph.
 */

import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "Comfy.SlashTool",

    async setup() {
        /* ── state ── */
        let slashMode = false;
        let isDrawing = false;
        let startX = 0, startY = 0;  // graph-space
        let endX   = 0, endY   = 0;

        const canvasEl = app.canvas.canvas;

        /* ── coordinate conversion ── */
        function clientToGraph(clientX, clientY) {
            const rect   = canvasEl.getBoundingClientRect();
            const scale  = app.canvas.ds.scale;
            const offset = app.canvas.ds.offset;
            return [
                (clientX - rect.left) / scale - offset[0],
                (clientY - rect.top)  / scale - offset[1],
            ];
        }

        /* ── pointer handlers ── */
        function onPointerDown(e) {
            if (e.button !== 0) return;
            e.stopPropagation();
            e.preventDefault();
            isDrawing = true;
            [startX, startY] = clientToGraph(e.clientX, e.clientY);
            endX = startX;
            endY = startY;
            app.canvas.setDirty(true, true);
        }

        function onPointerMove(e) {
            if (!isDrawing) return;
            [endX, endY] = clientToGraph(e.clientX, e.clientY);
            app.canvas.setDirty(true, true);
        }

        function onPointerUp(e) {
            if (!isDrawing) return;
            e.stopPropagation();
            e.preventDefault();
            [endX, endY] = clientToGraph(e.clientX, e.clientY);
            isDrawing = false;
            const n = cutLinks();
            console.log(`[SlashTool] cut ${n} link${n !== 1 ? "s" : ""}`);
            app.canvas.setDirty(true, true);
        }

        /* ── mode toggle ── */
        const cursorUrl = window.location.origin + '/extensions/slash_tool/cursor.png?' + Date.now();

        function enableSlashMode() {
            slashMode = true;
            app.canvas.allow_dragcanvas = false;
            canvasEl.style.cursor = `url('${cursorUrl}') 2 22, crosshair`;
            document.body.style.cursor = `url('${cursorUrl}') 2 22, crosshair`;
            document.addEventListener("pointerdown", onPointerDown, { capture: true });
            document.addEventListener("pointermove", onPointerMove, { capture: true });
            document.addEventListener("pointerup",   onPointerUp,   { capture: true });
            app.canvas.setDirty(true, true);
            console.log("[SlashTool] mode ON");
        }

        function exitSlashMode() {
            slashMode = false;
            isDrawing = false;
            app.canvas.allow_dragcanvas = true;
            canvasEl.style.cursor = "";
            document.body.style.cursor = "";
            document.removeEventListener("pointerdown", onPointerDown, { capture: true });
            document.removeEventListener("pointermove", onPointerMove, { capture: true });
            document.removeEventListener("pointerup",   onPointerUp,   { capture: true });
            app.canvas.setDirty(true, true);
            console.log("[SlashTool] mode OFF");
        }

        /* ── keyboard ── */
        document.addEventListener("keydown", (e) => {
            if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key === "x" || e.key === "X") {
                if (document.activeElement?.matches("input, textarea, [contenteditable]")) return;
                slashMode ? exitSlashMode() : enableSlashMode();
            }
        });

        /* ── permanent exit listeners ── */
        document.addEventListener('pointerdown', (e) => {
            if (slashMode && e.button !== 0) {
                exitSlashMode();
                canvasEl.dispatchEvent(new PointerEvent('pointerdown', e));
            }
        }, { capture: true });

        document.addEventListener('keydown', (e) => {
            if (slashMode && e.key !== 'x' && e.key !== 'X') {
                exitSlashMode();
                canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: e.key, bubbles: true, cancelable: true }));
            }
        }, { capture: true });

        /* ── link cutting ── */
        function cutLinks() {
            const a = [startX, startY];
            const b = [endX,   endY];
            const toRemove = [];
            for (const id in app.graph.links) {
                const link = app.graph.links[id];
                if (link && linkCrossesSegment(link, a, b)) {
                    toRemove.push(parseInt(id, 10));
                }
            }
            for (const id of toRemove) app.graph.removeLink(id);
            if (toRemove.length) app.canvas.setDirty(true, true);
            return toRemove.length;
        }

        function linkCrossesSegment(link, a, b) {
            const on = app.graph.getNodeById(link.origin_id);
            const tn = app.graph.getNodeById(link.target_id);
            if (!on || !tn) return false;

            const p0 = on.getConnectionPos(false, link.origin_slot);
            const p3 = tn.getConnectionPos(true,  link.target_slot);
            if (!p0 || !p3) return false;

            const dx   = p3[0] - p0[0];
            const dy   = p3[1] - p0[1];
            const dist = Math.sqrt(dx * dx + dy * dy);
            const cp   = Math.max(dist * 0.25, 20);
            const p1   = [p0[0] + cp, p0[1]];
            const p2   = [p3[0] - cp, p3[1]];

            let prev = p0;
            for (let i = 1; i <= 20; i++) {
                const t    = i / 20;
                const curr = cubicBezier(p0, p1, p2, p3, t);
                if (segmentsIntersect(prev, curr, a, b)) return true;
                prev = curr;
            }
            return false;
        }

        function cubicBezier(p0, p1, p2, p3, t) {
            const u = 1 - t;
            return [
                u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
                u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1],
            ];
        }

        function segmentsIntersect(a1, a2, b1, b2) {
            const d1x = a2[0] - a1[0], d1y = a2[1] - a1[1];
            const d2x = b2[0] - b1[0], d2y = b2[1] - b1[1];
            const cross = d1x * d2y - d1y * d2x;
            if (Math.abs(cross) < 1e-8) return false;
            const ex = b1[0] - a1[0], ey = b1[1] - a1[1];
            const t  = (ex * d2y - ey * d2x) / cross;
            const u  = (ex * d1y - ey * d1x) / cross;
            return t >= 0 && t <= 1 && u >= 0 && u <= 1;
        }

        /* ── canvas overlay ── */
        const origForeground = app.canvas.onDrawForeground?.bind(app.canvas);
        app.canvas.onDrawForeground = function(ctx, visArea) {
            if (origForeground) origForeground(ctx, visArea);
            if (!slashMode || !isDrawing) return;

            const scale = this.ds.scale;

            ctx.save();
            ctx.strokeStyle = "#ff2222";
            ctx.lineWidth   = 1.5 / scale;
            ctx.lineCap     = "round";
            ctx.shadowColor = "#ff6666";
            ctx.shadowBlur  = 10;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX,   endY);
            ctx.stroke();

            ctx.fillStyle  = "#ff2222";
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(startX, startY, 4 / scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        };
    },
});
