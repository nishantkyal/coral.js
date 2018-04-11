"use strict";
const i18n = require("i18n");
class LocalizationDelegate {
    static get(key, data, locale = 'en') {
        if (locale)
            return i18n.__({ 'phrase': key, 'locale': locale }, data);
        return i18n.__(key);
    }
    static setLocale(locale) {
        i18n.setLocale(locale);
    }
}
LocalizationDelegate.ctor = (() => {
    i18n.configure({
        defaultLocale: 'en',
        locales: ['en'],
        updateFiles: false,
        directory: '/var/searchntalk/localization',
        objectNotation: true
    });
})();
module.exports = LocalizationDelegate;
//# sourceMappingURL=LocalizationDelegate.js.map