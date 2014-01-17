import _            = require('underscore');
import Utils        = require('../Utils');

/**
 * Base class for Models
 */
class BaseModel
{
    static TABLE_NAME:string;

    private __proto__;
    private id:number;
    private created:number;
    private updated:number;
    private deleted:boolean;

    constructor(data:Object = {})
    {
        var thisProtoConstructor = this.__proto__.constructor;
        thisProtoConstructor['COLUMNS'] = thisProtoConstructor['COLUMNS'] || [];
        var that = this;

        if (thisProtoConstructor['COLUMNS'].length == 0)
            for (var classProperty in this.__proto__)
                if (typeof this.__proto__[classProperty] == 'function' && classProperty.match(/^set/) != null)
                {
                    var key:string = Utils.camelToUnderscore(classProperty.replace(/^set/, ''));
                    thisProtoConstructor['COLUMNS'].push(key);
                }

        _.each (thisProtoConstructor['COLUMNS'], function(column) {
            that[column] = data[column];;
        });
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