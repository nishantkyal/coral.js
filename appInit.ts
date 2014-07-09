import _                                            = require('underscore');
import q                                            = require('q');
import express                                      = require('express');
import connect_flash                                = require("connect-flash");
import https                                        = require('https');
import path                                         = require('path');
import passport                                     = require('passport');
import log4js                                       = require('log4js');
import moment                                       = require('moment');
import fs                                           = require('fs');
import Config                                       = require('./common/Config');
import Credentials                                  = require('./common/Credentials');
import Formatter                                    = require('./common/Formatter');
import Utils                                        = require('./common/Utils');
import ApiUrlDelegate                               = require('./delegates/ApiUrlDelegate');
import RequestHandler                               = require('./middleware/RequestHandler');
import api                                          = require('./api/index');
import routes                                       = require('./routes/index');
import CountryCode                                  = require('./enums/CountryCode');
import IndustryCode                                 = require('./enums/IndustryCode');
import CountryName                                  = require('./enums/CountryName');
import Salutation                                   = require('./enums/Salutation');
import ItemType                                     = require('./enums/ItemType');
import CouponType                                   = require('./enums/CouponType');
import IntegrationMemberRole                        = require('./enums/IntegrationMemberRole');
import TransactionType                              = require('./enums/TransactionType');
import ScheduledTaskType                            = require('./enums/ScheduledTaskType');
import CallFlowUrls                                 = require('./routes/callFlow/Urls');
import DashboardUrls                                = require('./routes/dashboard/Urls');
import PaymentUrls                                  = require('./routes/payment/Urls');
import MemberRegistrationUrls                       = require('./routes/expertRegistration/Urls');
import AuthenticationUrls                           = require('./routes/authentication/Urls');
var connect                                         = require('connect');
var RedisStore                                      = require('connect-redis')(connect);


class appInit
{
    // View helpers
    static helpers:Object =
    {
        getNameInitials: Formatter.getNameInitials,
        formatMoney: Formatter.formatMoney,
        formatRole: Formatter.formatRole,
        formatName: Formatter.formatName,
        formatSchedule: Formatter.formatSchedule,
        formatDate: Formatter.formatDate,
        formatCallStatus: Formatter.formatCallStatus,
        formatPhone: Formatter.formatPhone,
        formatTimezone: Formatter.formatTimezone,
        moment: moment,

        ApiUrlDelegate: ApiUrlDelegate,
        CallFlowUrls: CallFlowUrls,
        DashboardUrls: DashboardUrls,
        PaymentUrls: PaymentUrls,
        MemberRegistrationUrls: MemberRegistrationUrls,
        AuthenticationUrls: AuthenticationUrls,

        Config: Config,
        Credentials: Credentials,
        escapeObject: Utils.escapeObject,
        unEscapeObject: Utils.unEscapeObject,

        IndustryCodes: Utils.enumToNormalText(IndustryCode),
        Salutation: Utils.enumToNormalText(Salutation),
        CouponType: Utils.enumToNormalText(CouponType),
        ItemType: Utils.enumToNormalText(ItemType),
        TransactionType: Utils.enumToNormalText(TransactionType),
        IntegrationMemberRole: Utils.enumToNormalText(IntegrationMemberRole),
        CountryCode: CountryCode,
        CountryName: Utils.enumToNormalText(CountryName.CountryName),

        minYear: Config.get(Config.MINIMUM_YEAR),
        currentYear: moment().format('YYYY')
    };

    static initialise(app:express.Application)
    {
        app.use(
            function (req:express.Request, res:express.Response, next:Function)
            {
                // This middleware applies to all urls except
                // 1. APIs (which start with "/rest")
                // 2. Static content (which start with "/js" or "/css" or "/img")
                var excludeRegex:RegExp = /^\/(rest|bower_dependencies|css|js|images|img|fonts|static)/;

                if (Utils.isNullOrEmpty(req.path.match(excludeRegex)))
                {
                    _.extend(res.locals, appInit.helpers);
                    res.locals.path = req.path;
                }

                next();
            }
        );

        // all environments
        app.use(express.compress());
        app.set('views', path.join(__dirname, 'views'));
        app.set('view engine', 'jade');

        var oneDay = 86400000;
        app.use(express.static(path.join(__dirname, 'public'), {maxAge: oneDay}));

        app.use(express.json());
        app.use(express.urlencoded());

        app.use(express.methodOverride());
        app.use(RequestHandler.parseRequest);
        app.use(express.cookieParser());

        app.use(express.session({
            secret: 'searchntalk.com',
            cookie: {maxAge: Config.get(Config.SESSION_EXPIRY)},
            store: new RedisStore({
                host: Config.get(Config.REDIS_HOST),
                port: Config.get(Config.REDIS_PORT),
                db: 1
            })
        }));

        app.use(passport.initialize());
        app.use(passport.session({}));
        app.use(connect_flash());

        // APIs and Route endpoints
        api(app);
        routes(app);

        /* Error Pages */
        app.use(function (req:express.Request, res:express.Response, next:Function)
        {
            res.status(404);

            // respond with html page
            if (req.accepts('html'))
            {
                res.render('404', { url: req.url });
                return;
            }

            // respond with json
            if (req.accepts('json'))
            {
                res.send({ error: 'Not found' });
                return;
            }

            // default to plain-text. send()
            res.type('txt').send('Not found');
        });

        app.use(function (err:any, req:express.Request, res:express.Response, next:Function)
        {
            var isAjax = req.get('content-type') && req.get('content-type').indexOf('application/json') != -1;
            if (isAjax)
                return res.send(500, err.message);

            // we may use properties of the error object
            // here and next(err) appropriately, or if
            // we possibly recovered from the error, simply next().
            res.status(err.status || 500);
            res.render('500', { error: err });
        });


        app.configure('production', function ()
        {
            app.enable('view cache');
        });

    }
}
export = appInit