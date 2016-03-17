_.mixin({
	isset: function(param) {
		return !_.isUndefined(param);
	},

	deepClone: function(obj) {
		return JSON.parse(JSON.stringify(obj));
	},

	pad: function (n, width, padding, leftOrRight) {
	    if (_.isUndefined(leftOrRight)) {
            leftOrRight = "right";
        }

        padding = padding || '0';
	    n = n + '';
	    if (n.length < width) {

            var padding_string = new Array(width - n.length + 1).join(padding);

            return leftOrRight === "left"
                ? padding_string + n
                : n + padding_string;

        } else {
            return n;
        }
	},

    pluckUnique: function(obj, key) {
    	return _.unique(_.pluck(obj, key));
    },

    mapObject: function(object, f, context) {
    	var result = {};
    	_.each(object, function(v, k) {
    		result[k] = f.call(context, v, k);
    	});
    	return result;
    },


  	mapWithKey: function(object, f, context) {
  		return _.pluralize(object).reduce(function(memo, value) {
  			var result = f.call(context, value);
  			memo[result[0]] = result[1];
  			return memo;
  		}, {});
  	},

    hashList: function(list) {
        var result_hash = {};
        _.each(list, function(v) {
            result_hash[v] = true;
        });
        return result_hash;
    },

    arrayContentsMatchKey: function(array1, array2) {
        return (
               array1.length === array2.length
            && _(array1).all(function(e, idx) {
                return array2[idx] === e;
            })
        );
    },

    arrayContentsMatch: function(array1, array2) {
        return (
               array1.length === array2.length
            && _.difference(array1, array2).length === 0
        );
    },

    pluralize: function(input) {
    	if (input instanceof _) {
    		return input;
    	}

        var array;
        if (input instanceof Backbone.Collection) {
            array = input.models;
        } else if (_.isArray(input)) {
            array = input;
        } else {
            array =[input];
        }
        return _(array);
    },



    ////////////////////////
    // underscore-contrib //
    ////////////////////////

	isNumeric: function(n) {
		return !_.isNaN(parseFloat(n)) && _.isFinite(n);
  	},

	// An integer contains an optional minus sign to begin and only the digits 0-9
	// Objects that can be parsed that way are also considered ints, e.g. "123"
	// Floats that are mathematically equal to integers are considered integers, e.g. 1.0
	// See here for more discussion: http://stackoverflow.com/questions/1019515/javascript-test-for-an-integer
	isInteger: function(i) {
		return _.isNumeric(i) && i % 1 === 0;
	},

	// A float is a numbr that is not an integer.
	isFloat: function(n) {
		return _.isNumeric(n) && !_.isInteger(n);
	},

});