import { Options } from './options.model';
import { getContainerElement, isAbsoluteUrl, hashCode } from './loader-utils';

declare const window: any;
window.meltwaterSingleSpaAngular = window.meltwaterSingleSpaAngular || {};

const xmlToAssets = (xml: string): { styles: string[], scripts: string[] } => {
    const dom = document.createElement('html');
    dom.innerHTML = xml;
    const linksEls = dom.querySelectorAll('link[rel="stylesheet"]');
    const scriptsEls = dom.querySelectorAll('script[type="text/javascript"]');
    return {
        styles: Array.from(linksEls).map(el => el.getAttribute('href')),
        scripts: Array.from(scriptsEls).map(el => el.getAttribute('src')).filter(src => !src.match(/zone\.js/))
    };
};

const transformOptsWithAssets = (opts: Options): Promise<null> => {
    const url = `${opts.baseHref}/index.html`;
    return new Promise((resolve, reject) => {
        const req = new XMLHttpRequest();
        req.onreadystatechange = (event) => {
            if (req.readyState === XMLHttpRequest.DONE) {
                if (req.status >= 200 && req.status < 400) {
                    const res = xmlToAssets(req.responseText);
                    opts.styles = res.styles;
                    opts.scripts = res.scripts;
                    resolve(null);
                } else {
                    reject(`Try to load ${url}, status : ${this.status} => ${this.statusText}`);
                }
            }
        };
        req.open('GET', url, true);
        req.send(null);
    });
};



const noLoadingApp = (currentApp: string, singleSpa: any) => {
    const { getAppNames, getAppStatus, BOOTSTRAPPING } = singleSpa
    const firstInMounting = getAppNames().find((appName: string) => {
        return getAppStatus(appName) === BOOTSTRAPPING;
    });
    const firstInMountingIndex = getAppNames().indexOf(firstInMounting);
    const currentIndex = getAppNames().indexOf(currentApp);
    return currentIndex <= firstInMountingIndex;
};

const onNotLoadingApp = (currentApp: string, props: any) => {
    const { singleSpa } = props;
    const bootstrapMaxTime = props.bootstrapMaxTime || 10000;
    return new Promise((resolve, reject) => {
        let time = 0;
        const INTERVAL = 100;
        const interval = setInterval(() => {
            time += INTERVAL;
            if (noLoadingApp(currentApp, singleSpa)) {
                clearInterval(interval);
                resolve();
            }
            if (time >= bootstrapMaxTime) {
                clearInterval(interval);
                reject(`The application could not be loaded because another is still loading more than ${time} milliseconds`);
            }
        }, INTERVAL);
    });
};

const loadAllAssets = (opts: Options) => {
    return new Promise((resolve, reject) => {
        transformOptsWithAssets(opts).then(() => {
            const scriptsPromise = opts.scripts.reduce(
                (prev: Promise<undefined>, fileName: string) => prev.then(loadScriptTag({url: fileName, baseHref: opts.baseHref})),
                Promise.resolve(undefined)
            );
            const stylesPromise = opts.styles.reduce(
                (prev: Promise<undefined>, fileName: string) => prev.then(loadLinkTag({url: fileName, baseHref: opts.baseHref})),
                Promise.resolve(undefined)
            );
            Promise.all([scriptsPromise, stylesPromise]).then(resolve, reject);
        }, reject); 
    });
};


// Check to see if the url is an absolute or relative path.
// If it is a relative path: append the baseHref so that proxy will properly retrieve them 
const loadScriptTag = (scriptOpts: {url: string, baseHref: string}) => {
    return () => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.onload = function () {
                resolve();
            };
            script.onerror = err => {
                reject(err);
            };

            if (isAbsoluteUrl(scriptOpts.url)){
                script.src = scriptOpts.url;
                script.id = hashCode(scriptOpts.url); 
            } else {
                script.src = `${scriptOpts.baseHref}/${scriptOpts.url}`;
                script.id = hashCode(`${scriptOpts.baseHref}/${scriptOpts.url}`); 
            }
            document.head.appendChild(script);
        });
    };
};

const loadLinkTag = (scriptOpts: {url: string, baseHref: string}) => {
    return () => {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.onload = function () {
                resolve();
            };
            link.onerror = err => {
                reject(err);
            };
            if(isAbsoluteUrl(scriptOpts.url)) {
                link.href = scriptOpts.url;
                link.id = hashCode(scriptOpts.url);
            } else {
                link.href = `${scriptOpts.baseHref}/${scriptOpts.url}`;
                link.id = hashCode(`${scriptOpts.baseHref}/${scriptOpts.url}`);
            }
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        });
    };
};

const unloadTag = (url: string) => {
    return () => {
        return new Promise((resolve, reject) => {
            const tag = document.getElementById(hashCode(url));
            document.head.removeChild(tag);
            resolve();
        });
    };
};

const bootstrap = (opts: Options, props: any) => {
    window.meltwaterSingleSpaAngular.isSingleSpa = true;
    return new Promise((resolve, reject) => {
        onNotLoadingApp(opts.name, props).then(() => {
            loadAllAssets(opts).then(resolve, reject);
        }, reject);
    });
};

const mount = (opts: Options, props: any) => {
    return new Promise((resolve, reject) => {
        getContainerElement(opts);
        if (window.meltwaterSingleSpaAngular[opts.name]) {
            window.meltwaterSingleSpaAngular[opts.name].mount(props);
            resolve();
        } else {
            console.error(`Cannot mount ${opts.name} because that is not bootstraped`);
            reject();
        }
    });
};

const unmount = (opts: Options, props: any) => {
    const { singleSpa: { unloadApplication, getAppNames } } = props;
    return new Promise((resolve, reject) => {
        if (window.meltwaterSingleSpaAngular[opts.name]) {
            window.meltwaterSingleSpaAngular[opts.name].unmount();
            const container = getContainerElement(opts);
            if(container.parentNode) {
                container.parentNode.removeChild(container);
            }
            if (getAppNames().indexOf(opts.name) !== -1) {
                unloadApplication(opts.name, { waitForUnmount: true });
                resolve();
            } else {
                reject(`Cannot unmount ${opts.name} because that ${opts.name} is not part of the decalred applications : ${getAppNames()}`);
            }
        } else {
            reject(`Cannot unmount ${opts.name} because that is not bootstraped`);
        }
    });
};

const unload = (opts: Options, props: any) => {
    return new Promise((resolve, reject) => {
        opts.scripts.concat(opts.styles).reduce(
            (prev: Promise<undefined>, scriptName: string) => {
                let tag = `${opts.baseHref}/${scriptName}`;
                if(isAbsoluteUrl(scriptName)){
                    tag = scriptName;
                }
                return prev.then(unloadTag(tag));
            },
            Promise.resolve(undefined)
        );
        resolve();
    });
};

export function loader(opts: Options) {
    if (typeof opts !== 'object') {
        throw new Error(`@meltwater/single-spa-angular requires a configuration object`);
    }

    if (typeof opts.name !== 'string') {
        throw new Error(`@meltwater/single-spa-angular must be passed opts.name string (ex : app1)`);
    }

    if (typeof opts.baseHref !== 'string') {
        throw new Error(`@meltwater/single-spa-angular must be passed opts.baseHref string (ex : /app1)`);
    }

    return {
        bootstrap: bootstrap.bind(null, opts),
        mount: mount.bind(null, opts),
        unmount: unmount.bind(null, opts),
        unload: unload.bind(null, opts)
    };
}
