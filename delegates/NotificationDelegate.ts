///<reference path='../_references.d.ts'/>
import q                                                    = require('q');
import Config                                               = require('../common/Config');
import EmailDelegate                                        = require('../delegates/EmailDelegate');
import SMSDelegate                                          = require('../delegates/SMSDelegate');
import ScheduledTaskDelegate                                = require('../delegates/ScheduledTaskDelegate');
import PhoneCall                                            = require('../models/PhoneCall');
import IntegrationMember                                    = require('../models/IntegrationMember');
import CallFragment                                         = require('../models/CallFragment');
import User                                                 = require('../models/User');
import NotificationCallScheduledTask                        = require('../models/tasks/NotificationCallScheduledTask');
import Utils                                                = require('../common/Utils');

class NotificationDelegate
{
    private smsDelegate = new SMSDelegate();
    private emailDelegate = new EmailDelegate();

    sendCallSchedulingNotifications(call:number, appointments:number[], duration:number, caller:User):q.Promise<any>;
    sendCallSchedulingNotifications(call:PhoneCall, appointments:number[], duration:number, caller:User):q.Promise<any>;
    sendCallSchedulingNotifications(call:any, appointments:number[], duration:number, caller:User):q.Promise<any>
    {
        var self = this;

        return q.all([
            self.emailDelegate.sendSchedulingEmailToExpert(call, appointments, duration, caller)
        ]);
    }

    sendCallSchedulingCompleteNotifications(call:number, appointment:number):q.Promise<any>;
    sendCallSchedulingCompleteNotifications(call:PhoneCall, appointment:number):q.Promise<any>;
    sendCallSchedulingCompleteNotifications(call:any, appointment:number):q.Promise<any>
    {
        var self = this;
        return q.all([
            self.emailDelegate.sendSchedulingCompleteEmail(call, appointment)
        ]);
    }

    sendCallReschedulingNotificationsToUser(call:number, appointment:number):q.Promise<any>;
    sendCallReschedulingNotificationsToUser(call:PhoneCall, appointment:number):q.Promise<any>;
    sendCallReschedulingNotificationsToUser(call:any, appointment:number):q.Promise<any>
    {
        var self = this;
        return q.all([
            self.emailDelegate.sendReschedulingEmailToUser(call, appointment)
        ]);
    }

    sendCallReschedulingNotificationsToExpert(call:number, appointments:number[]):q.Promise<any>;
    sendCallReschedulingNotificationsToExpert(call:PhoneCall, appointments:number[]):q.Promise<any>;
    sendCallReschedulingNotificationsToExpert(call:any, appointments:number[]):q.Promise<any>
    {
        var self = this;
        return q.all([
            self.emailDelegate.sendReschedulingEmailToExpert(call, appointments)
        ]);
    }

    sendCallAgendaFailedNotifications(call:number):q.Promise<any>;
    sendCallAgendaFailedNotifications(call:PhoneCall):q.Promise<any>;
    sendCallAgendaFailedNotifications(call:any):q.Promise<any>
    {
        var self = this;
        return q.all([
            self.emailDelegate.sendAgendaFailedEmailToUser(call)
        ]);
    }

    sendCallReminderNotification(call:number):q.Promise<any>;
    sendCallReminderNotification(call:PhoneCall):q.Promise<any>;
    sendCallReminderNotification(call:any):q.Promise<any>
    {
        var self = this;
        return q.all([
            self.smsDelegate.sendReminderSMS(call),
            self.emailDelegate.sendCallReminderEmail(call)
        ]);
    }

    sendCallFailureNotifications(call:PhoneCall):q.Promise<any>;
    sendCallFailureNotifications(call:number):q.Promise<any>;
    sendCallFailureNotifications(call:any):q.Promise<any>
    {
        var self = this;

        return q.all([
            self.smsDelegate.sendFailureSMS(call),
            self.emailDelegate.sendCallFailureEmail(call)
        ]);
    }

    sendCallSuccessNotifications(call:number, duration:number):q.Promise<any>;
    sendCallSuccessNotifications(call:PhoneCall, duration:number):q.Promise<any>;
    sendCallSuccessNotifications(call:any, duration:number):q.Promise<any>
    {
        var self = this;

        return q.all([
            self.smsDelegate.sendSuccessSMS(call, duration)
        ]);
    }

    sendCallStatusNotifications(callFragment:CallFragment, attemptCount:number):q.Promise<any>
    {
        return null;
    }

    sendAccountVerificationEmail(user:User, code:string):q.Promise<any>
    {
        return this.emailDelegate.sendAccountVerificationEmail(user, code);
    }

    sendPasswordResetNotification(email:string, code:string):q.Promise<any>
    {
        return this.emailDelegate.sendPasswordResetEmail(email, code);
    }

    sendProfilePendingApprovalEmail(memberId:number):q.Promise<any>
    {
        return this.emailDelegate.sendProfilePendingApprovalEmail(memberId);
    }

    sendExpertRegistrationCompleteNotification(expert:IntegrationMember):q.Promise<any>
    {
        var self = this;

        return q.all([
            self.emailDelegate.sendExpertRegistrationCompleteEmail(expert)
        ]);
    }

    scheduleCallNotification(call:PhoneCall)
    {
        var scheduledTaskDelegate = new ScheduledTaskDelegate();
        scheduledTaskDelegate.scheduleAt(new NotificationCallScheduledTask(call.getId()), call.getStartTime() - parseInt(Config.get(Config.CALL_REMINDER_LEAD_TIME_SECS)) * 1000);
    }
}
export = NotificationDelegate