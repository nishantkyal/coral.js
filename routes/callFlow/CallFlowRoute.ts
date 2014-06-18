///<reference path='../../_references.d.ts'/>
import connect_ensure_login                                 = require('connect-ensure-login');
import q                                                    = require('q');
import _                                                    = require('underscore');
import moment                                               = require('moment');
import express                                              = require('express');
import passport                                             = require('passport');
import log4js                                               = require('log4js');
import RequestHandler                                       = require('../../middleware/RequestHandler');
import MysqlDelegate                                        = require('../../delegates/MysqlDelegate');
import AuthenticationDelegate                               = require('../../delegates/AuthenticationDelegate');
import IntegrationDelegate                                  = require('../../delegates/IntegrationDelegate');
import IntegrationMemberDelegate                            = require('../../delegates/IntegrationMemberDelegate');
import PhoneCallDelegate                                    = require('../../delegates/PhoneCallDelegate');
import EmailDelegate                                        = require('../../delegates/EmailDelegate');
import TransactionDelegate                                  = require('../../delegates/TransactionDelegate');
import TransactionLineDelegate                              = require('../../delegates/TransactionLineDelegate');
import VerificationCodeDelegate                             = require('../../delegates/VerificationCodeDelegate');
import UserPhoneDelegate                                    = require('../../delegates/UserPhoneDelegate');
import UserProfileDelegate                                  = require('../../delegates/UserProfileDelegate');
import NotificationDelegate                                 = require('../../delegates/NotificationDelegate');
import UserDelegate                                         = require('../../delegates/UserDelegate');
import UserEducationDelegate                                = require('../../delegates/UserEducationDelegate');
import UserSkillDelegate                                    = require('../../delegates/UserSkillDelegate');
import UserEmploymentDelegate                               = require('../../delegates/UserEmploymentDelegate');
import ScheduleDelegate                                     = require('../../delegates/ScheduleDelegate');
import ScheduleExceptionDelegate                            = require('../../delegates/ScheduleExceptionDelegate');
import CouponDelegate                                       = require('../../delegates/CouponDelegate');
import PricingSchemeDelegate                                = require('../../delegates/PricingSchemeDelegate');
import PhoneCall                                            = require('../../models/PhoneCall');
import Schedule                                             = require('../../models/Schedule');
import Transaction                                          = require('../../models/Transaction');
import Coupon                                               = require('../../models/Coupon');
import UserPhone                                            = require('../../models/UserPhone');
import IntegrationMember                                    = require('../../models/IntegrationMember');
import TransactionLine                                      = require('../../models/TransactionLine');
import UserProfile                                          = require('../../models/UserProfile');
import ScheduleException                                    = require('../../models/ScheduleException');
import User                                                 = require('../../models/User');
import PricingScheme                                        = require('../../models/PricingScheme');
import CallStatus                                           = require('../../enums/CallStatus');
import ApiConstants                                         = require('../../enums/ApiConstants');
import IncludeFlag                                          = require('../../enums/IncludeFlag');
import MoneyUnit                                            = require('../../enums/MoneyUnit');
import UserStatus                                           = require('../../enums/UserStatus');
import PhoneType                                            = require('../../enums/PhoneType');
import TransactionStatus                                    = require('../../enums/TransactionStatus');
import TransactionType                                      = require('../../enums/TransactionType');
import Formatter                                            = require('../../common/Formatter');
import Utils                                                = require('../../common/Utils');
import Config                                               = require('../../common/Config');
import DashboardUrls                                        = require('../../routes/dashboard/Urls');
import PayZippyProvider                                     = require('../../providers/PayZippyProvider');

import Urls                                                 = require('./Urls');
import Middleware                                           = require('./Middleware');
import SessionData                                          = require('./SessionData');

class CallFlowRoute
{
    private static INDEX:string = 'callFlow/index';
    private static PAYMENT:string = 'callFlow/payment';

    private logger:log4js.Logger = log4js.getLogger(Utils.getClassName(this));
    private integrationMemberDelegate = new IntegrationMemberDelegate();
    private transactionDelegate = new TransactionDelegate();
    private transactionLineDelegate = new TransactionLineDelegate();
    private phoneCallDelegate = new PhoneCallDelegate();
    private userPhoneDelegate = new UserPhoneDelegate();
    private userProfileDelegate = new UserProfileDelegate();
    private userDelegate = new UserDelegate();
    private userEmploymentDelegate = new UserEmploymentDelegate();
    private userSkillDelegate = new UserSkillDelegate();
    private userEducationDelegate = new UserEducationDelegate();
    private couponDelegate = new CouponDelegate();
    private scheduleDelegate = new ScheduleDelegate();
    private scheduleExceptionDelegate = new ScheduleExceptionDelegate();
    private pricingSchemeDelegate = new PricingSchemeDelegate();

