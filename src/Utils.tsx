export namespace Utils {
    /* tslint:disable:no-bitwise */
    export function uuidv4(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c: string) {
            const r = (Math.random() * 16 | 0);
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // ucs-2 string to base64 encoded ascii
    export function utoa(str: string): string {
        return window.btoa(encodeURIComponent(str));
    }

    // base64 encoded ascii to ucs-2 string
    export function atou(str: string): string {
        return decodeURIComponent(window.atob(str));
    }
}
