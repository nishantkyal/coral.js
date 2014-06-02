import q                                                    = require('q');
import express                                              = require('express');
import json2xml                                             = require('json2xml');
import ApiConstants                                         = require('../enums/ApiConstants');
import IncludeFlag                                          = require('../enums/IncludeFlag');
import PhoneType                                            = require('../enums/PhoneType');
import CallFragmentStatus                                   = require('../enums/CallFragmentStatus');
import CallStatus                                           = require('../enums/CallStatus');
import AgentType                                            = require('../enums/AgentType');
import IntegrationMemberDelegate                            = require('../delegates/IntegrationMemberDelegate');
import PhoneCallDelegate                                    = require('../delegates/PhoneCallDelegate');
import PhoneCallCache                                       = require('../caches/PhoneCallCache');
import UserPhoneDelegate                                    = require('../delegates/UserPhoneDelegate');
import TwilioUrlDelegate                                    = require('../delegates/TwilioUrlDelegate');
import CallFragmentDelegate                                 = require('../delegates/CallFragmentDelegate');
import ScheduledTaskDelegate                                = require('../delegates/ScheduledTaskDelegate');
import NotificationDelegate                                 = require('../delegates/NotificationDelegate');
import TwilioProvider                                       = require('../providers/TwilioProvider');
import Utils                                                = require('../common/Utils');
import Config                                               = require('../common/Config');
import Formatter                                            = require('../common/Formatter');
import PhoneCall                                            = require('../models/PhoneCall');
import User                                                 = require('../models/User');
import IntegrationMember                                    = require('../models/IntegrationMember');
import UserPhone                                            = require('../models/UserPhone');
import CallFragment                                         = require('../models/CallFragment');

class TwimlOutApi
{
    static DIAL_CALL_SID:string = 'DialCallSid';
    static CALL_SID:string = 'CallSid';
    static USER_NUMBER:string = 'To';
    static COMPLETED:string = 'completed'; //TODO same definition being repeated in CallFragmentDelegate
    static BUSY:string = 'busy';
    static FAILED:string = 'failed';
    static NO_ANSWER:string = 'no-answer';
    static DIAL_CALL_STATUS:string = 'DialCallStatus';
    static CALL_STATUS:string = 'CallStatus';
    static DURATION:string = 'Duration';
    static START_TIME:string = 'start_time';

    phoneCallDelegate = new PhoneCallDelegate();
    twilioProvider = new TwilioProvider();
    notificationDelegate = new NotificationDelegate();
    phoneCallCache = new PhoneCallCache();