    constructor(app, secureApp)
    {
        // Actual rendered pages
        app.get(Urls.callExpert(), this.index.bind(this));
        app.get(Urls.payment(), Middleware.requireCallerAndCallDetails, Middleware.ensureNotCallingSelf, this.callPaymentPage.bind(this));
        app.post(Urls.payment(), Middleware.requireCallerAndCallDetails, Middleware.ensureNotCallingSelf, this.callPayment.bind(this));
        app.post(Urls.coupon(), Middleware.ensureNotCallingSelf, Middleware.requireTransaction, this.applyCoupon.bind(this))
        app.post(Urls.checkout(), Middleware.ensureNotCallingSelf, Middleware.requireTransaction, this.checkout.bind(this));
        app.get(Urls.removeCoupon(), Middleware.ensureNotCallingSelf, Middleware.requireTransaction, this.removeCoupon.bind(this))

        app.get(Urls.linkedInLogin(), passport.authenticate(AuthenticationDelegate.STRATEGY_LINKEDIN_CALL_LOGIN, {failureRedirect: Urls.payment(), failureFlash: true, scope: ['r_basicprofile', 'r_emailaddress', 'r_fullprofile']}));
        app.get(Urls.linkedInLoginCallback(), passport.authenticate(AuthenticationDelegate.STRATEGY_LINKEDIN_CALL_LOGIN, {failureRedirect: Urls.payment(), failureFlash: true}), this.callPayment.bind(this));

        app.get(Urls.facebookLogin(), passport.authenticate(AuthenticationDelegate.STRATEGY_FACEBOOK_CALL_FLOW, {failureRedirect: Urls.payment(), failureFlash: true, scope: ['public_profile', 'email']}));
        app.get(Urls.facebookLoginCallback(), passport.authenticate(AuthenticationDelegate.STRATEGY_FACEBOOK_CALL_FLOW, {failureRedirect: Urls.payment(), failureFlash: true}), this.callPayment.bind(this));
    }

    /* Render index with expert schedules */
    // Validate that the expert has completed his profile and account is active
    private index(req:express.Request, res:express.Response)
    {
        var self = this;
        var expertId = parseInt(req.params[ApiConstants.EXPERT_ID]);
        var sessionData = new SessionData(req);

        this.integrationMemberDelegate.get(expertId, IntegrationMember.DASHBOARD_FIELDS, [IncludeFlag.INCLUDE_USER])
            .then(
            function expertFetched(expert:IntegrationMember):any
            {
                var user = expert.getUser();

                if (user.getStatus() != UserStatus.ACTIVE)
                {
                    var errorMessage = Formatter.formatName(user.getFirstName(), user.getLastName(), user.getTitle()) + '\'s account has not been setup completely. Please visit us again later.'
                    throw (errorMessage);
                }

                sessionData.setExpert(expert);

                return q.all([
                    self.userProfileDelegate.find(Utils.createSimpleObject(UserProfile.USER_ID, user.getId())),
                    self.phoneCallDelegate.getScheduledCalls(user.getId()),
                    self.scheduleExceptionDelegate.search({'integration_member_id': expert.getId()}, [Schedule.START_TIME, Schedule.DURATION]),
                    self.userDelegate.get(user.getId(), null, [IncludeFlag.INCLUDE_SCHEDULES, IncludeFlag.INCLUDE_PRICING_SCHEMES])
                ]);
            },
            function handleExpertSearchFailed(error)
            {
                self.logger.error('Error in getting expert details - ' +  error);
                throw('No such expert exists!');
            })
            .then(
            function userProfileFetched(...args):any
            {
                var userProfile:UserProfile = args[0][0];

                var exceptions = [];

                if(!Utils.isNullOrEmpty(args[0][1]))
                    exceptions = exceptions.concat(_.map(args[0][1], function(call:any){
                        return {duration:call.getDuration(), start_time:call.getStartTime()}
                    }));

                if(!Utils.isNullOrEmpty(args[0][2]))
                    exceptions = exceptions.concat( _.map(args[0][2], function(exception:any){
                        return {duration:exception.getDuration(), start_time:exception.getStartTime()}
                    }));

                var user:User = args[0][3];

                return [userProfile, exceptions, user, q.all([
                    self.userSkillDelegate.getSkillWithName(userProfile.getId()),
                    self.userEducationDelegate.search({'profileId': userProfile.getId()}),
                    self.userEmploymentDelegate.search({'profileId': userProfile.getId()})
                ])];
            })
            .spread(
            function profileDetailsFetched(userProfile:UserProfile, exceptions:ScheduleException[], user:User, ...args)
            {
                var userSkill = args[0][0] || [];
                var userEducation = args[0][1] || [];
                var userEmployment = args[0][2] || [];

                var expert = sessionData.getExpert();
                expert.setUser(user);
                sessionData.setExpert(expert);

                var pageData = _.extend(sessionData.getData(), {
                    userSkill: _.sortBy(userSkill, function (skill) { return skill['skill_name'].length; }),
                    userProfile: userProfile,
                    userEducation: userEducation,
                    userEmployment: userEmployment,
                    exception: exceptions,
                    messages: req.flash()
                });

                res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
                res.render(CallFlowRoute.INDEX, pageData);
            },
            function handleExpertSearchFailed(error)
            {
                res.render('500', {error: JSON.stringify(error)});
            });
    }

