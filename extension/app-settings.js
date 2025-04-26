const DEFAULT = {
    serverDomain: 'http://localhost:8000/',
    downloadType: 'json',
}

class AppSettings {
    constructor() {
        if (!localStorage.getItem('server-domain')) {
            localStorage.setItem('server-domain', DEFAULT.serverDomain);
        }

        if (!localStorage.getItem('download-file-type')) {
            localStorage.setItem('download-file-type', DEFAULT.downloadType);
        }
    }

    get serverDomain() {
        return localStorage.getItem('server-domain');
    }

    set serverDomain(s) {
        localStorage.setItem('server-domain', s);
    }

    get downloadType() {
        return localStorage.getItem('download-file-type');
    }

    set downloadType(s) {
        localStorage.setItem('download-file-type', s);
    }
}

export const appSettings = new AppSettings();

