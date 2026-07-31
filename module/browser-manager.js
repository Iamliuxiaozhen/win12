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

    async openExternal(url, { fallback = true } = {}) {
        const parsed = new URL(url, window.location.href);
        if (!['http:', 'https:'].includes(parsed.protocol) || /[\u0000-\u001f\u007f]/.test(parsed.href)) {
            throw new Error('不允许打开此类型的链接');
        }

        if (window.win12Native && window.win12Native.isTauri()) {
            try {
                return await window.win12Native.openExternalUrl(parsed.href);
            } catch (error) {
                if (!fallback) throw error;
                return this.fallback(parsed.href, error);
            }
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
