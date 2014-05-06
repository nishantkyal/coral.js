///<reference path='../_references.d.ts'/>
import _                                                        = require('underscore');
import q                                                        = require('q');
import path                                                     = require('path');
import fs_io                                                    = require('q-io/fs');
import fs                                                       = require('fs');
import log4js                                                   = require('log4js');
import WidgetExpertDelegate                                     = require('../delegates/WidgetExpertDelegate');
import BaseDaoDelegate                                          = require('../delegates/BaseDaoDelegate');
import FileWatcherDelegate                                      = require('../delegates/FileWatcherDelegate');
import IntegrationMemberDelegate                                = require('../delegates/IntegrationMemberDelegate');
import IntegrationMember                                        = require('../models/IntegrationMember');
import Widget                                                   = require('../models/Widget');
import WidgetExpert                                             = require('../models/WidgetExpert');
import WidgetRuntimeData                                        = require('../models/WidgetRuntimeData');
import IncludeFlag                                              = require('../enums/IncludeFlag');
import Config                                                   = require('../common/Config');
import Utils                                                    = require('../common/Utils');
import WidgetDao                                                = require('../dao/WidgetDao');

class WidgetDelegate extends BaseDaoDelegate
{
    private static widgetTemplateCache:{[templateNameAndLocale:string]:string} = {};
    private static logger:log4js.Logger = log4js.getLogger('WidgetDelegate');
    private widgetExpertDelegate = new WidgetExpertDelegate();

    constructor() { super(new WidgetDao()); }

    /* Static constructor workaround */
    private static ctor = (() =>
    {
        new FileWatcherDelegate(Config.get(Config.WIDGET_TEMPLATE_BASE_DIR), [/\.html$/],
            function (files:string[])
            {
                _.each(files, function (fileName:string) { WidgetDelegate.readFileAndCache(fileName); });
            },
            WidgetDelegate.readFileAndCache,
            WidgetDelegate.readFileAndCache,
            WidgetDelegate.readFileAndCache);
    })();

    private static readFileAndCache(filePath:string)
    {
        var fileName = filePath.substring(filePath.lastIndexOf(path.sep) + 1);
        var extension = fileName.substring(fileName.lastIndexOf('.') + 1);
        var fileNameWithoutExtension = fileName.substring(0, fileName.lastIndexOf('.'));

        if (extension != 'html') return;

        fs.readFile(filePath, 'utf8', function (err, data)
        {
            if (data)
            {
                var template = fileNameWithoutExtension.toUpperCase();
                WidgetDelegate.widgetTemplateCache[template] = data;
                WidgetDelegate.logger.debug('Widget template updated: ' + template);

                /*var widgetDelegate = new WidgetDelegate();
                widgetDelegate.search({template: template})
                    .then(
                    function widgetSearched(widgets:Widget[])
                    {
                        return _.map(widgets, function (widget)
                        {
                            return widgetDelegate.computeAndCachePartialWidgetHtml(widget);
                        });
                    });*/
            }
        });
    }

    /**
     * Helper method to embed expert data into widget html. May be used at run time or while generating partial htmls
     * Expert data is specified using pattern {%= %}, {% %}
     * */
    private renderWidgetExpertData(widgetPartialHtml:string, widgetExpert:WidgetExpert[]):string;
    private renderWidgetExpertData(widgetPartialHtml:string, widgetExpert:WidgetExpert):string;
    private renderWidgetExpertData(widgetPartialHtml:string, widgetExpert:any):string
    {
        var originalSettings = _.templateSettings;
        widgetExpert = [].concat(widgetExpert);

        _.templateSettings = {
            evaluate: /{%([\s\S]+?)%}/g,
            interpolate: /{%=([\s\S]+?)%}/g
        };
        var widgetTemplate = _.template(widgetPartialHtml);
        var widgetHtml = widgetTemplate({experts: [].concat(widgetExpert)});

        _.templateSettings = originalSettings;

        return widgetHtml;
    }

    /**
     * Helper method to embed settings into widget html. Used when settings are updated
     * Settings are specified by pattern {{ }}, {[ ]}
     * */
    private renderWidgetSettings(widgetPartialHtml:string, widgetSettings:Object):string
    {
        var originalSettings = _.templateSettings;

        _.templateSettings = {
            evaluate: /\{\[([\s\S]+?)\]\}/g,
            interpolate: /\{\{([\s\S]+?)\}\}/g
        };
        var widgetTemplate = _.template(widgetPartialHtml);
        var widgetHtml = widgetTemplate(widgetSettings);

        _.templateSettings = originalSettings;

        return widgetHtml;
    }