    /* Redirect to convert post to get
     * Note: We're doing a POST so that user selected params don't appear in url*/
    private callPayment(req, res:express.Response)
    {
        res.redirect(Urls.payment());
    }

    /* Validate request from caller and start a new transaction */
    private callPaymentPage(req, res:express.Response)
    {
        var sessionData = new SessionData(req);
        var self = this;
        var expert = sessionData.getExpert();
        var loggedInUserId = req.isAuthenticated() ? sessionData.getLoggedInUser().getId() : null;
        var tasks = [];

        // Delete transaction and call if anything was changed
        var transactionExists:boolean = !Utils.isNullOrEmpty(sessionData.getTransaction());
        if (transactionExists)
        {
            var isExpertChanged = sessionData.getCall().getIntegrationMemberId() != sessionData.getExpert().getId();
            var isDurationChanged = sessionData.getCall().getDuration() != sessionData.getDuration();
            var isAgendaChanged = sessionData.getCall().getAgenda() != sessionData.getAgenda();

            if (isExpertChanged || isDurationChanged || isAgendaChanged)
            {
                tasks.push(self.transactionDelegate.delete(sessionData.getTransaction().getId()));
                tasks.push(self.phoneCallDelegate.delete(sessionData.getCall().getId()));
            }
        }

        // Create transaction and call if anything was changed or if transaction wasn't already started
        if (!transactionExists || isExpertChanged || isDurationChanged || isAgendaChanged)
        {
            var phoneCall = new PhoneCall();
            phoneCall.setIntegrationMemberId(sessionData.getExpert().getId());
            phoneCall.setDelay(0);
            phoneCall.setStatus(CallStatus.PLANNING);
            phoneCall.setDuration(sessionData.getDuration());
            phoneCall.setAgenda(sessionData.getAgenda());
            phoneCall.setPricePerMin(new PricingScheme(expert.getUser().getPricingScheme()[0]).getChargingRate());
            phoneCall.setPriceCurrency(new PricingScheme(expert.getUser().getPricingScheme()[0]).getUnit());
            phoneCall.setCallerUserId(loggedInUserId);

            var transaction = new Transaction();
            transaction.setUserId(loggedInUserId);
            transaction.setStatus(TransactionStatus.CREATED);

            tasks.push(self.phoneCallDelegate.create(phoneCall)
                .then(
                function phoneCallCreated(createdCall:PhoneCall)
                {
                    sessionData.setCall(createdCall);
                    return self.transactionDelegate.createPhoneCallTransaction(transaction, createdCall);
                })
                .then(
                function transactionCreated(createdTransaction:Transaction)
                {
                    sessionData.setTransaction(createdTransaction);
                    return true;
                }));
        }

        // Execute all tasks and render
        q.all(tasks)
            .then(
            function allDone(...args)
            {
                return self.transactionLineDelegate.search(Utils.createSimpleObject(TransactionLine.TRANSACTION_ID, sessionData.getTransaction().getId()));
            }).
            then(function transactionLinesFetched(lines:TransactionLine[])
            {
                lines = _.sortBy(lines, function (line:TransactionLine)
                {
                    return line.getTransactionType();
                });

                // If discount applied, fetch coupon name
                var discountLine = _.findWhere(lines, Utils.createSimpleObject(TransactionLine.TRANSACTION_TYPE, TransactionType.DISCOUNT));
                if (Utils.isNullOrEmpty(discountLine))
                    return [lines];
                else
                    return [lines, self.couponDelegate.get(discountLine.getItemId())];
            })
            .spread(
            function linesAndCouponFetched(...args)
            {
                var lines = args[0];
                var coupon = args[1];

                var pageData = _.extend(sessionData.getData(), {
                    messages: req.flash(),
                    transactionLines: lines,
                    coupon: coupon
                });

                res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
                res.render(CallFlowRoute.PAYMENT, pageData);
            },
            function handleError(error) { res.send(500); });
    }

