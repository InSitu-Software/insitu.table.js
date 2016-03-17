insitu.Views.Base = Backbone.View.extend({

    defaults: {
        parent: undefined,
    },

    initialize: function(options) {
        this._fillWithDefault(this, options);
        insitu.Views.Base.__super__.initialize.call(this, arguments);
    },

	////////////////////////
	// subview mangement //
	////////////////////////

    _subviews: undefined,

    // every subview has to be registered to this view
    registerSubview: function(subview) {
        // init
        this._subviews = this._subviews || [];

        this._subviews.push(subview);
    },

    // convinience wrapper for registerSubview including init, render & append
    appendSubview: function(subview, data, $container) {
        data = _.extend({parent: this}, data);
        var v = new subview(data);

        if(_.isset( $container )){
            var renderReturn = v.render();
            if(!renderReturn){
                // case for willingly breaking subview
                return false;
            }
            v.$el.appendTo($container);

        }

        this.registerSubview(v);
        return v;
    },

    removeSubview: function(subView){
        if(!(subView instanceof Backbone.View)){
            insitu.fn.error("I need a sub_VIEW_ to remove, nothing else");
        }

        subView.remove();
        this._subviews = _.without( this._subviews, subView );
    },

    removeSubviews: function() {
        _.invoke(this._subviews, 'remove');
        this._subviews = [];
    },

    // on this.remove first remove all subviews
    remove: function() {
        // this.$el.detach();
        this.removeSubviews();
        Backbone.View.prototype.remove.call(this);
    },

    // to enable re-render the smartyApp convention is to remove subviews on render()
    // render: function() {
    //     this.removeSubviews();
    //     Backbone.View.prototype.render.call(this);
    // },

    //////////////////////
    // rerender support //
    //////////////////////

    // reSetElement: function(new_el) {
    //     // preserve DOM reference
    //     var $old_el = this.$el;

    //     // insert new_el
    //     this.setElement(new_el);

    //     // if old DOM elemt is within DOM: replace with new element
    //     if ($.contains(document, $old_el[0])) {
    //         $old_el.replaceWith(this.$el);
    //     }
    // },


    //////////////////////
    //     tooltips     //
    //////////////////////

    tooltip: undefined,

    delegateEvents: function(events) {
        events = events ? events : _.result(this, 'events');
        events = events ? events : {};

        if (this.events_tooltipElements) {

            // join to string
            var selectorListString = this.events_tooltipElements.join(", ");

            // create additional event listener
            var tooltipEventHash = {};
            tooltipEventHash["mouseenter " + selectorListString] = "handleTooltipMouseEnter";
            tooltipEventHash["mouseleave " + selectorListString] = "handleTooltipMouseLeave";

            // combine with existing event hash
            events = _.extend({}, events, tooltipEventHash);
        }

        insitu.Views.Base.__super__.delegateEvents.call(this, events);
    },

    handleTooltipMouseEnter: function(event) {

        this.handleTooltipMouseLeave(null);

        var data = this.tooltipData(event.currentTarget);

        data = _.extend({anchor: event.currentTarget}, data);
        this.tooltip = this.appendSubview(insitu.Views.Tooltip, data, data.anchor);
    },

    handleTooltipMouseLeave: function(event) {
        if (typeof this.tooltip !== 'undefined') {
            this.tooltip.remove();
        }
    },

    updateTooltipData: function(event) {
        this.handleTooltipMouseEnter(event);
    },

    // to pass data to a tooltip, override this function and implement something like this:
    // if ($(target).hasClass("css-class")) { return {text: "tooltip text", orientation: "top"} };

    tooltipData: function(target) {
        return {
            text: $(target).attr("original-title")
        };
    },

});