
insitu.Views.TableCell = insitu.Views.Base.extend({
	template: _.template("<td></td>"),

	className: undefined,

	defaults: {
		parent: undefined,
		data: undefined,
		table: undefined,
		column: undefined
	},

	initialize: function(data){
		this._fillWithDefault(this, data);
	},

	_getCellView: function(){
		var view;
		_.any([this.data, this.column, this.table], function(where){
			if(_.isset(where) && _.isObject(where) && (_.isset(where.view) || _.isset(where.cellView))){
				view = where.view || where.cellView;
			}
		}, this);

		return view;
	},

	render: function(){
		var $el = $(this.template({}));

		var cellView = this._getCellView();

		if(_.isset(cellView) && _.isFunction(cellView)){
			this.appendSubview(
				cellView,
				{
					data: this.data,
					table: this.table,
				},
				$el
			);
		}else{
			$el.append( this.data.label || this.data );
		}

		$el.addClass(this.className);
		this.reSetElement($el);
		return this;
	}

});

insitu.Views.TableHeaderCell = insitu.Views.TableCell.extend({
	template: _.template("<th></th>"),

	events: {
		"click": "_handleClick"
	},

	initialize: function(data){
		this._fillWithDefault(this, data);

		if( this.table.sortable ){
			this.className = "sortable";
		}
	},

	_getCellView: function(){
		return _.isset(this.table.columnHeaderView)
			? this.table.columnHeaderView
			: false;
	},

	_handleClick: function(event){
		if(!this.table.sortable){
			return false;
		}

		event.stopPropagation();
		this.table.sortByColumn(this);
	}
});




insitu.Views.TableRow = insitu.Views.Base.extend({
	template: _.template("<tr></tr>"),

	defaults: {
		data: undefined,
		table: undefined,
		parent: undefined
	},

	cellData: undefined,

	initialize: function(data){
		this._fillWithDefault(this, data);
	},

	render: function(){
		var $el = $(this.template({}));

		if(_.isset(this.table.rowLabelCallback) && _.isFunction( this.table.rowLabelCallback )){
			this.appendSubview(
				insitu.Views.TableHeaderCell,
				{
					data: this.table.rowLabelCallback.call(this.context, this.data),
					table: this.table
				},
				$el
			);
		}

		this.table.columns.each(function(column, index){
			var cellData = this._getCellData(column, index);

			this.appendSubview(
				insitu.Views.TableCell,
				{
					data: 	cellData,
					table: 	this.table,
					column: column
				},
				$el
			);
		}, this);

		this.reSetElement($el);
		return this;
	},

	_getCellData: function(column, index){
		if(_.isset(this.table.rowDataCellFilter) && _.isFunction( this.table.rowDataCellFilter )){
			return this.table.rowDataCellFilter.call(this.table.context, this.data, column);
		}

		if( (this.data instanceof Backbone.Model) && _.isset(column.id) ){
			return this.data.get(column.id);
		}

		if( _.isArray( this.data ) ){
			return this.data[ index ];
		}
	},

	getDataByColumn: function(column){
		var index = this.table.columns.indexOf( column.column );
		return this._getCellData( column.column, index );
	}

});





