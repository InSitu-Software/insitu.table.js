/*globals numeral*/
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
			view = false;
			if( _.isset(where)
				&& _.isObject(where)
			){
				if( where instanceof Backbone.Model ){
					view = where.get("view");
				}else{
					view = where.view || where.cellView;
				}
			}

			return view;

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
		var sorting = this.table.sortByColumn(this.column);
		this.table.indicateSorting(this, sorting);
	}
});




insitu.Views.TableRow = insitu.Views.Base.extend({
	template: _.template("<tr></tr>"),

	defaults: function(){
		return {
			data: 				undefined,
			table: 				undefined,
			parent: 			undefined,
			visible: 			true,
			_columnDataHash: 	{}
		};
	},

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

	_show: function(){
		this.$el.show();
	},

	_hide: function(){
		this.remove(); // 640 ms
		// this.$el.hide();	// 100ms
	},

	_getColumnId: function(column){
		if(_.isObject( column ) && _.isset( column.id )){
			return column.id;
		}

		if( _.isString( column ) ){
			return column;
		}
	},

	// trigger "getting" of row X column data from raw Data
	// DOES NOT USE INTERNAL HASH
	_getCellData: function(column, index){

		var cellDate;

		if(_.isset(this.table.rowCellDataGetter) && _.isFunction( this.table.rowCellDataGetter )){
			cellDate = this.table.rowCellDataGetter.call(this.table.context, this.data, column);

		}else if( (this.data instanceof Backbone.Model) && _.isset(column.id) ){
			cellDate = this.data.get(column.id);

		}else if( _.isArray( this.data ) ){
			cellDate = this.data[ index ];
		}

		// save for faster access
		this._columnDataHash[ this._getColumnId( column ) ] = cellDate;

		return cellDate;
	},

	// here we use the internal hash for getting the row X column data
	getDataByColumn: function(column){
		if(_.isUndefined( column )){
			return this.$el.find("th").text();	// kind of hacky...
		}

		var columnId = this._getColumnId( column );

		if(_.isUndefined( this._columnDataHash[ columnId ] )){
			var index = this.table.columns.indexOf( column.column );
			this._getCellData( column.column, index );
		}

		return this._columnDataHash[ columnId ];
	},

	// Hides / shows row based on a "filter"-data and matching "columns" set
	// if no "columns" is defined, every column is used as matching partner
	// custom filter function can be defined (rowFilterCallback)
	filterRow: function(filter, columns){
		var newVisibility;
		if(_.isset( this.table.rowFilterCallback ) && _.isFunction( this.table.rowFilterCallback )){
			newVisibility = this.table.rowFilterCallback.call( this.table.context, this.cellDataHash, filter, columns );
		}else{
			if( _.isUndefined(columns) ){
				columns = this.table.columns;
			}

			newVisibility = _.pluralize( columns ).any(function(column){
				var columnId = this._getColumnId( column );
				var cellDate = this._columnDataHash[ columnId ];

				switch(typeof(cellDate)){
					case "number":
						return cellDate === numeral(filter).value();
					case "string":
					case "object":
						if(_.isNull( cellDate )){
							return false;
						}
						return cellDate.includes(filter);
				}

			}, this);
		}

		if( this.visible !== newVisibility && newVisibility === true ){
			this.render();
		}

		this.visible = newVisibility;
		return this.visible;
	}

});



insitu.Views.TableBody = insitu.Views.Base.extend({
	tagName: "tbody",

	defaults: {
		parent: undefined,
		table: 	undefined
	},

	initialize: function(data){
		this._fillWithDefault(this, data);
	},


	render: function(){
		this.removeSubviews();
		this._subviews = _.pluralize([]);

		this._renderRows(this.table.rows, this.$el);

		return this;
	},


	sortByColumn: function(column){
		if(this.sortColumn === column){
			this.sortReverse = !this.sortReverse;
		}else{
			this.sortReverse = false;
			this.sortColumn = column;
		}

		var sorter = _.isset(this.table.sortCallback)
			? this.table.sortCallback
			: this.table.sortNatural && _.isset(_.sortByNat)
				? _.sortByNat
				: _.sortBy;


		this._subviews = _.pluralize(sorter( this._subviews.values(), function(rowView){
			var data = rowView.getDataByColumn(column);
			if( this.sortNatural && _.isString(data) ){
				data = data.toUpperCase();
			}

			return data;
		}, this ));

		if(this.sortReverse){
			this._subviews.reverse();
		}

		this._subviews.each(function(rV){
			this.$el.append(rV.$el);
		}, this);

		return this.sortReverse
			? "DESC"
			: "ASC";

	},


	filter: function(filter){
		var $el = $("<"+this.tagName+">");

		this._subviews.each( function(rowView){
			if( rowView.filterRow( filter ) ){
				$el.append( rowView.$el );
			}
		}, this );

		this.reSetElement($el);

		return this;

	},

	_renderRows: function(data, $el){
		data.each(function(rowData){

			var rowView = this.appendSubview(
				insitu.Views.TableRow,
				{
					data: 	rowData,
					table: 	this.table
				},
				$el
			);

			this._subviews.push( rowView );

		}, this);

	}

});



