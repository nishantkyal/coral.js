import BaseModel                = require('../models/BaseModel');

/**
 * Bean class for User's oauth settings (FB, LinkedIn tokens)
 */
class UserOauth extends BaseModel
{
    static TABLE_NAME:string = 'user_oauth';

    static USER_ID:string = 'user_id';
    static PROVIDER_ID:string = 'provider_id';
    static OAUTH_USER_ID:string = 'oauth_user_id';
    static ACCESS_TOKEN:string = 'access_token';
    static ACCESS_TOKEN_EXPIRY:string = 'access_token_expiry';
    static REFRESH_TOKEN:string = 'refresh_token';
    static REFRESH_TOKEN_EXPIRY:string = 'refresh_token_expiry';

    private user_id:string;
    private provider_id:string;
    private oauth_user_id:string;
    private access_token:string;
    private access_token_expiry:string;
    private refresh_token:string;
    private refresh_token_expiry:string;

    /* Getters */
    getUserId() { return this.user_id; }
    getProviderId() { return this.provider_id; }
    getOauthUserId() { return this.oauth_user_id; }
    getAccessToken() { return this.access_token; }
    getAccessTokenExpiry() { return this.access_token_expiry; }
    getRefreshToken() { return this.refresh_token; }
    getRefreshTokenExpiry() { return this.refresh_token_expiry; }
    isValid() {
        return this.getOauthUserId() && this.getProviderId() && (this.getAccessToken() || this.getRefreshToken())
    }

    /* Setters */
    setUserId(val) { this.user_id = val; }
    setProviderId(val) { this.provider_id = val; }
    setOauthUserId(val) { this.oauth_user_id = val; }
    setAccessToken(val) { this.access_token = val; }
    setAccessTokenExpiry(val) { this.access_token_expiry = val; }
    setRefreshToken(val) { this.refresh_token = val; }
    setRefreshTokenExpiry(val) { this.refresh_token = val; }

}
export = UserOauth