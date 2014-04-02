///<reference path='../../_references.d.ts'/>
import ApiConstants                                         = require('../../enums/ApiConstants');
import Utils                                                = require('../../common/Utils');
import IntegrationMember                                    = require('../../models/IntegrationMember');
import PhoneCall                                            = require('../../models/PhoneCall');
import BaseModel                                            = require('../../models/BaseModel');
import UserPhone                                            = require('../../models/UserPhone');
import UserPhoneDelegate                                    = require('../../delegates/UserPhoneDelegate');
import SessionStorageHelper                                 = require('../../helpers/SessionStorageHelper');
import Urls                                                 = require('./Urls');

class Middleware
{
    private static sessionStore = new SessionStorageHelper('CallFlow');
    private static SESSION_VARS_EXPERT:string = 'call_expert';
    private static SESSION_VARS_START_TIMES:string = 'call_start_times';
    private static SESSION_VARS_DURATION:string = 'call_durations';

    static setSelectedExpert(req, expert:IntegrationMember):void { Middleware.sessionStore.set(req, Middleware.SESSION_VARS_EXPERT, expert.toJson()); }
    static getSelectedExpert(req):IntegrationMember
    {
        var expertJson = Middleware.sessionStore.get(req, Middleware.SESSION_VARS_EXPERT);

        return !Utils.isNullOrEmpty(expertJson) ? new IntegrationMember(expertJson) : expertJson;
    }

    static setSelectedStartTimes(req, startTimes:number[]):void { Middleware.sessionStore.set(req, Middleware.SESSION_VARS_START_TIMES, startTimes); }
    static getSelectedStartTimes(req):number[] { return Middleware.sessionStore.get(req, Middleware.SESSION_VARS_START_TIMES); }

    static setDuration(req, duration:number):void { Middleware.sessionStore.set(req, Middleware.SESSION_VARS_DURATION, duration); }
    static getDuration(req):number { return parseInt(Middleware.sessionStore.get(req, Middleware.SESSION_VARS_DURATION)); }

    static requireExpertAndAppointments(req, res, next)
    {
        var expert = Middleware.getSelectedExpert(req);
        var startTimes = Middleware.getSelectedStartTimes(req) || req.body[ApiConstants.START_TIME];
        Middleware.setSelectedStartTimes(req, startTimes);
        var duration:number = Middleware.getDuration(req) || req.body[ApiConstants.DURATION];
        Middleware.setDuration(req, duration);

        // TODO: Validate that selected start times and durations fit expert's schedules

        if (!Utils.isNullOrEmpty(startTimes) && !Utils.isNullOrEmpty(expert) && !Utils.isNullOrEmpty(duration))
            next();
        else if (!Utils.isNullOrEmpty(expert))
            res.redirect(Urls.callExpert(expert[BaseModel.ID]));
        else
            res.send(400, "This is strange, how did you land up here without selecting an expert");
    }

}
export = Middleware