insitu.Views.Table = insitu.Views.Base.extend({

	template: _.template('<table class="insitutable"><thead></thead><tbody></tbody></table>'),


	defaults: function(){
		return {
			////////////////
			// input data //
			////////////////

			// unstructured data, implies defining rawDataRowFilter abd
			// rawData: undefined,

			// data input by row, so we expect an iterable data structure
			// in which every iteratee describes on row
			// rowData: undefined,


			//////////////////////
			// filter functions //
			//////////////////////

			// this one filters a unstructured bunch of input data
			// to get data per row.
			// Only applies to "rawData", is obsolet if we get "rowData"
			// rawDataRowFilter: undefined,

			// operates on filter rowData and excerpts data needed for this cell
			// cell = rowData X column definition
			rowDataCellFilter: undefined,

			//////////////////////////////
			// row / column definitions //
			//////////////////////////////
			// row and column definition follow this structure:
			// [
			// 	{
			// 		label: 	optional, if not present row/columnLabelCallback will be invoked
			// 		id: 	needed on columns, on parameter for filterFunction
			// 		view: 	n/a for row, column can specify a distinct BB-View for this column,
			// 				if not set, "cellView" is used
			// 		data: 	n/a for columns, if set for rows, no filtering etc is done, this
			// 				value is plainly outputed / given to cellView
			// 	},
			// 	{}
			// ]

			rows: undefined,	// optional
			columns: undefined, // necessary

			//////////////
			// Callback //
			//////////////

			columnLabelCallback: undefined,
			rowLabelCallback: undefined,


			/////////////////////
			// common cellView //
			/////////////////////

			// if not defined and not special column-view is defined,
			// output of cellFilter will be plainly written into the cell
			cellView: undefined,


			//////////////////////
			// Static additions //
			//////////////////////
			// static HTML or callback output, which will be

			// appended before internal header generation, but in <thead>
			columnPreHeader: undefined,

			// append after internal header generation, but in <thead>
			columnPostHeader: undefined,

			// appended colGroupDefinition, for table styling
			colgroupDefintion: undefined,

			//////////////////////////////
			// optional functionalities //
			//////////////////////////////
			sortable: false,		// Enable / Disable column sorter
			sortNatural: false,		// use defaultSorter, but sort natural, requires: https://gist.github.com/kjantzer/7027717
			sortCallback: undefined,// optional sortCallback function, gets array of row-Views and data-extraction callback


			columnHeader: false,	// render column header, based von this.columns or columnLabelCallback
			rowHeader: false,

			//////////////////
			// housekeeping //
			//////////////////
			parent: undefined,
			context: this
		};
	},


	_pluralizeableData: [
		"columns",
		"rows",
		"rawData",
	],


	initialize: function(data){
		this._fillWithDefault(this, data);
		_.each(this._pluralizeableData, function(key){
			this[key] = _.isset( this[key] ) && !( this[key] instanceof Backbone.Collection )
				? _.pluralize( this[key] )
				: this[key] || undefined;
		}, this);

	},


	render: function(){
		var $el = $(this.template({}));
		this.$tbody = $el.find("tbody");
		this.$thead = $el.find("thead");

		// Headerrenderer
		this._renderHeader(this.$thead);

		// Bodyrenderer
		if( _.isset( this.rows ) ){
			this._renderByRows(this.$tbody);
		}

		this.reSetElement($el);
		return this;
	},


	_renderByRows: function($el){

		if(this.sortable && _.isset( this.sortByColId )){

		}

		this.rowViews = [];
		this.rows.each(function(rowData){

			var rowView = this.appendSubview(
				insitu.Views.TableRow,
				{
					data: 	rowData,
					table: 	this
				},
				$el
			);

			this.rowViews.push( rowView );

		}, this);
	},


	// _renderByRawData: function(){
	// },


	_renderHeader: function($el){
		if(_.isset(this.rowLabelCallback)){
			this.appendSubview(
				insitu.Views.TableHeaderCell,
				{table: this, data: ""},
				$el
			);
		}

		this.columns.each(function(column, index){

			var colLabel = _.isset(this.columnLabelCallback) && _.isFunction(this.columnLabelCallback)
				? this.columnLabelCallback.call(this.context, column)
				: column;

			this.appendSubview(
				insitu.Views.TableHeaderCell,
				{
					data: 		colLabel,
					table: 		this,
					column: 	column
				},
				$el
			);
		}, this);
	},


	sortByColumn: function(column){
		if(this.sortColumn === column){
			this.sortReverse = !this.sortReverse;
		}else{
			this.sortReverse = false;
			this.sortColumn = column;
		}

		var sorter = _.isset(this.sortCallback)
			? this.sortCallback
			: this.sortNatural && _.isset(_.sortByNat)
				? _.sortByNat
				: _.sortBy;


		this.$tbody.html("");
		this.rowViews = sorter( this.rowViews, function(rowView){
			var data = rowView.getDataByColumn(column);
			if( this.sortNatural && _.isString(data) ){
				data = data.toUpperCase();
			}

			return data;
		}, this );

		if(this.sortReverse){
			this.rowViews.reverse();
		}

		_.each(this.rowViews, function(rV){
			this.$tbody.append(rV.$el);
		}, this);

	},

});

