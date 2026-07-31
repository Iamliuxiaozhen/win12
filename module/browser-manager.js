'use strict';

// Browser Manager deliberately contains no tab, history, or UI state.
// It only decides where a URL should be rendered and performs the handoff.
window.browser = {
    mode: 'hybrid',

    configure(mode) {
        this.mode = ['hybrid', 'embedded', 'external'].includes(mode) ? mode : 'hybrid';
    },

    classify(url) {
        if (url === 'mainpage.html' || /^data\//.test(url) || /^\.\/?data\//.test(url)) {
            return 'internal';
        }
        try {
            const parsed = new URL(url, window.location.href);
            return parsed.origin === window.location.origin ? 'internal' :
                ['http:', 'https:'].includes(parsed.protocol) ? 'external' : 'invalid';
        } catch (_) {
            return 'invalid';
        }
    },

    openInternal(url, handlers = {}) {
        if (typeof handlers.open === 'function') return handlers.open(url);
        window.location.href = url;
    },

    async openExternal(url, { label, title = 'Microsoft Edge', parent = 'main', onDestroyed, onTitle, onUrl } = {}) {
        const parsed = new URL(url, window.location.href);
        if (!['http:', 'https:'].includes(parsed.protocol) || /[\u0000-\u001f\u007f]/.test(parsed.href)) {
            throw new Error('不允许打开此类型的链接');
        }

        const WebviewWindow = window.__TAURI__?.webviewWindow?.WebviewWindow;
        if (window.win12Native?.isTauri?.() && WebviewWindow) {
            if (!label) throw new Error('外部浏览器窗口缺少标签标识');
            let placement = {};
            try {
                const mainWindow = window.__TAURI__.window?.getCurrentWindow?.();
                if (mainWindow) {
                    const [position, size] = await Promise.all([mainWindow.outerPosition(), mainWindow.innerSize()]);
                    placement = { x: position.x, y: position.y, width: size.width, height: size.height };
                }
            } catch (_) {}
            return new Promise((resolve, reject) => {
                const webview = new WebviewWindow(label, {
                    url: parsed.href,
                    title,
                    parent,
                    x: placement.x,
                    y: placement.y,
                    center: placement.x === undefined,
                    decorations: false,
                    resizable: true,
                    focus: true,
                    visible: true,
                    width: placement.width || 1100,
                    height: placement.height || 760
                });
                webview.once('tauri://destroyed', () => {
                    if (typeof onDestroyed === 'function') onDestroyed(label);
                });
                webview.listen('tauri://page-load', (event) => {
                    const payload = event.payload || {};
                    if (payload.url && typeof onUrl === 'function') onUrl(payload.url);
                    if (typeof onTitle === 'function') {
                        webview.title().then(onTitle).catch(() => {});
                    }
                }).catch(() => {});
                webview.once('tauri://created', () => resolve(webview));
                webview.once('tauri://error', event => reject(new Error(String(event.payload || '无法创建 WebView 窗口'))));
            });
        }

        return this.fallback(parsed.href);
    },

    fallback(url, originalError) {
        if (window.__TAURI__?.opener?.openUrl) {
            return window.__TAURI__.opener.openUrl(url);
        }
        if (!window.win12Native?.isTauri?.()) {
            return window.open(url, '_blank');
        }
        throw originalError || new Error('无法启动系统浏览器');
    }
};
