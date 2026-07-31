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

    async openExternal(url, { label, title = 'Microsoft Edge', parent = 'main' } = {}) {
        const parsed = new URL(url, window.location.href);
        if (!['http:', 'https:'].includes(parsed.protocol) || /[\u0000-\u001f\u007f]/.test(parsed.href)) {
            throw new Error('不允许打开此类型的链接');
        }

        const WebviewWindow = window.__TAURI__?.webviewWindow?.WebviewWindow;
        if (window.win12Native?.isTauri?.() && WebviewWindow) {
            if (!label) throw new Error('外部浏览器窗口缺少标签标识');
            return new Promise((resolve, reject) => {
                const webview = new WebviewWindow(label, {
                    url: parsed.href,
                    title,
                    parent,
                    center: true,
                    decorations: true,
                    resizable: true,
                    focus: true,
                    visible: true,
                    width: 1100,
                    height: 760
                });
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
