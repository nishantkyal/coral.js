///<reference path='../_references.d.ts'/>
import q                                                                = require('q');
import _                                                                = require('underscore');
import fs                                                               = require('fs');
import passport                                                         = require('passport');
import crypto                                                           = require('crypto');
import BaseDaoDelegate                                                  = require('../delegates/BaseDaoDelegate');
import MysqlDelegate                                                    = require('../delegates/MysqlDelegate');
import UserProfileDelegate                                              = require('../delegates/UserProfileDelegate');
import ImageDelegate                                                    = require('../delegates/ImageDelegate');
import UserPhoneDelegate                                                = require('../delegates/UserPhoneDelegate');
import IDao                                                             = require('../dao/IDao')
import UserDAO                                                          = require('../dao/UserDao')
import User                                                             = require('../models/User');
import UserProfile                                                      = require('../models/UserProfile');
import IncludeFlag                                                      = require('../enums/IncludeFlag');
import ImageSize                                                        = require('../enums/ImageSize');
import UserStatus                                                       = require('../enums/UserStatus');
import Config                                                           = require('../common/Config');
import Utils                                                            = require('../common/Utils');

/*
 Delegate class for User operations
 */
class UserDelegate extends BaseDaoDelegate
{
    private imageDelegate = new ImageDelegate();
    private userProfileDelegate = new UserProfileDelegate();
    private userPhoneDelegate = new UserPhoneDelegate();
    private md5sum = crypto.createHash('md5');

    constructor() { super(new UserDAO()); }

    update(criteria:Object, newValues:any, transaction?:any):q.Promise<any>;
    update(criteria:number, newValues:any, transaction?:any):q.Promise<any>;
    update(criteria:any, newValues:any, transaction?:any):q.Promise<any>
    {
        delete newValues[User.ID];
        delete newValues[User.EMAIL];

        if (newValues.hasOwnProperty(User.PASSWORD))
            newValues[User.PASSWORD] = this.md5sum.digest(newValues[User.PASSWORD]);

        return super.update(criteria, newValues);
    }

    getIncludeHandler(include:IncludeFlag, result:any):q.Promise<any>
    {
        var user:User = result;
        var self = this;

        switch (include)
        {
            case IncludeFlag.INCLUDE_USER_PROFILE:
                return self.userProfileDelegate.search({'user_id': result.getId()});
            case IncludeFlag.INCLUDE_INTEGRATION_MEMBER:
                var IntegrationMemberDelegate:any = require('../delegates/IntegrationMemberDelegate');
                var integrationMemberDelegate = new IntegrationMemberDelegate();
                return integrationMemberDelegate.searchByUser(result.getId());
        }
        return super.getIncludeHandler(include, result);
    }

    processProfileImage(userId:number, tempImagePath:string):q.Promise<any>
    {
        var self = this;
        var imageBasePath:string = Config.get(Config.PROFILE_IMAGE_PATH) + userId;
        var newImagePath:string = imageBasePath;

        return self.imageDelegate.move(tempImagePath, newImagePath)
            .fail(
            function imageMoveFailed(err)
            {
                self.logger.error('Failed renaming file %s to %s. Error: %s', tempImagePath, newImagePath, err);
                throw('An error occurred while uploading your image');
            });

        /*
         var sizes = [ImageSize.SMALL];
         return q.all(_.map(sizes, function (size:ImageSize):q.Promise<any>
         {
         return self.imageDelegate.resize(tempImagePath, imageBasePath + '_' + ImageSize[size].toLowerCase(), size);
         }))
         .fail(
         function imageResizeFiled(error)
         {
         self.logger.debug('Image resize failed because %s', error);
         });*/
    }

    recalculateStatus(criteria:number):q.Promise<any>;
    recalculateStatus(criteria:Object):q.Promise<any>;
    recalculateStatus(criteria:any):q.Promise<any>
    {
        var self = this;
        var user:User;

        if (Utils.getObjectType(criteria) == 'Number')
            criteria = {id: criteria};

        return this.find(criteria)
            .then(
            function userFound(u)
            {
                user = u;
                return self.userPhoneDelegate.find({user_id: user.getId(), verified: true});
            })
            .then(
            function phoneFound(phone)
            {
                if (Utils.isNullOrEmpty(phone))
                    throw(UserStatus.MOBILE_NOT_VERIFIED);
                else
                    return self.userProfileDelegate.find({user_id: user.getId()});
            })
            .then(
            function userProfileFound(profile)
            {
                if (Utils.isNullOrEmpty(profile) || Utils.getObjectType(profile) != 'UserProfile')
                    throw(UserStatus.PROFILE_NOT_PUBLISHED);
                else
                    throw(UserStatus.ACTIVE);
            })
            .fail(
            function updateStatus(status)
            {
                return self.update({id: user.getId()}, {status: status});
            });
    }

}
export = UserDelegate
