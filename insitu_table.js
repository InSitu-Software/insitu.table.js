
/*
Zwei Varianten die Spalten zu definieren.
Zum ersten kann ein gemeinsamer View für alle Zellen
gesetzt werden (columnCommonView).
Alternativ können _alle_ Spalten einzeln als "columns" definiert werden.
Hier wird eine List mit Objekten erwartet die min. "header" und "view" definiert
haben.
In jedem Fall wird die Menge an Spalten aus der Menge der Elemente aus "columns"
definiert. Die Header werden aus dem "columnLabelCallback" definiert. Der als
Standardfall einfach das aktuelle columns-Element ausgibt.
Intern verwertete Werte pro column-Element sind {view};
Falls View gesetzt ist, wird die Zelle aus diesem View generiert. Falls kein
view gesetzt ist, wird auf columnCommonView zurückgegriffen.

In jedem Fall wird eine Liste mit Werten in "rows" erwartet. Für jede Zeile ist ein
Datum in der Liste erwartet.
Das Zeilenlabel wird aus "rowLabelCallback(rows[i])" erzeugt, die Daten, die an
den Zellenview übergeben werden sind entweder die kompletten Zeilendaten aus rows[i]
oder, falls columDataFilterCallback definiert ist, der Rückgabewert aus
"cellDataFilterCallback(rows[i], columns[j])". Wobei columns[j] entweder das
aktuelle Spaltenelemen aus columns ist oder

 */

insitu.Models.TableCell = Backbone.Model.extend({
	defaults: {
		model: 		undefined,
		data: 		undefined,
		view: 		undefined,
		columnId: 	undefined
	}
});

insitu.Collections.TableCells = Backbone.Collection.extend({
	model: insitu.Models.TableCell
});

insitu.Models.TableRow = Backbone.Model.extend({
	idAttribute: "rowKey",

	defaults: function(){
		return {
			rowKey: undefined,
			rawData: undefined,
			cells: new insitu.Collections.TableCells()
		};
	}
});

insitu.Collections.TableRows = Backbone.Collection.extend({
	model: insitu.Models.TableRow
});



