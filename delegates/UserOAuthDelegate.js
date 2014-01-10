var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};


var UserAuthDAO = require('../dao/UserOAuthDao');
var BaseDaoDelegate = require("./BaseDaoDelegate");
var UserDelegate = require('../delegates/UserDelegate');
var MysqlDelegate = require('../delegates/MysqlDelegate');
var UserOAuth = require('../models/UserOauth');
var User = require('../models/User');

/**
Delegate class for managing user's oauth integrations (FB/LinkedIn logins)
**/
var UserOAuthDelegate = (function (_super) {
    __extends(UserOAuthDelegate, _super);
    function UserOAuthDelegate() {
        _super.apply(this, arguments);
    }
    /* Add or update an OAuth token
    * Created new user if can't update
    * @param userOAuth
    * @returns {makePromise} User updated or created
    */
    UserOAuthDelegate.prototype.addOrUpdateToken = function (userOAuth) {
        var that = this;

        // 1. Try updating the token
        // 2. If it fails for uniqueness constraint, create a new user and add token to it
        return this.getDao().search({ oauth_user_id: userOAuth.getOauthUserId(), provider_id: userOAuth.getProviderId() }, { 'fields': ['id', 'user_id'] }).then(function oauthSearchCompleted(existingTokens) {
            if (existingTokens.length != 0) {
                var token = new UserOAuth(existingTokens[0]);
                var oauthId = token.getId();
                userOAuth.setUserId(token.getUserId());
                return that.update(oauthId, userOAuth);
            } else {
                var transaction = null;
                var newUser = null;
                return MysqlDelegate.beginTransaction().then(function transactionStarted(t) {
                    transaction = t;
                    return new UserDelegate().create({}, transaction);
                }).then(function userCreated(user) {
                    newUser = user;
                    userOAuth.setUserId(newUser.getId());
                    return that.getDao().create(userOAuth, transaction);
                }).then(function oauthCreated(oauth) {
                    return MysqlDelegate.commit(transaction, newUser);
                }).then(function transactionCommitted() {
                    // Need to do this because this is a transaction and we won't have user in db until commit
                    return new UserDelegate().get(newUser.getId());
                });
            }
        });
    };

    UserOAuthDelegate.prototype.update = function (id, oauth) {
        // Can't update user id for a token
        var userId = oauth.getUserId();
        oauth.setUserId(null);
        oauth.setId(null);

        return _super.prototype.update.call(this, { id: id }, oauth).then(function oauthUpdated() {
            return new UserDelegate().get(userId);
        });
    };

    UserOAuthDelegate.prototype.deleteForUser = function (type, userId) {
        // TODO: Implement delete oauth token
        return this.getDao().search({});
    };

    UserOAuthDelegate.prototype.getDao = function () {
        return new UserAuthDAO();
    };
    return UserOAuthDelegate;
})(BaseDaoDelegate);

module.exports = UserOAuthDelegate;