insitu.Views.TableHead = insitu.Views.Base.extend({
	tagName: "thead",

	defaults: {
		parent: undefined,
		table: 	undefined
	},

	initialize: function(data){
		this._fillWithDefault(this, data);
	},

	render: function(){
		// Preheader
		if( _.isset( this.table.columnPreHeader ) ){
			this.$el.append(
				_.isFunction(this.columnPreHeader)
					? this.table.columnPreHeader.call(this.table.context)
					: this.table.columnPreHeader
			);
		}


		// general header
		var $headerRow = $("<tr>");
		if(_.isset(this.table.rowLabelCallback)){
			this.appendSubview(
				insitu.Views.TableHeaderCell,
				{table: this.table, data: ""},
				$headerRow
			);
		}

		this.table.columns.each(function(column, index){

			var colLabel = _.isset(this.table.columnLabelCallback) && _.isFunction(this.table.columnLabelCallback)
				? this.table.columnLabelCallback.call(this.table.context, column)
				: column;

			this.appendSubview(
				insitu.Views.TableHeaderCell,
				{
					data: 		colLabel,
					table: 		this.table,
					column: 	column
				},
				$headerRow
			);
		}, this);

		this.$el.append($headerRow);


		// PostHeader
		if( _.isset( this.table.columnPostHeader ) ){
			this.$el.append(
				_.isFunction(this.table.columnPostHeader)
					? this.table.columnPostHeader.call(this.table.context)
					: this.table.columnPostHeader
			);
		}

		return this;
	}
});



insitu.Views.Table = insitu.Views.Base.extend({

	template: _.template('<table class="insitutable"></table>'),


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
			// getter functions //
			//////////////////////

			// this one filters a unstructured bunch of input data
			// to get data per row.
			// Only applies to "rawData", is obsolet if we get "rowData"
			// rawDataRowFilter: undefined,

			// operates on filter rowData and excerpts data needed for this cell
			// cell = rowData X column definition
			rowCellDataGetter: undefined,

			rowFilterCallback: undefined,

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


	////////////
	// Render //
	////////////

	render: function(){
		var $el = $(this.template({}));


		// Headerrenderer
		this.headView = this.appendSubview(
			insitu.Views.TableHead,
			{
				table: this
			},
			$el
		);

		// Bodyrenderer
		if( _.isset( this.rows ) ){
			this.tbodyView = this.appendSubview(
				insitu.Views.TableBody,
				{
					table: this
				},
				$el
			);
		}

		this.reSetElement($el);
		return this;
	},


	/////////////////////////
	// Extra Functionality //
	/////////////////////////

	sortByColumn: function(column){
		return this.tbodyView.sortByColumn( column );
	},


	filterRows: function(filterSet){
		this.tbodyView.filter( filterSet );
	},

	indicateSorting: function(headerView, sorting){
		if(_.isset( this.indicatorView )){
			this.indicatorView.remove();
		}

		this.indicatorView = headerView.appendSubview(
			insitu.Views.SortIndicator,
			{
				sorting: sorting
			},
			headerView.$el
		);
	}

});

insitu.Views.SortIndicator = insitu.Views.Base.extend({
	tagName: "span",
	className: "sortingIndicator",

	defaults: {
		parent: undefined,
		sorting: "ASC"
	},

	initialize: function(data){
		this._fillWithDefault(this, data);
	},

	render: function(){
		this.$el = $(document.createElement(this.tagName));
		this.$el.addClass(this.className);

		this.$el.addClass(
			this.sorting === "ASC"
				? "ascending"
				: "descending"
		);

		return this;
	}
});