insitu.Views.Table = insitu.Views.Base.extend({

	tagName: "table",

	defaults: {
		parent: undefined,

		tableCustomColumnPreHeader: undefined,
		tableCustomColumnPostHeader: undefined,

		columns: undefined,
		columnCommonView: undefined,
		columnLabelCallback: undefined,

		baseData: undefined,

		rowDataFilterCallback: undefined,
		cellDataFilterCallback: undefined,

		rows: undefined,

		rowLabelLabel: undefined,
		rowLabelCallback: undefined,

		colgroupDefintion: undefined,

		sortable: false
	},

	events: {
		"click th.col_header": "_handleSortClick"
	},

	_pluralizedData: [
		"columns",
		"rows"
	],

	initialize: function(options){
		this._fillWithDefault(this, options);

		_.each(this._pluralizedData, function(key){
			if(
				_.isset( this[key] )
				&&
				!(this[key] instanceof Backbone.Collection)
			){
				this[key] = _.pluralize( this[key] );
			}

		}, this);
	},

	_getColId: function(col){
		return _.isObject(col) && _.isset(col.id)
			? col.id
			: col;
	},

	_sortByColId: function(bodyData){
		var columnId = this.sortByColId;
		bodyData.sortType = "natural";
		bodyData.comparator = function(m){
			var cellData = m.get("cells").findWhere({ columnId: columnId });
			return _.isset(cellData.get("model"))
				? cellData.get("model")
				: cellData.get("data");
		};
		bodyData.sort();

		if(this.reverseSorting){
			bodyData.reverse();
		}

		return bodyData;
	},

	_generateRowData: function(){
		var rowsData = new insitu.Collections.TableRows();

		this.rows.each(function( row ){
			var filteredRowData = _.isset(this.rowDataFilterCallback)
				? this.rowDataFilterCallback.call(this.context, row, this.baseData)
				: row;
			rowsData.add( this._generateSingleRowData( filteredRowData, row ) );
		}, this);

		return rowsData;
	},

	_generateSingleRowData: function(filteredRowData, rawRowData){
		var row = new insitu.Models.TableRow({
			rowKey: filteredRowData.id,
			rawData: rawRowData
		});

		var cells = new insitu.Collections.TableCells();

		this.columns.each(function(col){
			var cellData = _.isset(this.cellDataFilterCallback)
				? this.cellDataFilterCallback.call(this.context, filteredRowData, rawRowData, col)
				: filteredRowData;

			cellData = (cellData instanceof Backbone.Model)
				? { model: cellData }
				: { data:  cellData };

			cellData.view = _.isset( col.view )
				? col.view
				: this.columnCommonView;

			cellData.columnId = this._getColId(col);

			cells.add( cellData );

		}, this);

		row.set("cells", cells);

		return row;
	},

	// Todo: separate data creation and rendering
    _renderHeader: function(){
        var $thead = $("<thead>");

        if(this.sortable){
            $thead.addClass("sortable");
        }

        // Prepend Columnheader if columnLabelCallback is defined
        if( _.isset( this.columnLabelCallback ) ){


            if(_.isset( this.tableCustomColumnPreHeader )){
                $thead.append( _.isFunction(this.tableCustomColumnPreHeader)
                    ? this.tableCustomColumnPreHeader.call(this.context)
                    : this.tableCustomColumnPreHeader
                );
            }

            var $tr = $("<tr>");

            // First cell over rowLabels
            if(_.isset( this.rowLabelCallback )){
                $tr.append( _.isset(this.rowLabelLabel)
                    ? this.rowLabelLabel
                    : "<th></th>"
                );
            }

            this.columns.each(function(col){
                var $th = $("<th>");
                $th.addClass("col_header");

                if(this.sortable){
                    var $sortIndicator = $("<div>").addClass("sortIndicator");

                    if(this.sortByColId === this._getColId(col)){
                        $sortIndicator.addClass(
                            this.reverseSorting
                                ? "descending"
                                : "ascending"
                        );
                    }else{
                        $sortIndicator.addClass("unsorted");
                    }

                    $th.append($sortIndicator);
                }

                $th.data(
                    "columnId",
                    this._getColId(col)
                );

                if(col !== ""){
                    $th.append( this.columnLabelCallback.call(this.context, col) );
                }

                $tr.append($th);
            }, this);

            $thead.append($tr);

            if(_.isset(this.tableCustomColumnPostHeader)){
                $thead.append( _.isFunction(this.tableCustomColumnPostHeader)
                    ? this.tableCustomColumnPostHeader.call(this.context)
                    : this.tableCustomColumnPostHeader
                );
            }


        }
        return $thead;
    },

	// TODO: Wrapping in Subview
	_renderBody: function(bodyData){
		var $tbody = $("<tbody>");

		if(_.isset(this.sortByColId)){
			bodyData = this._sortByColId( bodyData );
		}

		bodyData.each(function(singleRowData, rowKey){
			var $tr = $("<tr>");
			if(_.isset(this.rowLabelCallback)){
				var rowLabel = this.rowLabelCallback.call(this.context, singleRowData, rowKey, this);
				$tr.append( $("<th>").append( rowLabel ) );
			}

			singleRowData.get("cells").each(function(singleCellData){
				var $td = $("<td>");

				var view = singleCellData.get("view");
				var viewData = {
					data: singleCellData.get("data"),
					model: singleCellData.get("model")
				};

				var renderedView =this.appendSubview(
					view,
					viewData,
					$td
				);
				// $td.append( new view(viewData).render().$el );
				$tr.append($td);
			}, this);

			$tbody.append($tr);
		}, this);

		return $tbody;
	},

	render: function(){
		var rowData = this._generateRowData();

		var $table = $("<table>");

		if(_.isset(this.colgroupDefintion)){
			$table.append(this.colgroupDefintion);
		}

		// Header
		var $header = this._renderHeader();
		$table.append($header);


		// Body
		var $body = this._renderBody( rowData );
		$table.append($body);


		this.reSetElement( $table );

		return this;
	},

	_handleSortClick: function(event){
		if(!this.sortable){
			return false;
		}

		var $target = $(event.target);

		var columnId = $target.prop("tagName") === "TH"
			? $target.data("columnId")
			: $target.parents("th").data("columnId");

		if(this.sortByColId === columnId){
			this.reverseSorting = !this.reverseSorting;
		}else{
			this.sortByColId = columnId;
			this.reverseSorting = false;
		}

		this.render();

	}


});