    /**
     * Helper method to render runtime data into widget partials
     * e.g. Availability, Price
     * Settings are specified by pattern [[ ]], [{ }]
     * */
    /*private renderWidgetRuntimeData(widgetPartialHtml:string, runtimeData:Object):string
    {
        var originalSettings = _.templateSettings;

        _.templateSettings = {
            evaluate: /\[\{([\s\S]+?)\}\]/g,
            interpolate: /\[\[([\s\S]+?)]]/g
        };
        var widgetTemplate = _.template(widgetPartialHtml);
        var widgetHtml = widgetTemplate(runtimeData);

        _.templateSettings = originalSettings;

        return widgetHtml;
    }*/

    /*update(criteria:Object, newValues:any, transaction?:any):q.Promise<any>;
    update(criteria:number, newValues:any, transaction?:any):q.Promise<any>;
    update(criteria:any, newValues:any, transaction?:any):q.Promise<any>
    {
        var self = this;

        return super.update(criteria, newValues, transaction)
            .then(
            function widgetUpdated()
            {
                return Utils.getObjectType(criteria) == 'Number' ? self.get(criteria) : self.find(criteria);
            })
            .then(
            function widgetFetched(widget:Widget)
            {
                return self.computeAndCachePartialWidgetHtml(widget);
            });
    }*/

    /**
     * Compute widget html to be cached
     * May be called when widget settings are updated
     * Or, when experts referred to in expert_resource_id are updated
     */
    /*computeAndCachePartialWidgetHtml(widget:number):q.Promise<any>;
    computeAndCachePartialWidgetHtml(widget:Widget):q.Promise<any>;
    computeAndCachePartialWidgetHtml(widget:any):q.Promise<any>
    {
        var self = this;

        function computeAndCache(widget:Widget):q.Promise<any>
        {
            return self.widgetExpertDelegate.get(widget.getExpertId())
                .then(
                function widgetExpertFetched(widgetExpert:WidgetExpert[])
                {
                    var widgetBaseHtml = WidgetDelegate.widgetTemplateCache[widget.getTemplate().toUpperCase()];
                    var widgetHtmlWithExpertData = self.renderWidgetExpertData(widgetBaseHtml, widgetExpert)
                    var widgetHtmlWithSettingsAndExpertData = self.renderWidgetSettings(widgetHtmlWithExpertData, widget.getSettings());
                    return widgetHtmlWithSettingsAndExpertData;
                })
                .then(
                function widgetComputed(widgetHtml:string)
                {
                    return fs_io.write(Config.get(Config.WIDGET_PARTIALS_BASE_DIR) + path.sep + widget.getId(), widgetHtml);
                })
                .fail(
                function widgetCachingFailed(error)
                {
                    self.logger.error('Widget html compute failed for %s. Error: %s', widget.getTemplate().toUpperCase(), JSON.stringify(error));
                    return fs_io.remove(Config.get(Config.WIDGET_PARTIALS_BASE_DIR) + path.sep + widget.getId());
                });
        };

        if (Utils.getObjectType(widget) == 'Number')
            return this.get(widget).then(computeAndCache);
        else if (Utils.getObjectType(widget) == 'Widget')
            return computeAndCache(widget);

        return null;
    }*/

    render(widgetId:number):q.Promise<string>
    {
        var self = this;
        var widget;

        return this.get(widgetId)
            .then(
            function widgetFetched(w:Widget)
            {
                widget = w;
                return self.widgetExpertDelegate.get(widget.getExpertId());
            })
            .then(
            function widgetExpertFetched(widgetExpert:WidgetExpert[])
            {
                var widgetBaseHtml = WidgetDelegate.widgetTemplateCache[widget.getTemplate().toUpperCase()];
                var widgetHtmlWithExpertData = self.renderWidgetExpertData(widgetBaseHtml, widgetExpert)
                var widgetHtmlWithSettingsAndExpertData = self.renderWidgetSettings(widgetHtmlWithExpertData, widget.getSettings());
                return widgetHtmlWithSettingsAndExpertData;
            });
    }

}
export = WidgetDelegate