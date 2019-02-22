import {Options} from './options.model';

export function getContainerElement (opts: Options) {
    let el = document.querySelector(opts.selector);
    if (!el) {
        el = document.createElement(opts.selector);
        let container = opts.container ? document.querySelector(opts.container) : document.body;
        container.appendChild(el);
    }
    return el;
};

export function hashCode (str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash = hash & hash;
        hash = hash >>> 1;
    }
    return hash.toString();
};

export function isAbsoluteUrl (url: string) {
    return /^[a-z][a-z0-9+.-]*:/.test(url);
}