    /* Apply coupon and send back discount details */
    private applyCoupon(req:express.Request, res:express.Response)
    {
        var self = this;
        var couponCode:string = req.body[ApiConstants.CODE];
        var sessionData:SessionData = new SessionData(req);
        var transaction = sessionData.getTransaction();

        self.transactionDelegate.applyCoupon(transaction.getId(), couponCode)
            .then(
            function transactionLinesFetched() { res.redirect(Urls.payment()); },
            function couponApplyFailed(error)
            {
                req.flash('error', JSON.stringify(error));
                res.redirect(Urls.payment());
            });
    }

    private removeCoupon(req:express.Request, res:express.Response)
    {
        var self = this;

        var sessionData:SessionData = new SessionData(req);
        var transaction = sessionData.getTransaction();

        var couponCode:string = req.query[ApiConstants.CODE];

        self.transactionDelegate.removeCoupon(transaction.getId(),couponCode)
            .then(
            function couponRemoved() { res.redirect(Urls.payment()); },
            function couponRemoveFailed(error)
            {
                req.flash('error', JSON.stringify(error));
                res.redirect(Urls.payment());
            });
    }

    /* Redirect to gateway for payment */
    private checkout(req, res:express.Response)
    {
        var self = this;
        var sessionData = new SessionData(req);
        var transaction = sessionData.getTransaction();
        var call = sessionData.getCall();
        var dbTransaction:Object;

        // Check that we've a valid call for scheduling
        var isCallValid = !Utils.isNullOrEmpty(call.getAgenda())
            && !Utils.isNullOrEmpty(sessionData.getAppointments())

        if (!isCallValid)
        {
            res.render('500', {error: 'An error occurred while scheduling your call. Please try again.'});
            return null;
        }

        var userPhone = new UserPhone();
        userPhone.setCountryCode(sessionData.getCountryCode());
        userPhone.setPhone(sessionData.getCallerPhone());
        userPhone.setUserId(sessionData.getLoggedInUser().getId());
        userPhone.setType(PhoneType.MOBILE);

        // 1. Begin sql transaction
        // 2. Create phone number entry
        // 3. Associate logged in user with call and transaction
        // 4. Associate phone number with call
        // 5. Redirect to checkout
        MysqlDelegate.beginTransaction()
            .then(
            function transactionStarted(t)
            {
                dbTransaction = t;
                return self.userPhoneDelegate.create(userPhone, dbTransaction);
            })
            .then(
            function phoneNumberCreated(createdPhone:UserPhone)
            {
                var userId = sessionData.getLoggedInUser().getId();

                var phoneCallUpdates = {};
                phoneCallUpdates[PhoneCall.CALLER_PHONE_ID] = createdPhone.getId();
                phoneCallUpdates[PhoneCall.CALLER_USER_ID] = userId;

                return q.all([
                    self.phoneCallDelegate.update(call.getId(), phoneCallUpdates, dbTransaction),
                    self.transactionDelegate.update(transaction.getId(), Utils.createSimpleObject(Transaction.USER_ID, userId), dbTransaction)
                ]);
            })
            .then(
            function transactionAndCallUpdated()
            {
                return MysqlDelegate.commit(dbTransaction);
            })
            .then(
            function transactionCommitted()
            {
                return self.transactionLineDelegate.search(Utils.createSimpleObject(TransactionLine.TRANSACTION_ID, transaction.getId()), null, null, dbTransaction);
            })
            .then(
            function transactionLinesFetched(lines:TransactionLine[])
            {
                var payZippyProvider = new PayZippyProvider();
                var amount:number = _.reduce(_.pluck(lines, TransactionLine.AMOUNT), function (memo:number, num:number) { return memo + num; }, 0) * 100;

                if (amount > 0)
                    res.redirect(payZippyProvider.getPaymentUrl(transaction, parseFloat(amount.toFixed(2)), sessionData.getLoggedInUser()));
                else
                    res.redirect(DashboardUrls.paymentCallback() + '?noPayment=true');
            },
            function handleError(error)
            {
                req.flash({error: JSON.stringify(error)});
                res.redirect(Urls.payment());
            });
    }
}

export = CallFlowRoute