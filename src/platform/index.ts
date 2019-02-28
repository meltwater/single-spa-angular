import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';

declare const window: any;
window.meltwaterSingleSpaAngular = window.meltwaterSingleSpaAngular || {};

export class Platform {

    name: string;
    router: any;

    mount(name: string, container: string, selector: string, router?: any): Observable<any> {
        this.name = name;
        this.router = router;
        return Observable.create((observer: Observer<any>) => {
            if (this.isSingleSpaApp()) {
                window.meltwaterSingleSpaAngular[this.name] = window.meltwaterSingleSpaAngular[this.name] || {};
                window.meltwaterSingleSpaAngular[this.name].mount = (props: any) => {
                    observer.next({ props: {...props, container,selector}, attachUnmount: this.unmount.bind(this) });
                    observer.complete();
                };
            } else {
                observer.next({ props: {}, attachUnmount: this.unmount.bind(this) });
                observer.complete();
            }
        });
    }

    unmount(module: any) {
        if (this.isSingleSpaApp()) {
            window.meltwaterSingleSpaAngular[this.name].unmount = () => {
                if (module) {
                    console.log(`the module ${this.name} is: `);
                    console.log(module);
                    // This should be the case for angular cli projects
                    if (typeof module.destroy === "function") {
                        console.log('destroy() available, calling module.destroy'); // log it out just for now
                        module.destroy();
                    }
                    // This should be the case for angularjs projects
                    else if (typeof module.$destroy === "function") {
                        console.log('$destroy() available, calling module.$destroy'); // log it out just for now
                        module.$destroy();
                    }
                    else {
                        console.log(`No destroy function available on the module for "${this.name}" `);
                    }

                    if (this.router) {
                        module.injector.get(this.router).dispose();
                    }
                }
            };
        }
    }

    private isSingleSpaApp(): boolean {
        return window.meltwaterSingleSpaAngular.isSingleSpa;
    }
}
