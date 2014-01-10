import _            = require('underscore');
import Utils        = require('../Utils');

/**
 * Base class for Models
 */
class BaseModel
{
    static TABLE_NAME:string;
    static PRIMARY_KEY:string = 'id';

    private __proto__;
    private id:number;
    private created:number;
    private updated:number;
    private deleted:boolean;

    constructor(data:Object = {})
    {
        for (var classProperty in this.__proto__) {
            if (typeof this.__proto__[classProperty] == 'function' && classProperty.match(/^set/) != null) {
                var key:string = Utils.camelToUnderscore(classProperty.replace(/^set/, ''));
                this[key] = data[key];
            }
        }
    }

    /* Getters */
    getId():number { return this.id; }
    getCreated():number { return this.created; }
    getUpdated():number { return this.updated; }
    getDeleted():boolean { return this.deleted; }

    /* Setters */
    setId(val:number):void { this.id = val; }
    setCreated(val:number):void { this.created = val; }
    setUpdated(val:number):void { this.updated = val; }
    setDeleted(val:boolean):void { this.deleted = val; }



}
export = BaseModel