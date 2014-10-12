DANSA.Utils = {};

DANSA.Utils.merge = function (o1, o2) {
    for (var attr in o2) {
        o1[attr] = o2[attr];
    }
};

DANSA.Utils.deepCopy = function (o) {
    var ret = {};
    DANSA.Utils.merge(ret, o);
    return ret;
};