    constructor(app, secureApp)
    {
        var self = this;

        /*
         * Called after User picks up the phone
         * Need to send back expert phone details
         */
        app.get(TwilioUrlDelegate.twimlJoinCall(), function (req:express.Request, res:express.Response)
        {
            var callId = parseInt(req.params[ApiConstants.PHONE_CALL_ID]);
            self.phoneCallDelegate.get(callId)
                .then(
                function callFetched(call:PhoneCall)
                {
                    var pageData = {};
                    pageData['actionURL'] = TwilioUrlDelegate.twimlJoinCall(callId,Config.get(Config.TWILIO_URI));
                    pageData['timeLimit'] = call.getDuration() * 60;
                    pageData['phoneNumber'] = call.getExpertPhone().getCompleteNumber();
                    pageData['record'] = (call.getRecorded() == false) ? 'false' : 'true';
                    pageData['message'] = 'Please wait while we get ' + Formatter.formatName(call.getIntegrationMember().getUser().getFirstName(), call.getIntegrationMember().getUser().getLastName(), call.getIntegrationMember().getUser().getTitle()) + ' on the call';
                    res.render('twilio/TwilioXMLJoin.jade', pageData);
                })
                .fail(function (error)
                {
                    var pageData = {};
                    pageData['message'] = 'Internal Server Error';
                    res.render('twilio/TwilioXMLSay.jade', pageData);
                })
        });

        app.post(TwilioUrlDelegate.twimlJoinCall(), function (req:express.Request, res:express.Response)
        { // called after expert has hung up. saving details into call fragment here.
            var attemptCount = parseInt(req.query[TwilioProvider.ATTEMPTCOUNT]);
            if (Utils.isNullOrEmpty(attemptCount))
                attemptCount = 0;

            var dialCallStatus = req.body[TwimlOutApi.DIAL_CALL_STATUS];
            var callId = parseInt(req.params[ApiConstants.PHONE_CALL_ID]);
            var pageData = {};
            var call:PhoneCall = new PhoneCall();
            call.setNumReattempts(attemptCount);

            var callFragment:CallFragment = new CallFragment(); //save information received in CaLLFragment
            callFragment.setCallId(callId);
            callFragment.setAgentCallSidExpert(req.body[TwimlOutApi.DIAL_CALL_SID]);
            callFragment.setAgentCallSidUser(req.body[TwimlOutApi.CALL_SID]);
            callFragment.setFromNumber(req.body[TwimlOutApi.USER_NUMBER]);
            callFragment.setCallFragmentStatus(CallFragmentStatus.FAILED_EXPERT_ERROR); // if successful then this value will be overwritten

            switch (dialCallStatus) //decide the message based on expertCallStatus and attemptCount
            {
                case TwimlOutApi.COMPLETED:
                    pageData['message'] = 'Call Completed. Thank you for using our services';
                    break;
                case TwimlOutApi.BUSY:
                    pageData['message'] = 'Call could not be completed. We regret the inconvenience caused.';
                    break;
                case TwimlOutApi.NO_ANSWER:
                    if (attemptCount == 1)
                        pageData['message'] = 'Call could not be completed. We regret the inconvenience caused';
                    else
                        pageData['message'] = 'Expert did not answer the call. We will retry in ' + Config.get(Config.CALL_RETRY_DELAY_SECS)/60 + ' minutes';
                    break;
                default:
                    if (attemptCount == 1)
                        pageData['message'] = 'Call could not be completed. We regret the inconvenience caused';
                    else
                        pageData['message'] = 'The expert is unreachable. We will retry in ' + Config.get(Config.CALL_RETRY_DELAY_SECS)/60 + ' minutes';
            }
            res.render('twilio/TwilioXMLSay.jade', pageData);

            q.all([
                self.twilioProvider.updateCallFragment(callFragment),
                self.notificationDelegate.sendCallStatusNotifications(callFragment, attemptCount)
            ])
            .then(
            function (...args){
                if(args[0][0])
                {
                    var fragmentStatus:CallFragmentStatus = args[0][0].getCallFragmentStatus();
                    if (fragmentStatus == CallFragmentStatus.SUCCESS)
                        call.setStatus(CallStatus.COMPLETED)
                    else if(attemptCount == 1 && fragmentStatus != CallFragmentStatus.SUCCESS)
                        call.setStatus(CallStatus.FAILED);
                    if(attemptCount == 0)
                        call.setDelay(Config.get(Config.CALL_RETRY_DELAY_SECS));
                }
                return q.all([
                    self.phoneCallDelegate.update(callId,call),
                    self.phoneCallCache.addCall(call)
                ])
            })
            .then(
            function callUpdated(...args)
            {
                self.phoneCallDelegate.queueCallForTriggering(callId);
            });
        });

        /* Called after User hangs up the call */
        app.post(TwilioUrlDelegate.twimlCallback(), function (req:express.Request, res:express.Response)
        {
            res.json('OK');

            var self = this;
            var callId = parseInt(req.params[ApiConstants.PHONE_CALL_ID]);

            var callStatus = req.body[TwimlOutApi.CALL_STATUS];
            var attemptCount = parseInt(req.query[TwilioProvider.ATTEMPTCOUNT]);
            attemptCount = attemptCount || 0;

            var call:PhoneCall = new PhoneCall();
            call.setNumReattempts(attemptCount);

            if (callStatus != TwimlOutApi.COMPLETED) // if completed then information saved after expert drops the call
            {
                //save information for failed call
                var callFragment:CallFragment = new CallFragment();
                callFragment.setCallId(parseInt(req.params[ApiConstants.PHONE_CALL_ID]));
                callFragment.setAgentCallSidUser(req.body[TwimlOutApi.CALL_SID]);
                callFragment.setFromNumber(req.body[TwimlOutApi.USER_NUMBER]);
                callFragment.setDuration(parseInt(req.body[TwimlOutApi.DURATION]));
                callFragment.setAgentId(AgentType.TWILIO);

                if (callStatus == TwimlOutApi.FAILED) //failed means twilio was not able to connect the call
                    callFragment.setCallFragmentStatus(CallFragmentStatus.FAILED_SERVER_ERROR);
                else
                    callFragment.setCallFragmentStatus(CallFragmentStatus.FAILED_USER_ERROR);

                if (attemptCount == 0)
                    self.phoneCallDelegate.queueCallForTriggering(callId);

                q.all([
                    self.twilioProvider.updateCallFragment(callFragment),
                    self.notificationDelegate.sendCallFailureNotifications(callId)
                ])
                .then(
                function (...args){
                    if(args[0][0])
                    {
                        var fragmentStatus:CallFragmentStatus = args[0][0].getCallFragmentStatus();

                        if (fragmentStatus == CallFragmentStatus.SUCCESS)
                            call.setStatus(CallStatus.COMPLETED)
                        else if(attemptCount == 1 && fragmentStatus != CallFragmentStatus.SUCCESS)
                            call.setStatus(CallStatus.FAILED);

                        if(attemptCount == 0)
                            call.setDelay(Config.get(Config.CALL_RETRY_DELAY_SECS));
                    }
                    return q.all([
                        self.phoneCallDelegate.update(callId,call),
                        self.phoneCallCache.addCall(call)
                    ])
                })
                .then(
                function callUpdated(...args)
                {
                    self.phoneCallDelegate.queueCallForTriggering(callId);
                });
            }
        });
    }
}
export = TwimlOutApi

