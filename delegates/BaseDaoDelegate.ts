///<reference path='../_references.d.ts'/>
import _                = require('underscore');
import log4js           = require('log4js');
import q                = require('q');
import moment           = require('moment');
import IDao             = require('../dao/IDao');
import Utils            = require('../common/Utils');
import BaseModel        = require('../models/BaseModel');
import GlobalIdDelegate = require('../delegates/GlobalIDDelegate');
import IncludeFlag      = require('../enums/IncludeFlag');

class BaseDaoDelegate
{
    logger:log4js.Logger = log4js.getLogger(Utils.getClassName(this));

    DEFAULT_FIELDS:string[] = [BaseModel.ID];
    TIMESTAMPS_FIELDS:string[] = [BaseModel.CREATED, BaseModel.DELETED, BaseModel.UPDATED];

    get(id:any, fields?:string[], includes:IncludeFlag[] = []):q.Promise<any>
    {
        fields = fields || this.DEFAULT_FIELDS;

        if (Utils.getObjectType(id) == 'Array' && id.length > 0)
            return this.search({'id': id}, null, fields, includes);

        if (Utils.getObjectType(id) == 'Array' && id.length == 1)
            id = id[0];


        var self = this;
        var rawResult;

        // 1. Get the queried object
        // 2. Parse flags and add handlers to a queue
        // 3. When queue is complete, concat all results to queried object and return
        return this.getDao().get(id, fields)
            .then(
            function processIncludes(result):any
            {
                rawResult = result;
                var includeTasks = [];
                _.each(includes, function (flag)
                {
                    var handler;
                    if (handler = self.getIncludeHandler(flag, result))
                        includeTasks.push(handler);
                });
                return q.all(includeTasks);
            })
            .then(
            function handleIncludesProcessed(...args):any
            {
                for (var i = 0; i < args[0].length; i++)
                    rawResult.set(includes[i], args[0][i]);
                return rawResult;
            });
    }

    /* Abstract method self defines how flags are handled in get query */
    getIncludeHandler(include:IncludeFlag, result:any):q.Promise<any>
    {
        return null;
    }

    find(search:Object, options?:Object, fields?:string[], includes:IncludeFlag[] = []):q.Promise<any>
    {
        var self = this;
        var rawResult;

        fields = fields || this.DEFAULT_FIELDS;

        return this.getDao().find(search, options, fields)
            .then(
            function processIncludes(result)
            {
                rawResult = result;
                var includeTasks = [];
                _.each(includes, function (flag)
                {
                    var handler;
                    if (handler = self.getIncludeHandler(flag, result))
                        includeTasks.push(handler);
                });
                return q.all(includeTasks);
            })
            .then(
            function handleIncludesProcessed(...args)
            {
                var results = args[0];

                _.each(rawResult, function (result:any)
                {
                    _.each(results, function (resultSet:any, index)
                    {
                        // TODO: Implement foreign keys so mapping can work in search
                        var foreignKeyColumn = null;
                        result.set(includes[index], _.map(resultSet, function (res)
                        {
                            // return result[foreignKeyColumn] == res['id'] ? res : null;
                            return res;
                        }));
                    });
                });
                return rawResult;
            });
    }

    /*
     * Perform search based on seacrh query
     * Also fetch joint fields
     */
    search(search:Object, options?:Object, fields?:string[], includes:IncludeFlag[] = []):q.Promise<any>
    {
        var self = this;
        var rawResult;

        fields = fields || this.DEFAULT_FIELDS;

        return this.getDao().search(search, options, fields)
            .then(
            function processIncludes(result)
            {
                rawResult = result;
                var includeTasks = [];
                _.each(includes, function (flag)
                {
                    var handler;
                    if (handler = self.getIncludeHandler(flag, result))
                        includeTasks.push(handler);
                });
                return q.all(includeTasks);
            })
            .then(
            function handleIncludesProcessed(...args)
            {
                var results = args[0];

                _.each(rawResult, function (result:any)
                {
                    _.each(results, function (resultSet:any, index)
                    {
                        // TODO: Implement foreign keys so mapping can work in search
                        var foreignKeyColumn = null;
                        result.set(includes[index], _.map(resultSet, function (res)
                        {
                            // return result[foreignKeyColumn] == res['id'] ? res : null;
                            return res;
                        }));
                    });
                });
                return rawResult;
            });
    }
    create(object:any, transaction?:any):q.Promise<any>;
    create(object:any[], transaction?:any):q.Promise<any>;
    create(object:any, transaction?:any):q.Promise<any>
    {
        var self = this;
        object = object || {};
        if(object.length === undefined)
        {
            var generatedId:number = new GlobalIdDelegate().generate(this.getDao().getModel().TABLE_NAME);
            object[BaseModel.ID] = generatedId;
            object[BaseModel.CREATED] = new Date().getTime();
            object[BaseModel.UPDATED] = new Date().getTime();
            return this.getDao().create(object, transaction);
        }
        else
        {
            object = [object];
            var newObject:any[] = [];
            _.each(object, function(data){
                var tempObject = data;
                var generatedId:number = new GlobalIdDelegate().generate(self.getDao().getModel().TABLE_NAME);
                tempObject[BaseModel.ID] = generatedId;
                tempObject[BaseModel.CREATED] = new Date().getTime();
                tempObject[BaseModel.UPDATED] = new Date().getTime();
                tempObject[BaseModel.DELETED] = false;
                newObject.push(tempObject);
            })
            return this.getDao().create(newObject, transaction);
        }
    }

    update(criteria:Object, newValues:Object, transaction?:any):q.Promise<any>
    {
        // Compose update statement based on newValues
        newValues[BaseModel.UPDATED] = new Date().getTime();
        delete newValues[BaseModel.CREATED];
        delete newValues[BaseModel.ID];

        return this.getDao().update(criteria, newValues, transaction);
    }

    delete(id:number, softDelete:boolean = true, transaction?:any):q.Promise<any>
    {
        if (!softDelete)
            return this.getDao().delete(id, transaction);
        else
            return this.getDao().update({'id': id}, {'deleted': moment().valueOf()}, transaction)
    }

    searchAndDelete(criteria:Object, softDelete:boolean = true, transaction?:any):q.Promise<any>
    {
        if (!softDelete)
            this.getDao().searchAndDelete(criteria, transaction);
        else
            return this.getDao().update(criteria, {'deleted': moment().valueOf()}, transaction);
    }

    getDao():IDao { throw('getDao method not implemented'); }

}
export = BaseDaoDelegate