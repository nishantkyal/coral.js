define(["require", "exports"], function (require, exports) {
    var MoneyUnit;
    (function (MoneyUnit) {
        MoneyUnit[MoneyUnit["INR"] = 1] = "INR";
        MoneyUnit[MoneyUnit["USD"] = 2] = "USD";
        MoneyUnit[MoneyUnit["PERCENT"] = 3] = "PERCENT";
        MoneyUnit[MoneyUnit["POINTS"] = 4] = "POINTS";
    })(MoneyUnit || (MoneyUnit = {}));
    return MoneyUnit;
});
//# sourceMappingURL=MoneyUnit.js.map