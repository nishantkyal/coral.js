import express                                              = require('express');
import connect_ensure_login                                 = require('connect-ensure-login');
import AccessControl                                        = require('../middleware/AccessControl');
import ApiUrlDelegate                                       = require('../delegates/ApiUrlDelegate');
import UserEducationDelegate                                = require('../delegates/UserEducationDelegate');
import ApiConstants                                         = require('../enums/ApiConstants');
import UserEducation                                        = require('../models/UserEducation');

class UserEducationApi
{
    userEducationDelegate;
    constructor(app, secureApp)
    {
        var self = this;
        this.userEducationDelegate = new UserEducationDelegate();

        app.post(ApiUrlDelegate.userEducationById(), connect_ensure_login.ensureLoggedIn(), function(req:express.Request, res:express.Response)
        {
            var education:any = req.body[ApiConstants.USER_EDUCATION];
            var educationId = parseInt(req.params[ApiConstants.EDUCATION_ID]);
            self.userEducationDelegate.update({id: educationId}, education)
                .then(
                function userUpdated() { res.send(200); },
                function userUpdateError(error) { res.send(500); }
            );
        });

        app.put(ApiUrlDelegate.userEducation(), connect_ensure_login.ensureLoggedIn(), function(req:express.Request, res:express.Response)
        {
            var loggedInUser = req['user'];
            var education:UserEducation = req.body[ApiConstants.USER_EDUCATION];
            var profileId = req.body[ApiConstants.USER_PROFILE_ID];

            self.userEducationDelegate.createUserEducation(education, profileId)
                .then(
                function userUpdated() { res.send(200); },
                function userUpdateError(error) { res.send(500); }
            );
        });

        app.delete(ApiUrlDelegate.userEducationById(), connect_ensure_login.ensureLoggedIn(), function(req:express.Request, res:express.Response)
        {
            var educationId = parseInt(req.params[ApiConstants.EDUCATION_ID]);
            var profileId:number = parseInt(req.body[ApiConstants.USER_PROFILE_ID]);

            self.userEducationDelegate.delete({id:educationId}) // if hard deleting then add profileId:profileId
                .then(
                function userUpdated() { res.send(200); },
                function userUpdateError(error) { res.send(500); }
            );
        });
    }
}
export = UserEducationApi