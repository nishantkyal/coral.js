import BaseDao                  = require('./BaseDao');
import BaseModel                = require('../models/BaseModel');
import ExpertScheduleRule       = require('../models/ExpertScheduleRule');

class ExpertScheduleRuleDao extends BaseDao
{
    getModel():typeof BaseModel { return ExpertScheduleRule; }
}
export = ExpertScheduleRuleDao