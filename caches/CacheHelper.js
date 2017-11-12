"use strict";
///<reference path='../_references.d.ts'/>
const _ = require("underscore");
const q = require("q");
const redis = require("redis");
const Utils = require("../common/Utils");
/*
 Base class for all caches
 */
class CacheHelper {
    constructor(host, port) {
        // We're going to maintain just one connection to redis since both node and redis are single threaded
        this.connection = redis.createClient(port, host);
        this.connection.on('error', function (error) {
            throw (error);
        });
    }
    getConnection() { return this.connection; }
    set(key, value, expiry, overwrite = false) {
        var deferred = q.defer();
        var self = this;
        var args = [key, JSON.stringify(value)];
        if (expiry)
            args.concat(['EX', expiry]);
        if (!overwrite)
            args.push('NX');
        self.getConnection().set(args, function (error, result) {
            if (error)
                deferred.reject(error);
            else
                deferred.resolve(result);
        });
        return deferred.promise;
    }
    mget(keys) {
        var deferred = q.defer();
        if (Utils.isNullOrEmpty(keys))
            return q.resolve(keys);
        this.getConnection().mget(keys, function (error, result) {
            if (error)
                return deferred.reject(error);
            if (Utils.isNullOrEmpty(result))
                return deferred.resolve(result);
            deferred.resolve(_.map(result, function (row) {
                return JSON.parse(row);
            }));
        });
        return deferred.promise;
    }
    get(key) {
        var deferred = q.defer();
        if (Utils.isNullOrEmpty(key))
            return q.resolve(key);
        this.getConnection().get(key, function (error, result) {
            if (error)
                return deferred.reject(error);
            if (Utils.isNullOrEmpty(result))
                return deferred.resolve(result);
            deferred.resolve(JSON.parse(result));
        });
        return deferred.promise;
    }
    del(key) {
        var deferred = q.defer();
        this.getConnection().del(key, function (error, result) {
            if (error)
                deferred.reject(error);
            else
                deferred.resolve(result);
        });
        return deferred.promise;
    }
    /* Manipulate hashes */
    createHash(set, values, keyFieldName, expiry) {
        // Create a clone for addition since we'll be removing from it to keep count
        var self = this;
        var deferred = q.defer();
        var clonedValues = JSON.parse(JSON.stringify(values));
        var row = clonedValues.shift();
        this.addToHash(set, row[keyFieldName], row)
            .then(function (result) {
            if (clonedValues.length == 0) {
                if (expiry > 0)
                    setInterval(function () {
                        self.del(set);
                    }, expiry);
                return deferred.resolve(result);
            }
            else
                return self.createHash(set, clonedValues, keyFieldName, expiry);
        });
        return deferred.promise;
    }
    addToHash(set, key, value) {
        var self = this;
        var deferred = q.defer();
        this.delFromHash(set, key)
            .then(function () {
            self.getConnection().hset(set, key, JSON.stringify(value), function (error, result) {
                if (error)
                    deferred.reject(error);
                else
                    deferred.resolve(result);
            });
        });
        return deferred.promise;
    }
    getHashValues(set) {
        var deferred = q.defer();
        var self = this;
        self.getConnection().hvals(set, function (error, result) {
            if (result) {
                if (Utils.getObjectType(result) == 'Array')
                    deferred.resolve(_.map(result, function (row) {
                        return JSON.parse(row);
                    }));
                else
                    deferred.resolve(JSON.parse(result));
            }
            else
                deferred.reject(error);
        });
        return deferred.promise;
    }
    getHashKeys(set) {
        var deferred = q.defer();
        this.getConnection().hkeys(set, function (error, result) {
            if (error)
                deferred.reject(error);
            else
                deferred.resolve(result);
        });
        return deferred.promise;
    }
    getHash(set) {
        var self = this;
        return q.all([
            self.getHashKeys(set),
            self.getHashValues(set)
        ])
            .then(function valuesFetched(...args) {
            var keys = args[0][0];
            var values = args[0][1];
            var indexed = {};
            _.each(keys, function (code, index) {
                indexed[code] = values[index];
            });
            return indexed;
        });
    }
    getFromHash(set, key) {
        var deferred = q.defer();
        this.getConnection().hget(set, key, function (error, result) {
            if (error)
                deferred.reject(error);
            else if (Utils.getObjectType(result) == 'Array')
                deferred.resolve(_.map(result, function (row) {
                    return JSON.parse(row);
                }));
            else
                deferred.resolve(JSON.parse(result));
        });
        return deferred.promise;
    }
    delFromHash(set, key) {
        var deferred = q.defer();
        this.getConnection().hdel(set, key, function (error, result) {
            if (error)
                deferred.reject(error);
            else
                deferred.resolve(result);
        });
        return deferred.promise;
    }
    /* MANIPULATE ORDERED SETS */
    addToOrderedSet(set, key, value) {
        var deferred = q.defer();
        var self = this;
        this.delFromOrderedSet(set, key)
            .then(function () {
            self.getConnection().hset(set, key, JSON.stringify(value), function (error, result) {
                if (error)
                    deferred.reject(error);
                else
                    deferred.resolve(result);
            });
        });
        return deferred.promise;
    }
    addMultipleToOrderedSet(set, values, keyFieldName) {
        // Create a clone for addition since we'll be removing from it to keep count
        var self = this;
        var deferred = q.defer();
        var clonedValues = JSON.parse(JSON.stringify(values));
        var row = clonedValues.shift();
        this.addToOrderedSet(set, row[keyFieldName], row)
            .then(function () {
            if (clonedValues.length == 0)
                deferred.resolve(null);
            else
                self.addMultipleToOrderedSet(set, clonedValues, keyFieldName);
        });
        return deferred.promise;
    }
    getOrderedSet(set) {
        var self = this;
        var deferred = q.defer();
        this.getConnection().zcard(set, function (err, count) {
            self.getConnection().zrange(set, 0, count, function (error, result) {
                if (result)
                    deferred.resolve(result);
                else
                    deferred.reject(error);
            });
        });
        return deferred.promise;
    }
    getFromOrderedSet(set, key) {
        var deferred = q.defer();
        this.getConnection().zrevrangebyscore(set, key, key, function (error, result) {
            if (error)
                deferred.reject(error);
            else
                deferred.resolve(result);
        });
        return deferred.promise;
    }
    delFromOrderedSet(set, key) {
        var deferred = q.defer();
        this.getConnection().zremrangebyscore(set, key, key, function (error, result) {
            if (error)
                deferred.reject(error);
            else
                try {
                    deferred.resolve(result);
                }
                catch (e) {
                }
        });
        return deferred.promise;
    }
    setExpiry(key, expiry) {
        var deferred = q.defer();
        this.getConnection().expire(key, expiry, function (error, result) {
            if (error)
                deferred.reject(error);
            else
                deferred.resolve(result);
        });
        return deferred.promise;
    }
    incrementCounter(counterName) {
        var deferred = q.defer();
        this.getConnection().incr(counterName, function (error, result) {
            if (error)
                deferred.reject(error);
            else
                deferred.resolve(result);
        });
        return deferred.promise;
    }
    incrementHashKey(hash, counterName, increment = 1) {
        var deferred = q.defer();
        this.getConnection().hincrby(hash, counterName, increment, function (error, result) {
            if (error)
                deferred.reject(error);
            else
                deferred.resolve(result);
        });
        return deferred.promise;
    }
    getKeys(nameOrPattern) {
        var deferred = q.defer();
        this.getConnection().keys(nameOrPattern, function (error, result) {
            if (error)
                deferred.reject(error);
            else
                deferred.resolve(result);
        });
        return deferred.promise;
    }
    /* Sets */
    addToSet(set, key) {
        var deferred = q.defer();
        this.getConnection().sadd(set, key, function (error, result) {
            if (error)
                deferred.reject(error);
            else
                deferred.resolve(result);
        });
        return deferred.promise;
    }
    isMemberOfSet(set, key) {
        var deferred = q.defer();
        this.getConnection().sismember(set, key, function (error, result) {
            if (error)
                deferred.reject(error);
            else
                deferred.resolve(result);
        });
        return deferred.promise;
    }
    removeFromSet(set, key) {
        var deferred = q.defer();
        this.getConnection().srem(set, key, function (error, result) {
            if (error)
                deferred.reject(error);
            else
                deferred.resolve(result);
        });
        return deferred.promise;
    }
}
module.exports = CacheHelper;
//# sourceMappingURL=CacheHelper.js.map